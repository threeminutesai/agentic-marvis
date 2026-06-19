// tests/main/geminiProvider.test.js
const test = require('node:test');
const assert = require('node:assert');
const { createGeminiProvider } = require('../../src/main/providers/geminiProvider');

test('createGeminiProvider sends chat request and returns reply text', async () => {
  let capturedUrl, capturedOptions;
  const fakeFetch = async (url, options) => {
    capturedUrl = url;
    capturedOptions = options;
    return {
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'All systems nominal, sir.' }] } }] }),
    };
  };

  const provider = createGeminiProvider({ apiKey: 'gm-test', fetchImpl: fakeFetch });
  const reply = await provider.chat({
    systemPrompt: 'You are Jarvis.',
    messages: [{ role: 'user', content: 'Status report.' }],
  });

  assert.strictEqual(reply, 'All systems nominal, sir.');
  assert.ok(capturedUrl.includes('generativelanguage.googleapis.com'));
  assert.ok(capturedUrl.includes('key=gm-test'));
  const body = JSON.parse(capturedOptions.body);
  assert.strictEqual(body.systemInstruction.parts[0].text, 'You are Jarvis.');
  assert.strictEqual(body.contents[0].role, 'user');
  assert.strictEqual(body.contents[0].parts[0].text, 'Status report.');
});

test('createGeminiProvider maps assistant role to model role', async () => {
  let capturedOptions;
  const fakeFetch = async (url, options) => {
    capturedOptions = options;
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }) };
  };

  const provider = createGeminiProvider({ apiKey: 'gm-test', fetchImpl: fakeFetch });
  await provider.chat({
    systemPrompt: 'x',
    messages: [{ role: 'assistant', content: 'Previous reply.' }],
  });

  const body = JSON.parse(capturedOptions.body);
  assert.strictEqual(body.contents[0].role, 'model');
});

test('createGeminiProvider throws a clear error on non-ok response', async () => {
  const fakeFetch = async () => ({ ok: false, status: 403, json: async () => ({ error: 'invalid key' }) });
  const provider = createGeminiProvider({ apiKey: 'bad-key', fetchImpl: fakeFetch });

  await assert.rejects(
    () => provider.chat({ systemPrompt: 'x', messages: [] }),
    /Gemini API error \(403\)/
  );
});

test('createGeminiProvider throws a clear error when candidates are empty', async () => {
  const fakeFetch = async () => ({ ok: true, json: async () => ({ candidates: [] }) });
  const provider = createGeminiProvider({ apiKey: 'gm-test', fetchImpl: fakeFetch });

  await assert.rejects(
    () => provider.chat({ systemPrompt: 'x', messages: [] }),
    /no content in response/i
  );
});
