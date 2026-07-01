// src/main/ipcHandlers.js
const { ipcMain, dialog, safeStorage, app, BrowserWindow, nativeImage, shell } = require('electron');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const { createSettingsStore } = require('./settings');
const { createDeepseekProvider } = require('./providers/deepseekProvider');
const { createGeminiProvider } = require('./providers/geminiProvider');
const { createOpenRouterProvider } = require('./providers/openRouterProvider');
const { createOllamaProvider } = require('./providers/ollamaProvider');
const { createElevenLabsProvider } = require('./providers/elevenLabsProvider');
const { createElevenLabsSttProvider } = require('./providers/elevenLabsSttProvider');
const { delegateTask, warmupClaudeCode } = require('./claudeCode/delegate');
const { delegateCodexTask, warmupCodex } = require('./codex/delegate');
const { readStatusRows, ensureStatusFile, hashStatusRows } = require('./status/statusFile');
const { ensureCaptureDir, getNextCapturePath, pruneCaptures } = require('./status/captureFile');
const { DEFAULT_TEMPLATE_HTML } = require('./status/htmlPanelTemplate');
const { DEFAULT_MUSIC_TRACKS, DEFAULT_MUSIC_SCHEDULE, WEEKDAY_SLOTS, WEEKEND_SLOTS } = require('./music/defaultMusic');
const { synthesizeGreetingWithCache } = require('./voice/greetingVoiceCache');
const { createMusicLibraryStore, SUPPORTED_EXTENSIONS } = require('./music');
const { createMemoryStore } = require('./memory/memoryStore');
const { pathToFileURL } = require('node:url');

function createProviderFor(providerName, apiKey, settings = {}) {
  if (providerName === 'gemini') return createGeminiProvider({ apiKey });
  if (providerName === 'openrouter') {
    return createOpenRouterProvider({
      apiKey,
      model: settings.openRouterModel,
    });
  }
  if (providerName === 'ollama') {
    return createOllamaProvider({
      baseUrl: settings.ollamaBaseUrl,
      model: settings.ollamaModel,
    });
  }
  return createDeepseekProvider({ apiKey });
}

function extractJsonObject(text) {
  const source = String(text || '').trim();
  if (!source) return null;
  const fenced = source.match(/```json\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1] : source;
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) return null;
  try {
    return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
  } catch {
    return null;
  }
}

function normalizeRouterDecision(raw, { hasSession = false } = {}) {
  const rawRoute = raw?.route;
  const route = ['codex', 'claudeCode'].includes(rawRoute) ? rawRoute : 'marvis';
  const isCliRoute = route === 'codex' || route === 'claudeCode';
  let sessionAction = ['start', 'continue', 'close', 'none'].includes(raw?.sessionAction)
    ? raw.sessionAction
    : 'none';

  if (isCliRoute && sessionAction === 'none') {
    sessionAction = hasSession ? 'continue' : 'start';
  }
  if (isCliRoute && sessionAction === 'continue' && !hasSession) {
    sessionAction = 'start';
  }
  if (route === 'marvis' && sessionAction === 'start') {
    sessionAction = hasSession ? 'close' : 'none';
  }

  return {
    route,
    sessionAction,
    reason: String(raw?.reason || '').trim(),
  };
}

function getUserFacingLanguageInstruction(language) {
  return language === 'zh'
    ? 'Reply in Simplified Chinese for all user-facing output unless the user explicitly asks for another language.'
    : 'Reply in English for all user-facing output unless the user explicitly asks for another language.';
}

// Packaged (portable exe): data lives next to the exe so the whole app is
// self-contained in one folder. PORTABLE_EXECUTABLE_DIR is set by the
// Electron portable launcher; fall back to dirname(execPath) if absent.
// Dev (unpackaged): data lives in the project root's data/ folder (gitignored).
function getDataDir() {
  if (!app.isPackaged) return path.join(path.resolve(__dirname, '../..'), 'data');
  let exeDir = process.env.PORTABLE_EXECUTABLE_DIR;
  if (!exeDir && process.execPath) {
    exeDir = path.dirname(process.execPath);
  }
  if (!exeDir) {
    exeDir = path.dirname(app.getPath('exe'));
  }
  return path.join(exeDir, 'data');
}

function getStatusFilePath() {
  return path.join(getDataDir(), 'marvis-status.json');
}

function getSettingsFilePath() {
  return path.join(getDataDir(), 'settings.json');
}

function getMusicDir() {
  return path.join(getDataDir(), 'music');
}

function getMusicLibraryFilePath() {
  return path.join(getDataDir(), 'music-library.json');
}

function getVoiceCacheDir() {
  return path.join(getDataDir(), 'voice-cache');
}

function getConversationMemoryFilePath() {
  return path.join(getDataDir(), 'conversation-memory.json');
}

const RELEASES_API_URL = 'https://api.github.com/repos/threeminutesai/agentic-marvis/releases/latest';
const RELEASES_PAGE_URL = 'https://github.com/threeminutesai/agentic-marvis/releases';

function normalizeVersion(version) {
  return String(version || '')
    .trim()
    .replace(/^v/i, '')
    .split('-')[0];
}

function compareVersions(a, b) {
  const left = normalizeVersion(a).split('.').map((part) => Number.parseInt(part, 10) || 0);
  const right = normalizeVersion(b).split('.').map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (left[index] || 0) - (right[index] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function chooseReleaseAsset(assets = []) {
  const platform = process.platform;
  const arch = process.arch;
  const names = [];

  if (platform === 'win32') {
    names.push('win32-x64.zip');
    names.push('.exe');
  } else if (platform === 'darwin') {
    if (arch === 'arm64') names.push('arm64.dmg', 'arm64-mac.zip');
    names.push('.dmg', '-mac.zip', '.zip');
  } else if (platform === 'linux') {
    names.push('.AppImage', '.deb');
  }

  for (const token of names) {
    const match = assets.find((asset) => asset?.name?.includes(token));
    if (match) return match;
  }
  return assets[0] || null;
}

async function fetchLatestReleaseInfo() {
  const response = await fetch(RELEASES_API_URL, {
    headers: {
      'Accept': 'application/vnd.github+json',
      'User-Agent': `Marvis/${app.getVersion()}`,
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub returned ${response.status} ${response.statusText}`);
  }

  const release = await response.json();
  const selectedAsset = chooseReleaseAsset(Array.isArray(release.assets) ? release.assets : []);
  const currentVersion = normalizeVersion(app.getVersion());
  const latestVersion = normalizeVersion(release.tag_name || release.name || '');

  return {
    currentVersion,
    latestVersion,
    updateAvailable: compareVersions(latestVersion, currentVersion) > 0,
    releaseName: release.name || release.tag_name || `v${latestVersion}`,
    publishedAt: release.published_at || null,
    releasePageUrl: release.html_url || RELEASES_PAGE_URL,
    downloadUrl: selectedAsset?.browser_download_url || release.html_url || RELEASES_PAGE_URL,
    assetName: selectedAsset?.name || null,
  };
}

