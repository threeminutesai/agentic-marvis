const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createSettingsStore } = require('../../src/main/settings');

function fakeCrypto() {
  return {
    isEncryptionAvailable: () => true,
    encryptString: (s) => Buffer.from('ENC:' + s),
    decryptString: (buf) => buf.toString().replace(/^ENC:/, ''),
  };
}

test('createSettingsStore returns defaults when no file exists', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-settings-'));
  const store = createSettingsStore({ filePath: path.join(dir, 'settings.json'), crypto: fakeCrypto() });
  const settings = store.load();
  assert.strictEqual(settings.provider, 'deepseek');
  assert.deepStrictEqual(settings.apiKeys, { deepseek: '', gemini: '', elevenlabs: '', anthropic: '' });
  assert.strictEqual(settings.avatarStyle, 'rings');
  assert.strictEqual(settings.userName, '');
  assert.ok(settings.voicePhrases.morning.includes('Good morning [user]'));
  assert.ok(settings.voicePhrases.processing.includes('Working on it'));
});

test('createSettingsStore round-trips saved settings with encrypted API keys per provider', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-settings-'));
  const filePath = path.join(dir, 'settings.json');
  const store = createSettingsStore({ filePath, crypto: fakeCrypto() });

  store.save({
    provider: 'gemini',
    apiKeys: { deepseek: 'sk-deepseek-123', gemini: 'sk-gemini-456' },
    personality: 'Be witty.',
    avatarStyle: 'brain',
    activeProject: '/tmp/proj',
  });

  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert.ok(!raw.apiKeys.deepseek.includes('sk-deepseek-123'), 'deepseek key must not be stored in plaintext');
  assert.ok(!raw.apiKeys.gemini.includes('sk-gemini-456'), 'gemini key must not be stored in plaintext');

  const reloaded = createSettingsStore({ filePath, crypto: fakeCrypto() }).load();
  assert.strictEqual(reloaded.apiKeys.deepseek, 'sk-deepseek-123');
  assert.strictEqual(reloaded.apiKeys.gemini, 'sk-gemini-456');
  assert.strictEqual(reloaded.provider, 'gemini');
  assert.strictEqual(reloaded.avatarStyle, 'brain');
  assert.strictEqual(reloaded.activeProject, '/tmp/proj');
});

test('createSettingsStore returns defaults when settings file is corrupt', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-settings-'));
  const filePath = path.join(dir, 'settings.json');
  fs.writeFileSync(filePath, '{ this is not valid JSON ');

  const store = createSettingsStore({ filePath, crypto: fakeCrypto() });
  const settings = store.load();
  assert.strictEqual(settings.provider, 'deepseek');
  assert.deepStrictEqual(settings.apiKeys, { deepseek: '', gemini: '', elevenlabs: '', anthropic: '' });
  assert.strictEqual(settings.avatarStyle, 'rings');
});

test('createSettingsStore migrates legacy single apiKey field onto the deepseek slot', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-settings-'));
  const filePath = path.join(dir, 'settings.json');
  const crypto = fakeCrypto();

  // Simulate a settings.json written by the pre-multi-provider version of the app.
  fs.writeFileSync(filePath, JSON.stringify({
    provider: 'deepseek',
    apiKey: crypto.encryptString('sk-legacy-789').toString('base64'),
    personality: 'Be witty.',
    avatarStyle: 'rings',
    activeProject: '',
  }));

  const store = createSettingsStore({ filePath, crypto });
  const settings = store.load();
  assert.strictEqual(settings.apiKeys.deepseek, 'sk-legacy-789');
  assert.strictEqual(settings.apiKeys.gemini, '');
});

test('createSettingsStore defaults elevenLabsVoiceId to empty string', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-settings-'));
  const store = createSettingsStore({ filePath: path.join(dir, 'settings.json'), crypto: fakeCrypto() });
  const settings = store.load();
  assert.strictEqual(settings.elevenLabsVoiceId, '');
});

