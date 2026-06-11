@preconcurrency import AVFoundation
import AudioToolbox
import CoreAudio
import CoreMedia
import Foundation
@preconcurrency import ScreenCaptureKit

enum ProbeError: Error, CustomStringConvertible {
    case invalidArguments(String)
    case microphonePermissionDenied
    case noDisplayAvailable
    case noCaptureSourceSelected
    case failedToCreateAudioFormat
    case failedToCreatePCMBuffer

    var description: String {
        switch self {
        case .invalidArguments(let message):
            return message
        case .microphonePermissionDenied:
            return "Microphone permission was denied."
        case .noDisplayAvailable:
            return "No display is available for ScreenCaptureKit capture."
        case .noCaptureSourceSelected:
            return "Choose at least one source: --mic or --system."
        case .failedToCreateAudioFormat:
            return "Failed to create a target PCM audio format."
        case .failedToCreatePCMBuffer:
            return "Failed to create an audio PCM buffer."
        }
    }
}

struct CaptureOptions {
    var seconds: Double = 10
    var captureMicrophone = false
    var captureSystemAudio = false
    var outputDirectory = URL(fileURLWithPath: "../captures")
}

struct Counters {
    var buffers: Int = 0
    var frames: Int64 = 0
    var bytes: Int64 = 0
    var lastRMS: Float = 0
    var peakRMS: Float = 0
}

final class LockedCounters: @unchecked Sendable {
    private let lock = NSLock()
    private var counters = Counters()

    func add(frames: Int64, bytes: Int, rms: Float) {
        lock.lock()
        counters.buffers += 1
        counters.frames += frames
        counters.bytes += Int64(bytes)
        counters.lastRMS = rms
        counters.peakRMS = max(counters.peakRMS, rms)
        lock.unlock()
    }

    func snapshot() -> Counters {
        lock.lock()
        let copy = counters
        lock.unlock()
        return copy
    }
}

final class ConverterInputState: @unchecked Sendable {
    var didProvideInput = false
}

final class PermissionState: @unchecked Sendable {
    private let lock = NSLock()
    private var value = false

    func set(_ granted: Bool) {
        lock.lock()
        value = granted
        lock.unlock()
    }

    func get() -> Bool {
        lock.lock()
        let current = value
        lock.unlock()
        return current
    }
}

final class PCM16Normalizer {
    private let targetFormat: AVAudioFormat
    private var converters: [String: AVAudioConverter] = [:]

    init() throws {
        guard let format = AVAudioFormat(
            commonFormat: .pcmFormatInt16,
            sampleRate: 16_000,
            channels: 1,
            interleaved: true
        ) else {
            throw ProbeError.failedToCreateAudioFormat
        }
        self.targetFormat = format
    }

    func convert(_ buffer: AVAudioPCMBuffer) -> Data {
        let sourceFormat = buffer.format
        let key = "\(sourceFormat.sampleRate)-\(sourceFormat.channelCount)-\(sourceFormat.commonFormat.rawValue)-\(sourceFormat.isInterleaved)"
        let converter: AVAudioConverter

        if let existing = converters[key] {
            converter = existing
        } else if let created = AVAudioConverter(from: sourceFormat, to: targetFormat) {
            converters[key] = created
            converter = created
        } else {
            return Data()
        }

        let ratio = targetFormat.sampleRate / sourceFormat.sampleRate
        let capacity = max(1, AVAudioFrameCount(Double(buffer.frameLength) * ratio) + 1024)
        guard let output = AVAudioPCMBuffer(pcmFormat: targetFormat, frameCapacity: capacity) else {
            return Data()
        }

        let inputState = ConverterInputState()
        var error: NSError?

        converter.convert(to: output, error: &error) { _, status in
            if inputState.didProvideInput {
                status.pointee = .noDataNow
                return nil
            }
            inputState.didProvideInput = true
            status.pointee = .haveData
            return buffer
        }

        guard error == nil else {
            return Data()
        }

        let audioBuffer = output.audioBufferList.pointee.mBuffers
        guard let dataPointer = audioBuffer.mData else {
            return Data()
        }

        return Data(bytes: dataPointer, count: Int(audioBuffer.mDataByteSize))
    }
}

final class PCMFileSink: @unchecked Sendable {
    let url: URL
    let counters = LockedCounters()
    private let handle: FileHandle
    private let queue: DispatchQueue

    init(url: URL, label: String) throws {
        self.url = url
        self.queue = DispatchQueue(label: "meeting-audio-probe.\(label)")
        FileManager.default.createFile(atPath: url.path, contents: nil)
        self.handle = try FileHandle(forWritingTo: url)
    }

