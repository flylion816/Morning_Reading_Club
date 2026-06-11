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