test('createSettingsStore round-trips elevenLabsVoiceId', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-settings-'));
  const filePath = path.join(dir, 'settings.json');
  const store = createSettingsStore({ filePath, crypto: fakeCrypto() });

  store.save({
    provider: 'deepseek',
    apiKeys: { deepseek: '', gemini: '', elevenlabs: 'el-456' },
    elevenLabsVoiceId: 'UgBBYS2sOqTuMpoF3BR0',
    wakeWordEnabled: false,
    personality: 'Be witty.',
    avatarStyle: 'rings',
    activeProject: '',
  });

  const reloaded = createSettingsStore({ filePath, crypto: fakeCrypto() }).load();
  assert.strictEqual(reloaded.elevenLabsVoiceId, 'UgBBYS2sOqTuMpoF3BR0');
});

test('createSettingsStore defaults elevenLabsVoices to an empty array', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-settings-'));
  const store = createSettingsStore({ filePath: path.join(dir, 'settings.json'), crypto: fakeCrypto() });
  const settings = store.load();
  assert.deepStrictEqual(settings.elevenLabsVoices, []);
});

test('createSettingsStore round-trips elevenLabsVoices', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-settings-'));
  const filePath = path.join(dir, 'settings.json');
  const store = createSettingsStore({ filePath, crypto: fakeCrypto() });

  store.save({
    provider: 'deepseek',
    apiKeys: { deepseek: '', gemini: '', elevenlabs: 'el-456' },
    elevenLabsVoiceId: 'UgBBYS2sOqTuMpoF3BR0',
    elevenLabsVoices: [{ id: 'UgBBYS2sOqTuMpoF3BR0', name: 'Mark - Natural Conversations' }],
    wakeWordEnabled: false,
    personality: 'Be witty.',
    avatarStyle: 'rings',
    activeProject: '',
  });

  const reloaded = createSettingsStore({ filePath, crypto: fakeCrypto() }).load();
  assert.deepStrictEqual(reloaded.elevenLabsVoices, [{ id: 'UgBBYS2sOqTuMpoF3BR0', name: 'Mark - Natural Conversations' }]);
});

test('createSettingsStore round-trips custom voice words', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-settings-'));
  const filePath = path.join(dir, 'settings.json');
  const store = createSettingsStore({ filePath, crypto: fakeCrypto() });

  store.save({
    provider: 'deepseek',
    apiKeys: { deepseek: '', gemini: '', elevenlabs: '' },
    userName: 'Zan',
    voicePhrases: {
      morning: ['Good morning [user]', 'Hi, [user]'],
      afternoon: ['Good afternoon [user]'],
      evening: ['Good evening [user]'],
      processing: ['Working on it', 'Got it [user]'],
    },
  });

  const reloaded = createSettingsStore({ filePath, crypto: fakeCrypto() }).load();
  assert.strictEqual(reloaded.userName, 'Zan');
  assert.deepStrictEqual(reloaded.voicePhrases.processing, ['Working on it', 'Got it [user]']);
});

test('createSettingsStore defaults wakeWordEnabled to false', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-settings-'));
  const store = createSettingsStore({ filePath: path.join(dir, 'settings.json'), crypto: fakeCrypto() });
  const settings = store.load();
  assert.strictEqual(settings.wakeWordEnabled, false);
});

test('createSettingsStore round-trips wakeWordEnabled', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-settings-'));
  const filePath = path.join(dir, 'settings.json');
  const store = createSettingsStore({ filePath, crypto: fakeCrypto() });

  store.save({
    provider: 'deepseek',
    apiKeys: { deepseek: 'sk-deepseek-123', gemini: '', elevenlabs: 'el-456' },
    wakeWordEnabled: true,
    personality: 'Be witty.',
    avatarStyle: 'rings',
    activeProject: '',
  });

  const reloaded = createSettingsStore({ filePath, crypto: fakeCrypto() }).load();
  assert.strictEqual(reloaded.wakeWordEnabled, true);
  assert.strictEqual(reloaded.apiKeys.elevenlabs, 'el-456');
});

test('createSettingsStore ignores a legacy wakeWordKey field from settings.json', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-settings-'));
  const filePath = path.join(dir, 'settings.json');
  fs.writeFileSync(filePath, JSON.stringify({
    provider: 'deepseek',
    apiKeys: {},
    wakeWordKey: 'stale-encoded-picovoice-key',
    personality: 'Be witty.',
    avatarStyle: 'rings',
    activeProject: '',
  }));

  const store = createSettingsStore({ filePath, crypto: fakeCrypto() });
  const settings = store.load();
  assert.strictEqual(settings.wakeWordEnabled, false);
  assert.strictEqual(settings.wakeWordKey, undefined);
});
