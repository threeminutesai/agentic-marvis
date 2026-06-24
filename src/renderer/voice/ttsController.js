// src/renderer/voice/ttsController.js
function isElevenLabsQuotaShortage(error) {
  const text = String(error || '').toLowerCase();
  return text.includes('exceeds your quota')
    || (text.includes('credits remaining') && text.includes('required'));
}

function createTtsController() {
  let levelCallback = null;
  let audioCtx = null;
  let analyser = null;
  let dataArray = null;
  let rafId = null;
  let currentAudio = null;
  let currentResolve = null;
  let volume = 1;

  function setOnLevel(cb) {
    levelCallback = cb;
  }

  function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
  }

  function emitLevel(level) {
    if (levelCallback) levelCallback(level);
  }

  function stopLevelLoop() {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
    emitLevel(0);
  }

  function stop() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    }
    stopLevelLoop();
    if (currentResolve) {
      const resolve = currentResolve;
      currentResolve = null;
      resolve();
    }
  }

  function startLevelLoop() {
    if (!analyser || !dataArray) return;
    const tick = () => {
      analyser.getByteTimeDomainData(dataArray);
      let sumSquares = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const sample = (dataArray[i] - 128) / 128;
        sumSquares += sample * sample;
      }
      const rms = Math.sqrt(sumSquares / dataArray.length);
      emitLevel(Math.min(1, rms * 4));
      rafId = requestAnimationFrame(tick);
    };
    tick();
  }

  async function speak(text) {
    try {
      const result = await window.marvis.synthesizeSpeech(text);
      if (!result.ok) {
        if (isElevenLabsQuotaShortage(result.error)) {
          window.dispatchEvent(new CustomEvent('marvis:temporaryNotice', {
            detail: {
              type: 'warning',
              message: 'ElevenLabs credits are too low for this voice request.',
            },
          }));
        }
        return;
      }
      await playWithLevelAnalysis(`data:audio/mpeg;base64,${result.audioBase64}`);
    } catch {
      // ElevenLabs unavailable — stay silent
    }
  }

  function playWithLevelAnalysis(src) {
    return new Promise((resolve) => {
      const audio = new Audio(src);
      audio.volume = volume;
      currentAudio = audio;
      currentResolve = resolve;
      try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const source = audioCtx.createMediaElementSource(audio);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        dataArray = new Uint8Array(analyser.fftSize);
        source.connect(analyser);
        analyser.connect(audioCtx.destination);
      } catch {
        analyser = null;
      }

      audio.onended = () => {
        stopLevelLoop();
        currentAudio = null;
        if (currentResolve) {
          currentResolve = null;
          resolve();
        }
      };
      audio.onerror = () => {
        stopLevelLoop();
        currentAudio = null;
        if (currentResolve) {
          currentResolve = null;
          resolve();
        }
      };
      audio
        .play()
        .then(() => startLevelLoop())
        .catch(() => {
          stopLevelLoop();
          currentAudio = null;
          currentResolve = null;
          resolve();
        });
    });
  }

  return { speak, setOnLevel, setVolume, stop };
}

if (typeof module !== 'undefined') module.exports = { createTtsController, isElevenLabsQuotaShortage };
