// src/main/providers/elevenLabsProvider.js
const DEFAULT_VOICE_ID = 'pNInz6obpgDQGcFmaJgB'; // ElevenLabs "Adam" voice — calm, formal male voice

function createElevenLabsProvider({ apiKey, voiceId = DEFAULT_VOICE_ID, fetchImpl = fetch }) {
  async function synthesize(text) {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
    console.log(`[ElevenLabs] POST ${url}`);
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',
      }),
    });

    if (!response.ok) {
      let detail = '';
      try {
        const errorBody = await response.json();
        detail = errorBody.detail?.message ? ` — ${errorBody.detail.message}` : '';
      } catch {
        detail = '';
      }
      const errMsg = `ElevenLabs API error (${response.status})${detail}`;
      console.log(`[ElevenLabs] ${errMsg}`);
      throw new Error(errMsg);
    }
    console.log(`[ElevenLabs] Response OK (${response.status}).`);

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  return { synthesize };
}

module.exports = { createElevenLabsProvider };
