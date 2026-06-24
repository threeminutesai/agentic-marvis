const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('marvis', {
  sendMessage: (text, operationId) => ipcRenderer.invoke('chat:send', { text, operationId }),
  cancelOperation: (operationId) => ipcRenderer.invoke('operation:cancel', operationId),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  testConnection: (payload) => ipcRenderer.invoke('settings:testConnection', payload),
  synthesizeSpeech: (text) => ipcRenderer.invoke('tts:synthesize', text),
  synthesizeGreeting: (text) => ipcRenderer.invoke('tts:synthesize-greeting', text),
  synthesizeCachedSpeech: (payload) => ipcRenderer.invoke('tts:synthesize-cached', payload),
  transcribeSpeech: (payload) => ipcRenderer.invoke('stt:transcribe', payload),
  transcribeWhisper: (payload) => ipcRenderer.invoke('stt:whisper', payload),
  transcribeWhisperLocal: (payload) => ipcRenderer.invoke('stt:whisper-local', payload),
  delegateTask: (task, operationId) => ipcRenderer.invoke('claudeCode:delegate', { task, operationId }),
  delegateCodexTask: (task, operationId) => ipcRenderer.invoke('codex:delegate', { task, operationId }),
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  getMusicLibrary: () => ipcRenderer.invoke('music:get'),
  saveMusicLibrary: (catalog) => ipcRenderer.invoke('music:save', catalog),
  importMusicFiles: () => ipcRenderer.invoke('music:importFiles'),
  deleteMusicTrack: (trackId) => ipcRenderer.invoke('music:deleteTrack', trackId),
  getStatus: () => ipcRenderer.invoke('status:get'),
  saveUserProfile: (profileText, geolocation) => ipcRenderer.invoke('status:saveUserProfile', { profileText, geolocation }),
  updateProfile: (profileText, geolocation) => ipcRenderer.invoke('profile:update', profileText, geolocation),
  prepareHtmlPanel: () => ipcRenderer.invoke('html-panel:prepare'),
  readHtmlPanel: (filePath) => ipcRenderer.invoke('html-panel:read', filePath),
  readExternalHtml: (filePath) => ipcRenderer.invoke('html:read-external', filePath),
  discardHtmlPanel: (filePath) => ipcRenderer.invoke('html-panel:discard', filePath),
  searchHtmlPanels: (keyword) => ipcRenderer.invoke('html-panel:search', keyword),
  openHtmlPanelByKeyword: (keyword) => ipcRenderer.invoke('html-panel:openByKeyword', keyword),
  captureRegion: (rect) => ipcRenderer.invoke('panel:captureRegion', rect),
  readCapture: (filePath) => ipcRenderer.invoke('capture:read', filePath),
  onCliProgress: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('cli:progress', listener);
    return () => ipcRenderer.removeListener('cli:progress', listener);
  },
});
