import react from '@vitejs/plugin-react';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { defineConfig } from 'vite';

const execFileAsync = promisify(execFile);
const DEFAULT_AI_REQUEST_TIMEOUT_MS = 120000;

const providerDefaults = {
  openai_responses: {
    label: 'OpenAI Responses',
    baseUrl: '',
    model: 'gpt-4.1-mini',
  },
  xiaomi_mimo: {
    label: '小米 MiMo Token Plan',
    baseUrl: 'https://token-plan-cn.xiaomimimo.com/v1',
    model: 'mimo-v2.5-pro',
  },
  openai_compatible: {
    label: 'OpenAI 兼容接口',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4.1-mini',
  },
} as const;

type AIProvider = keyof typeof providerDefaults;
type LocalSettings = {
  provider?: AIProvider;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
};

type PromptImage = {
  dataUrl?: string;
  fileName?: string;
};

type PromptPayload = {
  instructions: string;
  input: string;
  schema: { name?: string; schema: unknown };
  images?: PromptImage[];
};

function localSettingsPath() {
  return path.join(process.cwd(), '.local', 'settings.json');
}

function normalizeProvider(provider: unknown): AIProvider {
  return typeof provider === 'string' && provider in providerDefaults ? (provider as AIProvider) : 'openai_responses';
}

function defaultSettings(): Required<LocalSettings> {
  const provider = normalizeProvider(process.env.OBSERVER_AI_PROVIDER || process.env.AI_PROVIDER);
  return {
    provider,
    apiKey: process.env.XIAOMI_API_KEY || process.env.MIMO_API_KEY || process.env.OPENAI_API_KEY || process.env.AI_API_KEY || '',
    baseUrl: providerDefaults[provider].baseUrl,
    model:
      process.env.XIAOMI_MODEL ||
      process.env.MIMO_MODEL ||
      process.env.OPENAI_MODEL ||
      process.env.AI_MODEL ||
      providerDefaults[provider].model,
  };
}

function normalizeSettings(settings: LocalSettings): Required<LocalSettings> {
  const provider = normalizeProvider(settings.provider);
  return {
    provider,
    apiKey: typeof settings.apiKey === 'string' ? settings.apiKey : '',
    baseUrl: provider === 'openai_responses' ? '' : String(settings.baseUrl || providerDefaults[provider].baseUrl).trim(),
    model: String(settings.model || providerDefaults[provider].model).trim(),
  };
}

function readSettings() {
  const fallback = defaultSettings();
  try {
    const raw = JSON.parse(fs.readFileSync(localSettingsPath(), 'utf8')) as LocalSettings;
    return normalizeSettings({ ...fallback, ...raw });
  } catch {
    return normalizeSettings(fallback);
  }
}

function writeSettings(settings: LocalSettings & { apiKey?: string }) {
  const current = readSettings();
  const provider = normalizeProvider(settings.provider || current.provider);
  const next = normalizeSettings({
    provider,
    apiKey: settings.apiKey === '__KEEP__' ? current.apiKey : String(settings.apiKey || '').trim(),
    baseUrl: provider === 'openai_responses' ? '' : String(settings.baseUrl || providerDefaults[provider].baseUrl).trim(),
    model: String(settings.model || providerDefaults[provider].model).trim(),
  });
  fs.mkdirSync(path.dirname(localSettingsPath()), { recursive: true });
  fs.writeFileSync(localSettingsPath(), JSON.stringify(next, null, 2));
  return publicSettings(next);
}

function publicSettings(settings: Required<LocalSettings>) {
  return {
    provider: settings.provider,
    apiKey: settings.apiKey ? '********' : '',
    hasApiKey: Boolean(settings.apiKey),
    baseUrl: settings.baseUrl,
    model: settings.model,
  };
}

