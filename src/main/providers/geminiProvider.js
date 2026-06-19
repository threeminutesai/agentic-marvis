// src/main/providers/geminiProvider.js
function createGeminiProvider({ apiKey, fetchImpl = fetch }) {
  async function chat({ systemPrompt, messages, signal }) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: messages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
      }),
      signal,
    });

    if (!response.ok) {
      let detail = '';
      try {
        const errorBody = await response.json();
        detail = errorBody.error?.message ? ` — ${errorBody.error.message}` : '';
      } catch {
        detail = '';
      }
      throw new Error(`Gemini API error (${response.status})${detail}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini API error: no content in response');
    return text;
  }

  return { chat };
}

module.exports = { createGeminiProvider };
