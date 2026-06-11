# macOS Meeting Insight Assistant P0

This directory is an isolated prototype for a macOS morning-reading observer cockpit. It does not depend on the Morning Reading Club miniprogram, backend, admin app, or database.

## Observer Cockpit MVP

Run the UI:

```bash
cd meeting-assistant
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:5173/
```

The MVP supports:

- seven-habits theme selection.
- multiple speaker cards.
- multiple pasted snippets per speaker.
- image upload snippets for screenshots or meeting transcript captures.
- clipboard paste into the current speaker.
- global `Cmd+Shift+V` clipboard paste in the Electron desktop app.
- single-speaker structured insight and response output.
- whole-session synthesis.
- actual response notes and Markdown review export.
- local fallback drafts when no AI API Key is configured.

To use real AI output, open Settings in the app and choose a model service:

- `OpenAI Responses`: add an OpenAI API Key and model such as `gpt-4.1-mini`.
- `小米 MiMo`: add a Xiaomi API Key. For `tp-` Token Plan keys, the app uses `https://token-plan-cn.xiaomimimo.com/v1` and `mimo-v2.5-pro` by default. For `sk-` pay-as-you-go keys, change Base URL to `https://api.xiaomimimo.com/v1`.
- `OpenAI 兼容接口`: use any provider that supports `/chat/completions`, then fill Base URL, API Key, and model.

If no key is configured, the app continues to generate local practice drafts.

The local browser preview at `http://127.0.0.1:5173/` also supports AI settings through local `/api/*` endpoints. Private keys are stored under `.local/`, which is gitignored.

Image analysis depends on the selected model supporting visual input. If a provider rejects images, use screenshot OCR first and paste the extracted text as a normal snippet.

## What P0 Verifies

- Observer cockpit workflow: paste -> speaker insight -> response -> whole-session synthesis.
- Optional future audio input: microphone/system audio capture and Tencent Cloud realtime ASR client wiring.

## Directory

```text
meeting-assistant/
├── src/                    # React observer cockpit UI
├── electron/               # Electron shell and OpenAI IPC bridge
├── swift-audio-probe/     # macOS native audio probe
├── asr/                   # Realtime ASR client scripts
├── docs/                  # P0 runbook and notes
└── captures/              # Local output only, gitignored
```

## Optional Audio Probe

1. Run diagnostics:

```bash
cd meeting-assistant/swift-audio-probe
swift run MeetingAudioProbe diagnose
```

2. Capture microphone and system audio for 10 seconds:

```bash
swift run MeetingAudioProbe capture --seconds 10 --mic --system --out ../captures
```

3. Send a PCM file to Tencent Cloud ASR:

```bash
cd ..
TENCENT_ASR_APP_ID=... \
TENCENT_ASR_SECRET_ID=... \
TENCENT_ASR_SECRET_KEY=... \
node asr/tencent-realtime-asr.mjs --file captures/microphone-16000-mono-s16le.pcm
```

The first capture run may trigger macOS permission prompts. The app needs microphone permission for mic capture and screen/audio capture permission for ScreenCaptureKit system audio.
