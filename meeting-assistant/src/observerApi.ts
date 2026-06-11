import type { ObserverAPI } from './types';

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || '本地接口请求失败。');
  }
  return payload as T;
}

const browserAPI: ObserverAPI = {
  readClipboardText: () => navigator.clipboard.readText(),
  readClipboardImage: async () => {
    if (!navigator.clipboard?.read) {
      return null;
    }
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const imageType = item.types.find((type) => type.startsWith('image/'));
      if (!imageType) {
        continue;
      }
      const blob = await item.getType(imageType);
      const imageDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      return { imageDataUrl, fileName: `剪贴板截图-${new Date().toLocaleTimeString('zh-CN')}.png` };
    }
    return null;
  },
  writeClipboardText: async (text) => {
    await navigator.clipboard.writeText(text);
    return true;
  },
  loadSettings: () => requestJson('/api/settings'),
  saveSettings: (settings) =>
    requestJson('/api/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    }),
  ocrImage: (imageDataUrl, fileName) =>
    requestJson('/api/ocrImage', {
      method: 'POST',
      body: JSON.stringify({ imageDataUrl, fileName }),
    }),
  analyzeSpeaker: (payload) =>
    requestJson('/api/analyzeSpeaker', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  summarizeSession: (payload) =>
    requestJson('/api/summarizeSession', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  onGlobalPaste: () => () => undefined,
};

export function getObserverAPI(): ObserverAPI {
  return window.observerAPI || browserAPI;
}
