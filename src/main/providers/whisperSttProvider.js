function createWhisperSttProvider({ apiKey, fetchImpl = fetch }) {
  async function transcribe({ audioBuffer, mimeType = 'audio/webm' }) {
    const form = new FormData();
    form.append('model', 'whisper-1');
    form.append('file', new Blob([audioBuffer], { type: mimeType }), 'speech.webm');

    const response = await fetchImpl('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!response.ok) {
      let detail = '';
      try {
        const err = await response.json();
        detail = err.error?.message ? ` - ${err.error.message}` : '';
      } catch { detail = ''; }
      throw new Error(`Whisper API error (${response.status})${detail}`);
    }

    const data = await response.json();
    return { text: data.text || '' };
  }

  return { transcribe };
}

module.exports = { createWhisperSttProvider };
