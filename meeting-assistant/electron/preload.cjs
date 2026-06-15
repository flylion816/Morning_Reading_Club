const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('observerAPI', {
  readClipboardText: () => ipcRenderer.invoke('clipboard:readText'),
  readClipboardImage: () => ipcRenderer.invoke('clipboard:readImage'),
  writeClipboardText: (text) => ipcRenderer.invoke('clipboard:writeText', text),
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  ocrImage: (imageDataUrl, fileName) => ipcRenderer.invoke('ocr:image', { imageDataUrl, fileName }),
  extractDocumentText: (payload) => ipcRenderer.invoke('document:extractText', payload),
  analyzeSpeaker: (payload) => ipcRenderer.invoke('openai:analyzeSpeaker', payload),
  summarizeSession: (payload) => ipcRenderer.invoke('openai:summarizeSession', payload),
  extractKnowledge: (payload) => ipcRenderer.invoke('openai:extractKnowledge', payload),
  onGlobalPaste: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('global:pasteClipboard', handler);
    return () => ipcRenderer.removeListener('global:pasteClipboard', handler);
  },
});
