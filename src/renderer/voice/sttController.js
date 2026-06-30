// src/renderer/voice/sttController.js
function createSttController() {
  function listenOnce(onResult, onError) {
    const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionImpl) {
      onError(new Error('Speech recognition is not supported in this browser, sir.'));
      return;
    }

    const recognition = new SpeechRecognitionImpl();
    recognition.lang = window.__marvisLanguage === 'zh' ? 'zh-CN' : 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    let settled = false;

    recognition.onresult = (event) => {
      settled = true;
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    };

    recognition.onerror = (event) => {
      settled = true;
      onError(new Error(`Speech recognition error: ${event.error}`));
    };

    recognition.onend = () => {
      if (!settled) {
        onError(new Error('No speech detected, sir.'));
      }
    };

    recognition.start();
  }

  return { listenOnce };
}
