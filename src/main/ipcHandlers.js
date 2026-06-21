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
const { createMusicLibraryStore, SUPPORTED_EXTENSIONS } = require('./music');
const { pathToFileURL } = require('node:url');

function createProviderFor(providerName, apiKey) {
  if (providerName === 'gemini') return createGeminiProvider({ apiKey });
  return createDeepseekProvider({ apiKey });
}

function getStatusFilePath() {
  return path.join(path.resolve(__dirname, '../..'), 'data', 'jarvis-status.json');
}

const DEFAULT_USER_PROFILE = 'Robotics educator. Interests focus on technology, especially humanoid robots, drones, and robotics.';
const DEFAULT_USER_PROFILE_DETAIL = 'Geolocation: Bayan Lepas';

function ensureUserProfileRow(filePath, rows) {
  const existing = rows.find((row) => row.type === 'User Profile');
  if (existing && existing.value) return { rows, wasDefaulted: false };
  const profileRow = { type: 'User Profile', value: DEFAULT_USER_PROFILE, detail: existing?.detail || DEFAULT_USER_PROFILE_DETAIL };
  const updatedRows = existing
    ? rows.map((row) => (row.type === 'User Profile' ? profileRow : row))
    : [...rows, profileRow];
  fs.writeFileSync(filePath, JSON.stringify(updatedRows, null, 2));
  return { rows: updatedRows, wasDefaulted: true };
}

function saveUserProfile(filePath, profileText, geolocation) {
  const rows = readStatusRows(filePath);
  const value = String(profileText || '').trim();
  const geo = String(geolocation || '').trim();
  const detail = geo ? `Geolocation: ${geo}` : '';
  const updatedRows = rows.some((row) => row.type === 'User Profile')
    ? rows.map((row) => (row.type === 'User Profile' ? { ...row, value, detail } : row))
    : [...rows, { type: 'User Profile', value, detail }];
  fs.writeFileSync(filePath, JSON.stringify(updatedRows, null, 2));
  return updatedRows;
}

function getHtmlPanelDir() {
  return path.join(path.resolve(__dirname, '../..'), 'data', 'html-panels');
}

function ensureHtmlPanelDir() {
  const dir = getHtmlPanelDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getHtmlPanelTemplatePath() {
  const templatePath = path.join(getHtmlPanelDir(), '_template.html');
  return fs.existsSync(templatePath) ? templatePath : null;
}

function listHtmlPanelIds(dir) {
  return fs.readdirSync(dir)
    .map((name) => /^(\d{5})\.html$/i.exec(name)?.[1])
    .filter(Boolean)
    .map((id) => Number(id))
    .sort((a, b) => a - b);
}

function getNextHtmlPanelPath() {
  const dir = ensureHtmlPanelDir();
  const existingIds = listHtmlPanelIds(dir);
  const nextId = String((existingIds.length ? Math.max(...existingIds) : 0) + 1).padStart(5, '0');
  return path.join(dir, `${nextId}.html`);
}

function pruneHtmlPanels(maxCount) {
  const dir = ensureHtmlPanelDir();
  const limit = Number(maxCount) > 0 ? Number(maxCount) : 50;
  const ids = listHtmlPanelIds(dir);
  const excess = ids.length - limit;
  if (excess <= 0) return;
  for (const id of ids.slice(0, excess)) {
    const fileName = `${String(id).padStart(5, '0')}.html`;
    try {
      fs.unlinkSync(path.join(dir, fileName));
    } catch (err) {
      console.log(`[HtmlPanel] Failed to prune ${fileName}: ${err.message}`);
    }
  }
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
  const musicDir = path.join(os.homedir(), '.jarvis-music');
  const musicStore = createMusicLibraryStore({
    filePath: path.join(os.homedir(), '.jarvis-music-library.json'),
    musicDir,
  });

  function withFileUrls(catalog) {
    return {
      ...catalog,
      tracks: catalog.tracks.map((track) => ({
        ...track,
        fileUrl: pathToFileURL(path.join(musicDir, track.fileName)).toString(),
      })),
    };
  }

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
      return await delegateTask({
        task,
        projectPath: settings.activeProject,
        signal: controller?.signal,
        apiKey: settings.apiKeys?.anthropic,
        onProgress: operationId
          ? (text) => _event.sender.send('cli:progress', { operationId, text })
          : undefined,
      });
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
      const result = await delegateCodexTask({
        task,
        projectPath: settings.activeProject,
        signal: controller?.signal,
        onProgress: operationId
          ? (text) => _event.sender.send('cli:progress', { operationId, text })
          : undefined,
      });
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
      const { rows, wasDefaulted } = ensureUserProfileRow(filePath, readStatusRows(filePath));
      return { ok: true, rows, userProfileWasDefaulted: wasDefaulted };
    } catch (err) {
      console.log(`[Status] Failed to read status sheet: ${err.message}`);
      return { ok: false, rows: [], error: err.message };
    }
  });

  ipcMain.handle('status:saveUserProfile', (_event, payload) => {
    const filePath = getStatusFilePath();
    const profileText = typeof payload === 'string' ? payload : payload?.profileText;
    const geolocation = typeof payload === 'string' ? '' : payload?.geolocation;
    try {
      const rows = saveUserProfile(filePath, profileText, geolocation);
      return { ok: true, rows };
    } catch (err) {
      console.log(`[Status] Failed to save user profile: ${err.message}`);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('html-panel:prepare', () => {
    const filePath = getNextHtmlPanelPath();
    fs.writeFileSync(filePath, '', { flag: 'wx' });
    pruneHtmlPanels(settingsStore.load().maxHtmlPanels);
    return {
      filePath,
      fileName: path.basename(filePath),
      templatePath: getHtmlPanelTemplatePath(),
    };
  });

  ipcMain.handle('html-panel:read', (_event, filePath) => {
    try {
      return { ok: true, html: readHtmlPanelFile(filePath), filePath };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // Removes the placeholder file created by html-panel:prepare when a
  // delegated task ends up not writing it (error, cancel, or the CLI
  // decided no HTML panel was needed) - only if it's still empty, so a
  // file the CLI actually wrote content to is never touched.
  ipcMain.handle('html-panel:discard', (_event, filePath) => {
    try {
      const dir = ensureHtmlPanelDir();
      const resolved = path.resolve(filePath || '');
      if (!resolved.startsWith(path.resolve(dir) + path.sep)) {
        return { ok: false, error: 'HTML panel file must be inside the Jarvis html-panels folder.' };
      }
      if (fs.existsSync(resolved) && fs.statSync(resolved).size === 0) {
        fs.unlinkSync(resolved);
      }
      return { ok: true };
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

  ipcMain.handle('music:get', () => withFileUrls(musicStore.load()));

  ipcMain.handle('music:save', (_event, catalog) => {
    try {
      musicStore.save(catalog);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('music:importFiles', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      message: 'Select music files to add to your library',
      filters: [{ name: 'Audio', extensions: SUPPORTED_EXTENSIONS.map((ext) => ext.slice(1)) }],
    });
    if (result.canceled || !result.filePaths.length) {
      return { ok: true, catalog: withFileUrls(musicStore.load()) };
    }
    try {
      const catalog = musicStore.importFiles(result.filePaths);
      return { ok: true, catalog: withFileUrls(catalog) };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('music:deleteTrack', (_event, trackId) => {
    try {
      const catalog = musicStore.deleteTrack(trackId);
      return { ok: true, catalog: withFileUrls(catalog) };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
}

module.exports = { registerIpcHandlers };
