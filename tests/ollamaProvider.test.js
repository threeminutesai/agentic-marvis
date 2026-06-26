const test = require('node:test');
const assert = require('node:assert/strict');

const { createOllamaProvider } = require('../src/main/providers/ollamaProvider');

test('createOllamaProvider sends chat requests to the configured local endpoint', async () => {
  let requestUrl = '';
  let requestOptions = null;
  const fetchImpl = async (url, options) => {
    requestUrl = url;
    requestOptions = options;
    return {
      ok: true,
      async json() {
        return { message: { content: 'Local reply' } };
      },
    };
  };

  const provider = createOllamaProvider({
    baseUrl: 'http://127.0.0.1:11434/',
    model: 'llama3.1:8b',
    fetchImpl,
  });

  const reply = await provider.chat({
    systemPrompt: 'System prompt',
    messages: [{ role: 'user', content: 'Hello' }],
  });

  assert.equal(reply, 'Local reply');
  assert.equal(requestUrl, 'http://127.0.0.1:11434/api/chat');
  assert.equal(requestOptions.method, 'POST');
  assert.equal(requestOptions.headers['Content-Type'], 'application/json');

  const body = JSON.parse(requestOptions.body);
  assert.equal(body.model, 'llama3.1:8b');
  assert.equal(body.stream, false);
  assert.deepEqual(body.messages, [
    { role: 'system', content: 'System prompt' },
    { role: 'user', content: 'Hello' },
  ]);
});

test('createOllamaProvider surfaces server-side error details', async () => {
  const provider = createOllamaProvider({
    baseUrl: 'http://127.0.0.1:11434',
    model: 'llama3.1:8b',
    fetchImpl: async () => ({
      ok: false,
      status: 404,
      async json() {
        return { error: 'model not found' };
      },
    }),
  });

  await assert.rejects(
    () => provider.chat({ systemPrompt: 'System prompt', messages: [] }),
    /Ollama API error \(404\) - model not found/
  );
});
