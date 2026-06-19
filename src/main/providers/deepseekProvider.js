// src/main/providers/deepseekProvider.js
function createDeepseekProvider({ apiKey, fetchImpl = fetch }) {
  async function chat({ systemPrompt, messages, signal }) {
    const response = await fetchImpl('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error (${response.status})`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    if (!choice) throw new Error('DeepSeek API error: no choices in response');
    return choice.message.content;
  }

  return { chat };
}

module.exports = { createDeepseekProvider };