// One-time migration for voice cache from the legacy ~/.marvis-voices location
// to the portable voice-cache/ folder next to the exe (or in data/ for dev).
// Dev mode only — packaged builds start with empty voice-cache/.
function migrateLegacyVoiceCacheIfNeeded(newVoiceCacheDir) {
  fs.mkdirSync(newVoiceCacheDir, { recursive: true });
  if (app.isPackaged) return;

  const legacyVoiceCacheDir = path.join(os.homedir(), '.marvis-voices');
  if (!fs.existsSync(legacyVoiceCacheDir)) return;

  try {
    const categories = fs.readdirSync(legacyVoiceCacheDir);
    for (const category of categories) {
      const srcCategoryDir = path.join(legacyVoiceCacheDir, category);
      const destCategoryDir = path.join(newVoiceCacheDir, category);
      if (!fs.existsSync(destCategoryDir)) {
        fs.cpSync(srcCategoryDir, destCategoryDir, { recursive: true });
      }
    }
    console.log('[TTS] Migrated voice cache from legacy location');
  } catch (err) {
    console.log(`[TTS] Voice cache migration failed: ${err.message}`);
  }
}

// One-time migration for music files from the legacy ~/.marvis-music location
// to the portable music/ folder next to the exe (or in data/ for dev).
function migrateLegacyMusicFilesIfNeeded(newMusicDir) {
  fs.mkdirSync(newMusicDir, { recursive: true });
  const legacyMusicDir = path.join(os.homedir(), '.marvis-music');
  if (!fs.existsSync(legacyMusicDir)) return;

  try {
    const files = fs.readdirSync(legacyMusicDir);
    for (const file of files) {
      const src = path.join(legacyMusicDir, file);
      const dest = path.join(newMusicDir, file);
      if (!fs.existsSync(dest)) {
        const stat = fs.statSync(src);
        if (stat.isFile()) {
          fs.copyFileSync(src, dest);
        } else if (stat.isDirectory()) {
          fs.cpSync(src, dest, { recursive: true });
        }
      }
    }
  } catch (err) {
    console.log(`[Music] Migration from legacy location failed: ${err.message}`);
  }
}


// One-time migration for dev machines that already have a pre-existing
// ~/.marvis-settings.json from before settings.json moved into the
// data/ folder - copies it in instead of losing local dev config (API keys,
// voice settings, etc.). Packaged builds skip this and start with defaults
// instead, prompting the user to set up their own keys via the welcome panel.
// Ensure music library has individual playlists per track and schedule
function ensureDataFilesExist(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(path.join(dataDir, 'music'), { recursive: true });
}

// Dev only: if music-library.json is missing, build it from whichever
// DEFAULT_MUSIC_TRACKS files already exist in data/music/ — no copying.
function initDevMusicLibraryIfNeeded(musicDir, musicLibraryFilePath) {
  if (app.isPackaged) return;
  if (fs.existsSync(musicLibraryFilePath)) return;

  const present = DEFAULT_MUSIC_TRACKS.filter((t) =>
    fs.existsSync(path.join(musicDir, t.fileName)),
  );
  if (!present.length) return;

  // Weekday playlists — one per slot, trackId = fileName
  const playlists = present
    .filter((t) => WEEKDAY_SLOTS.includes(t.slot))
    .map((t) => ({ id: `pl_${t.slot}`, name: getDefaultPlaylistName(t.slot), trackIds: [t.fileName] }));

  // Weekend playlist — all weekend tracks combined
  const weekendTracks = present.filter((t) => WEEKEND_SLOTS.includes(t.slot));
  if (weekendTracks.length) {
    playlists.push({ id: 'pl_weekend', name: getDefaultPlaylistName('weekend'), trackIds: weekendTracks.map((t) => t.fileName) });
  }

  // Schedule: only reference playlists that were actually created
  const playlistIds = new Set(playlists.map((p) => p.id));
  const allSlots = ['earlyMorning', 'morning', 'afternoon', 'evening', 'midnight'];
  const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  const weekend = ['saturday', 'sunday'];
  const schedule = {};
  for (const day of weekdays) {
    schedule[day] = {};
    for (const slot of allSlots) {
      const plId = `pl_${slot}`;
      if (playlistIds.has(plId)) schedule[day][slot] = plId;
    }
  }
  for (const day of weekend) {
    schedule[day] = playlistIds.has('pl_weekend')
      ? Object.fromEntries(allSlots.map((s) => [s, 'pl_weekend']))
      : {};
  }

  // id IS the fileName — no separate fileName field
  const library = {
    tracks: present.map((t) => ({ id: t.fileName, artist: t.artist, duration: 0 })),
    playlists,
    schedule,
  };
  fs.writeFileSync(musicLibraryFilePath, JSON.stringify(library, null, 2));
  console.log(`[Music] Dev library initialised from ${present.length} existing tracks`);
}

function copyLegacySettingsFileIfNeeded(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (fs.existsSync(filePath)) return;
  if (app.isPackaged) return;
  const legacyPath = path.join(os.homedir(), '.marvis-settings.json');
  if (fs.existsSync(legacyPath)) {
    fs.copyFileSync(legacyPath, filePath);
  }
}

const DEFAULT_USER_PROFILE = 'Robotics educator. Interests focus on technology, especially humanoid robots, drones, and robotics.';
const DEFAULT_USER_PROFILE_DETAIL = 'Geolocation: Washington | Language: English';

