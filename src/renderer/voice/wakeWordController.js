// src/renderer/voice/wakeWordController.js
function createWakeWordController() {
  let recognition = null;
  let shouldListen = false;

  function listen(SpeechRecognitionImpl, onWake) {
    recognition = new SpeechRecognitionImpl();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.toLowerCase();
        if (transcript.includes('jarvis')) {
          stop();
          onWake();
          return;
        }
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      console.error('Wake word listener error, sir:', event.error);
    };

    recognition.onend = () => {
      if (shouldListen) listen(SpeechRecognitionImpl, onWake);
    };

    recognition.start();
  }

  function start(onWake) {
    if (shouldListen) return false;
    const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionImpl) {
      console.error('Wake word listening is not supported in this browser, sir.');
      return false;
    }
    shouldListen = true;
    listen(SpeechRecognitionImpl, onWake);
    return true;
  }

  function stop() {
    shouldListen = false;
    if (recognition) {
      recognition.onend = null;
      recognition.stop();
      recognition = null;
    }
  }

  return { start, stop };
}
