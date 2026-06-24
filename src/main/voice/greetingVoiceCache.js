const path = require('node:path');

const DEFAULT_VOICE_CACHE_KEY = 'default';

function hashVoiceText(text) {
  const value = String(text || '');
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return String(Math.abs(hash >>> 0) % 100000).padStart(5, '0');
}

function slugifyGreeting(text) {
  const slug = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'greeting';
}

function getCachedVoicePath({ cacheDir, voiceId, text, category = 'greetings' }) {
  const voiceCacheKey = voiceId || DEFAULT_VOICE_CACHE_KEY;
  const categoryKey = String(category || 'general').replace(/[^a-z0-9_-]/gi, '-');
  return path.join(
    cacheDir,
    categoryKey,
    voiceCacheKey,
    `${hashVoiceText(text)}.base64`
  );
}

function getGreetingVoicePath({ cacheDir, voiceId, text }) {
  return getCachedVoicePath({ cacheDir, voiceId, text, category: 'greetings' });
}

function readSavedGreeting({ fsImpl, voicePath }) {
  if (!fsImpl.existsSync(voicePath)) return null;
  const savedAudio = fsImpl.readFileSync(voicePath, 'utf8').trim();
  return savedAudio || null;
}

async function synthesizeGreetingWithCache({
  text,
  settings,
  apiKey,
  cacheDir,
  fsImpl,
  createProvider,
  category = 'greetings',
}) {
  const voiceId = settings.elevenLabsVoiceId || '';
  const voicePath = getCachedVoicePath({ cacheDir, voiceId, text, category });

  try {
    const savedAudio = readSavedGreeting({ fsImpl, voicePath });
    if (savedAudio) {
      console.log('[TTS] Reusing saved greeting voice file');
      return { ok: true, audioBase64: savedAudio, reused: true, voicePath };
    }
  } catch (err) {
    console.log(`[TTS] Saved voice file unreadable, will regenerate: ${err.message}`);
  }

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
  getCachedVoicePath,
  getGreetingVoicePath,
  hashVoiceText,
  slugifyGreeting,
  synthesizeGreetingWithCache,
};
