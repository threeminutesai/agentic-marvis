// tests/main/deepseekProvider.test.js
const test = require('node:test');
const assert = require('node:assert');
const { createDeepseekProvider } = require('../../src/main/providers/deepseekProvider');

test('createDeepseekProvider sends chat request and returns reply text', async () => {
  let capturedUrl, capturedOptions;
  const fakeFetch = async (url, options) => {
    capturedUrl = url;
    capturedOptions = options;
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'All systems nominal, sir.' } }] }),
    };
  };

  const provider = createDeepseekProvider({ apiKey: 'sk-test', fetchImpl: fakeFetch });
  const reply = await provider.chat({
    systemPrompt: 'You are Jarvis.',
    messages: [{ role: 'user', content: 'Status report.' }],
  });

  assert.strictEqual(reply, 'All systems nominal, sir.');
  assert.strictEqual(capturedUrl, 'https://api.deepseek.com/chat/completions');
  const body = JSON.parse(capturedOptions.body);
  assert.strictEqual(body.messages[0].role, 'system');
  assert.strictEqual(body.messages[0].content, 'You are Jarvis.');
  assert.strictEqual(capturedOptions.headers.Authorization, 'Bearer sk-test');
});

test('createDeepseekProvider throws a clear error on non-ok response', async () => {
  const fakeFetch = async () => ({ ok: false, status: 401, json: async () => ({ error: 'invalid key' }) });
  const provider = createDeepseekProvider({ apiKey: 'bad-key', fetchImpl: fakeFetch });

  await assert.rejects(
    () => provider.chat({ systemPrompt: 'x', messages: [] }),
    /DeepSeek API error \(401\)/
  );
});

test('createDeepseekProvider throws a clear error when choices array is empty', async () => {
  const fakeFetch = async () => ({ ok: true, json: async () => ({ choices: [] }) });
  const provider = createDeepseekProvider({ apiKey: 'sk-test', fetchImpl: fakeFetch });

  await assert.rejects(
    () => provider.chat({ systemPrompt: 'x', messages: [] }),
    /no choices in response/i
  );
});