    func write(_ data: Data, frames: Int64, rms: Float) {
        guard !data.isEmpty else {
            return
        }

        queue.async { [handle, counters] in
            do {
                try handle.write(contentsOf: data)
                counters.add(frames: frames, bytes: data.count, rms: rms)
            } catch {
                fputs("Failed to write PCM data: \(error)\n", stderr)
            }
        }
    }

    func close() {
        queue.sync {
            do {
                try handle.close()
            } catch {
                fputs("Failed to close PCM file: \(error)\n", stderr)
            }
        }
    }
}

final class MicrophoneCapture {
    private let engine = AVAudioEngine()
    private let normalizer: PCM16Normalizer
    private let sink: PCMFileSink

    init(normalizer: PCM16Normalizer, sink: PCMFileSink) {
        self.normalizer = normalizer
        self.sink = sink
    }

    func start() throws {
        let granted = requestMicrophonePermission()
        guard granted else {
            throw ProbeError.microphonePermissionDenied
        }

        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)

        input.installTap(onBus: 0, bufferSize: 4096, format: format) { [normalizer, sink] buffer, _ in
            let data = normalizer.convert(buffer)
            let rms = rmsFromFloatBuffer(buffer)
            sink.write(data, frames: Int64(buffer.frameLength), rms: rms)
        }

        engine.prepare()
        try engine.start()
    }

    func stop() {
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
    }

    private func requestMicrophonePermission() -> Bool {
        let semaphore = DispatchSemaphore(value: 0)
        let state = PermissionState()

        AVCaptureDevice.requestAccess(for: .audio) { granted in
            state.set(granted)
            semaphore.signal()
        }

        _ = semaphore.wait(timeout: .now() + 30)
        return state.get()
    }
}

final class SystemAudioCapture: NSObject, SCStreamOutput, SCStreamDelegate {
    private let normalizer: PCM16Normalizer
    private let sink: PCMFileSink
    private let outputQueue = DispatchQueue(label: "meeting-audio-probe.system-output")
    private var stream: SCStream?

    init(normalizer: PCM16Normalizer, sink: PCMFileSink) {
        self.normalizer = normalizer
        self.sink = sink
    }

    func start() async throws {
        let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
        guard let display = content.displays.first else {
            throw ProbeError.noDisplayAvailable
        }

        let filter = SCContentFilter(display: display, excludingWindows: [])
        let config = SCStreamConfiguration()
        config.capturesAudio = true
        config.excludesCurrentProcessAudio = true
        config.width = 2
        config.height = 2
        config.minimumFrameInterval = CMTime(value: 1, timescale: 1)
        config.queueDepth = 3

        let stream = SCStream(filter: filter, configuration: config, delegate: self)
        try stream.addStreamOutput(self, type: .audio, sampleHandlerQueue: outputQueue)
        try await stream.startCapture()
        self.stream = stream
    }

    func stop() async {
        guard let stream else {
            return
        }

        do {
            try await stream.stopCapture()
        } catch {
            fputs("Failed to stop system audio capture: \(error)\n", stderr)
        }
    }

    func stream(
        _ stream: SCStream,
        didOutputSampleBuffer sampleBuffer: CMSampleBuffer,
        of type: SCStreamOutputType
    ) {
        guard type == .audio, sampleBuffer.isValid, CMSampleBufferDataIsReady(sampleBuffer) else {
            return
        }

        guard let buffer = pcmBuffer(from: sampleBuffer) else {
            return
        }

        let data = normalizer.convert(buffer)
        let rms = rmsFromFloatBuffer(buffer)
        sink.write(data, frames: Int64(buffer.frameLength), rms: rms)
    }

    func stream(_ stream: SCStream, didStopWithError error: Error) {
        fputs("System audio stream stopped with error: \(error)\n", stderr)
    }

    private func pcmBuffer(from sampleBuffer: CMSampleBuffer) -> AVAudioPCMBuffer? {
        guard let formatDescription = CMSampleBufferGetFormatDescription(sampleBuffer) else {
            return nil
        }

        let sourceFormat = AVAudioFormat(cmAudioFormatDescription: formatDescription)
        let frameCount = AVAudioFrameCount(CMSampleBufferGetNumSamples(sampleBuffer))
        guard let pcmBuffer = AVAudioPCMBuffer(pcmFormat: sourceFormat, frameCapacity: frameCount) else {
            return nil
        }

        pcmBuffer.frameLength = frameCount
        let status = CMSampleBufferCopyPCMDataIntoAudioBufferList(
            sampleBuffer,
            at: 0,
            frameCount: Int32(frameCount),
            into: pcmBuffer.mutableAudioBufferList
        )

        guard status == noErr else {
            return nil
        }

        return pcmBuffer
    }
}

