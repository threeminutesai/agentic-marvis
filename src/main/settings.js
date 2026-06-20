const fs = require('node:fs');

const DEFAULTS = {
  provider: 'deepseek',
  apiKeys: { deepseek: '', gemini: '', elevenlabs: '' },
  elevenLabsVoiceId: '',
  elevenLabsVoices: [],
  userName: '',
  voicePhrases: {
    morning: ['Good morning [user]', 'Hi [user]', 'Morning [user]'],
    afternoon: ['Good afternoon [user]', 'Hi [user]', 'Ready for the afternoon run [user]'],
    evening: ['Good evening [user]', 'Hi [user]', 'Welcome back [user]'],
    processing: ['Working on it', 'Processing', 'Got it. Checking now', 'On it [user]', 'Give me a moment'],
  },
  wakeWordEnabled: false,
  personality: 'You are Jarvis: calm, witty, formal, loyal. Address the user respectfully.',
  avatarStyle: 'rings',
  activeProject: '',
  preferredCliChannel: null,
};

function decryptKey(crypto, encoded) {
  if (!encoded) return '';
  try {
    return crypto.decryptString(Buffer.from(encoded, 'base64'));
  } catch {
    return '';
  }
}

function createSettingsStore({ filePath, crypto }) {
  function load() {
    if (!fs.existsSync(filePath)) return { ...DEFAULTS, apiKeys: { ...DEFAULTS.apiKeys } };
    let raw;
    try {
      raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      return { ...DEFAULTS, apiKeys: { ...DEFAULTS.apiKeys } };
    }

    const apiKeys = { ...DEFAULTS.apiKeys };
    if (raw.apiKeys) {
      for (const [provider, encoded] of Object.entries(raw.apiKeys)) {
        apiKeys[provider] = decryptKey(crypto, encoded);
      }
    } else if (raw.apiKey) {
      // Migrate legacy single-key format (pre-multi-provider) onto the deepseek slot.
      apiKeys.deepseek = decryptKey(crypto, raw.apiKey);
    }

    // wakeWordKey is a leftover field from the discontinued Picovoice-based wake word;
    // strip it so it doesn't linger in `rest` and shadow the DEFAULTS.wakeWordEnabled boolean.
    const { apiKey, wakeWordKey, ...rest } = raw;
    return { ...DEFAULTS, ...rest, apiKeys };
  }

  function save(settings) {
    const encryptedKeys = {};
    for (const [provider, key] of Object.entries(settings.apiKeys || {})) {
      encryptedKeys[provider] = key ? crypto.encryptString(key).toString('base64') : '';
    }
    const toWrite = {
      ...settings,
      apiKeys: encryptedKeys,
    };
    fs.writeFileSync(filePath, JSON.stringify(toWrite, null, 2));
  }

  return { load, save };
}

module.exports = { createSettingsStore, DEFAULTS };
