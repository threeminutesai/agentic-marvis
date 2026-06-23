const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  getCachedVoicePath,
  getGreetingVoicePath,
  hashVoiceText,
  slugifyGreeting,
  synthesizeGreetingWithCache,
} = require('../../src/main/voice/greetingVoiceCache');

function tempHomeDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-greeting-cache-'));
}

test('slugifyGreeting creates stable readable greeting cache names', () => {
  assert.strictEqual(slugifyGreeting('Good morning, sir.'), 'good-morning-sir');
  assert.strictEqual(slugifyGreeting('   !!!   '), 'greeting');
});

test('hashVoiceText creates stable five-digit numeric cache IDs', () => {
  const id = hashVoiceText('Good morning Zan');
  assert.match(id, /^\d{5}$/);
  assert.strictEqual(hashVoiceText('Good morning Zan'), id);
});

test('getGreetingVoicePath scopes saved greetings by selected voice', () => {
  const cacheDir = 'C:\\data\\voice-cache';
  const voicePath = getGreetingVoicePath({
    cacheDir,
    voiceId: 'voice-123',
    text: 'Welcome back, sir.',
  });

  assert.ok(voicePath.endsWith(path.join('greetings', 'voice-123', `${hashVoiceText('Welcome back, sir.')}.base64`)));
});

test('getCachedVoicePath scopes saved audio by category and numeric cache ID', () => {
  const voicePath = getCachedVoicePath({
    cacheDir: 'C:\\data\\voice-cache',
    voiceId: '',
    category: 'processing',
    text: 'Working on it',
  });

  assert.ok(voicePath.endsWith(path.join('processing', 'default', `${hashVoiceText('Working on it')}.base64`)));
});

test('synthesizeGreetingWithCache saves first greeting audio and reuses it next time', async () => {
  const cacheDir = tempHomeDir();
  const settings = {
    elevenLabsVoiceId: 'custom-voice',
    apiKeys: { elevenlabs: 'el-test' },
  };
  let synthesizeCalls = 0;
  const createProvider = ({ apiKey, voiceId }) => {
    assert.strictEqual(apiKey, 'el-test');
    assert.strictEqual(voiceId, 'custom-voice');
    return {
      synthesize: async () => {
        synthesizeCalls += 1;
        return Buffer.from('fake mp3 bytes');
      },
    };
  };

  const first = await synthesizeGreetingWithCache({
    text: 'Welcome back, sir.',
    settings,
    cacheDir,
    fsImpl: fs,
    createProvider,
  });
  const second = await synthesizeGreetingWithCache({
    text: 'Welcome back, sir.',
    settings,
    cacheDir,
    fsImpl: fs,
    createProvider,
  });

  assert.strictEqual(first.ok, true);
  assert.strictEqual(first.reused, false);
  assert.strictEqual(second.ok, true);
  assert.strictEqual(second.reused, true);
  assert.strictEqual(second.audioBase64, Buffer.from('fake mp3 bytes').toString('base64'));
  assert.strictEqual(synthesizeCalls, 1);
});

test('synthesizeGreetingWithCache uses provider default voice when no custom voice is selected', async () => {
  const cacheDir = tempHomeDir();
  let capturedVoiceId = 'not-called';
  const createProvider = ({ voiceId }) => {
    capturedVoiceId = voiceId;
    return {
      synthesize: async () => Buffer.from('default voice audio'),
    };
  };

  const result = await synthesizeGreetingWithCache({
    text: 'Good evening, sir.',
    settings: {
      elevenLabsVoiceId: '',
      apiKeys: { elevenlabs: 'el-test' },
    },
    cacheDir,
    fsImpl: fs,
    createProvider,
  });

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.reused, false);
  assert.strictEqual(capturedVoiceId, undefined);
  assert.ok(result.voicePath.endsWith(path.join('greetings', 'default', `${hashVoiceText('Good evening, sir.')}.base64`)));
});

test('synthesizeGreetingWithCache falls back without an ElevenLabs key', async () => {
  let providerCreated = false;
  const result = await synthesizeGreetingWithCache({
    text: 'Hello, sir.',
    settings: { elevenLabsVoiceId: '', apiKeys: { elevenlabs: '' } },
    cacheDir: tempHomeDir(),
    fsImpl: fs,
    createProvider: () => {
      providerCreated = true;
    },
  });

  assert.deepStrictEqual(result, { ok: false });
  assert.strictEqual(providerCreated, false);
});