@main
struct MeetingAudioProbe {
    static func main() async {
        do {
            let args = Array(CommandLine.arguments.dropFirst())
            guard let command = args.first else {
                printUsage()
                return
            }

            switch command {
            case "diagnose":
                try await diagnose()
            case "capture":
                let options = try parseCaptureOptions(Array(args.dropFirst()))
                try await capture(options: options)
            default:
                throw ProbeError.invalidArguments("Unknown command: \(command)")
            }
        } catch {
            fputs("Error: \(error)\n\n", stderr)
            printUsage()
            Foundation.exit(1)
        }
    }

    private static func diagnose() async throws {
        let processInfo = ProcessInfo.processInfo
        print("macOS: \(processInfo.operatingSystemVersionString)")
        print("arch: \(machineArchitecture())")
        print("host: \(Host.current().localizedName ?? "unknown")")
        print("")
        print("Audio devices:")
        for device in listAudioDevices() {
            print("- \(device)")
        }

        print("")
        print("ScreenCaptureKit:")
        do {
            let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
            print("- displays: \(content.displays.count)")
            print("- windows: \(content.windows.count)")
            for app in content.applications.prefix(20) {
                print("- app: \(app.applicationName) [pid=\(app.processID)]")
            }
        } catch {
            print("- unavailable: \(error)")
        }
    }

    private static func capture(options: CaptureOptions) async throws {
        guard options.captureMicrophone || options.captureSystemAudio else {
            throw ProbeError.noCaptureSourceSelected
        }

        try FileManager.default.createDirectory(
            at: options.outputDirectory,
            withIntermediateDirectories: true
        )

        let normalizer = try PCM16Normalizer()
        var micCapture: MicrophoneCapture?
        var systemCapture: SystemAudioCapture?
        var sinks: [(String, PCMFileSink)] = []

        if options.captureMicrophone {
            let sink = try PCMFileSink(
                url: options.outputDirectory.appendingPathComponent("microphone-16000-mono-s16le.pcm"),
                label: "microphone"
            )
            let capture = MicrophoneCapture(normalizer: normalizer, sink: sink)
            try capture.start()
            micCapture = capture
            sinks.append(("microphone", sink))
            print("microphone capture started -> \(sink.url.path)")
        }

        if options.captureSystemAudio {
            let sink = try PCMFileSink(
                url: options.outputDirectory.appendingPathComponent("system-16000-mono-s16le.pcm"),
                label: "system"
            )
            let capture = SystemAudioCapture(normalizer: normalizer, sink: sink)
            try await capture.start()
            systemCapture = capture
            sinks.append(("system", sink))
            print("system audio capture started -> \(sink.url.path)")
        }

        let endTime = Date().addingTimeInterval(options.seconds)
        while Date() < endTime {
            try await Task.sleep(nanoseconds: 1_000_000_000)
            printSnapshots(sinks)
        }

        micCapture?.stop()
        await systemCapture?.stop()

        for (_, sink) in sinks {
            sink.close()
        }

        print("")
        print("final:")
        printSnapshots(sinks)
    }

    private static func parseCaptureOptions(_ args: [String]) throws -> CaptureOptions {
        var options = CaptureOptions()
        var index = 0

        while index < args.count {
            let arg = args[index]
            switch arg {
            case "--seconds":
                index += 1
                guard index < args.count, let seconds = Double(args[index]), seconds > 0 else {
                    throw ProbeError.invalidArguments("--seconds requires a positive number.")
                }
                options.seconds = seconds
            case "--mic":
                options.captureMicrophone = true
            case "--system":
                options.captureSystemAudio = true
            case "--out":
                index += 1
                guard index < args.count else {
                    throw ProbeError.invalidArguments("--out requires a directory path.")
                }
                options.outputDirectory = URL(fileURLWithPath: args[index])
            default:
                throw ProbeError.invalidArguments("Unknown capture option: \(arg)")
            }
            index += 1
        }

        return options
    }

    private static func printSnapshots(_ sinks: [(String, PCMFileSink)]) {
        for (label, sink) in sinks {
            let stats = sink.counters.snapshot()
            print(
                "\(label): buffers=\(stats.buffers) frames=\(stats.frames) bytes=\(stats.bytes) " +
                "lastRMS=\(String(format: "%.5f", stats.lastRMS)) peakRMS=\(String(format: "%.5f", stats.peakRMS))"
            )
        }
    }

