import crypto from 'node:crypto';
import fs from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

const DEFAULT_HOST = 'asr.cloud.tencent.com';
const DEFAULT_CHUNK_BYTES = 6400; // 200 ms for 16 kHz, 16-bit, mono PCM

function parseArgs(argv) {
  const args = {
    chunkBytes: DEFAULT_CHUNK_BYTES,
    dryRun: false,
    file: null,
    intervalMs: 200,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    switch (arg) {
      case '--file':
        index += 1;
        args.file = argv[index];
        break;
      case '--chunk-bytes':
        index += 1;
        args.chunkBytes = Number(argv[index]);
        break;
      case '--interval-ms':
        index += 1;
        args.intervalMs = Number(argv[index]);
        break;
      case '--dry-run':
        args.dryRun = true;
        break;
      case '--help':
        printUsage();
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!args.file) {
    throw new Error('Missing --file <pcm-file>.');
  }

  if (!Number.isFinite(args.chunkBytes) || args.chunkBytes <= 0) {
    throw new Error('--chunk-bytes must be a positive number.');
  }

  if (!Number.isFinite(args.intervalMs) || args.intervalMs <= 0) {
    throw new Error('--interval-ms must be a positive number.');
  }

  return args;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function buildTencentASRUrl() {
  const appId = requireEnv('TENCENT_ASR_APP_ID');
  const secretId = requireEnv('TENCENT_ASR_SECRET_ID');
  const secretKey = requireEnv('TENCENT_ASR_SECRET_KEY');
  const engineModelType = process.env.TENCENT_ASR_ENGINE_MODEL_TYPE || '16k_zh';
  const voiceFormat = process.env.TENCENT_ASR_VOICE_FORMAT || '1';
  const now = Math.floor(Date.now() / 1000);
  const params = {
    engine_model_type: engineModelType,
    expired: String(now + 24 * 60 * 60),
    filter_dirty: '0',
    filter_modal: '0',
    filter_punc: '0',
    needvad: '1',
    nonce: String(Math.floor(Math.random() * 1000000000)),
    secretid: secretId,
    timestamp: String(now),
    voice_format: voiceFormat,
    voice_id: crypto.randomUUID(),
    word_info: '1',
  };

  const query = Object.keys(params)
    .sort()
    .map((key) => `${key}=${encodeURIComponent(params[key])}`)
    .join('&');
  const signSource = `${DEFAULT_HOST}/asr/v2/${appId}?${query}`;
  const signature = crypto
    .createHmac('sha1', secretKey)
    .update(signSource)
    .digest('base64');
  const signedQuery = `${query}&signature=${encodeURIComponent(signature)}`;

  return {
    sanitizedUrl: `wss://${DEFAULT_HOST}/asr/v2/${appId}?${query}&signature=<redacted>`,
    url: `wss://${DEFAULT_HOST}/asr/v2/${appId}?${signedQuery}`,
    voiceId: params.voice_id,
  };
}

function normalizeTencentMessage(raw) {
  let message;
  try {
    message = JSON.parse(raw);
  } catch {
    return null;
  }

  const result = message.result || {};
  const text = result.voice_text_str || result.text || '';
  if (!text) {
    return { raw: message };
  }

  return {
    id: `asr-${result.slice_type ?? 'partial'}-${result.start_time ?? Date.now()}`,
    sourceId: 'uploaded_pcm',
    startMs: Number(result.start_time ?? 0),
    endMs: Number(result.end_time ?? 0),
    speakerHint: 'unknown',
    text,
    confidence: typeof result.confidence === 'number' ? result.confidence : undefined,
    isFinal: result.slice_type === 2 || result.final === 1,
    raw: message,
  };
}

async function sendPcmFile({ file, chunkBytes, intervalMs, dryRun }) {
  if (!fs.existsSync(file)) {
    throw new Error(`PCM file does not exist: ${file}`);
  }

  const stat = fs.statSync(file);
  if (stat.size === 0) {
    throw new Error(`PCM file is empty: ${file}`);
  }

  const { url, sanitizedUrl, voiceId } = buildTencentASRUrl();

  console.log(JSON.stringify({
    event: 'asr_url_ready',
    voiceId,
    bytes: stat.size,
    chunkBytes,
    intervalMs,
    url: sanitizedUrl,
  }));

  if (dryRun) {
    return;
  }

  if (typeof WebSocket === 'undefined') {
    throw new Error('Global WebSocket is unavailable. Use Node.js 22 or newer.');
  }

  const socket = new WebSocket(url);
  const stream = fs.createReadStream(file, { highWaterMark: chunkBytes });

  await new Promise((resolve, reject) => {
    socket.addEventListener('open', async () => {
      console.log(JSON.stringify({ event: 'websocket_open', voiceId }));

      try {
        for await (const chunk of stream) {
          socket.send(chunk);
          await delay(intervalMs);
        }

        socket.send(JSON.stringify({ type: 'end' }));
      } catch (error) {
        reject(error);
      }
    });

    socket.addEventListener('message', (event) => {
      const normalized = normalizeTencentMessage(String(event.data));
      console.log(JSON.stringify(normalized || { raw: String(event.data) }, null, 2));
    });

    socket.addEventListener('error', (event) => {
      reject(new Error(`WebSocket error: ${event.message || 'unknown error'}`));
    });

    socket.addEventListener('close', (event) => {
      console.log(JSON.stringify({
        event: 'websocket_close',
        code: event.code,
        reason: event.reason,
      }));
      resolve();
    });
  });
}

function printUsage() {
  console.log(`
Usage:
  node asr/tencent-realtime-asr.mjs --file captures/microphone-16000-mono-s16le.pcm

Options:
  --file <path>          16 kHz mono signed 16-bit little-endian PCM file
  --chunk-bytes <n>      bytes per send, default ${DEFAULT_CHUNK_BYTES}
  --interval-ms <n>      send interval, default 200
  --dry-run             build and validate the signed URL without connecting

Required env:
  TENCENT_ASR_APP_ID
  TENCENT_ASR_SECRET_ID
  TENCENT_ASR_SECRET_KEY

Optional env:
  TENCENT_ASR_ENGINE_MODEL_TYPE=16k_zh
  TENCENT_ASR_VOICE_FORMAT=1
`);
}

try {
  const args = parseArgs(process.argv.slice(2));
  await sendPcmFile(args);
} catch (error) {
  console.error(`Error: ${error.message}`);
  printUsage();
  process.exit(1);
}
