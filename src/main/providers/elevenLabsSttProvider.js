function createElevenLabsSttProvider({ apiKey, fetchImpl = fetch }) {
  async function transcribe({ audioBuffer, mimeType = 'audio/webm' }) {
    const form = new FormData();
    form.append('model_id', 'scribe_v2');
    form.append('file', new Blob([audioBuffer], { type: mimeType }), 'speech.webm');

    const response = await fetchImpl('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
      },
      body: form,
    });

    if (!response.ok) {
      let detail = '';
      try {
        const errorBody = await response.json();
        detail = errorBody.detail?.message ? ` - ${errorBody.detail.message}` : '';
      } catch {
        detail = '';
      }
      throw new Error(`ElevenLabs STT API error (${response.status})${detail}`);
    }

    const data = await response.json();
    return {
      text: data.text || '',
      languageCode: data.language_code || null,
      languageProbability: data.language_probability ?? null,
    };
  }

  return { transcribe };
}

module.exports = { createElevenLabsSttProvider };
