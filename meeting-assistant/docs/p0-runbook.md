# P0 Runbook

## Goal

Verify the smallest useful chain:

```text
Mac meeting audio + microphone -> PCM 16 kHz mono -> realtime ASR -> transcript segments
```

## Constraints

- Do not connect to the Morning Reading Club production database.
- Do not run database init/reset scripts.
- Do not commit captured audio, transcript content, API keys, or `.env` files.
- Keep P0 as an isolated prototype until the audio and ASR chain is proven.

## Step 1: Diagnostics

```bash
cd meeting-assistant/swift-audio-probe
swift run MeetingAudioProbe diagnose
```

Expected output:

- macOS version and architecture.
- available audio input/output devices.
- display/window availability for ScreenCaptureKit.

## Step 2: Capture Probe

Join or start a meeting, then run:

```bash
swift run MeetingAudioProbe capture --seconds 15 --mic --system --out ../captures
```

Expected output:

- microphone buffer count and byte count increase when you speak.
- system buffer count and byte count increase when remote meeting audio plays.
- output files:
  - `captures/microphone-16000-mono-s16le.pcm`
  - `captures/system-16000-mono-s16le.pcm`

If system audio does not produce buffers, grant Screen Recording permission to the Terminal or wrapper app and restart the shell.

## Step 3: ASR Smoke Test

Configure credentials through environment variables:

```bash
export TENCENT_ASR_APP_ID=...
export TENCENT_ASR_SECRET_ID=...
export TENCENT_ASR_SECRET_KEY=...
```

Run:

```bash
cd meeting-assistant
node asr/tencent-realtime-asr.mjs --file captures/microphone-16000-mono-s16le.pcm
```

Expected output:

- WebSocket connection opens.
- Partial/final JSON messages are printed.
- final messages are normalized into `TranscriptSegment`-like records.

## Step 4: Acceptance

P0 is accepted when:

- system audio and microphone can both be captured on the target Mac.
- both sources produce non-empty 16 kHz mono PCM files.
- at least one captured PCM file can be sent to ASR and return transcript text.
- stopping capture stops buffer and file writes.
