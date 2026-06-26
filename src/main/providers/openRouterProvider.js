// src/main/providers/openRouterProvider.js
function createOpenRouterProvider({ apiKey, model, fetchImpl = fetch }) {
  const resolvedModel = String(model || '').trim() || 'openai/gpt-4o-mini';

  async function chat({ systemPrompt, messages, signal }) {
    const response = await fetchImpl('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: resolvedModel,
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
        detail = errorBody.error?.message ? ` - ${errorBody.error.message}` : '';
      } catch {
        detail = '';
      }
      throw new Error(`OpenRouter API error (${response.status})${detail}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error('OpenRouter API error: no content in response');
    return text;
  }

  return { chat };
}

module.exports = { createOpenRouterProvider };