function readBody(req: { on: (event: string, listener: (chunk?: Buffer) => void) => void }) {
  return new Promise<unknown>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => {
      if (chunk) {
        chunks.push(chunk);
      }
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: { statusCode: number; setHeader: (key: string, value: string) => void; end: (body: string) => void }, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function decodeDataUrl(dataUrl: string) {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl || '');
  if (!match) {
    throw new Error('图片数据格式不正确。');
  }
  const mimeType = match[1];
  const extension = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
  return {
    buffer: Buffer.from(match[2], 'base64'),
    extension,
  };
}

async function extractDocumentText(fileName: string, dataUrl: string) {
  const { buffer } = decodeDataUrl(dataUrl);
  const extension = path.extname(fileName || '').toLowerCase();
  if (extension !== '.docx') {
    return buffer.toString('utf8');
  }

  const tempPath = path.join(os.tmpdir(), `meeting-assistant-doc-${Date.now()}-${Math.random().toString(16).slice(2)}.docx`);
  fs.writeFileSync(tempPath, buffer);
  try {
    const script = [
      'import sys, zipfile, re, xml.etree.ElementTree as ET',
      'path=sys.argv[1]',
      'with zipfile.ZipFile(path) as z:',
      '    xml=z.read("word/document.xml")',
      'root=ET.fromstring(xml)',
      'ns={"w":"http://schemas.openxmlformats.org/wordprocessingml/2006/main"}',
      'paras=[]',
      'for p in root.findall(".//w:p", ns):',
      '    texts=[t.text or "" for t in p.findall(".//w:t", ns)]',
      '    line="".join(texts).strip()',
      '    if line: paras.append(line)',
      'print("\\n".join(paras))',
    ].join('\n');
    const { stdout } = await execFileAsync('/usr/bin/python3', ['-c', script, tempPath], {
      timeout: 20000,
      maxBuffer: 3 * 1024 * 1024,
    });
    return stdout.trim();
  } finally {
    fs.rmSync(tempPath, { force: true });
  }
}

async function recognizeImageText(imageDataUrl: string) {
  const { buffer, extension } = decodeDataUrl(imageDataUrl);
  const tempPath = path.join(os.tmpdir(), `meeting-assistant-ocr-${Date.now()}-${Math.random().toString(16).slice(2)}.${extension}`);
  fs.writeFileSync(tempPath, buffer);
  try {
    const scriptPath = path.join(process.cwd(), 'scripts', 'ocr-image.swift');
    const { stdout } = await execFileAsync('/usr/bin/swift', [scriptPath, tempPath], {
      timeout: 20000,
      maxBuffer: 1024 * 1024,
    });
    return stdout.trim();
  } finally {
    fs.rmSync(tempPath, { force: true });
  }
}

function cleanJsonText(text: string) {
  return String(text || '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function extractJsonCandidate(text: string, preferFullTail = false) {
  const objectStart = text.indexOf('{');
  const arrayStart = text.indexOf('[');
  const starts = [objectStart, arrayStart].filter((index) => index >= 0);
  if (starts.length === 0) {
    return text;
  }
  const start = Math.min(...starts);
  if (preferFullTail) {
    return text.slice(start).trim();
  }
  const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
  return end > start ? text.slice(start, end + 1).trim() : text.slice(start).trim();
}

function closeUnbalancedJson(text: string) {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (const char of text) {
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === '{') {
      stack.push('}');
    } else if (char === '[') {
      stack.push(']');
    } else if ((char === '}' || char === ']') && stack[stack.length - 1] === char) {
      stack.pop();
    }
  }

  const suffix = `${inString ? '"' : ''}${stack.reverse().join('')}`;
  return suffix ? `${text}${suffix}` : text;
}

function repairJsonText(text: string) {
  let repaired = text
    .replace(/\u0000/g, '')
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/}\s*(?={\s*")/g, '},{')
    .replace(/]\s*(?={\s*")/g, '],{')
    .replace(
      /("(?:\\.|[^"\\])*"|[}\]]|-?\d+(?:\.\d+)?|true|false|null)\s+(?=("(?:\\.|[^"\\])*"\s*:)|[\{\[]|"(?:\\.|[^"\\])*")/g,
      '$1,'
    );
  repaired = closeUnbalancedJson(repaired);
  return repaired.replace(/,\s*([}\]])/g, '$1');
}

function parseJsonText(text: string) {
  const cleaned = cleanJsonText(text);
  const candidates = [
    cleaned,
    extractJsonCandidate(cleaned),
    extractJsonCandidate(cleaned, true),
  ];

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      try {
        return JSON.parse(repairJsonText(candidate));
      } catch {
        // Try the next candidate shape.
      }
    }
  }

  try {
    return JSON.parse(repairJsonText(cleaned));
  } catch (error) {
    throw new Error(error instanceof Error ? `模型返回的 JSON 无法修复：${error.message}` : '模型返回的内容不是可解析的 JSON。');
  }
}