function getDefaultPlaylistName(slot) {
  return {
    earlyMorning: 'Early Morning',
    morning: 'Morning Focus',
    afternoon: 'Afternoon Drive',
    evening: 'Evening Wind Down',
    midnight: 'Midnight Deep Work',
    weekend: 'Weekend Mix',
  }[slot] || slot;
}

function formatLanguageLabel(language) {
  return language === 'zh' ? '中文' : 'English';
}

function buildUserProfileDetail(geolocation, language) {
  const parts = [];
  const geo = String(geolocation || '').trim();
  const lang = String(language || '').trim();
  if (geo) parts.push(`Geolocation: ${geo}`);
  if (lang) parts.push(`Language: ${formatLanguageLabel(lang)}`);
  return parts.join(' | ');
}

function parseUserProfileDetail(detail) {
  const text = String(detail || '');
  const geoMatch = text.match(/Geolocation:\s*([^|]+)/i);
  const languageMatch = text.match(/Language:\s*([^|]+)/i);
  const languageRaw = (languageMatch?.[1] || '').trim();
  return {
    geolocation: (geoMatch?.[1] || '').trim(),
    language: /中文/i.test(languageRaw) ? 'zh' : (languageRaw ? 'en' : ''),
  };
}

function ensureUserProfileRow(filePath, rows) {
  const existing = rows.find((row) => row.type === 'User Profile');
  if (existing && existing.value) return { rows, wasDefaulted: false };

  // For packaged builds (fresh installs), leave User Profile empty until user completes onboarding.
  // For dev builds, use sensible defaults to avoid re-configuring every time.
  if (app.isPackaged) {
    if (!existing) {
      const profileRow = { type: 'User Profile', value: '', detail: '' };
      const updatedRows = [...rows, profileRow];
      fs.writeFileSync(filePath, JSON.stringify(updatedRows, null, 2));
      return { rows: updatedRows, wasDefaulted: true };
    }
    return { rows, wasDefaulted: false };
  }

  // Dev mode: add default profile if missing.
  const profileRow = { type: 'User Profile', value: DEFAULT_USER_PROFILE, detail: existing?.detail || DEFAULT_USER_PROFILE_DETAIL };
  const updatedRows = existing
    ? rows.map((row) => (row.type === 'User Profile' ? profileRow : row))
    : [...rows, profileRow];
  fs.writeFileSync(filePath, JSON.stringify(updatedRows, null, 2));
  return { rows: updatedRows, wasDefaulted: true };
}

function saveUserProfile(filePath, profileText, geolocation, language) {
  const rows = readStatusRows(filePath);
  const value = String(profileText || '').trim();
  const geo = String(geolocation || '').trim();
  const detail = buildUserProfileDetail(geo, language);
  const updatedRows = rows.some((row) => row.type === 'User Profile')
    ? rows.map((row) => (row.type === 'User Profile' ? { ...row, value, detail } : row))
    : [...rows, { type: 'User Profile', value, detail }];
  fs.writeFileSync(filePath, JSON.stringify(updatedRows, null, 2));
  return updatedRows;
}

function syncUserProfileLanguage(filePath, language) {
  const rows = readStatusRows(filePath);
  const updatedRows = rows.map((row) => {
    if (row.type !== 'User Profile') return row;
    const parsed = parseUserProfileDetail(row.detail);
    return {
      ...row,
      detail: buildUserProfileDetail(parsed.geolocation, language),
    };
  });
  fs.writeFileSync(filePath, JSON.stringify(updatedRows, null, 2));
  return updatedRows;
}

function getEnvFilePath() {
  return path.join(getDataDir(), '.env');
}

const ENV_KEY_MAP = {
  DEEPSEEK_API_KEY: 'deepseek',
  GEMINI_API_KEY: 'gemini',
  OPENROUTER_API_KEY: 'openrouter',
  OLLAMA_API_KEY: 'ollama',
  ELEVENLABS_API_KEY: 'elevenlabs',
  ANTHROPIC_API_KEY: 'anthropic',
};

function loadEnvFile() {
  const keys = { deepseek: '', gemini: '', openrouter: '', ollama: '', elevenlabs: '', anthropic: '' };
  const envPath = getEnvFilePath();
  if (!fs.existsSync(envPath)) return keys;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const envKey = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (ENV_KEY_MAP[envKey] !== undefined) keys[ENV_KEY_MAP[envKey]] = value;
  }
  return keys;
}

function saveEnvFile(apiKeys) {
  const lines = Object.entries(ENV_KEY_MAP).map(
    ([envKey, settingsKey]) => `${envKey}=${apiKeys[settingsKey] || ''}`,
  );
  fs.writeFileSync(getEnvFilePath(), lines.join('\n') + '\n');
}

// One-time migration: if .env doesn't exist yet but settings.json already
// has encrypted keys, decrypt them into .env and clear them from JSON.
function migrateApiKeysToEnvIfNeeded(settingsStore) {
  if (fs.existsSync(getEnvFilePath())) return;
  const settings = settingsStore.load();
  const { apiKeys } = settings;
  if (!apiKeys || !Object.values(apiKeys).some((v) => v)) return;
  saveEnvFile(apiKeys);
      settingsStore.save({ ...settings, apiKeys: { deepseek: '', gemini: '', openrouter: '', ollama: '', elevenlabs: '', anthropic: '' } });
  console.log('[Settings] Migrated API keys from settings.json to .env');
}

function getHtmlPanelDir() {
  return path.join(getDataDir(), 'html-panels');
}

