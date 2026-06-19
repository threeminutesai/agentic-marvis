// tests/main/elevenLabsProvider.test.js
const test = require('node:test');
const assert = require('node:assert');
const { createElevenLabsProvider } = require('../../src/main/providers/elevenLabsProvider');

test('createElevenLabsProvider sends synthesis request and returns audio buffer', async () => {
  let capturedUrl, capturedOptions;
  const fakeAudioBytes = new Uint8Array([1, 2, 3, 4]);
  const fakeFetch = async (url, options) => {
    capturedUrl = url;
    capturedOptions = options;
    return { ok: true, arrayBuffer: async () => fakeAudioBytes.buffer };
  };

  const provider = createElevenLabsProvider({ apiKey: 'el-test', fetchImpl: fakeFetch });
  const buffer = await provider.synthesize('Hello, sir.');

  assert.ok(Buffer.isBuffer(buffer));
  assert.deepStrictEqual([...buffer], [1, 2, 3, 4]);
  assert.ok(capturedUrl.includes('api.elevenlabs.io/v1/text-to-speech/'));
  assert.strictEqual(capturedOptions.headers['xi-api-key'], 'el-test');
  const body = JSON.parse(capturedOptions.body);
  assert.strictEqual(body.text, 'Hello, sir.');
});

test('createElevenLabsProvider uses a custom voiceId in the request URL when provided', async () => {
  let capturedUrl;
  const fakeFetch = async (url) => {
    capturedUrl = url;
    return { ok: true, arrayBuffer: async () => new Uint8Array([1]).buffer };
  };

  const provider = createElevenLabsProvider({ apiKey: 'el-test', voiceId: 'UgBBYS2sOqTuMpoF3BR0', fetchImpl: fakeFetch });
  await provider.synthesize('Hello, sir.');

  assert.ok(capturedUrl.endsWith('/v1/text-to-speech/UgBBYS2sOqTuMpoF3BR0'));
});

test('createElevenLabsProvider falls back to the default voice when voiceId is omitted', async () => {
  let capturedUrl;
  const fakeFetch = async (url) => {
    capturedUrl = url;
    return { ok: true, arrayBuffer: async () => new Uint8Array([1]).buffer };
  };

  const provider = createElevenLabsProvider({ apiKey: 'el-test', fetchImpl: fakeFetch });
  await provider.synthesize('Hello, sir.');

  assert.ok(capturedUrl.endsWith('/v1/text-to-speech/pNInz6obpgDQGcFmaJgB'));
});

test('createElevenLabsProvider throws a clear error on non-ok response', async () => {
  const fakeFetch = async () => ({
    ok: false,
    status: 401,
    json: async () => ({ detail: { message: 'Invalid API key' } }),
  });
  const provider = createElevenLabsProvider({ apiKey: 'bad-key', fetchImpl: fakeFetch });

  await assert.rejects(
    () => provider.synthesize('Hello'),
    /ElevenLabs API error \(401\) — Invalid API key/
  );
});

test('createElevenLabsProvider throws a clear error when error body has no detail message', async () => {
  const fakeFetch = async () => ({
    ok: false,
    status: 500,
    json: async () => { throw new Error('not json'); },
  });
  const provider = createElevenLabsProvider({ apiKey: 'el-test', fetchImpl: fakeFetch });

  await assert.rejects(
    () => provider.synthesize('Hello'),
    /ElevenLabs API error \(500\)$/
  );
});
