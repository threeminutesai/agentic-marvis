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
    const filePath = path.join(os.homedir(), '.jarvis-status.json');
    try {
      return { ok: true, rows: readStatusRows(filePath) };
    } catch (err) {
      console.log(`[Status] Failed to read status sheet: ${err.message}`);
      return { ok: false, rows: [], error: err.message };
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
