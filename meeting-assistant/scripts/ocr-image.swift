import Foundation
import Vision
import ImageIO

guard CommandLine.arguments.count >= 2 else {
  FileHandle.standardError.write(Data("Usage: ocr-image.swift <image-path>\n".utf8))
  exit(2)
}

let imageURL = URL(fileURLWithPath: CommandLine.arguments[1])
guard
  let imageSource = CGImageSourceCreateWithURL(imageURL as CFURL, nil),
  let cgImage = CGImageSourceCreateImageAtIndex(imageSource, 0, nil)
else {
  FileHandle.standardError.write(Data("Cannot read image.\n".utf8))
  exit(3)
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = true
request.recognitionLanguages = ["zh-Hans", "zh-Hant", "en-US"]

let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])

do {
  try handler.perform([request])
  let lines = (request.results ?? [])
    .compactMap { $0.topCandidates(1).first?.string.trimmingCharacters(in: .whitespacesAndNewlines) }
    .filter { !$0.isEmpty }
  print(lines.joined(separator: "\n"))
} catch {
  FileHandle.standardError.write(Data("OCR failed: \(error.localizedDescription)\n".utf8))
  exit(4)
}
