const { app, BrowserWindow, clipboard, globalShortcut, ipcMain } = require('electron');
const { execFile } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { promisify } = require('node:util');

const isDev = !app.isPackaged;
let mainWindow = null;
const execFileAsync = promisify(execFile);

function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

const PROVIDER_DEFAULTS = {
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
};

function normalizeProvider(provider) {
  return Object.hasOwn(PROVIDER_DEFAULTS, provider) ? provider : 'openai_responses';
}

function envDefaultProvider() {
  const configured = process.env.OBSERVER_AI_PROVIDER || process.env.AI_PROVIDER || process.env.LLM_PROVIDER;
  if (configured && Object.hasOwn(PROVIDER_DEFAULTS, configured)) {
    return configured;
  }
  if (process.env.XIAOMI_API_KEY || process.env.MIMO_API_KEY) {
    return 'xiaomi_mimo';
  }
  return 'openai_responses';
}

function envApiKey(provider) {
  if (provider === 'xiaomi_mimo') {
    return process.env.XIAOMI_API_KEY || process.env.MIMO_API_KEY || process.env.AI_API_KEY || '';
  }
  return process.env.OPENAI_API_KEY || process.env.AI_API_KEY || '';
}

function envModel(provider) {
  if (provider === 'xiaomi_mimo') {
    return process.env.XIAOMI_MODEL || process.env.MIMO_MODEL || process.env.AI_MODEL || PROVIDER_DEFAULTS.xiaomi_mimo.model;
  }
  return process.env.OPENAI_MODEL || process.env.AI_MODEL || PROVIDER_DEFAULTS[provider].model;
}

function defaultSettings() {
  const provider = envDefaultProvider();
  const defaults = PROVIDER_DEFAULTS[provider];
  return {
    provider,
    apiKey: envApiKey(provider),
    baseUrl: process.env.AI_BASE_URL || defaults.baseUrl,
    model: envModel(provider),
  };
}

function normalizeSettings(settings) {
  const provider = normalizeProvider(settings?.provider);
  const defaults = PROVIDER_DEFAULTS[provider];
  return {
    provider,
    apiKey: typeof settings?.apiKey === 'string' ? settings.apiKey : '',
    baseUrl: provider === 'openai_responses' ? '' : String(settings?.baseUrl || defaults.baseUrl).trim(),
    model: String(settings?.model || defaults.model).trim(),
  };
}

function publicSettings(settings) {
  const normalized = normalizeSettings(settings);
  return {
    provider: normalized.provider,
    apiKey: normalized.apiKey ? '********' : '',
    hasApiKey: Boolean(normalized.apiKey),
    baseUrl: normalized.baseUrl,
    model: normalized.model,
  };
}

function readSettings() {
  const fallback = defaultSettings();
  const file = settingsPath();
  if (!fs.existsSync(file)) {
    return normalizeSettings(fallback);
  }

  try {
    return normalizeSettings({ ...fallback, ...JSON.parse(fs.readFileSync(file, 'utf8')) });
  } catch {
    return normalizeSettings(fallback);
  }
}

function writeSettings(settings) {
  const current = readSettings();
  const provider = normalizeProvider(settings.provider || current.provider);
  const defaults = PROVIDER_DEFAULTS[provider];
  const next = normalizeSettings({
    provider,
    apiKey: settings.apiKey === '__KEEP__' ? current.apiKey : settings.apiKey,
    baseUrl: provider === 'openai_responses' ? '' : String(settings.baseUrl || defaults.baseUrl).trim(),
    model: settings.model || defaults.model,
  });
  const file = settingsPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(next, null, 2));
  return publicSettings(next);
}

function extractOutputText(response) {
  if (typeof response.output_text === 'string') {
    return response.output_text;
  }

  const chunks = [];
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && content.text) {
        chunks.push(content.text);
      }
    }
  }
  return chunks.join('\n');
}

function parseJsonText(text) {
  const cleaned = String(text || '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error('模型返回的内容不是可解析的 JSON。');
  }
}

function getPayloadError(payload, fallback) {
  return payload?.error?.message || payload?.message || payload?.detail || fallback;
}

function decodeDataUrl(dataUrl) {
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

async function recognizeImageText(imageDataUrl) {
  const { buffer, extension } = decodeDataUrl(imageDataUrl);
  const tempPath = path.join(os.tmpdir(), `meeting-assistant-ocr-${Date.now()}-${Math.random().toString(16).slice(2)}.${extension}`);
  fs.writeFileSync(tempPath, buffer);
  try {
    const scriptPath = path.join(__dirname, '../scripts/ocr-image.swift');
    const { stdout } = await execFileAsync('/usr/bin/swift', [scriptPath, tempPath], {
      timeout: 20000,
      maxBuffer: 1024 * 1024,
    });
    return stdout.trim();
  } finally {
    fs.rmSync(tempPath, { force: true });
  }
}

async function createOpenAIResponsesResult({ instructions, input, schema, images = [] }, settings) {
  const apiKey = settings.apiKey;
  const model = settings.model || PROVIDER_DEFAULTS.openai_responses.model;

  if (!apiKey) {
    throw new Error('请先在设置里填写 OpenAI API Key，或使用本地演练稿。');
  }

  const userContent = [
    { type: 'input_text', text: input },
    ...images
      .filter((image) => image.dataUrl)
      .map((image) => ({
        type: 'input_image',
        image_url: image.dataUrl,
        detail: 'high',
      })),
  ];

  const body = {
    model,
    input: [
      { role: 'system', content: instructions },
      { role: 'user', content: userContent },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: schema.name,
        schema: schema.schema,
        strict: true,
      },
    },
    max_output_tokens: 2200,
  };

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(getPayloadError(payload, 'OpenAI 请求失败。'));
  }

  const text = extractOutputText(payload);
  if (!text) {
    throw new Error('OpenAI 没有返回可解析文本。');
  }

  return parseJsonText(text);
}

