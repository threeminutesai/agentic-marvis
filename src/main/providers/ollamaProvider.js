// src/main/providers/ollamaProvider.js
function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function createOllamaProvider({ baseUrl, model, fetchImpl = fetch }) {
  const resolvedBaseUrl = trimTrailingSlash(baseUrl || 'http://127.0.0.1:11434');
  const resolvedModel = String(model || '').trim();

  async function chat({ systemPrompt, messages, signal }) {
    if (!resolvedModel) {
      throw new Error('Ollama model is not configured');
    }

    const response = await fetchImpl(`${resolvedBaseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: resolvedModel,
        stream: false,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
      }),
      signal,
    });

    if (!response.ok) {
      let detail = '';
      try {
        const errorBody = await response.json();
        detail = errorBody.error ? ` - ${errorBody.error}` : '';
      } catch {
        detail = '';
      }
      throw new Error(`Ollama API error (${response.status})${detail}`);
    }

    const data = await response.json();
    const text = data.message?.content;
    if (!text) throw new Error('Ollama API error: no content in response');
    return text;
  }

  return { chat };
}

module.exports = { createOllamaProvider };
