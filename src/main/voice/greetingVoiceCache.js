const path = require('node:path');

const DEFAULT_VOICE_CACHE_KEY = 'default';

function slugifyGreeting(text) {
  const slug = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'greeting';
}

function getGreetingVoicePath({ homeDir, voiceId, text }) {
  const voiceCacheKey = voiceId || DEFAULT_VOICE_CACHE_KEY;
  return path.join(
    homeDir,
    '.jarvis-voices',
    'greetings',
    voiceCacheKey,
    `${slugifyGreeting(text)}.base64`
  );
}

function readSavedGreeting({ fsImpl, voicePath }) {
  if (!fsImpl.existsSync(voicePath)) return null;
  const savedAudio = fsImpl.readFileSync(voicePath, 'utf8').trim();
  return savedAudio || null;
}

async function synthesizeGreetingWithCache({
  text,
  settings,
  homeDir,
  fsImpl,
  createProvider,
}) {
  const voiceId = settings.elevenLabsVoiceId || '';
  const voicePath = getGreetingVoicePath({ homeDir, voiceId, text });

  try {
    const savedAudio = readSavedGreeting({ fsImpl, voicePath });
    if (savedAudio) {
      console.log('[TTS] Reusing saved greeting voice file');
      return { ok: true, audioBase64: savedAudio, reused: true, voicePath };
    }
  } catch (err) {
    console.log(`[TTS] Saved voice file unreadable, will regenerate: ${err.message}`);
  }

  const apiKey = settings.apiKeys?.elevenlabs;
  if (!apiKey) {
    console.log('[TTS] No ElevenLabs API key configured, will fall back to Web Speech.');
    return { ok: false };
  }

  try {
    const provider = createProvider({ apiKey, voiceId: voiceId || undefined });
    const audioBuffer = await provider.synthesize(text);
    const audioBase64 = audioBuffer.toString('base64');

    fsImpl.mkdirSync(path.dirname(voicePath), { recursive: true });
    fsImpl.writeFileSync(voicePath, audioBase64, 'utf8');

    console.log('[TTS] Synthesized and saved greeting voice file');
    return { ok: true, audioBase64, reused: false, voicePath };
  } catch (err) {
    console.log(`[TTS] ElevenLabs failed: ${err.message} - falling back to Web Speech.`);
    return { ok: false, error: err.message };
  }
}

module.exports = {
  getGreetingVoicePath,
  slugifyGreeting,
  synthesizeGreetingWithCache,
};