function chatCompletionsUrl(baseUrl) {
  const normalized = String(baseUrl || '').trim().replace(/\/+$/, '');
  if (!normalized) {
    throw new Error('请填写 OpenAI 兼容接口的 Base URL。');
  }
  return normalized.endsWith('/chat/completions') ? normalized : `${normalized}/chat/completions`;
}

function chatAuthHeaders(settings) {
  if (settings.provider === 'xiaomi_mimo') {
    return {
      'api-key': settings.apiKey,
    };
  }

  return {
    Authorization: `Bearer ${settings.apiKey}`,
  };
}

function normalizeMessageContent(content) {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((item) => item?.text || item?.content || '')
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

async function postChatCompletions(settings, body) {
  const response = await fetch(chatCompletionsUrl(settings.baseUrl), {
    method: 'POST',
    headers: {
      ...chatAuthHeaders(settings),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(getPayloadError(payload, `${PROVIDER_DEFAULTS[settings.provider].label} 请求失败。`));
  }
  return payload;
}

async function createChatCompletionsResult({ instructions, input, schema, images = [] }, settings) {
  if (!settings.apiKey) {
    throw new Error(`请先在设置里填写 ${PROVIDER_DEFAULTS[settings.provider].label} API Key，或使用本地演练稿。`);
  }

  const promptImages = settings.provider === 'xiaomi_mimo' ? [] : images.filter((image) => image.dataUrl);
  const userText = `${input}\n\n请严格按下面 JSON Schema 输出：\n${JSON.stringify(schema.schema, null, 2)}`;
  const userContent =
    promptImages.length === 0
      ? userText
      : [
          { type: 'text', text: userText },
          ...promptImages.map((image) => ({
            type: 'image_url',
            image_url: {
              url: image.dataUrl,
              detail: 'high',
            },
          })),
        ];

  const body = {
    model: settings.model,
    messages: [
      {
        role: 'system',
        content: `${instructions}\n\n你必须只输出一个 JSON 对象，不要输出 Markdown，不要解释。`,
      },
      {
        role: 'user',
        content: userContent,
      },
    ],
    temperature: 0.4,
    response_format: { type: 'json_object' },
  };

  if (settings.provider === 'xiaomi_mimo') {
    body.max_completion_tokens = 2200;
  } else {
    body.max_tokens = 2200;
  }

  let payload;
  try {
    payload = await postChatCompletions(settings, body);
  } catch (error) {
    if (!String(error.message || '').toLowerCase().includes('response_format')) {
      throw error;
    }
    const retryBody = { ...body };
    delete retryBody.response_format;
    payload = await postChatCompletions(settings, retryBody);
  }

  const text = normalizeMessageContent(payload?.choices?.[0]?.message?.content);
  if (!text) {
    throw new Error(`${PROVIDER_DEFAULTS[settings.provider].label} 没有返回可解析文本。`);
  }
  return parseJsonText(text);
}

async function createAIResponse(promptPayload) {
  const settings = readSettings();
  if (settings.provider === 'openai_responses') {
    return createOpenAIResponsesResult(promptPayload, settings);
  }
  return createChatCompletionsResult(promptPayload, settings);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1120,
    minHeight: 720,
    title: '晨读观察台',
    backgroundColor: '#f7f5f0',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow = win;

  win.on('closed', () => {
    if (mainWindow === win) {
      mainWindow = null;
    }
  });

  if (isDev) {
    win.loadURL('http://127.0.0.1:5173');
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  ipcMain.handle('clipboard:readText', () => clipboard.readText());
  ipcMain.handle('clipboard:readImage', () => {
    const image = clipboard.readImage();
    if (image.isEmpty()) {
      return null;
    }
    return {
      imageDataUrl: image.toDataURL(),
      fileName: `剪贴板截图-${new Date().toLocaleTimeString('zh-CN')}.png`,
    };
  });
  ipcMain.handle('clipboard:writeText', (_, text) => {
    clipboard.writeText(text || '');
    return true;
  });
  ipcMain.handle('settings:load', () => {
    return publicSettings(readSettings());
  });
  ipcMain.handle('settings:save', (_, settings) => writeSettings(settings));
  ipcMain.handle('ocr:image', async (_, payload) => ({ text: await recognizeImageText(payload?.imageDataUrl || '') }));
  ipcMain.handle('openai:analyzeSpeaker', (_, payload) => createAIResponse(payload));
  ipcMain.handle('openai:summarizeSession', (_, payload) => createAIResponse(payload));

  createWindow();
  globalShortcut.register('CommandOrControl+Shift+V', () => {
    mainWindow?.webContents.send('global:pasteClipboard');
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
