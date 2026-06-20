// src/main/ipcHandlers.js
const { ipcMain, dialog, safeStorage } = require('electron');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const { createSettingsStore } = require('./settings');
const { createDeepseekProvider } = require('./providers/deepseekProvider');
const { createGeminiProvider } = require('./providers/geminiProvider');
const { createElevenLabsProvider } = require('./providers/elevenLabsProvider');
const { createElevenLabsSttProvider } = require('./providers/elevenLabsSttProvider');
const { delegateTask } = require('./claudeCode/delegate');
const { delegateCodexTask } = require('./codex/delegate');
const { readStatusRows } = require('./status/statusFile');
const { synthesizeGreetingWithCache } = require('./voice/greetingVoiceCache');

function createProviderFor(providerName, apiKey) {
  if (providerName === 'gemini') return createGeminiProvider({ apiKey });
  return createDeepseekProvider({ apiKey });
}

function getStatusFilePath() {
  return path.join(path.resolve(__dirname, '../..'), 'data', 'jarvis-status.json');
}

function getHtmlPanelDir() {
  return path.join(path.resolve(__dirname, '../..'), 'data', 'html-panels');
}

function ensureHtmlPanelDir() {
  const dir = getHtmlPanelDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getHtmlPanelTemplate() {
  const templatePath = path.join(getHtmlPanelDir(), '_template.html');
  try {
    return fs.readFileSync(templatePath, 'utf8');
  } catch {
    return '';
  }
}

function getNextHtmlPanelPath() {
  const dir = ensureHtmlPanelDir();
  const existingIds = fs.readdirSync(dir)
    .map((name) => /^(\d{5})\.html$/i.exec(name)?.[1])
    .filter(Boolean)
    .map((id) => Number(id));
  const nextId = String((existingIds.length ? Math.max(...existingIds) : 0) + 1).padStart(5, '0');
  return path.join(dir, `${nextId}.html`);
}

function readHtmlPanelFile(filePath) {
  const dir = ensureHtmlPanelDir();
  const resolved = path.resolve(filePath || '');
  if (!resolved.startsWith(path.resolve(dir) + path.sep)) {
    throw new Error('HTML panel file must be inside the Jarvis html-panels folder.');
  }
  const html = fs.readFileSync(resolved, 'utf8');
  if (!html.trim()) throw new Error('HTML panel file is empty.');
  return html;
}

function copyLegacyStatusFileIfNeeded(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const rootStatusFilePath = path.join(path.resolve(__dirname, '../..'), 'jarvis-status.json');
  const legacyFilePath = path.join(os.homedir(), '.jarvis-status.json');
  if (!fs.existsSync(filePath) && fs.existsSync(rootStatusFilePath)) {
    fs.copyFileSync(rootStatusFilePath, filePath);
    return;
  }
  if (!fs.existsSync(filePath) && fs.existsSync(legacyFilePath)) {
    fs.copyFileSync(legacyFilePath, filePath);
  }
}

function registerIpcHandlers() {
  const settingsStore = createSettingsStore({
    filePath: path.join(os.homedir(), '.jarvis-settings.json'),
    crypto: safeStorage,
  });
  const activeOperations = new Map();
  const cancelledOperations = new Set();

  function createOperationController(operationId) {
    if (!operationId) return null;
    const controller = new AbortController();
    if (cancelledOperations.delete(operationId)) {
      controller.abort();
    }
    activeOperations.set(operationId, controller);
    return controller;
  }

  function finishOperation(operationId) {
    if (!operationId) return;
    activeOperations.delete(operationId);
    cancelledOperations.delete(operationId);
  }

  ipcMain.handle('settings:get', () => settingsStore.load());

  ipcMain.handle('settings:save', (_event, settings) => {
    try {
      settingsStore.save(settings);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: `I couldn't save your settings, sir: ${err.message}` };
    }
  });

  ipcMain.handle('settings:testConnection', async (_event, { provider, apiKey }) => {
    if (!apiKey) {
      return { ok: false, error: 'No API key provided, sir.' };
    }
    const client = createProviderFor(provider, apiKey);
    try {
      await client.chat({
        systemPrompt: 'You are a connectivity check. Reply with a single word.',
        messages: [{ role: 'user', content: 'Reply with OK.' }],
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('operation:cancel', (_event, operationId) => {
    const controller = activeOperations.get(operationId);
    if (!controller) {
      if (operationId) cancelledOperations.add(operationId);
      return { ok: true };
    }
    controller.abort();
    activeOperations.delete(operationId);
    return { ok: true };
  });

  ipcMain.handle('chat:send', async (_event, payload) => {
    const text = typeof payload === 'string' ? payload : payload.text;
    const operationId = typeof payload === 'string' ? null : payload.operationId;
    const controller = createOperationController(operationId);
    const settings = settingsStore.load();
    const apiKey = settings.apiKeys?.[settings.provider];
    if (!apiKey) {
      finishOperation(operationId);
      return { ok: false, reply: `I don't have an API key configured for ${settings.provider}, sir - please add one in Settings.` };
    }
    const client = createProviderFor(settings.provider, apiKey);
    try {
      const reply = await client.chat({
        systemPrompt: settings.personality,
        messages: [{ role: 'user', content: text }],
        signal: controller?.signal,
      });
      return { ok: true, reply };
    } catch (err) {
      if (controller?.signal.aborted) return { ok: false, cancelled: true, reply: '' };
      return { ok: false, reply: `I'm having trouble reaching my AI provider, sir: ${err.message}` };
    } finally {
      finishOperation(operationId);
    }
  });

  ipcMain.handle('tts:synthesize', async (_event, text) => {
    const settings = settingsStore.load();
    const apiKey = settings.apiKeys?.elevenlabs;
    if (!apiKey) {
      console.log('[TTS] No ElevenLabs API key configured, will fall back to Web Speech.');
      return { ok: false };
    }
    const voiceId = settings.elevenLabsVoiceId || undefined;
    console.log(`[TTS] Attempting ElevenLabs with voiceId: "${voiceId || 'default (Adam)'}"`);
    try {
      const provider = createElevenLabsProvider({ apiKey, voiceId });
      const audioBuffer = await provider.synthesize(text);
      console.log('[TTS] ElevenLabs succeeded.');
      return { ok: true, audioBase64: audioBuffer.toString('base64') };
    } catch (err) {
      console.log(`[TTS] ElevenLabs failed: ${err.message} - falling back to Web Speech.`);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('tts:synthesize-greeting', async (_event, text) => {
    const settings = settingsStore.load();
    return synthesizeGreetingWithCache({
      text,
      settings,
      homeDir: os.homedir(),
      fsImpl: fs,
      createProvider: createElevenLabsProvider,
    });
  });

  ipcMain.handle('tts:synthesize-cached', async (_event, { text, category }) => {
    const settings = settingsStore.load();
    return synthesizeGreetingWithCache({
      text,
      settings,
      homeDir: os.homedir(),
      fsImpl: fs,
      createProvider: createElevenLabsProvider,
      category: category || 'general',
    });
  });

  ipcMain.handle('stt:transcribe', async (_event, { audioBase64, mimeType }) => {
    const settings = settingsStore.load();
    const apiKey = settings.apiKeys?.elevenlabs;
    if (!apiKey) {
      return { ok: false, error: 'No ElevenLabs API key configured, sir.' };
    }

    try {
      const provider = createElevenLabsSttProvider({ apiKey });
      const result = await provider.transcribe({
        audioBuffer: Buffer.from(audioBase64, 'base64'),
        mimeType,
      });
      return { ok: true, ...result };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('claudeCode:delegate', async (_event, payload) => {
    const task = typeof payload === 'string' ? payload : payload.task;
    const operationId = typeof payload === 'string' ? null : payload.operationId;
    const controller = createOperationController(operationId);
    const settings = settingsStore.load();
    if (!settings.activeProject) {
      finishOperation(operationId);
      return { status: 'error', summary: 'No active project is set, sir. Please choose one in settings first.' };
    }
    try {
      return await delegateTask({ task, projectPath: settings.activeProject, signal: controller?.signal });
    } finally {
      finishOperation(operationId);
    }
  });

  ipcMain.handle('codex:delegate', async (_event, payload) => {
    const task = typeof payload === 'string' ? payload : payload.task;
    const operationId = typeof payload === 'string' ? null : payload.operationId;
    const controller = createOperationController(operationId);
    console.log(`[IPC] codex:delegate received task: "${task}"`);
    const settings = settingsStore.load();
    if (!settings.activeProject) {
      console.log('[IPC] No active project, returning error');
      finishOperation(operationId);
      return { status: 'error', summary: 'No active project is set, sir. Please choose one in settings first.' };
    }
    console.log(`[IPC] Delegating to Codex: "${task}"`);
    try {
      const result = await delegateCodexTask({ task, projectPath: settings.activeProject, signal: controller?.signal });
      console.log('[IPC] Codex delegate returned:', result);
      return result;
    } finally {
      finishOperation(operationId);
    }
  });

  ipcMain.handle('status:get', () => {
    const filePath = getStatusFilePath();
    try {
      copyLegacyStatusFileIfNeeded(filePath);
      return { ok: true, rows: readStatusRows(filePath) };
    } catch (err) {
      console.log(`[Status] Failed to read status sheet: ${err.message}`);
      return { ok: false, rows: [], error: err.message };
    }
  });

  ipcMain.handle('html-panel:prepare', () => {
    const filePath = getNextHtmlPanelPath();
    fs.writeFileSync(filePath, '', { flag: 'wx' });
    return {
      filePath,
      fileName: path.basename(filePath),
      template: getHtmlPanelTemplate(),
    };
  });

  ipcMain.handle('html-panel:read', (_event, filePath) => {
    try {
      return { ok: true, html: readHtmlPanelFile(filePath), filePath };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('dialog:selectFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      message: 'Select your project folder',
    });
    if (result.canceled) return null;
    return result.filePaths[0] || null;
  });
}

module.exports = { registerIpcHandlers };
