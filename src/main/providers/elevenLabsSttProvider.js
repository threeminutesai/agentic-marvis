const AUDIO_EVENT_TAG_RE = /\[(?:audio|background|beep|chime|doorbell|intro|keyboard|laughter|laughs?|music|noise|notification|outro|phone|ring(?:ing)?|silence|typing|inaudible)[^\]]*\]/gi;

function cleanTranscriptText(text) {
  return String(text || '')
    .replace(AUDIO_EVENT_TAG_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function audioFileNameForMime(mimeType) {
  const normalized = String(mimeType || '').toLowerCase();
  if (normalized.includes('mp4')) return 'speech.m4a';
  if (normalized.includes('mpeg') || normalized.includes('mp3')) return 'speech.mp3';
  if (normalized.includes('wav')) return 'speech.wav';
  if (normalized.includes('ogg')) return 'speech.ogg';
  return 'speech.webm';
}

function createElevenLabsSttProvider({ apiKey, fetchImpl = fetch }) {
  async function transcribe({ audioBuffer, mimeType = 'audio/webm' }) {
    const form = new FormData();
    form.append('model_id', 'scribe_v2');
    form.append('language_code', 'eng');
    form.append('keyterms', 'financial');
    form.append('keyterms', 'finance');
    form.append('file', new Blob([audioBuffer], { type: mimeType }), audioFileNameForMime(mimeType));

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
      text: cleanTranscriptText(data.text),
      rawText: data.text || '',
      languageCode: data.language_code || null,
      languageProbability: data.language_probability ?? null,
    };
  }

  return { transcribe };
}

module.exports = { createElevenLabsSttProvider, cleanTranscriptText, audioFileNameForMime };
