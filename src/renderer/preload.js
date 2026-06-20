const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('jarvis', {
  sendMessage: (text, operationId) => ipcRenderer.invoke('chat:send', { text, operationId }),
  cancelOperation: (operationId) => ipcRenderer.invoke('operation:cancel', operationId),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  testConnection: (payload) => ipcRenderer.invoke('settings:testConnection', payload),
  synthesizeSpeech: (text) => ipcRenderer.invoke('tts:synthesize', text),
  synthesizeGreeting: (text) => ipcRenderer.invoke('tts:synthesize-greeting', text),
  synthesizeCachedSpeech: (payload) => ipcRenderer.invoke('tts:synthesize-cached', payload),
  transcribeSpeech: (payload) => ipcRenderer.invoke('stt:transcribe', payload),
  delegateTask: (task, operationId) => ipcRenderer.invoke('claudeCode:delegate', { task, operationId }),
  delegateCodexTask: (task, operationId) => ipcRenderer.invoke('codex:delegate', { task, operationId }),
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  getStatus: () => ipcRenderer.invoke('status:get'),
  prepareHtmlPanel: () => ipcRenderer.invoke('html-panel:prepare'),
  readHtmlPanel: (filePath) => ipcRenderer.invoke('html-panel:read', filePath),
});