function ensureHtmlPanelDir() {
  const dir = getHtmlPanelDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function normalizePanelText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtmlTags(html) {
  return normalizePanelText(String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '));
}

function titleCaseFallback(value) {
  const text = normalizePanelText(value);
  if (!text) return 'Marvis Report';
  return text[0].toUpperCase() + text.slice(1);
}

function isWeakPanelTitle(value) {
  const text = normalizePanelText(value)
    .replace(/\.html$/i, '')
    .toLowerCase();
  if (!text) return true;
  if (/^(?:marvis\s+)?report(?:\s+\d+)?$/.test(text)) return true;
  if (/^(?:untitled|new document|document|panel|html panel)$/.test(text)) return true;

  const compact = text
    .replace(/[^\w-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (/^\d{8}(?:-\d{4}-\d{2}-\d{2})?(?:-\d+)?$/.test(compact)) return true;
  if (/^\d{4}-\d{2}-\d{2}(?:-\d+)?$/.test(compact)) return true;
  if (/^(?:\d{8}-)?report(?:-\d+)?$/.test(compact)) return true;
  return false;
}

function deriveHtmlPanelTitle(input) {
  const cleaned = normalizePanelText(input)
    .replace(/^\/(?:codex|code|claude)\s+/i, '')
    .replace(/\b(?:please|can you|could you)\b/gi, '')
    .replace(/\b(?:make|generate|create|write|produce|compile|prepare|search the web for|search web for)\b/gi, '')
    .replace(/\b(?:a|an|the|me)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const shortened = (cleaned || 'Marvis report').slice(0, 90).trim();
  const title = /\breport\b/i.test(shortened)
    ? shortened
    : `${shortened} Report`;
  return titleCaseFallback(title);
}

function slugifyPanelTitle(title) {
  const slug = String(title || '')
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 56);
  return slug || 'marvis-report';
}

function getHtmlPanelFiles() {
  const dir = ensureHtmlPanelDir();
  return fs.readdirSync(dir)
    .filter((file) => file.endsWith('.html') && file !== '_template.html')
    .map((file) => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      return {
        file,
        filePath,
        createdMs: stat.birthtimeMs || stat.ctimeMs || stat.mtimeMs,
        modifiedMs: stat.mtimeMs,
      };
    });
}

function getUniqueHtmlPanelPath(title) {
  const dir = ensureHtmlPanelDir();
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const slug = slugifyPanelTitle(title);
  let candidate = path.join(dir, `${datePart}-${slug}.html`);
  let suffix = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${datePart}-${slug}-${suffix}.html`);
    suffix += 1;
  }
  return candidate;
}

function renameHtmlPanelToMatchTitle(filePath, title) {
  const dir = ensureHtmlPanelDir();
  const resolved = path.resolve(filePath || '');
  const resolvedDir = path.resolve(dir);
  if (!resolved.startsWith(`${resolvedDir}${path.sep}`)) {
    throw new Error('HTML panel file must be inside the Marvis html-panels folder.');
  }
  if (!fs.existsSync(resolved)) {
    throw new Error('HTML panel file does not exist.');
  }
  const currentName = path.basename(resolved);
  const desiredPath = getUniqueHtmlPanelPath(title);
  const desiredName = path.basename(desiredPath);
  const currentSlug = currentName.replace(/^\d{8}-/, '').replace(/-\d+(?=\.html$)/, '');
  const desiredSlug = desiredName.replace(/^\d{8}-/, '').replace(/-\d+(?=\.html$)/, '');
  if (currentSlug === desiredSlug) {
    return {
      filePath: resolved,
      fileName: currentName,
    };
  }
  fs.renameSync(resolved, desiredPath);
  return {
    filePath: desiredPath,
    fileName: path.basename(desiredPath),
  };
}

function extractHtmlPanelTitle(html) {
  const source = String(html || '');
  const titleMatch = source.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const titleText = titleMatch?.[1] ? normalizePanelText(stripHtmlTags(titleMatch[1])) : '';
  const headingMatch = source.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
    || source.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  const headingText = headingMatch?.[1] ? normalizePanelText(stripHtmlTags(headingMatch[1])) : '';
  if (titleText && !isWeakPanelTitle(titleText)) return titleText;
  if (headingText && !isWeakPanelTitle(headingText)) return headingText;
  return titleText || headingText || '';
}

function upsertHtmlTitleTag(html, title) {
  const escapedTitle = String(title || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  let nextHtml = String(html || '');
  if (/<title[^>]*>[\s\S]*?<\/title>/i.test(nextHtml)) {
    return nextHtml.replace(/<title[^>]*>[\s\S]*?<\/title>/i, `<title>${escapedTitle}</title>`);
  }
  if (/<head[\s>]/i.test(nextHtml)) {
    return nextHtml.replace(/<head([^>]*)>/i, `<head$1>\n  <title>${escapedTitle}</title>`);
  }
  if (/<html[\s>]/i.test(nextHtml)) {
    return nextHtml.replace(/<html([^>]*)>/i, `<html$1>\n<head>\n  <title>${escapedTitle}</title>\n</head>`);
  }
  return `<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="UTF-8">\n  <title>${escapedTitle}</title>\n</head>\n<body>\n${nextHtml}\n</body>\n</html>`;
}

function ensureHtmlPanelTitle(filePath, fallbackTitle) {
  if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) return fallbackTitle;
  const html = fs.readFileSync(filePath, 'utf8');
  const existingTitle = extractHtmlPanelTitle(html);
  const derivedTitle = deriveHtmlPanelTitle(fallbackTitle);
  const shouldReplaceExisting = isWeakPanelTitle(existingTitle) && !isWeakPanelTitle(derivedTitle);
  const title = existingTitle && !shouldReplaceExisting
    ? existingTitle
    : derivedTitle;
  if (existingTitle && !shouldReplaceExisting) return title;

  const nextHtml = upsertHtmlTitleTag(html, title);
  if (nextHtml !== html) {
    fs.writeFileSync(filePath, nextHtml);
  }
  return title;
}

function finalizeHtmlPanelMetadata(filePath, fallbackTitle) {
  const title = ensureHtmlPanelTitle(filePath, fallbackTitle);
  const renamed = renameHtmlPanelToMatchTitle(filePath, title);
  return {
    title,
    filePath: renamed.filePath,
    fileName: renamed.fileName,
    sourceTask: normalizePanelText(fallbackTitle || ''),
  };
}

// Calculate string similarity score (0-1) using normalized Levenshtein distance
function calculateSimilarity(str1, str2) {
  const s1 = String(str1).toLowerCase();
  const s2 = String(str2).toLowerCase();
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  if (longer.length === 0) return 1;
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

// Calculate Levenshtein distance between two strings
function levenshteinDistance(s1, s2) {
  const costs = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

function scorePanelMatch(query, candidate) {
  const text = String(candidate || '').toLowerCase();
  if (!text) return 0;
  if (text === query) return 1.8;
  if (text.includes(query)) return 1.3;
  return calculateSimilarity(query, text);
}

// Search HTML files in the html-panels folder by title, source task, content,
// and filename. The filename is now just storage; the report title is the
// primary handle users can ask for later ("open AI news report").
function searchHtmlPanels(keyword, { minSimilarity = 0.4, memoryResults = [] } = {}) {
  const rememberedText = (Array.isArray(memoryResults) ? memoryResults : [])
    .map((entry) => normalizePanelText(entry.summary || ''))
    .filter(Boolean)
    .join('\n');
  if (!keyword || !String(keyword).trim()) {
    return [];
  }

  const query = String(keyword).toLowerCase().trim();

  const results = getHtmlPanelFiles()
    .map(({ file, filePath, createdMs, modifiedMs }) => {
      const baseName = file.replace(/\.html$/, '');
      let html = '';
      try {
        html = fs.readFileSync(filePath, 'utf8');
      } catch {
        html = '';
      }
      const htmlTitle = extractHtmlPanelTitle(html);
      const contentText = stripHtmlTags(html).slice(0, 2000);
      const title = normalizePanelText(htmlTitle || titleCaseFallback(baseName.replace(/^\d{8}-/, '').replace(/-/g, ' ')));
      const titleScore = scorePanelMatch(query, title);
      const fileScore = scorePanelMatch(query, baseName) * 0.7;
      const contentScore = scorePanelMatch(query, contentText) * 0.5;
      const memoryScore = rememberedText ? scorePanelMatch(title.toLowerCase(), rememberedText.toLowerCase()) * 0.35 : 0;
      const score = Math.max(titleScore, fileScore, contentScore, memoryScore);

      return {
        file,
        baseName,
        title,
        sourceTask: '',
        score,
        filePath,
        createdAt: new Date(createdMs).toISOString(),
        modifiedMs,
      };
    })
    .filter((result) => result.score >= minSimilarity)
    .sort((a, b) => {
      return b.score - a.score || b.modifiedMs - a.modifiedMs;
    });

  return results;
}

// Regenerates _template.html when missing or emptied out, same "found
// empty" rule as ensureStatusFile, so delegated report tasks always have a
// style/structure reference to match instead of silently losing it.
function getHtmlPanelTemplatePath() {
  const templatePath = path.join(ensureHtmlPanelDir(), '_template.html');
  let needsTemplate = !fs.existsSync(templatePath);
  if (!needsTemplate) {
    try {
      needsTemplate = !fs.readFileSync(templatePath, 'utf8').trim();
    } catch {
      needsTemplate = true;
    }
  }
  if (needsTemplate) fs.writeFileSync(templatePath, DEFAULT_TEMPLATE_HTML);
  return templatePath;
}

function getNextHtmlPanelPath(title) {
  return getUniqueHtmlPanelPath(title);
}

function pruneHtmlPanels(maxCount) {
  const limit = Number(maxCount) > 0 ? Number(maxCount) : 50;
  const files = getHtmlPanelFiles()
    .sort((a, b) => a.createdMs - b.createdMs || a.modifiedMs - b.modifiedMs);
  const excess = files.length - limit;
  if (excess <= 0) return;
  for (const panel of files.slice(0, excess)) {
    try {
      fs.unlinkSync(panel.filePath);
    } catch (err) {
      console.log(`[HtmlPanel] Failed to prune ${panel.file}: ${err.message}`);
    }
  }
}

function removeLegacyHtmlPanelIndex() {
  const legacyIndexPath = path.join(ensureHtmlPanelDir(), 'index.json');
  if (fs.existsSync(legacyIndexPath)) {
    try {
      fs.unlinkSync(legacyIndexPath);
    } catch (err) {
      console.log(`[HtmlPanel] Failed to remove legacy index.json: ${err.message}`);
    }
  }
}

function readHtmlPanelFile(filePath) {
  const dir = ensureHtmlPanelDir();
  const resolved = path.resolve(filePath || '');
  if (!resolved.startsWith(path.resolve(dir) + path.sep)) {
    throw new Error('HTML panel file must be inside the Marvis html-panels folder.');
  }
  const html = fs.readFileSync(resolved, 'utf8');
  if (!html.trim()) throw new Error('HTML panel file is empty.');
  return html;
}

function copyLegacyStatusFileIfNeeded(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const rootStatusFilePath = path.join(path.resolve(__dirname, '../..'), 'marvis-status.json');
  const legacyFilePath = path.join(os.homedir(), '.marvis-status.json');
  if (!fs.existsSync(filePath) && fs.existsSync(rootStatusFilePath)) {
    fs.copyFileSync(rootStatusFilePath, filePath);
    return;
  }
  if (!fs.existsSync(filePath) && fs.existsSync(legacyFilePath)) {
    fs.copyFileSync(legacyFilePath, filePath);
  }
}

function registerIpcHandlers() {
  console.log('[Init] Starting registerIpcHandlers');

  // Check & generate the data/ folder next to the exe (or the project's
  // data/ folder in dev) on every launch: marvis-status.json, settings.json,
  // and html-panels/_template.html all get created with sane defaults the
  // first time, or regenerated if any of them is later found missing/empty.
  try {
    console.log('[Init] Getting data directory...');
    const dataDir = getDataDir();
    console.log('[Init] Data dir:', dataDir);
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('[Init] Data dir created');
    ensureDataFilesExist(dataDir);
    console.log('[Init] Data files ensured');
  } catch (err) {
    console.error('[Init] Error in initialization:', err);
  }

  const settingsFilePath = getSettingsFilePath();
  copyLegacySettingsFileIfNeeded(settingsFilePath);
  const settingsStore = createSettingsStore({
    filePath: settingsFilePath,
    crypto: safeStorage,
  });
  migrateApiKeysToEnvIfNeeded(settingsStore);

  const statusFilePath = getStatusFilePath();
  copyLegacyStatusFileIfNeeded(statusFilePath);
  ensureStatusFile(statusFilePath);
  getHtmlPanelTemplatePath();
  removeLegacyHtmlPanelIndex();

  const musicDir = getMusicDir();
  const musicLibraryFilePath = getMusicLibraryFilePath();
  const voiceCacheDir = getVoiceCacheDir();
  const conversationMemoryFilePath = getConversationMemoryFilePath();
  migrateLegacyMusicFilesIfNeeded(musicDir);
  initDevMusicLibraryIfNeeded(musicDir, musicLibraryFilePath);
  migrateLegacyVoiceCacheIfNeeded(voiceCacheDir);
  const musicStore = createMusicLibraryStore({
    filePath: musicLibraryFilePath,
    musicDir,
  });
  const memoryStore = createMemoryStore({
    filePath: conversationMemoryFilePath,
  });

  function withFileUrls(catalog) {
    return {
      ...catalog,
      tracks: catalog.tracks.map((track) => ({
        ...track,
        fileUrl: pathToFileURL(path.join(musicDir, track.id)).toString(),
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

  ipcMain.handle('settings:get', () => {
    const settings = settingsStore.load();
    // Sync language from User Profile detail if not in settings
    if (!settings.language) {
      try {
        const statusRows = readStatusRows(getStatusFilePath());
        const profileRow = statusRows.find((r) => r.type === 'User Profile');
        if (profileRow) {
          const parsed = parseUserProfileDetail(profileRow.detail);
          if (parsed.language) {
            settings.language = parsed.language;
          }
        }
      } catch (err) {
        console.log('[Settings] Could not sync language from profile:', err.message);
      }
    }
    return { ...settings, apiKeys: loadEnvFile() };
  });

  ipcMain.handle('settings:save', (_event, settings) => {
    try {
      const { apiKeys, ...rest } = settings;
      if (apiKeys) saveEnvFile(apiKeys);
      settingsStore.save({ ...rest, apiKeys: { deepseek: '', gemini: '', openrouter: '', ollama: '', elevenlabs: '', anthropic: '' } });
      syncUserProfileLanguage(getStatusFilePath(), settings.language || 'en');
      return { ok: true };
    } catch (err) {
      return { ok: false, error: `I couldn't save your settings, sir: ${err.message}` };
    }
  });

  ipcMain.handle('settings:checkForUpdates', async () => {
    try {
      return { ok: true, ...(await fetchLatestReleaseInfo()) };
    } catch (err) {
      return { ok: false, error: `I couldn't check GitHub releases, sir: ${err.message}`, releasePageUrl: RELEASES_PAGE_URL };
    }
  });

  ipcMain.handle('shell:openExternal', async (_event, targetUrl) => {
    if (!targetUrl) {
      return { ok: false, error: 'No URL provided, sir.' };
    }
    try {
      await shell.openExternal(targetUrl);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: `I couldn't open that link, sir: ${err.message}` };
    }
  });

  ipcMain.handle('profile:update', (_event, profileText, geolocation, language) => {
    try {
      const statusFilePath = getStatusFilePath();
      const rows = readStatusRows(statusFilePath);
      const updated = rows.map((row) => {
        if (row.type === 'User Profile') {
          return {
            ...row,
            value: profileText,
            detail: buildUserProfileDetail(geolocation, language),
          };
        }
        return row;
      });
      if (!updated.some((r) => r.type === 'User Profile')) {
        updated.push({
          type: 'User Profile',
          value: profileText,
          detail: buildUserProfileDetail(geolocation, language),
        });
      }
      fs.writeFileSync(statusFilePath, JSON.stringify(updated, null, 2));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: `Couldn't save profile, sir: ${err.message}` };
    }
  });

  ipcMain.handle('settings:testConnection', async (_event, { provider, apiKey }) => {
    const settings = settingsStore.load();
    if (provider !== 'ollama' && !apiKey) {
      return { ok: false, error: 'No API key provided, sir.' };
    }
    const client = createProviderFor(provider, apiKey, settings);
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

  ipcMain.handle('cli:warmup', async (_event, channelKey) => {
    const settings = settingsStore.load();
    const normalized = String(channelKey || settings.preferredCliChannel || '')
      .trim()
      .toLowerCase()
      .replace(/^\//, '');

    if (!normalized) {
      return { ok: false, skipped: true, summary: 'No preferred CLI configured.' };
    }

    if (normalized === 'code' || normalized === 'claude') {
      return warmupClaudeCode({ projectPath: settings.activeProject });
    }

    if (normalized === 'codex') {
      return warmupCodex({ projectPath: settings.activeProject });
    }

    return { ok: false, skipped: true, summary: `Unknown CLI channel: ${normalized}` };
  });

  ipcMain.handle('memory:rememberConversation', (_event, payload) => {
    try {
      const entry = memoryStore.rememberConversation(payload || {});
      return { ok: true, entry };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('memory:search', (_event, query) => {
    try {
      return { ok: true, results: memoryStore.search(query || '') };
    } catch (err) {
      return { ok: false, error: err.message, results: [] };
    }
  });

  ipcMain.handle('router:decide', async (_event, payload) => {
    const settings = settingsStore.load();
    const envKeys = loadEnvFile();
    const apiKey = envKeys.gemini || settings.apiKeys?.gemini;
    if (!apiKey) {
      return { ok: false, skipped: true, error: 'No Gemini API key configured for intelligent routing, sir.' };
    }

    const session = payload?.session?.active ? payload.session : null;
    const client = createGeminiProvider({ apiKey });
    const memoryResults = session
      ? []
      : memoryStore.search(payload?.text || '', 3);
    const userPayload = {
      text: String(payload?.text || ''),
      hasAttachments: Boolean(payload?.hasAttachments),
      currentHtmlPath: String(payload?.currentHtmlPath || ''),
      session,
      memorySummaries: memoryResults.map((entry) => entry.summary),
    };

    const systemPrompt = [
      'You are Marvis intelligent routing control.',
      'Decide whether the next user message should go to normal Marvis chat, Codex, or Claude Code.',
      'Use claudeCode when: the user asks a follow-up question about the currently displayed HTML report (currentHtmlPath is set and the question relates to its content), or when starting a new report/code/file task for Claude Code.',
      'Use codex when: the user explicitly wants Codex for project work, debugging, or implementation.',
      'Use marvis for ordinary conversation, quick factual answers, small talk, or clearly new non-project topics.',
      'If currentHtmlPath is set and the user question clearly relates to the displayed content (asking about it, comparing items, requesting summary), route to claudeCode with sessionAction "continue" to answer from the displayed HTML without generating a new report.',
      'If currentHtmlPath is set but the user is asking for something unrelated or a new report, route to claudeCode with sessionAction "start" (this closes the current panel and starts fresh).',
      'If there is an active session, continue it only when the user is clearly following the same task or result.',
      'HTML/report delivery does not automatically close the session; keep it active for follow-up questions, edits, or additions.',
      'Close the session when the user switches topic, asks an unrelated question, or clearly concludes the task.',
      'Return JSON only with this shape: {"route":"marvis|codex|claudeCode","sessionAction":"start|continue|close|none","reason":"short reason"}.',
      'No markdown, no extra text.',
    ].join(' ');

    try {
      const reply = await client.chat({
        systemPrompt,
        messages: [{ role: 'user', content: JSON.stringify(userPayload) }],
      });
      const parsed = extractJsonObject(reply);
      if (!parsed) {
        return {
          ok: true,
          decision: normalizeRouterDecision({ route: session ? (session.channelKey === '/codex' ? 'codex' : 'claudeCode') : 'marvis', sessionAction: session ? 'continue' : 'none', reason: 'Fallback because router JSON could not be parsed.' }, { hasSession: Boolean(session) }),
        };
      }
      return { ok: true, decision: normalizeRouterDecision(parsed, { hasSession: Boolean(session) }) };
    } catch (err) {
      return { ok: false, error: `Gemini routing failed, sir: ${err.message}` };
    }
  });

  ipcMain.handle('chat:send', async (_event, payload) => {
    const text = typeof payload === 'string' ? payload : payload.text;
    const operationId = typeof payload === 'string' ? null : payload.operationId;
    const controller = createOperationController(operationId);
    const settings = settingsStore.load();
    const envKeys = loadEnvFile();
    const apiKey = envKeys[settings.provider] || settings.apiKeys?.[settings.provider];
    if (settings.provider !== 'ollama' && !apiKey) {
      finishOperation(operationId);
      return { ok: false, reply: `I don't have an API key configured for ${settings.provider}, sir - please add one in Settings.` };
    }
    const client = createProviderFor(settings.provider, apiKey, settings);
    const memoryResults = memoryStore.search(text, 3);
    const recentTurns = Array.isArray(payload?.recentTurns)
      ? payload.recentTurns
        .slice(-8)
        .map((turn) => ({
          role: turn?.role === 'assistant' ? 'assistant' : 'user',
          content: String(turn?.content || '').slice(0, 500),
        }))
        .filter((turn) => turn.content.trim())
      : [];
    const recentTurnBlock = recentTurns.length
      ? `\n\nRecent visible chat turns, newest last. Treat these as more authoritative than vector memory for "just now", "what did I ask", and follow-up references:\n${recentTurns.map((turn, index) => `${index + 1}. ${turn.role === 'assistant' ? 'Marvis' : 'User'}: ${turn.content}`).join('\n')}`
      : '';
    const memoryBlock = memoryResults.length
      ? `\n\nRelevant local memory summaries:\n${memoryResults.map((entry, index) => `${index + 1}. ${entry.summary}`).join('\n')}\nUse these only when relevant; do not claim certainty beyond them.`
      : '';
    try {
      const reply = await client.chat({
        systemPrompt: `${settings.personality}\n\n${getUserFacingLanguageInstruction(settings.language)}${recentTurnBlock}${memoryBlock}`,
        messages: [{ role: 'user', content: text }],
        signal: controller?.signal,
      });
      return { ok: true, reply };
    } catch (err) {
      if (controller?.signal.aborted) return { ok: false, cancelled: true, reply: '' };
      return { ok: false, reply: `I'm having trouble reaching ${settings.provider}, sir: ${err.message}` };
    } finally {
      finishOperation(operationId);
    }
  });

  ipcMain.handle('tts:synthesize', async (_event, text) => {
    const envKeys = loadEnvFile();
    const apiKey = envKeys.elevenlabs;
    if (!apiKey) {
      console.log('[TTS] No ElevenLabs API key configured, will fall back to Web Speech.');
      return { ok: false };
    }
    const settings = settingsStore.load();
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
    const envKeys = loadEnvFile();
    return synthesizeGreetingWithCache({
      text,
      settings,
      apiKey: envKeys.elevenlabs,
      cacheDir: voiceCacheDir,
      fsImpl: fs,
      createProvider: createElevenLabsProvider,
    });
  });

  ipcMain.handle('tts:synthesize-cached', async (_event, { text, category }) => {
    const settings = settingsStore.load();
    const envKeys = loadEnvFile();
    return synthesizeGreetingWithCache({
      text,
      settings,
      apiKey: envKeys.elevenlabs,
      cacheDir: voiceCacheDir,
      fsImpl: fs,
      createProvider: createElevenLabsProvider,
      category: category || 'general',
    });
  });

  ipcMain.handle('stt:transcribe', async (_event, { audioBase64, mimeType }) => {
    const envKeys = loadEnvFile();
    const apiKey = envKeys.elevenlabs;
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
    const resumeSessionId = typeof payload === 'string' ? null : payload.resumeSessionId;
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
        resumeSessionId,
        signal: controller?.signal,
        onProgress: operationId
          ? (text) => _event.sender.send('cli:progress', { operationId, text })
          : undefined,
        onRawOutput: operationId
          ? (text) => _event.sender.send('cli:output', { operationId, text })
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
      return { ok: true, rows, statusHash: hashStatusRows(rows), userProfileWasDefaulted: wasDefaulted };
    } catch (err) {
      console.log(`[Status] Failed to read status sheet: ${err.message}`);
      return { ok: false, rows: [], statusHash: '', error: err.message };
    }
  });

  ipcMain.handle('status:saveUserProfile', (_event, payload) => {
    const filePath = getStatusFilePath();
    const profileText = typeof payload === 'string' ? payload : payload?.profileText;
    const geolocation = typeof payload === 'string' ? '' : payload?.geolocation;
    const language = typeof payload === 'string' ? 'en' : payload?.language;
    try {
      const rows = saveUserProfile(filePath, profileText, geolocation, language);
      return { ok: true, rows };
    } catch (err) {
      console.log(`[Status] Failed to save user profile: ${err.message}`);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('html-panel:prepare', (_event, payload = {}) => {
    const sourceTask = typeof payload === 'string' ? payload : payload.task;
    const title = deriveHtmlPanelTitle(typeof payload === 'string' ? payload : (payload.title || payload.task));
    const filePath = getNextHtmlPanelPath(title);
    fs.writeFileSync(filePath, '', { flag: 'wx' });
    pruneHtmlPanels(settingsStore.load().maxHtmlPanels);
    return {
      filePath,
      fileName: path.basename(filePath),
      title,
      templatePath: getHtmlPanelTemplatePath(),
    };
  });

  ipcMain.handle('html-panel:finalize', (_event, payload = {}) => {
    const { filePath, fallbackTitle } = payload;
    try {
      const meta = finalizeHtmlPanelMetadata(
        filePath,
        fallbackTitle || path.basename(filePath || '').replace(/\.html$/i, ''),
      );
      return {
        ok: true,
        title: meta?.title || '',
        filePath: meta?.filePath || filePath,
        fileName: meta?.fileName || path.basename(filePath || ''),
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('html-panel:read', (_event, filePath) => {
    try {
      const meta = finalizeHtmlPanelMetadata(filePath, path.basename(filePath || '').replace(/\.html$/i, ''));
      return {
        ok: true,
        html: readHtmlPanelFile(meta?.filePath || filePath),
        filePath: meta?.filePath || filePath,
        title: meta?.title || '',
        fileName: meta?.fileName || path.basename(filePath || ''),
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('html-panel:search', (_event, keyword) => {
    try {
      const results = searchHtmlPanels(keyword, {
        memoryResults: memoryStore.search(keyword || '', 5),
      });
      return { ok: true, results };
    } catch (err) {
      return { ok: false, error: err.message, results: [] };
    }
  });

  ipcMain.handle('html-panel:openByKeyword', (_event, keyword) => {
    try {
      const results = searchHtmlPanels(keyword, {
        memoryResults: memoryStore.search(keyword || '', 5),
      });
      if (!results.length) {
        return { ok: false, error: `No HTML panel found matching "${keyword}".` };
      }
      const topMatch = results[0];
      const meta = finalizeHtmlPanelMetadata(topMatch.filePath, topMatch.title || topMatch.sourceTask || topMatch.file);
      const html = readHtmlPanelFile(meta?.filePath || topMatch.filePath);
      return {
        ok: true,
        html,
        filePath: meta?.filePath || topMatch.filePath,
        fileName: meta?.fileName || topMatch.file,
        title: meta?.title || topMatch.title || topMatch.file,
      };
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
        return { ok: false, error: 'HTML panel file must be inside the Marvis html-panels folder.' };
      }
      if (fs.existsSync(resolved) && fs.statSync(resolved).size === 0) {
        fs.unlinkSync(resolved);
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // Read external HTML files (not restricted to html-panels folder)
  ipcMain.handle('html:read-external', (_event, filePath) => {
    try {
      const resolved = path.resolve(filePath || '');
      // Basic security: file must exist and be readable
      if (!fs.existsSync(resolved)) {
        return { ok: false, error: 'File not found.' };
      }
      const stat = fs.statSync(resolved);
      if (!stat.isFile()) {
        return { ok: false, error: 'Path is not a file.' };
      }
      const html = fs.readFileSync(resolved, 'utf8');
      if (!html.trim()) {
        return { ok: false, error: 'HTML file is empty.' };
      }
      return { ok: true, html, filePath };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // Captures a region of the main window's rendered pixels (not a DOM
  // screenshot - this rasterizes whatever capturePage() sees, so Chart.js
  // canvases and cross-origin news thumbnails in the status panel come
  // through correctly with no CORS/canvas-taint issues).
  ipcMain.handle('panel:captureRegion', async (_event, rect) => {
    try {
      const win = BrowserWindow.getAllWindows()[0];
      if (!win) return { ok: false, error: 'No window available to capture.' };
      const x = Number(rect?.x);
      const y = Number(rect?.y);
      const width = Number(rect?.width);
      const height = Number(rect?.height);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return { ok: false, error: 'Invalid capture region.' };
      }
      const fullImage = await win.webContents.capturePage();
      const bounds = fullImage.getSize();
      const clampedX = Math.max(0, Math.min(Math.round(x), bounds.width - 1));
      const clampedY = Math.max(0, Math.min(Math.round(y), bounds.height - 1));
      const cropRect = {
        x: clampedX,
        y: clampedY,
        width: Math.max(1, Math.min(Math.round(width), bounds.width - clampedX)),
        height: Math.max(1, Math.min(Math.round(height), bounds.height - clampedY)),
      };
      const cropped = fullImage.crop(cropRect);
      const dataDir = getDataDir();
      ensureCaptureDir(dataDir);
      const filePath = getNextCapturePath(dataDir);
      fs.writeFileSync(filePath, cropped.toPNG());
      pruneCaptures(dataDir, 30);
      return { ok: true, filePath, fileName: path.basename(filePath) };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('capture:read', (_event, filePath) => {
    try {
      const dir = ensureCaptureDir(getDataDir());
      const resolved = path.resolve(filePath || '');
      if (!resolved.startsWith(path.resolve(dir) + path.sep)) {
        return { ok: false, error: 'Capture file must be inside the Marvis captures folder.' };
      }
      const buffer = fs.readFileSync(resolved);
      return { ok: true, dataUrl: `data:image/png;base64,${buffer.toString('base64')}` };
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

module.exports = {
  registerIpcHandlers,
  deriveHtmlPanelTitle,
  extractHtmlPanelTitle,
  ensureHtmlPanelTitle,
  finalizeHtmlPanelMetadata,
  slugifyPanelTitle,
  isWeakPanelTitle,
};