    private static func printUsage() {
        print(
            """
            Usage:
              MeetingAudioProbe diagnose
              MeetingAudioProbe capture --seconds 10 --mic --system --out ../captures

            Output format:
              16 kHz mono signed 16-bit little-endian PCM
            """
        )
    }
}

private func rmsFromFloatBuffer(_ buffer: AVAudioPCMBuffer) -> Float {
    guard let channelData = buffer.floatChannelData else {
        return 0
    }

    let channelCount = Int(buffer.format.channelCount)
    let frameLength = Int(buffer.frameLength)
    guard channelCount > 0, frameLength > 0 else {
        return 0
    }

    var sum: Float = 0
    for channel in 0..<channelCount {
        let samples = channelData[channel]
        for frame in 0..<frameLength {
            let sample = samples[frame]
            sum += sample * sample
        }
    }

    return sqrt(sum / Float(channelCount * frameLength))
}

private func listAudioDevices() -> [String] {
    var address = AudioObjectPropertyAddress(
        mSelector: kAudioHardwarePropertyDevices,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain
    )

    var dataSize: UInt32 = 0
    var status = AudioObjectGetPropertyDataSize(
        AudioObjectID(kAudioObjectSystemObject),
        &address,
        0,
        nil,
        &dataSize
    )

    guard status == noErr else {
        return ["failed to read device list: \(status)"]
    }

    let deviceCount = Int(dataSize) / MemoryLayout<AudioDeviceID>.size
    var deviceIDs = [AudioDeviceID](repeating: 0, count: deviceCount)

    status = AudioObjectGetPropertyData(
        AudioObjectID(kAudioObjectSystemObject),
        &address,
        0,
        nil,
        &dataSize,
        &deviceIDs
    )

    guard status == noErr else {
        return ["failed to read device ids: \(status)"]
    }

    return deviceIDs.map { deviceID in
        let name = audioDeviceName(deviceID)
        let inputChannels = channelCount(deviceID, scope: kAudioDevicePropertyScopeInput)
        let outputChannels = channelCount(deviceID, scope: kAudioDevicePropertyScopeOutput)
        return "\(name) [id=\(deviceID), input=\(inputChannels), output=\(outputChannels)]"
    }
}

private func audioDeviceName(_ deviceID: AudioDeviceID) -> String {
    var address = AudioObjectPropertyAddress(
        mSelector: kAudioObjectPropertyName,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain
    )

    var name: CFString?
    var dataSize = UInt32(MemoryLayout<CFString?>.size)
    let status = withUnsafeMutablePointer(to: &name) { pointer in
        AudioObjectGetPropertyData(deviceID, &address, 0, nil, &dataSize, pointer)
    }
    guard status == noErr else {
        return "Unknown"
    }

    return (name as String?) ?? "Unknown"
}

private func channelCount(_ deviceID: AudioDeviceID, scope: AudioObjectPropertyScope) -> Int {
    var address = AudioObjectPropertyAddress(
        mSelector: kAudioDevicePropertyStreamConfiguration,
        mScope: scope,
        mElement: kAudioObjectPropertyElementMain
    )

    var dataSize: UInt32 = 0
    let sizeStatus = AudioObjectGetPropertyDataSize(deviceID, &address, 0, nil, &dataSize)
    guard sizeStatus == noErr, dataSize > 0 else {
        return 0
    }

    let rawPointer = UnsafeMutableRawPointer.allocate(
        byteCount: Int(dataSize),
        alignment: MemoryLayout<AudioBufferList>.alignment
    )
    let audioBufferList = rawPointer.bindMemory(to: AudioBufferList.self, capacity: 1)
    let bufferListPointer = UnsafeMutableAudioBufferListPointer(audioBufferList)
    defer {
        rawPointer.deallocate()
    }

    let dataStatus = AudioObjectGetPropertyData(
        deviceID,
        &address,
        0,
        nil,
        &dataSize,
        audioBufferList
    )
    guard dataStatus == noErr else {
        return 0
    }

    return bufferListPointer.reduce(0) { partial, buffer in
        partial + Int(buffer.mNumberChannels)
    }
}

private func machineArchitecture() -> String {
    var systemInfo = utsname()
    uname(&systemInfo)
    let mirror = Mirror(reflecting: systemInfo.machine)
    let identifier = mirror.children.reduce("") { partial, element in
        guard let value = element.value as? Int8, value != 0 else {
            return partial
        }
        return partial + String(UnicodeScalar(UInt8(value)))
    }
    return identifier
}
