const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  getGreetingVoicePath,
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

test('getGreetingVoicePath scopes saved greetings by selected voice', () => {
  const homeDir = 'C:\\Users\\Test';
  const voicePath = getGreetingVoicePath({
    homeDir,
    voiceId: 'voice-123',
    text: 'Welcome back, sir.',
  });

  assert.ok(voicePath.endsWith(path.join('.jarvis-voices', 'greetings', 'voice-123', 'welcome-back-sir.base64')));
});

test('synthesizeGreetingWithCache saves first greeting audio and reuses it next time', async () => {
  const homeDir = tempHomeDir();
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
    homeDir,
    fsImpl: fs,
    createProvider,
  });
  const second = await synthesizeGreetingWithCache({
    text: 'Welcome back, sir.',
    settings,
    homeDir,
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
  const homeDir = tempHomeDir();
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
    homeDir,
    fsImpl: fs,
    createProvider,
  });

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.reused, false);
  assert.strictEqual(capturedVoiceId, undefined);
  assert.ok(result.voicePath.endsWith(path.join('.jarvis-voices', 'greetings', 'default', 'good-evening-sir.base64')));
});

test('synthesizeGreetingWithCache falls back without an ElevenLabs key', async () => {
  let providerCreated = false;
  const result = await synthesizeGreetingWithCache({
    text: 'Hello, sir.',
    settings: { elevenLabsVoiceId: '', apiKeys: { elevenlabs: '' } },
    homeDir: tempHomeDir(),
    fsImpl: fs,
    createProvider: () => {
      providerCreated = true;
    },
  });

  assert.deepStrictEqual(result, { ok: false });
  assert.strictEqual(providerCreated, false);
});
