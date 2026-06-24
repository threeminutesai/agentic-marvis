// Local Whisper via @xenova/transformers — fully offline, no API key needed.
// ESM-only package loaded via dynamic import().
let pipeline = null;
let pipelineReady = null;

async function getWhisperPipeline() {
  if (pipeline) return pipeline;
  if (pipelineReady) return pipelineReady;

  pipelineReady = (async () => {
    console.log('[Whisper] Loading local model (Xenova/whisper-tiny) — first run will download ~75MB...');
    const { pipeline: createPipeline, env } = await import('@xenova/transformers');
    env.cacheDir = require('node:path').join(require('node:os').homedir(), '.marvis-models');
    env.allowLocalModels = false;
    pipeline = await createPipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
      progress_callback: (p) => {
        if (p.status === 'downloading') {
          const pct = p.progress != null ? ` ${Math.round(p.progress)}%` : '';
          console.log(`[Whisper] Downloading ${p.file}${pct}`);
        } else if (p.status === 'done') {
          console.log(`[Whisper] ${p.file} ready`);
        } else if (p.status === 'ready') {
          console.log('[Whisper] Model ready — local STT active');
        }
      },
    });
    return pipeline;
  })();

  return pipelineReady;
}

function createWhisperLocalProvider() {
  async function transcribe({ pcmFloat32, sampleRate = 16000 }) {
    const asr = await getWhisperPipeline();
    // @xenova/transformers expects a Float32Array at 16 kHz
    let audio = pcmFloat32;
    if (!(audio instanceof Float32Array)) {
      audio = new Float32Array(pcmFloat32);
    }
    const result = await asr(audio, { sampling_rate: sampleRate });
    return { text: result.text || '' };
  }

  return { transcribe };
}

module.exports = { createWhisperLocalProvider, getWhisperPipeline };
