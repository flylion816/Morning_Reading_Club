const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('observerAPI', {
  readClipboardText: () => ipcRenderer.invoke('clipboard:readText'),
  writeClipboardText: (text) => ipcRenderer.invoke('clipboard:writeText', text),
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  analyzeSpeaker: (payload) => ipcRenderer.invoke('openai:analyzeSpeaker', payload),
  summarizeSession: (payload) => ipcRenderer.invoke('openai:summarizeSession', payload),
  onGlobalPaste: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('global:pasteClipboard', handler);
    return () => ipcRenderer.removeListener('global:pasteClipboard', handler);
  },
});
