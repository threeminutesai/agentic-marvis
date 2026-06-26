const test = require('node:test');
const assert = require('node:assert/strict');

const { createOpenRouterProvider } = require('../src/main/providers/openRouterProvider');

test('createOpenRouterProvider sends chat requests to the OpenRouter chat completions endpoint', async () => {
  let requestUrl = '';
  let requestOptions = null;
  const fetchImpl = async (url, options) => {
    requestUrl = url;
    requestOptions = options;
    return {
      ok: true,
      async json() {
        return { choices: [{ message: { content: 'Hosted reply' } }] };
      },
    };
  };

  const provider = createOpenRouterProvider({
    apiKey: 'test-key',
    model: 'openai/gpt-4o-mini',
    fetchImpl,
  });

  const reply = await provider.chat({
    systemPrompt: 'System prompt',
    messages: [{ role: 'user', content: 'Hello' }],
  });

  assert.equal(reply, 'Hosted reply');
  assert.equal(requestUrl, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(requestOptions.method, 'POST');
  assert.equal(requestOptions.headers['Content-Type'], 'application/json');
  assert.equal(requestOptions.headers.Authorization, 'Bearer test-key');

  const body = JSON.parse(requestOptions.body);
  assert.equal(body.model, 'openai/gpt-4o-mini');
  assert.deepEqual(body.messages, [
    { role: 'system', content: 'System prompt' },
    { role: 'user', content: 'Hello' },
  ]);
});

test('createOpenRouterProvider surfaces server-side error details', async () => {
  const provider = createOpenRouterProvider({
    apiKey: 'test-key',
    model: 'openai/gpt-4o-mini',
    fetchImpl: async () => ({
      ok: false,
      status: 401,
      async json() {
        return { error: { message: 'invalid key' } };
      },
    }),
  });

  await assert.rejects(
    () => provider.chat({ systemPrompt: 'System prompt', messages: [] }),
    /OpenRouter API error \(401\) - invalid key/
  );
});
