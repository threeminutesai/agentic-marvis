// src/renderer/voice/wakeWordController.js
// Primary: ElevenLabs STT via MediaRecorder chunks
// Fallback: Web Speech API (requires Google connectivity)
const CHUNK_MS = 4000;

function createWakeWordController() {
  let shouldListen = false;
  let mediaRecorder = null;
  let stream = null;
  let onWakeCb = null;
  let wakeWord = 'marvis';

  async function processChunk(blob) {
    if (!shouldListen) return;
    try {
      const reader = new FileReader();
      const base64 = await new Promise((res, rej) => {
        reader.onloadend = () => { const r = String(reader.result || ''); res(r.includes(',') ? r.split(',')[1] : r); };
        reader.onerror = () => rej(reader.error);
        reader.readAsDataURL(blob);
      });
      const result = await window.marvis.transcribeSpeech({ audioBase64: base64, mimeType: blob.type || 'audio/webm' });
      if (!shouldListen) return;
      const text = (result.ok ? result.text : '').toLowerCase().trim();
      const prefix = wakeWord.slice(0, 4);
      if (text && (text.includes(wakeWord) || text.includes(prefix))) {
        console.log('[WakeWord] detected:', text);
        stopMediaRecorder();
        onWakeCb();
      }
    } catch (err) {
      console.error('[WakeWord] chunk error:', err.message);
    }
  }

  function startMediaRecorder(onWake, onError) {
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
            processChunk(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
            if (shouldListen) recordChunk();
          };
          mediaRecorder = recorder;
          recorder.start();
          setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, CHUNK_MS);
        }
        recordChunk();
      })
      .catch((err) => {
        console.error('[WakeWord] mic error:', err.message);
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

  let recognition = null;

  function startWebSpeech(onWake, word, onError) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { if (onError) onError('Speech recognition not supported.'); return; }
    let retryDelay = 1000;
    function listen() {
      recognition = new SR();
      recognition.lang = 'en-US';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event) => {
        retryDelay = 1000;
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i][0].transcript.toLowerCase().includes(word)) {
            stopWebSpeech(); onWake(); return;
          }
        }
      };
      recognition.onerror = (event) => {
        if (event.error === 'no-speech' || event.error === 'aborted') return;
        if (event.error === 'network') {
          shouldListen = false; recognition = null;
          if (onError) onError('Wake word unavailable: Google Speech API unreachable. Use the mic button instead.');
          return;
        }
        console.error('[WakeWord] error:', event.error);
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

  function start(onWake, word = 'marvis', onError) {
    if (shouldListen) return false;
    shouldListen = true;
    onWakeCb = onWake;
    wakeWord = word.toLowerCase();
    if (window.marvis?.transcribeSpeech) {
      console.log('[WakeWord] Using ElevenLabs STT, listening for:', wakeWord);
      startMediaRecorder(onWake, onError);
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
