// src/renderer/voice/wakeWordController.js
// Passive wake listening:
// 1. monitor mic volume locally
// 2. collect a short utterance only after speech starts
// 3. send that utterance to ElevenLabs STT
// 4. fuzzy-match the transcript to the configured wake word
const PASSIVE_TIMESLICE_MS = 250;
const PASSIVE_MIN_SPEECH_THRESHOLD = 0.02;
const PASSIVE_NOISE_MULTIPLIER = 2.2;
const PASSIVE_PREROLL_MS = 350;
const PASSIVE_SILENCE_MS = 1000;
const PASSIVE_MAX_UTTERANCE_MS = 7000;
const WAKE_WORD_THRESHOLD = 0.8;
const WAKE_WORD_COOLDOWN_MS = 5000;

const wakeWordMatcher = window.MarvisWakeWordMatcher;

function createWakeWordController() {
  let shouldListen = false;
  let stream = null;
  let audioCtx = null;
  let analyser = null;
  let levelData = null;
  let levelRafId = null;
  let scriptProcessor = null;
  let onWakeCb = null;
  let onTranscriptCb = null;
  let onErrorCb = null;
  let wakeWord = 'marvis';
  let lastWakeAt = 0;
  let utteranceActive = false;
  let utteranceBlocks = [];
  let preRollBlocks = [];
  let preRollSamples = 0;
  let utteranceStartedAt = 0;
  let lastSpeechAt = 0;
  let noiseFloor = PASSIVE_MIN_SPEECH_THRESHOLD;

  function stopLevelLoop() {
    if (levelRafId !== null) cancelAnimationFrame(levelRafId);
    levelRafId = null;
  }

  function cleanupAudioNodes() {
    stopLevelLoop();
    if (audioCtx) {
      audioCtx.close().catch(() => {});
      audioCtx = null;
    }
    analyser = null;
    levelData = null;
    scriptProcessor = null;
  }

  function resetUtteranceState() {
    utteranceActive = false;
    utteranceBlocks = [];
    utteranceStartedAt = 0;
    lastSpeechAt = 0;
  }

  function getSpeechThreshold() {
    return Math.max(PASSIVE_MIN_SPEECH_THRESHOLD, noiseFloor * PASSIVE_NOISE_MULTIPLIER);
  }

  function encodeWavFromFloat32(blocks, sampleRate) {
    const samples = blocks.reduce((sum, block) => sum + block.length, 0);
    const bytesPerSample = 2;
    const dataSize = samples * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    function writeAscii(offset, text) {
      for (let index = 0; index < text.length; index += 1) {
        view.setUint8(offset + index, text.charCodeAt(index));
      }
    }

    writeAscii(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeAscii(8, 'WAVE');
    writeAscii(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * bytesPerSample, true);
    view.setUint16(32, bytesPerSample, true);
    view.setUint16(34, 16, true);
    writeAscii(36, 'data');
    view.setUint32(40, dataSize, true);

    let offset = 44;
    for (const block of blocks) {
      for (let index = 0; index < block.length; index += 1) {
        const sample = Math.max(-1, Math.min(1, block[index]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        offset += 2;
      }
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  function pushPreRollBlock(block) {
    preRollBlocks.push(block);
    preRollSamples += block.length;
    const maxPreRollSamples = Math.round((audioCtx?.sampleRate || 44100) * (PASSIVE_PREROLL_MS / 1000));
    while (preRollSamples > maxPreRollSamples && preRollBlocks.length) {
      const removed = preRollBlocks.shift();
      preRollSamples -= removed.length;
    }
  }

  function appendAudioBlock(float32Block) {
    const copy = new Float32Array(float32Block.length);
    copy.set(float32Block);
    if (utteranceActive) {
      utteranceBlocks.push(copy);
      return;
    }
    pushPreRollBlock(copy);
  }

  async function processUtterance(blob) {
    if (!shouldListen || !blob?.size) return;
    try {
      const reader = new FileReader();
      const base64 = await new Promise((resolve, reject) => {
        reader.onloadend = () => {
          const result = String(reader.result || '');
          resolve(result.includes(',') ? result.split(',')[1] : result);
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });

      const result = await window.marvis.transcribeSpeech({
        audioBase64: base64,
        mimeType: blob.type || 'audio/webm',
      });
      if (!shouldListen) return;
      if (!result?.ok) {
        console.error('[WakeWord] STT failed:', result?.error || 'Unknown error');
        if (typeof onErrorCb === 'function') {
          onErrorCb(`Wake word STT failed: ${result?.error || 'Unknown error'}`);
        }
        return;
      }

      const transcript = String(result.text || '').trim();
      const match = wakeWordMatcher
        ? wakeWordMatcher.bestWakeWordMatch(transcript, wakeWord, WAKE_WORD_THRESHOLD)
        : {
            detected: transcript.toLowerCase().includes(wakeWord),
            score: transcript ? 1 : 0,
            alias: wakeWord,
            transcriptToken: transcript,
          };

      if (transcript && typeof onTranscriptCb === 'function') {
        onTranscriptCb(transcript, match);
      }

      if (match.detected && Date.now() - lastWakeAt >= WAKE_WORD_COOLDOWN_MS) {
        lastWakeAt = Date.now();
        if (typeof onWakeCb === 'function') onWakeCb(transcript, match);
      }
    } catch (err) {
      console.error('[WakeWord] utterance error:', err.message);
    }
  }

  function flushUtterance() {
    if (!utteranceActive) {
      resetUtteranceState();
      return;
    }
    if (!utteranceBlocks.length) {
      resetUtteranceState();
      return;
    }
    const blocks = utteranceBlocks.slice();
    const blob = encodeWavFromFloat32(blocks, audioCtx?.sampleRate || 44100);
    resetUtteranceState();
    processUtterance(blob);
  }

  function startUtteranceIfNeeded() {
    if (utteranceActive) return;
    utteranceActive = true;
    utteranceStartedAt = Date.now();
    utteranceBlocks = preRollBlocks.map((block) => {
      const copy = new Float32Array(block.length);
      copy.set(block);
      return copy;
    });
  }

  function monitorVoiceLevel() {
    if (!shouldListen || !analyser || !levelData) return;
    analyser.getByteTimeDomainData(levelData);
    let sumSquares = 0;
    for (let i = 0; i < levelData.length; i += 1) {
      const sample = (levelData[i] - 128) / 128;
      sumSquares += sample * sample;
    }
    const rms = Math.sqrt(sumSquares / levelData.length);
    const now = Date.now();
    const threshold = getSpeechThreshold();

    if (!utteranceActive) {
      noiseFloor = (noiseFloor * 0.92) + (Math.min(rms, threshold) * 0.08);
    }

    if (rms >= threshold) {
      lastSpeechAt = now;
      startUtteranceIfNeeded();
    }

    if (utteranceActive) {
      const silenceExpired = lastSpeechAt && now - lastSpeechAt >= PASSIVE_SILENCE_MS;
      const tooLong = utteranceStartedAt && now - utteranceStartedAt >= PASSIVE_MAX_UTTERANCE_MS;
      if (silenceExpired || tooLong) {
        flushUtterance();
      }
    }

    levelRafId = requestAnimationFrame(monitorVoiceLevel);
  }

  function startPassiveRecorder(onError) {
    navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    }).then((mediaStream) => {
      if (!shouldListen) {
        mediaStream.getTracks().forEach((track) => track.stop());
        return;
      }

      stream = mediaStream;
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      const source = audioCtx.createMediaStreamSource(stream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      levelData = new Uint8Array(analyser.fftSize);
      source.connect(analyser);
      scriptProcessor = audioCtx.createScriptProcessor(2048, 1, 1);
      source.connect(scriptProcessor);
      scriptProcessor.connect(audioCtx.destination);
      scriptProcessor.onaudioprocess = (event) => {
        if (!shouldListen) return;
        appendAudioBlock(event.inputBuffer.getChannelData(0));
      };

      monitorVoiceLevel();
    }).catch((err) => {
      console.error('[WakeWord] mic error:', err.message);
      if (onError) onError(`Microphone access denied: ${err.message}`);
    });
  }

  function stopPassiveRecorder() {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }
    cleanupAudioNodes();
    resetUtteranceState();
  }

  function start(onWake, word = 'marvis', onError, onTranscript) {
    if (shouldListen) return false;
    shouldListen = true;
    onWakeCb = onWake;
    onTranscriptCb = onTranscript;
    onErrorCb = onError;
    wakeWord = word.toLowerCase();
    lastWakeAt = 0;
    noiseFloor = PASSIVE_MIN_SPEECH_THRESHOLD;
    startPassiveRecorder(onError);
    return true;
  }

  function stop() {
    shouldListen = false;
    stopPassiveRecorder();
  }

  return { start, stop };
}
