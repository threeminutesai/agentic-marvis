const test = require('node:test');
const assert = require('node:assert');
const { createElevenLabsSttProvider } = require('../../src/main/providers/elevenLabsSttProvider');

test('createElevenLabsSttProvider sends multipart transcript request and returns text', async () => {
  let capturedUrl, capturedOptions;
  const fakeFetch = async (url, options) => {
    capturedUrl = url;
    capturedOptions = options;
    return {
      ok: true,
      json: async () => ({
        text: 'Open the project, please.',
        language_code: 'en',
        language_probability: 0.98,
      }),
    };
  };

  const provider = createElevenLabsSttProvider({ apiKey: 'el-test', fetchImpl: fakeFetch });
  const result = await provider.transcribe({
    audioBuffer: Buffer.from([1, 2, 3]),
    mimeType: 'audio/webm',
  });

  assert.strictEqual(capturedUrl, 'https://api.elevenlabs.io/v1/speech-to-text');
  assert.strictEqual(capturedOptions.method, 'POST');
  assert.strictEqual(capturedOptions.headers['xi-api-key'], 'el-test');
  assert.ok(capturedOptions.body instanceof FormData);
  assert.strictEqual(capturedOptions.body.get('model_id'), 'scribe_v2');
  assert.ok(capturedOptions.body.get('file') instanceof Blob);
  assert.deepStrictEqual(result, {
    text: 'Open the project, please.',
    languageCode: 'en',
    languageProbability: 0.98,
  });
});

test('createElevenLabsSttProvider throws a clear error on non-ok response', async () => {
  const fakeFetch = async () => ({
    ok: false,
    status: 401,
    json: async () => ({ detail: { message: 'Invalid API key' } }),
  });

  const provider = createElevenLabsSttProvider({ apiKey: 'bad-key', fetchImpl: fakeFetch });

  await assert.rejects(
    () => provider.transcribe({ audioBuffer: Buffer.from([1]) }),
    /ElevenLabs STT API error \(401\) - Invalid API key/
  );
});