function outputTokenLimit(schemaName?: string) {
  if (schemaName === 'transcript_organize') {
    return 12000;
  }
  if (schemaName === 'whole_session_summary') {
    return 10000;
  }
  if (schemaName === 'knowledge_entries') {
    return 8000;
  }
  return 6000;
}

function requestTimeoutMs(schemaName?: string) {
  if (schemaName === 'transcript_organize') {
    return 240000;
  }
  if (schemaName === 'whole_session_summary') {
    return 240000;
  }
  if (schemaName === 'knowledge_entries') {
    return 180000;
  }
  return DEFAULT_AI_REQUEST_TIMEOUT_MS;
}

function chatCompletionsUrl(baseUrl: string) {
  const normalized = String(baseUrl || '').trim().replace(/\/+$/, '');
  if (!normalized) {
    throw new Error('请填写 OpenAI 兼容接口的 Base URL。');
  }
  return normalized.endsWith('/chat/completions') ? normalized : `${normalized}/chat/completions`;
}

function normalizeMessageContent(content: unknown) {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (item && typeof item === 'object' && 'text' in item) {
          return String(item.text || '');
        }
        if (item && typeof item === 'object' && 'content' in item) {
          return String(item.content || '');
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

function buildUserContent(promptPayload: PromptPayload, includeImages: boolean) {
  const images = includeImages ? (promptPayload.images || []).filter((image) => image.dataUrl) : [];
  const text = `${promptPayload.input}\n\n请严格按下面 JSON Schema 输出：\n${JSON.stringify(promptPayload.schema.schema, null, 2)}`;
  if (images.length === 0) {
    return text;
  }

  return [
    { type: 'text', text },
    ...images.map((image) => ({
      type: 'image_url',
      image_url: {
        url: image.dataUrl,
        detail: 'high',
      },
    })),
  ];
}

async function createChatCompletion(promptPayload: PromptPayload) {
  const settings = readSettings();
  if (!settings.apiKey) {
    throw new Error(`请先在设置里填写 ${providerDefaults[settings.provider].label} API Key。`);
  }

  const body: Record<string, unknown> = {
    model: settings.model,
    messages: [
      {
        role: 'system',
        content: `${promptPayload.instructions}\n\n你必须只输出一个 JSON 对象，不要输出 Markdown，不要解释。`,
      },
      {
        role: 'user',
        content: buildUserContent(promptPayload, settings.provider !== 'xiaomi_mimo'),
      },
    ],
    temperature: 0.4,
    response_format: { type: 'json_object' },
  };

  const maxTokens = outputTokenLimit(promptPayload.schema.name);
  if (settings.provider === 'xiaomi_mimo') {
    body.max_completion_tokens = maxTokens;
  } else {
    body.max_tokens = maxTokens;
  }

  const headers =
    settings.provider === 'xiaomi_mimo'
      ? { 'api-key': settings.apiKey, 'Content-Type': 'application/json' }
      : { Authorization: `Bearer ${settings.apiKey}`, 'Content-Type': 'application/json' };

  async function post(payload: Record<string, unknown>, timeoutMs: number) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(chatCompletionsUrl(settings.baseUrl), {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const responsePayload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          responsePayload && typeof responsePayload === 'object' && 'error' in responsePayload
            ? (responsePayload.error as { message?: string })?.message
            : undefined;
        throw new Error(message || `${providerDefaults[settings.provider].label} 请求失败。`);
      }
      return responsePayload as { choices?: Array<{ message?: { content?: unknown } }> };
    } finally {
      clearTimeout(timer);
    }
  }

  let payload;
  const timeoutMs = requestTimeoutMs(promptPayload.schema.name);
  try {
    payload = await post(body, timeoutMs);
  } catch (error) {
    if (!String(error instanceof Error ? error.message : error).toLowerCase().includes('response_format')) {
      throw error;
    }
    const retryBody = { ...body };
    delete retryBody.response_format;
    payload = await post(retryBody, timeoutMs);
  }

  const text = normalizeMessageContent(payload.choices?.[0]?.message?.content);
  if (!text) {
    throw new Error(`${providerDefaults[settings.provider].label} 没有返回可解析文本。`);
  }
  return parseJsonText(text);
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'observer-local-api',
      configureServer(server) {
        server.middlewares.use('/api/settings', async (req, res) => {
          try {
            if (req.method === 'GET') {
              sendJson(res, 200, publicSettings(readSettings()));
              return;
            }
            if (req.method === 'POST') {
              sendJson(res, 200, writeSettings((await readBody(req)) as LocalSettings));
              return;
            }
            sendJson(res, 405, { error: 'Method Not Allowed' });
          } catch (error) {
            sendJson(res, 500, { error: error instanceof Error ? error.message : '设置接口失败。' });
          }
        });

        server.middlewares.use('/api/ocrImage', async (req, res) => {
          try {
            const body = (await readBody(req)) as { imageDataUrl?: string };
            sendJson(res, 200, { text: await recognizeImageText(body.imageDataUrl || '') });
          } catch (error) {
            sendJson(res, 500, { error: error instanceof Error ? error.message : '图片 OCR 失败。' });
          }
        });

        server.middlewares.use('/api/extractDocumentText', async (req, res) => {
          try {
            const body = (await readBody(req)) as { fileName?: string; dataUrl?: string };
            sendJson(res, 200, { text: await extractDocumentText(body.fileName || '', body.dataUrl || '') });
          } catch (error) {
            sendJson(res, 500, { error: error instanceof Error ? error.message : '文档提取失败。' });
          }
        });

        server.middlewares.use('/api/analyzeSpeaker', async (req, res) => {
          try {
            sendJson(res, 200, await createChatCompletion((await readBody(req)) as PromptPayload));
          } catch (error) {
            sendJson(res, 500, { error: error instanceof Error ? error.message : 'AI 请求失败。' });
          }
        });

        server.middlewares.use('/api/polishSpeakerContent', async (req, res) => {
          try {
            sendJson(res, 200, await createChatCompletion((await readBody(req)) as PromptPayload));
          } catch (error) {
            sendJson(res, 500, { error: error instanceof Error ? error.message : '发言内容整理失败。' });
          }
        });

        server.middlewares.use('/api/organizeTranscript', async (req, res) => {
          try {
            sendJson(res, 200, await createChatCompletion((await readBody(req)) as PromptPayload));
          } catch (error) {
            sendJson(res, 500, { error: error instanceof Error ? error.message : '整场脚本梳理失败。' });
          }
        });

        server.middlewares.use('/api/summarizeSession', async (req, res) => {
          try {
            sendJson(res, 200, await createChatCompletion((await readBody(req)) as PromptPayload));
          } catch (error) {
            sendJson(res, 500, { error: error instanceof Error ? error.message : 'AI 请求失败。' });
          }
        });

        server.middlewares.use('/api/extractKnowledge', async (req, res) => {
          try {
            sendJson(res, 200, await createChatCompletion((await readBody(req)) as PromptPayload));
          } catch (error) {
            sendJson(res, 500, { error: error instanceof Error ? error.message : '知识提炼失败。' });
          }
        });
      },
    },
  ],
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
