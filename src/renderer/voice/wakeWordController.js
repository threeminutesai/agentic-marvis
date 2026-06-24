// src/renderer/voice/wakeWordController.js
// Priority: Local Whisper (offline) → ElevenLabs STT → Web Speech API (Google)
const CHUNK_MS = 4000;
const TARGET_SAMPLE_RATE = 16000;

function createWakeWordController() {
  let shouldListen = false;
  let mediaRecorder = null;
  let stream = null;
  let onWakeCb = null;
  let wakeWord = 'marvis';
  let audioCtx = null;

  // Decode WebM blob → resample to 16kHz mono Float32Array using Web Audio API
  async function decodeToFloat32(blob) {
    audioCtx = audioCtx || new AudioContext();
    const arrayBuffer = await blob.arrayBuffer();
    const decoded = await audioCtx.decodeAudioData(arrayBuffer);
    // Mix down to mono
    const rawPcm = decoded.getChannelData(0);
    if (decoded.sampleRate === TARGET_SAMPLE_RATE) return rawPcm;
    // Resample via OfflineAudioContext
    const ratio = decoded.sampleRate / TARGET_SAMPLE_RATE;
    const outLen = Math.round(rawPcm.length / ratio);
    const offCtx = new OfflineAudioContext(1, outLen, TARGET_SAMPLE_RATE);
    const buf = offCtx.createBuffer(1, rawPcm.length, decoded.sampleRate);
    buf.copyToChannel(rawPcm, 0);
    const src = offCtx.createBufferSource();
    src.buffer = buf;
    src.connect(offCtx.destination);
    src.start(0);
    const rendered = await offCtx.startRendering();
    return rendered.getChannelData(0);
  }

  async function processChunk(blob, backend) {
    if (!shouldListen) return;
    try {
      let result;
      if (backend === 'whisper-local') {
        const pcm = await decodeToFloat32(blob);
        const maxVal = pcm.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
        console.log(`[WakeWord] PCM samples:${pcm.length} blobSize:${blob.size} maxAmplitude:${maxVal.toFixed(4)}`);
        result = await window.marvis.transcribeWhisperLocal({
          pcmFloat32: Array.from(pcm),
          sampleRate: TARGET_SAMPLE_RATE,
        });
      } else if (backend === 'whisper') {
        const reader = new FileReader();
        const base64 = await new Promise((res, rej) => {
          reader.onloadend = () => { const r = String(reader.result || ''); res(r.includes(',') ? r.split(',')[1] : r); };
          reader.onerror = () => rej(reader.error);
          reader.readAsDataURL(blob);
        });
        result = await window.marvis.transcribeWhisper({ audioBase64: base64, mimeType: blob.type || 'audio/webm' });
      } else {
        const reader = new FileReader();
        const base64 = await new Promise((res, rej) => {
          reader.onloadend = () => { const r = String(reader.result || ''); res(r.includes(',') ? r.split(',')[1] : r); };
          reader.onerror = () => rej(reader.error);
          reader.readAsDataURL(blob);
        });
        result = await window.marvis.transcribeSpeech({ audioBase64: base64, mimeType: blob.type || 'audio/webm' });
      }
      if (!shouldListen) return;
      const text = (result.ok ? result.text : '').toLowerCase().trim();
      console.log('[WakeWord] transcript:', text || '(empty)');
      // Exact match or fuzzy: first 4 chars of wakeWord appear in transcript
      const prefix = wakeWord.slice(0, 4);
      if (result.ok && text && (text.includes(wakeWord) || text.includes(prefix))) {
        console.log('[WakeWord] wake word detected!');
        stopMediaRecorder();
        onWakeCb();
      }
    } catch (err) {
      console.error('[WakeWord] chunk error:', err.message);
    }
  }

  function startMediaRecorder(onWake, word, onError, backend) {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((s) => {
        if (!shouldListen) { s.getTracks().forEach((t) => t.stop()); return; }
        stream = s;
        function recordChunk() {
          if (!shouldListen) return;
          const recorder = new MediaRecorder(stream);
          const chunks = [];
          recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
          recorder.onstop = () => {
            const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
            processChunk(blob, backend);
            if (shouldListen) recordChunk();
          };
          mediaRecorder = recorder;
          recorder.start();
          setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, CHUNK_MS);
        }
        recordChunk();
      })
      .catch((err) => {
        console.error('Wake word mic error:', err.message);
        if (onError) onError(`Microphone access denied: ${err.message}`);
      });
  }

  function stopMediaRecorder() {
    shouldListen = false;
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.onstop = null;
      mediaRecorder.stop();
    }
    mediaRecorder = null;
    if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
  }

  // --- Web Speech API fallback ---

  let recognition = null;

  function startWebSpeech(onWake, word, onError) {
    const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionImpl) {
      if (onError) onError('No speech recognition available.');
      return;
    }
    let retryDelay = 1000;
    function listen() {
      recognition = new SpeechRecognitionImpl();
      recognition.lang = 'en-US';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event) => {
        retryDelay = 1000;
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i][0].transcript.toLowerCase().includes(word)) {
            stopWebSpeech();
            onWake();
            return;
          }
        }
      };
      recognition.onerror = (event) => {
        if (event.error === 'no-speech' || event.error === 'aborted') return;
        if (event.error === 'network') {
          shouldListen = false;
          recognition = null;
          if (onError) onError('Wake word unavailable: Google Speech API unreachable. Use the mic button instead.');
          return;
        }
        console.error('Wake word error:', event.error);
      };
      recognition.onend = () => {
        if (!shouldListen) return;
        setTimeout(() => { if (shouldListen) listen(); }, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 30000);
      };
      recognition.start();
    }
    listen();
  }

  function stopWebSpeech() {
    shouldListen = false;
    if (recognition) { recognition.onend = null; recognition.stop(); recognition = null; }
  }

  // --- Public API ---

  function start(onWake, word = 'marvis', onError) {
    if (shouldListen) return false;
    shouldListen = true;
    onWakeCb = onWake;
    wakeWord = word.toLowerCase();

    // Priority: ElevenLabs STT → Web Speech API
    if (window.marvis?.transcribeSpeech) {
      console.log('[WakeWord] Using ElevenLabs STT, listening for:', wakeWord);
      startMediaRecorder(onWake, wakeWord, onError, 'elevenlabs');
    } else {
      startWebSpeech(onWake, wakeWord, onError);
    }
    return true;
  }

  function stop() {
    stopMediaRecorder();
    stopWebSpeech();
    shouldListen = false;
  }

  return { start, stop };
}
