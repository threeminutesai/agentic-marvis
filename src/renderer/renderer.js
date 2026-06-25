// src/renderer/renderer.js
let avatarController = null;
let currentSettings = null;
let onboarding = false;
let isMuted = false;
let isMusicMuted = false;
let isBusy = false;
let isSpeaking = false;
let isProcessingResponse = false;
let shouldAbortResponse = false;
let currentAvatarState = 'idle';
let statusRows = [];
let currentNewsBriefingItems = [];
let activeOperationId = null;
let audioRecorder = null;
let audioChunks = [];
let isRecordingAudio = false;
let temporaryNoticeTimer = null;
let processingCueAudio = null;
let cachedVoiceAudio = null;
let voicePhraseTab = 'morning';
let voicePhraseDraft = null;
let nowPlayingWidgetTimer = null;
let appClockTimer = null;

// Pending attachments (panel screenshot captures) to be sent with the next
// CLI-delegated message. See docs/superpowers/specs/
// 2026-06-23-panel-screenshot-capture-design.md.
let pendingAttachments = [];
let currentHtmlPath = null; // Track HTML file currently displayed for joint analysis with screenshots

// Capture drag-to-select state.
let captureSelectMode = false;
let captureSelectStartX = null;
let captureSelectStartY = null;

const PROCESSING_CUES = [
  'Working on it.',
  'Processing.',
  'Got it. Checking now.',
  'On it, sir.',
  'Give me a moment.',
  'I am looking into it.',
  'Understood. Running the request.',
];

const DEFAULT_VOICE_PHRASES = {
  morning: ['Good morning [user]', 'Hi [user]', 'Morning [user]'],
  afternoon: ['Good afternoon [user]', 'Hi [user]', 'Ready for the afternoon run [user]'],
  evening: ['Good evening [user]', 'Hi [user]', 'Welcome back [user]'],
  processing: ['Working on it', 'Processing', 'Got it. Checking now', 'On it [user]', 'Give me a moment'],
};

function showStartupProblem(message) {
  const setupStatus = document.getElementById('setup-status');
  if (setupStatus) setupStatus.textContent = `Startup problem: ${message}`;
  const modal = document.getElementById('settings-modal');
  if (modal) modal.classList.remove('hidden');
}

window.addEventListener('error', (event) => {
  showStartupProblem(event.message || 'Unknown renderer error.');
});

window.addEventListener('unhandledrejection', (event) => {
  showStartupProblem(event.reason?.message || String(event.reason || 'Unknown renderer promise error.'));
});

function showTemporaryNotice(message, timeoutMs = 5000) {
  const notice = document.getElementById('temporary-notice');
  if (!notice) return;
  notice.textContent = message;
  notice.classList.remove('hidden');
  if (temporaryNoticeTimer) clearTimeout(temporaryNoticeTimer);
  temporaryNoticeTimer = setTimeout(() => {
    notice.classList.add('hidden');
    temporaryNoticeTimer = null;
  }, timeoutMs);
}

window.addEventListener('marvis:temporaryNotice', (event) => {
  showTemporaryNotice(event.detail?.message || 'Temporary voice notice.');
});

const wakeWordController = createWakeWordController();
const sttController = createSttController();
const ttsController = createTtsController();
const musicController = createMusicController();
const musicPanel = createMusicPanel({ musicController });
ttsController.setOnLevel((level) => {
  if (avatarController) avatarController.setLevel(level);
});
musicController.setOnLevel((level) => {
  if (avatarController) avatarController.setOuterLevel(level);
});

function updateSendButton() {
  const btn = document.getElementById('send-btn');
  if (isProcessingResponse) {
    btn.classList.add('speaking');
    btn.textContent = 'Pause';
    btn.title = 'Pause response';
  } else {
    btn.classList.remove('speaking');
    btn.textContent = 'Send';
    btn.title = 'Send message';
  }
}

function setProcessingResponse(value) {
  isProcessingResponse = value;
  updateSendButton();
}

function updateAudioInputButton() {
  const btn = document.getElementById('audio-input-btn');
  if (!btn) return;
  btn.classList.toggle('recording', isRecordingAudio);
  btn.textContent = isRecordingAudio ? 'Stop' : 'Mic';
  btn.title = isRecordingAudio ? 'Stop recording' : 'Record voice input';
}

function createOperationId() {
  return `op-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function pauseActiveOperation() {
  shouldAbortResponse = true;
  const operationId = activeOperationId;
  activeOperationId = null;
  setProcessingResponse(false);
  isBusy = false;
  stopProcessingCue();
  stopCachedVoice();
  ttsController.stop();
  setAvatarState('idle');
  if (operationId) {
    try {
      await window.marvis.cancelOperation(operationId);
    } catch (err) {
      console.log(`[Cancel] Failed to cancel operation: ${err.message}`);
    }
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => reject(reader.error || new Error('Could not read audio recording.'));
    reader.readAsDataURL(blob);
  });
}

async function submitTranscribedAudio(blob) {
  const audioBase64 = await blobToBase64(blob);
  const result = await window.marvis.transcribeSpeech({
    audioBase64,
    mimeType: blob.type || 'audio/webm',
  });
  if (!result.ok) {
    appendChatLine('Marvis', `I couldn't transcribe that, sir: ${result.error}`);
    return;
  }
  const transcript = result.text.trim();
  if (!transcript) {
    appendChatLine('Marvis', "I couldn't hear any speech in that recording, sir.");
    return;
  }
  document.getElementById('chat-input').value = transcript;
  isBusy = false;
  await sendTextFromInput();
}

async function toggleAudioInput() {
  if (isBusy || isProcessingResponse) return;

  if (isRecordingAudio && audioRecorder) {
    audioRecorder.stop();
    return;
  }

  try {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      throw new Error('Audio recording is not supported in this browser.');
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    audioRecorder = new MediaRecorder(stream);
    audioRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) audioChunks.push(event.data);
    };
    audioRecorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());
      isRecordingAudio = false;
      updateAudioInputButton();
      const blob = new Blob(audioChunks, { type: audioRecorder.mimeType || 'audio/webm' });
      audioRecorder = null;
      audioChunks = [];
      if (!blob.size) return;
      isBusy = true;
      setAvatarState('processing');
      try {
        await submitTranscribedAudio(blob);
      } catch (err) {
        appendChatLine('Marvis', `I couldn't process that recording, sir: ${err.message}`);
      } finally {
        isBusy = false;
        if (!isSpeaking && !isProcessingResponse) setAvatarState('idle');
      }
    };
    audioRecorder.start();
    isRecordingAudio = true;
    updateAudioInputButton();
    setAvatarState('listening');
  } catch (err) {
    appendChatLine('Marvis', `I couldn't access the microphone, sir: ${err.message}`);
  }
}

async function speakReply(text) {
  if (isMuted) return;
  isSpeaking = true;
  updateSendButton();
  setAvatarState('speaking');
  musicController.duck();
  await ttsController.speak(text);
  musicController.unduck();
  setAvatarState('idle');
  isSpeaking = false;
  updateSendButton();
}

function isPhase3() {
  return document.getElementById('app-body')?.classList.contains('phase-3');
}

function normalizeVoicePhrases(settings = currentSettings) {
  return {
    ...DEFAULT_VOICE_PHRASES,
    ...(settings?.voicePhrases || {}),
  };
}

function selectRandomPhrase(category) {
  const phrases = normalizeVoicePhrases()[category] || [];
  const available = phrases.map((phrase) => phrase.trim()).filter(Boolean);
  const pool = available.length ? available : (DEFAULT_VOICE_PHRASES[category] || PROCESSING_CUES);
  const text = pool[Math.floor(Math.random() * pool.length)];
  return applyVoiceTemplate(text);
}

function applyVoiceTemplate(text) {
  const userName = (currentSettings?.userName || '').trim();
  const botName = (currentSettings?.botName || 'MARVIS').trim();
  return String(text || '')
    .replace(/\[user\]/gi, userName || 'sir')
    .replace(/\[box\]/gi, botName)
    .replace(/\s+/g, ' ')
    .trim();
}

function stopProcessingCue() {
  if (processingCueAudio) {
    processingCueAudio.pause();
    processingCueAudio.currentTime = 0;
    processingCueAudio = null;
  }
}

function stopCachedVoice() {
  if (cachedVoiceAudio) {
    cachedVoiceAudio.pause();
    cachedVoiceAudio.currentTime = 0;
    cachedVoiceAudio = null;
  }
}

async function playCachedVoice(text, category) {
  const result = await window.marvis.synthesizeCachedSpeech({ text, category });
  if (!result.ok || !result.audioBase64) return false;
  await new Promise((resolve) => {
    const audio = new Audio(`data:audio/mpeg;base64,${result.audioBase64}`);
    cachedVoiceAudio = audio;
    if (category === 'processing') processingCueAudio = audio;
    audio.onended = () => {
      if (processingCueAudio === audio) processingCueAudio = null;
      if (cachedVoiceAudio === audio) cachedVoiceAudio = null;
      resolve();
    };
    audio.onerror = resolve;
    audio.play().catch(resolve);
  });
  return true;
}

async function speakProcessingCue() {
  if (isMuted || !isPhase3()) return;
  const text = selectRandomPhrase('processing');
  musicController.duck();
  try {
    try {
      const result = await window.marvis.synthesizeCachedSpeech({ text, category: 'processing' });
      if (result.ok && result.audioBase64 && !isMuted && isProcessingResponse) {
        await new Promise((resolve) => {
          const audio = new Audio(`data:audio/mpeg;base64,${result.audioBase64}`);
          processingCueAudio = audio;
          audio.onended = () => {
            if (processingCueAudio === audio) processingCueAudio = null;
            resolve();
          };
          audio.onerror = resolve;
          audio.play().catch(resolve);
        });
        return;
      }
    } catch (err) {
      console.log('[TTS Processing Cue Error]', err.message);
    }

    if (!isMuted && isProcessingResponse) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    }
  } finally {
    musicController.unduck();
  }
}

async function speakBriefing(text) {
  if (isMuted) return;
  isSpeaking = true;
  updateSendButton();
  setAvatarState('speaking');
  musicController.duck();
  try {
    const played = await playCachedVoice(text, 'briefings');
    if (!played) await ttsController.speak(text);
  } finally {
    musicController.unduck();
    setAvatarState('idle');
    isSpeaking = false;
    updateSendButton();
  }
}

function buildCliTaskWithHtmlContract(task, htmlPanel, { forceReport = false } = {}) {
  if (!htmlPanel?.filePath) return task;
  const templateSection = htmlPanel.templatePath
    ? `a style/structure reference template at ${htmlPanel.templatePath} (read it only now, inside this branch) - you don't need to follow it strictly, just keep a similar look and feel (no inline styles or extra <style>/<script> tags beyond what's needed)`
    : `a standalone HTML fragment (no <script> or <style> tags) with the full display content - title, body, source links, image/placeholder area`;

  // forceReport: the user's own phrasing already signaled report intent
  // (see isReportRequest) - skip the self-classification step entirely so
  // the CLI doesn't second-guess and silently downgrade to a voice-only
  // answer despite the user explicitly asking for a report.
  if (forceReport) {
    return `Task: ${task}

The user explicitly asked for this as a report - skip any classification step, this IS a genuine on-screen document. Do not just give a short spoken answer.

[voice]
A short spoken summary, 1-2 sentences, no source URLs, no markdown.
[html] ${htmlPanel.filePath}

Before replying, write ${templateSection} to this exact file path: ${htmlPanel.filePath} (keep the file name exactly as given: ${htmlPanel.fileName}).
Do not send the HTML/content inline to the app. The app will open the file from the [html] path.`;
  }

  return `Task: ${task}

Step 1 - classify this task before doing anything else: is it genuinely a report, diagram, or slide/presentation - structured content meant to be read on screen (research reports, statistics writeups, multi-section summaries with sources, diagrams, slide decks)?
- NO for: jokes, quick answers, small talk, short factual answers, simple conversation, anything a 1-2 sentence spoken reply fully covers. Examples: "tell me a joke", "what's the capital of France", "say hi", "what time is it in Tokyo".
- YES only for genuine on-screen documents. Examples: "give me a report on X", "summarize this week's news with sources", "make a slide deck about Y", "draw a diagram of Z".

Step 2 - respond accordingly. This is the common case - assume NO unless you are confident it's YES.

IF NO:
Output ONLY this, then stop. Do not write any file, do not add an [html] line, do not print markdown/bullets/sources/links in the response:
[voice]
A short spoken summary, 1-2 sentences, no source URLs, no markdown.

IF AND ONLY IF YES:
[voice]
A short spoken summary, 1-2 sentences, no source URLs, no markdown.
[html] ${htmlPanel.filePath}

Before replying, write ${templateSection} to this exact file path: ${htmlPanel.filePath} (keep the file name exactly as given: ${htmlPanel.fileName}).
Do not send the HTML/content inline to the app. The app will open the file from the [html] path.`;
}

function extractPlainVoiceSummary(text) {
  const cleaned = String(text || '')
    .replace(/^Source:.*$/gim, '')
    .replace(/\[[^\]]+\]\(https?:\/\/[^)]+\)/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .trim();
  return cleaned.split(/\r?\n\s*\r?\n/)[0]?.trim() || cleaned || 'I found the summary, sir.';
}

function cleanTextForSpeech(text) {
  return String(text || '')
    .replace(/^Source:.*$/gim, '')
    .replace(/\[[^\]]+\]\(https?:\/\/[^)]+\)/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function formatAssistantResponse(text, { allowHtml = true } = {}) {
  const voiceBlock = extractVoiceContentBlock(text);
  if (voiceBlock) {
    // The right panel only opens from an explicit HTML file path returned by
    // Claude Code/Codex. Inline content is chat text, not panel content.
    let html = null;
    if (allowHtml && voiceBlock.htmlPath) {
      const result = await window.marvis.readHtmlPanel(voiceBlock.htmlPath);
      if (result.ok) html = result.html;
    }
    return {
      reply: voiceBlock.voiceText || extractPlainVoiceSummary(voiceBlock.displayText),
      displayReply: voiceBlock.voiceText,
      html,
    };
  }

  const plainSummary = extractPlainVoiceSummary(text);
  return {
    reply: allowHtml ? plainSummary : (cleanTextForSpeech(text) || plainSummary),
    displayReply: text,
    html: null,
  };
}

function isFirstRun(settings) {
  const keys = settings.apiKeys || {};
  return !keys.deepseek && !keys.gemini && !keys.elevenlabs;
}

async function init() {
  try {
    currentSettings = await window.marvis.getSettings();
    populateSettingsForm(currentSettings);

    if (currentSettings.voiceMuted) setVoiceMuted(true);
    if (currentSettings.musicMuted) isMusicMuted = true; // applied after music starts

    if (isFirstRun(currentSettings)) {
      onboarding = true;
      document.getElementById('welcome-modal').classList.remove('hidden');
      setupWelcomeModal();
      return;
    }

    try {
      const musicCatalog = await musicPanel.load();
      musicController.start(musicCatalog);
      if (isMusicMuted) musicController.pause();
      if (nowPlayingWidgetTimer) clearInterval(nowPlayingWidgetTimer);
      nowPlayingWidgetTimer = setInterval(updateNowPlayingWidget, 5000);
      updateNowPlayingWidget();
    } catch (err) {
      console.log(`[Music] Failed to start scheduled playback: ${err.message}`);
    }

    showAppScreen();
  } catch (err) {
    console.log(`[Init] ${err.message}`);
    showStartupProblem(err.message);
  }
}

function updateAppClock() {
  const clockEl = document.getElementById('app-clock');
  if (!clockEl) return;
  clockEl.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function setupWelcomeModal() {
  let selectedProfile = null;
  const PROFILE_TEMPLATES = {
    ceo: 'CEO / Founder. Focused on vision, growth strategy, fundraising, competitive landscape, market leadership, and company culture.',
    cto: 'Technology Director. Focused on engineering teams, software architecture, product innovation, AI adoption, and technical decision-making.',
    ops: 'Operations Director. Focused on operational efficiency, supply chain, process optimization, cost management, and P&L performance.',
  };

  // Step 1: API Key Setup
  const providerSelect = document.getElementById('welcome-provider-select');
  const elevenLabsCheckbox = document.getElementById('welcome-elevenlabs-checkbox');
  const elevenLabsGroup = document.querySelector('.welcome-elevenlabs-group');
  const step1NextBtn = document.getElementById('welcome-step1-next-btn');

  elevenLabsCheckbox.addEventListener('change', () => {
    if (elevenLabsCheckbox.checked) {
      elevenLabsGroup.classList.remove('hidden');
    } else {
      elevenLabsGroup.classList.add('hidden');
    }
  });

  step1NextBtn.addEventListener('click', async () => {
    const provider = providerSelect.value;
    const apiKey = document.getElementById('welcome-api-key-input').value.trim();

    if (!apiKey) {
      showTemporaryNotice('Please enter your API key.');
      return;
    }

    const elevenLabsKey = elevenLabsCheckbox.checked
      ? document.getElementById('welcome-elevenlabs-key-input').value.trim()
      : '';

    try {
      currentSettings.apiKeys[provider] = apiKey;
      if (elevenLabsKey) {
        currentSettings.apiKeys.elevenlabs = elevenLabsKey;
        currentSettings.elevenLabsVoiceId = '';
      }
      currentSettings.provider = provider;

      document.getElementById('welcome-step-1').classList.add('hidden');
      document.getElementById('welcome-step-2').classList.remove('hidden');
    } catch (err) {
      showTemporaryNotice(`Setup error: ${err.message}`);
    }
  });

  // Step 2: Profile Selection
  const profileOptions = document.querySelectorAll('.profile-option');
  const customProfileInput = document.getElementById('welcome-custom-profile');
  const step2BackBtn = document.getElementById('welcome-step2-back-btn');
  const step2FinishBtn = document.getElementById('welcome-step2-finish-btn');

  profileOptions.forEach((option) => {
    option.addEventListener('click', () => {
      profileOptions.forEach((o) => o.classList.remove('selected'));
      option.classList.add('selected');
      selectedProfile = option.dataset.profile;

      if (selectedProfile === 'custom') {
        customProfileInput.classList.remove('hidden');
      } else {
        customProfileInput.classList.add('hidden');
      }
    });
  });

  step2BackBtn.addEventListener('click', () => {
    document.getElementById('welcome-step-2').classList.add('hidden');
    document.getElementById('welcome-step-1').classList.remove('hidden');
  });

  step2FinishBtn.addEventListener('click', async () => {
    if (!selectedProfile) {
      showTemporaryNotice('Please select a profile.');
      return;
    }

    try {
      let profileText = '';
      let geolocation = '';

      if (selectedProfile === 'custom') {
        profileText = document.getElementById('welcome-profile-input').value.trim();
        geolocation = document.getElementById('welcome-geolocation-input').value.trim();
      } else {
        profileText = PROFILE_TEMPLATES[selectedProfile];
      }

      await window.marvis.saveSettings(currentSettings);
      await window.marvis.updateProfile(profileText, geolocation);

      currentSettings = await window.marvis.getSettings();
      populateSettingsForm(currentSettings);

      document.getElementById('welcome-modal').classList.add('hidden');

      try {
        const musicCatalog = await musicPanel.load();
        musicController.start(musicCatalog);
        if (nowPlayingWidgetTimer) clearInterval(nowPlayingWidgetTimer);
        nowPlayingWidgetTimer = setInterval(updateNowPlayingWidget, 5000);
        updateNowPlayingWidget();
      } catch (err) {
        console.log(`[Music] Failed to start scheduled playback: ${err.message}`);
      }

      showAppScreen();
    } catch (err) {
      showTemporaryNotice(`Setup error: ${err.message}`);
    }
  });
}

function showAppScreen({ keepSettingsOpen = false } = {}) {
  document.getElementById('app-screen').classList.remove('hidden');
  if (!keepSettingsOpen) {
    document.getElementById('settings-modal').classList.add('hidden');
    document.getElementById('setup-banner').classList.add('hidden');
  }
  mountAvatar(currentSettings.avatarStyle);
  updateHud(currentSettings);
  greetUser();
  startWakeWordIfConfigured();
  updateAppClock();
  if (appClockTimer) clearInterval(appClockTimer);
  appClockTimer = setInterval(updateAppClock, 30 * 1000);
  if (briefingCheckTimer) clearInterval(briefingCheckTimer);
  briefingCheckTimer = setInterval(checkPeriodicBriefing, 60 * 1000);
}

function buildSimpleGreeting(rows) {
  const hour = new Date().getHours();
  const category = hour < 12
    ? 'morning'
    : hour < 18
      ? 'afternoon'
      : 'evening';
  return selectRandomPhrase(category);
}

// The same now-playing widget is duplicated in two spots - the chat bar
// (phase-3) and the briefing screen's continue-section, left of Continue -
// so every lookup here updates/wires all instances by class, not a single id.
function updateNowPlayingWidget() {
  const widgets = document.querySelectorAll('.now-playing-widget');
  if (!widgets.length) return;
  const nowPlaying = musicController.getNowPlaying();
  widgets.forEach((widget) => {
    const trackLabel = widget.querySelector('.now-playing-track');
    const trackText = widget.querySelector('.now-playing-track-text');
    const toggleBtn = widget.querySelector('.now-playing-toggle-btn');
    if (!trackLabel || !trackText || !toggleBtn) return;
    if (!nowPlaying) {
      widget.classList.add('hidden');
      return;
    }
    widget.classList.remove('hidden');
    if (trackText.textContent !== nowPlaying.name) trackText.textContent = nowPlaying.name;
    // Recomputed every tick, not just on name change: the very first call can
    // run before web fonts finish loading, which would otherwise measure a
    // narrower fallback-font width and permanently miss a real overflow.
    trackLabel.classList.toggle('scrolling', trackText.scrollWidth > trackLabel.clientWidth);
    toggleBtn.textContent = nowPlaying.isPaused ? 'Play' : 'Pause';
  });
}

document.addEventListener('click', (e) => {
  if (e.target.closest('.now-playing-toggle-btn')) {
    const nowPlaying = musicController.getNowPlaying();
    if (nowPlaying?.isPaused) {
      musicController.resume();
    } else {
      musicController.pause();
    }
    updateNowPlayingWidget();
  } else if (e.target.closest('.now-playing-skip-btn')) {
    musicController.skip();
    updateNowPlayingWidget();
  }
});

// News Briefing stores parallel value[]/detail[] arrays (one headline +
// one longer detail per event). Older status files may still have a plain
// string in either field; normalize both shapes to a flat string list.
function getRowFieldList(rows, type, field) {
  const row = rows.find((r) => r.type === type);
  if (!row) return [];
  const value = row[field];
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

// Unread/Urgent Email counts are intentionally excluded from speech - they're
// still shown on the status cards, just not read aloud.
function buildIntroFragments(rows) {
  const byType = Object.fromEntries(rows.map((r) => [r.type, r.value]));
  const fragments = [];
  const timeStr = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  fragments.push(`the time is ${timeStr}`);
  if (byType['Weather']) fragments.push(`it's ${byType['Weather']} out`);
  return fragments;
}

function joinFragments(fragments) {
  if (!fragments.length) return '';
  return fragments.length === 1
    ? fragments[0]
    : `${fragments.slice(0, -1).join(', ')}, and ${fragments[fragments.length - 1]}`;
}

// Weather/email fragments only, spoken as one chunk ahead of the News
// Briefing items, which are spoken individually (see playNewsBriefingWithVoice)
// so each item's voice line stays in sync with its on-screen reveal.
function buildIntroBriefing(rows) {
  return joinFragments(buildIntroFragments(rows));
}

function buildBriefing(rows) {
  const fragments = buildIntroFragments(rows);
  const newsDetails = getRowFieldList(rows, 'News Briefing', 'detail');
  const newsHeadlines = getRowFieldList(rows, 'News Briefing', 'value');
  const spokenNews = newsDetails.length ? newsDetails.join('. ') : newsHeadlines.join(', ');
  if (spokenNews) fragments.push(`today's briefing: ${spokenNews}`);
  if (!fragments.length) return `I'm online and ready.`;
  return joinFragments(fragments);
}

function buildBriefingDisplay(rows, spokenBriefing) {
  const avatarBriefing = rows.find((row) => row.type === 'Avatar Briefing')?.value;
  if (avatarBriefing) return avatarBriefing;
  const newsHeadlines = getRowFieldList(rows, 'News Briefing', 'value');
  if (newsHeadlines.length) return newsHeadlines.join('\n');
  return spokenBriefing;
}

function buildGreeting(rows) {
  return buildSimpleGreeting(rows) + ' ' + buildBriefing(rows);
}

function matchStatusDetailRequest(text, rows) {
  const lower = text.toLowerCase();
  const asksForDetail = /\b(detail|more info|elaborate|explain more|tell me more)\b/.test(lower);
  if (!asksForDetail) return null;
  for (const row of rows) {
    const typeWords = row.type.toLowerCase().split(/\s+/);
    if (typeWords.some((w) => lower.includes(w))) return row;
  }
  return null;
}

// Recognizes standalone mute/unmute commands typed in chat (e.g. "mute",
// "mute music", "unmute the bot") so they're handled directly rather than
// sent to the AI model. Only matches when the WHOLE message is the command
// (not embedded in a longer sentence), to avoid misfiring on normal chat.
const MUTE_COMMAND_PATTERNS = [
  { target: 'music', re: /^(mute|unmute)\s+(the\s+)?music$/ },
  { target: 'voice', re: /^(mute|unmute)\s+(the\s+)?(bot|voice|marvis)$/ },
  { target: 'all', re: /^(mute|unmute)$/ },
];

function parseMuteCommand(text) {
  const normalized = text.trim().toLowerCase();
  for (const { target, re } of MUTE_COMMAND_PATTERNS) {
    const match = normalized.match(re);
    if (match) return { target, action: match[1] === 'mute' ? 'mute' : 'unmute' };
  }
  return null;
}

let newsBriefingTimer = null;
let newsBriefingToken = 0;
let briefingCheckTimer = null;

async function checkPeriodicBriefing() {
  if (isMuted || isSpeaking) return;
  const frequency = currentSettings?.briefingVoiceFrequency || '1h';
  const lastBriefingVoiceAt = currentSettings?.lastBriefingVoiceAt || null;
  if (!shouldTriggerBriefingVoice(frequency, lastBriefingVoiceAt)) return;

  // Mark as triggered before speaking to prevent double-fire
  if (currentSettings) {
    currentSettings.lastBriefingVoiceAt = new Date().toISOString();
    await window.marvis.saveSettings(currentSettings);
  }

  const newsItems = currentNewsBriefingItems;
  if (newsItems.length) {
    const intro = buildIntroBriefing(statusRows);
    if (intro) await speakBriefing(intro);
    await playNewsBriefingWithVoice(newsItems);
  } else {
    const briefing = buildBriefing(statusRows);
    if (briefing) await speakBriefing(briefing);
  }
}

// Bumping the token invalidates any in-flight playNewsBriefingCycle /
// playNewsBriefingWithVoice run so it stops advancing after this is called
// (e.g. the user sends a new message mid-briefing).
function stopNewsBriefingCycle() {
  newsBriefingToken += 1;
  if (newsBriefingTimer) {
    clearInterval(newsBriefingTimer);
    newsBriefingTimer = null;
  }
}

function setAvatarHeadline(text) {
  const chatLog = document.getElementById('chat-log');
  const lastLine = chatLog.lastElementChild;
  const textEl = lastLine?.querySelector('.chat-text');
  if (!textEl) return;
  textEl.classList.remove('chat-text-flip');
  void textEl.offsetWidth; // restart the CSS animation
  textEl.textContent = text;
  textEl.classList.add('chat-text-flip');
}

function revealNewsBriefingItem(index) {
  const el = document.getElementById(`news-briefing-item-${index}`);
  if (!el) return;
  el.classList.add('revealed');
  // Follow the briefing as items reveal below the fold instead of leaving
  // #status-panel scrolled to the top while new cards appear off-screen.
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function revealAllNewsBriefingItems(count) {
  for (let i = 0; i < count; i++) revealNewsBriefingItem(i);
}

function openNewsDetailModal(index) {
  const item = currentNewsBriefingItems[index];
  if (!item) return;
  const modal = document.getElementById('news-detail-modal');
  const titleEl = document.getElementById('news-detail-title');
  const textEl = document.getElementById('news-detail-text');
  const imageEl = document.getElementById('news-detail-image');
  const linkEl = document.getElementById('news-detail-link');
  if (!modal || !titleEl || !textEl || !imageEl || !linkEl) return;

  titleEl.textContent = item.headline || '';
  textEl.textContent = item.detail || item.headline || '';

  if (isSafeHttpUrl(item.image)) {
    imageEl.src = item.image;
    imageEl.classList.remove('hidden');
  } else {
    imageEl.removeAttribute('src');
    imageEl.classList.add('hidden');
  }

  if (isSafeHttpUrl(item.link)) {
    linkEl.href = item.link;
    linkEl.classList.remove('hidden');
  } else {
    linkEl.removeAttribute('href');
    linkEl.classList.add('hidden');
  }

  modal.classList.remove('hidden');
}

function closeNewsDetailModal() {
  document.getElementById('news-detail-modal')?.classList.add('hidden');
}

document.getElementById('status-panel')?.addEventListener('click', (e) => {
  const item = e.target.closest('.news-briefing-item');
  if (!item) return;
  const index = Number(item.dataset.newsIndex);
  if (!Number.isNaN(index)) openNewsDetailModal(index);
});

// Close on the close button, or on a click anywhere outside the floating
// window (the backdrop covers everything except the window itself).
document.getElementById('news-detail-close-btn')?.addEventListener('click', closeNewsDetailModal);
document.getElementById('news-detail-backdrop')?.addEventListener('click', closeNewsDetailModal);

// Fallback for when the briefing voice isn't due this round: cycles the
// avatar headline and reveals each Latest News item together on a fixed
// timer, since there's no audio to sync against. Plays through items once
// and stops after the last one (see stopNewsBriefingCycle for cancellation).
function playNewsBriefingCycle(items) {
  stopNewsBriefingCycle();
  if (!items.length) return;
  const myToken = newsBriefingToken;

  let index = 0;
  const showItem = () => {
    setAvatarHeadline(items[index].headline);
    revealNewsBriefingItem(index);
  };
  showItem();

  newsBriefingTimer = setInterval(() => {
    if (newsBriefingToken !== myToken) return;
    index += 1;
    if (index >= items.length) {
      stopNewsBriefingCycle();
      return;
    }
    showItem();
  }, NEWS_BRIEFING_ITEM_INTERVAL_MS);
}

// Voice-synced version: shows each headline and reveals its Latest News
// detail exactly when that item starts speaking, then waits for the audio
// to finish before moving on - so the display never runs ahead of or behind
// what's actually being said. Plays through items once and stops.
async function playNewsBriefingWithVoice(items) {
  stopNewsBriefingCycle();
  if (!items.length) return;
  const myToken = newsBriefingToken;

  for (let i = 0; i < items.length && newsBriefingToken === myToken; i++) {
    setAvatarHeadline(items[i].headline);
    revealNewsBriefingItem(i);
    await speakBriefing(items[i].detail || items[i].headline);
    if (newsBriefingToken !== myToken) return;
  }
}

async function speakGreeting(text) {
  // Plays the saved local voice file for this greeting, reusing it on every
  // future greet. Only synthesizes via ElevenLabs the first time this
  // greeting + voice combination is used.
  if (isMuted) return;
  isSpeaking = true;
  updateSendButton();
  setAvatarState('speaking');
  musicController.duck();

  try {
    const result = await window.marvis.synthesizeGreeting(text);
    if (result.ok && result.audioBase64) {
      const audio = new Audio(`data:audio/mpeg;base64,${result.audioBase64}`);
      audio.play().catch((err) => console.log('[Audio] Play failed:', err.message));
      // Wait for audio to finish (roughly)
      await new Promise((resolve) => {
        audio.onended = resolve;
        setTimeout(resolve, 2000);
      });
    } else {
      await ttsController.speak(text);
    }
  } catch (err) {
    console.log('[TTS Greeting Error]', err);
    await ttsController.speak(text);
  } finally {
    musicController.unduck();
    setAvatarState('idle');
    isSpeaking = false;
    updateSendButton();
  }
}

async function greetUser() {
  let userProfileWasDefaulted = false;
  try {
    const result = await window.marvis.getStatus();
    statusRows = result.ok ? result.rows : [];
    userProfileWasDefaulted = Boolean(result.ok && result.userProfileWasDefaulted);
  } catch (err) {
    console.log(`[Status] Failed to load status sheet: ${err.message}`);
    statusRows = [];
  }
  const userProfileRow = statusRows.find((row) => row.type === 'User Profile');
  const userProfileInput = document.getElementById('user-profile-input');
  if (userProfileInput) {
    userProfileInput.value = userProfileRow?.value || '';
  }
  const userProfileGeolocationInput = document.getElementById('user-profile-geolocation-input');
  if (userProfileGeolocationInput) {
    userProfileGeolocationInput.value = (userProfileRow?.detail || '').replace(/^Geolocation:\s*/i, '');
  }
  // Stage 1: Speak simple greeting only (with caching)
  const simpleGreeting = buildSimpleGreeting(statusRows);
  appendChatLine('Marvis', simpleGreeting);
  await speakGreeting(simpleGreeting);
  if (userProfileWasDefaulted) {
    appendChatLine('Marvis', "I don't have your profile yet, sir - I've set a default. Update it anytime under Settings > User Profile.");
  }

  // Stage 2: Enter interaction mode and speak briefing
  const appBody = document.getElementById('app-body');
  appBody.classList.add('interaction-mode');
  const hasAnyRowValue = (row) => (Array.isArray(row.value) ? row.value.length > 0 : Boolean(row.value));
  if (statusRows.some(hasAnyRowValue)) {
    try {
      showPanel(renderStatusBoard(statusRows));
    } catch (err) {
      console.log(`[Status] Failed to render status board: ${err.message}`);
    }
    const avatarBriefing = statusRows.find((row) => row.type === 'Avatar Briefing')?.value;
    const briefing = avatarBriefing || buildBriefing(statusRows);
    const briefingDisplay = buildBriefingDisplay(statusRows, briefing);
    const newsBriefingRow = statusRows.find((row) => row.type === 'News Briefing');
    // Animate/voice-sync per item whenever per-item array data exists, even
    // if an Avatar Briefing summary is also present (the agentic-marvis-brief
    // skill always writes both) - the legacy reveal-all-at-once branch below
    // is only for older status files with no News Briefing array data.
    const newsItems = getNewsBriefingItems(newsBriefingRow);
    currentNewsBriefingItems = newsItems;
    const frequency = currentSettings?.briefingVoiceFrequency || '1h';
    const lastBriefingVoiceAt = currentSettings?.lastBriefingVoiceAt || null;
    const voiceDue = !isMuted && shouldTriggerBriefingVoice(frequency, lastBriefingVoiceAt);

    if (newsItems.length) {
      if (voiceDue) {
        // Speak weather/email fragments as one intro line, then each News
        // Briefing item individually - its headline/detail reveal exactly
        // when its own voice line starts, and we wait for that line to
        // finish before moving to the next (see playNewsBriefingWithVoice).
        (async () => {
          const intro = buildIntroBriefing(statusRows);
          if (intro) await speakBriefing(intro);
          await playNewsBriefingWithVoice(newsItems);
        })();
      } else {
        // No voice this round - cycle the display on a fixed timer instead.
        playNewsBriefingCycle(newsItems);
      }
    } else {
      // Avatar Briefing branch (legacy): reveal any News Briefing items
      // immediately since nothing else will drive them, then show the
      // briefing text in chat.
      revealAllNewsBriefingItems(getNewsBriefingItems(newsBriefingRow).length);
      const chatLog = document.getElementById('chat-log');
      const lastLine = chatLog.lastElementChild;
      if (lastLine) {
        const textEl = lastLine.querySelector('.chat-text');
        if (textEl) {
          textEl.textContent = briefingDisplay;
        }
      }
      if (voiceDue) speakBriefing(briefing);
    }

    // Show Continue button right away; don't make the user wait for voice playback to finish
    const continueSection = document.getElementById('continue-section');
    if (continueSection) {
      continueSection.style.display = 'flex';
    }
    if (voiceDue && currentSettings) {
      currentSettings.lastBriefingVoiceAt = new Date().toISOString();
      await window.marvis.saveSettings(currentSettings);
    }
  }
}

const CLI_CHANNELS = {
  '/code': { label: 'Claude Code', delegate: (task, operationId) => window.marvis.delegateTask(task, operationId) },
  '/claude': { label: 'Claude Code', delegate: (task, operationId) => window.marvis.delegateTask(task, operationId) },
  '/codex': { label: 'Codex', delegate: (task, operationId) => window.marvis.delegateCodexTask(task, operationId) },
};

// Recognizes natural-language "generate me a report" phrasing (e.g. "in
// report, recommend...", "make a report on...", "report on...") that should
// be delegated to the CLI tool rather than answered as a plain chat reply -
// only the CLI agents have file-write access to actually produce an HTML
// report, which the chat AI providers can't do. Deliberately narrow (the
// word "report" alone isn't enough) to avoid misfiring on unrelated uses
// like "I need to report a bug" or "did you see that report from yesterday".
const REPORT_REQUEST_RE = /^(?:in|as)\s+(?:a\s+)?report\b|\b(?:make|generate|create|write|produce|compile|prepare)\s+(?:me\s+)?(?:a|the)\s+report\b|\breport\s+(?:on|about|for)\b/i;
function isReportRequest(text) {
  return REPORT_REQUEST_RE.test(text.trim());
}

function shouldSpeakReturnedMessage(text) {
  return Boolean(text.trim() || pendingAttachments.length > 0);
}

function parseCliCommand(text) {
  const spaceIndex = text.indexOf(' ');
  const prefix = (spaceIndex === -1 ? text : text.slice(0, spaceIndex)).toLowerCase();
  const channel = CLI_CHANNELS[prefix];
  if (!channel) {
    console.log(`[CLI] Prefix "${prefix}" not recognized. Available: ${Object.keys(CLI_CHANNELS).join(', ')}`);
    return null;
  }
  const task = spaceIndex === -1 ? '' : text.slice(spaceIndex + 1).trim();
  console.log(`[CLI] Recognized: prefix="${prefix}", task="${task}"`);
  return { channel, task };
}

async function sendToCli(text, channel, task, { forceReport = false, voiceAllowed = true } = {}) {
  appendChatLine('You', text);
  if (!task) {
    const prompt = `What would you like me to ask ${channel.label} to do, sir?`;
    appendChatLine('Marvis', prompt);
    if (voiceAllowed) await speakReply(prompt);
    return;
  }
  const operationId = createOperationId();
  activeOperationId = operationId;
  setProcessingResponse(true);
  setAvatarState('processing');
  if (voiceAllowed) speakProcessingCue();
  // Placeholder bubble updated in place (no speech) as progress events stream
  // in from the CLI, then overwritten with the real reply once it resolves.
  appendChatLine('Marvis', 'Thinking...');
  const unsubscribeProgress = window.marvis.onCliProgress(({ operationId: progressOperationId, text: progressText }) => {
    if (progressOperationId !== operationId) return;
    setAvatarHeadline(progressText);
  });
  let htmlPanel = null;
  try {
    htmlPanel = await window.marvis.prepareHtmlPanel();
    const delegatedTask = buildCliTaskWithHtmlContract(task, htmlPanel, { forceReport });
    console.log(`[CLI] Delegating to ${channel.label}: "${task}"`);
    console.log(`[CLI] Calling channel.delegate (this is an IPC call)...`);
    const result = await channel.delegate(delegatedTask, operationId);
    console.log(`[CLI] Received result from IPC:`, result);
    console.log(`[CLI] Result status: ${result?.status}, summary length: ${result?.summary?.length}`);
    unsubscribeProgress();
    if (result?.status !== 'success' && htmlPanel?.filePath) {
      window.marvis.discardHtmlPanel(htmlPanel.filePath).catch(() => {});
    }
    if (activeOperationId !== operationId && shouldAbortResponse) return;
    activeOperationId = null;
    setProcessingResponse(false);
    if (shouldAbortResponse || result?.status === 'cancelled') return;
    const summary = result.summary || `${channel.label} finished, sir.`;
    const formatted = await formatAssistantResponse(summary);
    if (formatted.html) showHTML(formatted.html);
    else hidePanel();
    const reply = formatted.reply;
    console.log(`[CLI] Displaying reply: "${reply}"`);
    setAvatarHeadline(formatted.displayReply);
    stopProcessingCue();
    stopCachedVoice();
    ttsController.stop();
    if (voiceAllowed) await speakReply(reply);
  } catch (err) {
    console.log(`[CLI] Error:`, err);
    unsubscribeProgress();
    if (htmlPanel?.filePath) window.marvis.discardHtmlPanel(htmlPanel.filePath).catch(() => {});
    if (activeOperationId === operationId) activeOperationId = null;
    setProcessingResponse(false);
    if (shouldAbortResponse) return;
    setAvatarHeadline(`I ran into a problem reaching ${channel.label}, sir: ${err.message}`);
  } finally {
    unsubscribeProgress();
    if (activeOperationId === operationId) activeOperationId = null;
    setProcessingResponse(false);
    if (!isSpeaking) setAvatarState('idle');
  }
}

async function startWakeWordIfConfigured() {
  console.log('[WakeWord] startWakeWordIfConfigured — enabled:', currentSettings.wakeWordEnabled);
  if (!currentSettings.wakeWordEnabled) return;
  const wakeWord = (currentSettings.botName || 'MARVIS').toLowerCase();
  console.log('[WakeWord] starting, word:', wakeWord, 'hasLocal:', !!window.marvis?.transcribeWhisperLocal);
  wakeWordController.start(onWakeWordDetected, wakeWord, () => {
    showTemporaryNotice('Wake word unavailable: Google Speech API unreachable. Use the mic button instead.');
  });
}

function onWakeWordDetected() {
  if (isBusy) return;
  isBusy = true;
  isRecordingAudio = true;
  setAvatarState('listening');
  updateAudioInputButton();
  setTimeout(() => {
    sttController.listenOnce(
      async (transcript) => {
        isRecordingAudio = false;
        updateAudioInputButton();
        await sendToMarvis(transcript, { voiceAllowed: shouldSpeakReturnedMessage(transcript) });
        isBusy = false;
        startWakeWordIfConfigured();
      },
      (err) => {
        isRecordingAudio = false;
        updateAudioInputButton();
        appendChatLine('Marvis', `I couldn't catch that, sir: ${err.message}`);
        setAvatarState('idle');
        isBusy = false;
        startWakeWordIfConfigured();
      }
    );
  }, 300);
}

async function sendToMarvis(text, { voiceAllowed = true } = {}) {
  appendChatLine('You', text);
  const operationId = createOperationId();
  activeOperationId = operationId;
  setProcessingResponse(true);
  setAvatarState('processing');
  if (voiceAllowed) speakProcessingCue();
  try {
    const { reply, cancelled } = await window.marvis.sendMessage(text, operationId);
    if (activeOperationId !== operationId && shouldAbortResponse) return;
    activeOperationId = null;
    setProcessingResponse(false);
    if (shouldAbortResponse || cancelled) return;
    const formatted = await formatAssistantResponse(reply, { allowHtml: false });
    if (formatted.html) showHTML(formatted.html);
    else hidePanel();
    appendChatLine('Marvis', formatted.displayReply);
    stopProcessingCue();
    stopCachedVoice();
    ttsController.stop();
    if (voiceAllowed) await speakReply(formatted.reply);
  } catch (err) {
    if (activeOperationId === operationId) activeOperationId = null;
    setProcessingResponse(false);
    if (shouldAbortResponse) return;
    appendChatLine('Marvis', `I ran into a problem, sir: ${err.message}`);
  } finally {
    if (activeOperationId === operationId) activeOperationId = null;
    setProcessingResponse(false);
    if (!isSpeaking) setAvatarState('idle');
  }
}

function mountAvatar(style) {
  const mountEl = document.getElementById('avatar-mount');
  avatarController = createAvatarController({ mountEl, style });
}

function updateHud(settings) {
  const projectDisplay = document.getElementById('project-path-display');
  if (!projectDisplay) return;
  projectDisplay.textContent = settings.activeProject || 'No project selected';
  projectDisplay.title = settings.activeProject || 'No project selected';
}

function setAvatarState(state) {
  currentAvatarState = state;
  if (avatarController) avatarController.setState(state);
  if (currentSettings) updateHud(currentSettings);
}

function appendChatLine(role, text) {
  const log = document.getElementById('chat-log');
  const line = document.createElement('div');
  line.className = `chat-line ${role === 'You' ? 'role-user' : 'role-marvis'}`;
  const roleEl = document.createElement('span');
  roleEl.className = 'chat-role';
  roleEl.textContent = role;
  const timeEl = document.createElement('span');
  timeEl.className = 'chat-time';
  timeEl.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const textEl = document.createElement('span');
  textEl.className = 'chat-text';
  textEl.textContent = text;
  line.append(roleEl, timeEl, textEl);
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}

function updateProviderApiFields(provider) {
  document.querySelectorAll('.provider-api-group').forEach((group) => {
    group.classList.add('hidden');
  });
  document.getElementById(`${provider}-api-group`).classList.remove('hidden');
}

function populateSettingsForm(settings) {
  document.getElementById('provider-select').value = settings.provider;
  updateProviderApiFields(settings.provider);
  document.getElementById('deepseek-api-key-input').value = settings.apiKeys.deepseek;
  document.getElementById('gemini-api-key-input').value = settings.apiKeys.gemini;
  document.getElementById('elevenlabs-api-key-input').value = settings.apiKeys.elevenlabs;
  renderVoiceOptions(settings.elevenLabsVoices || [], settings.elevenLabsVoiceId);
  const voiceVolume = typeof settings.voiceVolume === 'number' ? settings.voiceVolume : 1;
  document.getElementById('voice-volume-input').value = voiceVolume;
  document.getElementById('voice-volume-value').textContent = `${Math.round(voiceVolume * 100)}%`;
  ttsController.setVolume(voiceVolume);
  const musicVolume = typeof settings.musicVolume === 'number' ? settings.musicVolume : 0.6;
  document.getElementById('music-volume-input').value = musicVolume;
  document.getElementById('music-volume-value').textContent = `${Math.round(musicVolume * 100)}%`;
  musicController.setVolume(musicVolume);
  document.getElementById('wakeword-enabled-input').checked = settings.wakeWordEnabled;
  document.getElementById('personality-input').value = settings.personality;
  document.getElementById('avatar-select').value = settings.avatarStyle;
  document.getElementById('user-name-input').value = settings.userName || '';
  const botNameVal = settings.botName || 'MARVIS';
  document.getElementById('bot-name-input').value = botNameVal;
  document.getElementById('wake-word-label').textContent = botNameVal;
  voicePhraseDraft = normalizeVoicePhrases(settings);
  renderVoicePhraseEditor('morning');
  document.getElementById('preferred-cli-select').value = settings.preferredCliChannel || '';
  document.getElementById('project-input').value = settings.activeProject;
  document.getElementById('briefing-voice-frequency-select').value = settings.briefingVoiceFrequency || '1h';
  document.getElementById('max-html-panels-input').value = settings.maxHtmlPanels || 50;
}

function renderVoiceOptions(voices, selectedId) {
  const select = document.getElementById('elevenlabs-voice-select');
  select.innerHTML = '<option value="">Adam (default)</option>';
  for (const voice of voices) {
    const option = document.createElement('option');
    option.value = voice.id;
    option.textContent = voice.name;
    select.appendChild(option);
  }
  select.value = selectedId || '';
}

function renderVoicePhraseEditor(tab) {
  voicePhraseTab = tab;
  if (!voicePhraseDraft) voicePhraseDraft = normalizeVoicePhrases();
  document.querySelectorAll('.voice-phrase-tab').forEach((button) => {
    button.classList.toggle('active', button.dataset.phraseTab === tab);
  });
  const label = document.getElementById('voice-phrase-editor-label');
  const editor = document.getElementById('voice-phrase-editor');
  if (label) label.firstChild.textContent = `${tab[0].toUpperCase()}${tab.slice(1)} phrases: `;
  if (editor) editor.value = (voicePhraseDraft[tab] || []).join('\n');
}

function saveCurrentVoicePhraseEditor() {
  if (!voicePhraseDraft) voicePhraseDraft = normalizeVoicePhrases();
  const editor = document.getElementById('voice-phrase-editor');
  if (!editor) return;
  voicePhraseDraft[voicePhraseTab] = editor.value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

document.getElementById('elevenlabs-voice-add-btn').addEventListener('click', () => {
  const nameInput = document.getElementById('elevenlabs-voice-name-input');
  const idInput = document.getElementById('elevenlabs-voice-id-input');
  const name = nameInput.value.trim();
  const id = idInput.value.trim();
  if (!name || !id) return;

  const select = document.getElementById('elevenlabs-voice-select');
  const existing = Array.from(select.options).find((o) => o.value === id);
  if (existing) {
    existing.textContent = name;
    select.value = id;
  } else {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = name;
    select.appendChild(option);
    select.value = id;
  }

  nameInput.value = '';
  idInput.value = '';
});

document.getElementById('elevenlabs-voice-remove-btn').addEventListener('click', () => {
  const select = document.getElementById('elevenlabs-voice-select');
  if (!select.value) return;
  select.querySelector(`option[value="${CSS.escape(select.value)}"]`).remove();
  select.value = '';
});

document.getElementById('voice-volume-input').addEventListener('input', (e) => {
  const value = parseFloat(e.target.value);
  document.getElementById('voice-volume-value').textContent = `${Math.round(value * 100)}%`;
  ttsController.setVolume(value);
});

document.getElementById('music-volume-input').addEventListener('input', (e) => {
  const value = parseFloat(e.target.value);
  document.getElementById('music-volume-value').textContent = `${Math.round(value * 100)}%`;
  musicController.setVolume(value);
});

document.getElementById('voice-volume-input').addEventListener('change', (e) => {
  ttsController.setVolume(parseFloat(e.target.value));
  ttsController.stop();
  ttsController.speak('This is how I sound, sir.');
});

document.getElementById('voice-words-toggle-btn').addEventListener('click', () => {
  document.getElementById('voice-words-panel').classList.toggle('hidden');
});

document.getElementById('bot-name-input').addEventListener('input', (e) => {
  const val = e.target.value.trim() || 'MARVIS';
  document.getElementById('wake-word-label').textContent = val;
});

document.querySelectorAll('.voice-phrase-tab').forEach((button) => {
  button.addEventListener('click', () => {
    saveCurrentVoicePhraseEditor();
    renderVoicePhraseEditor(button.dataset.phraseTab);
  });
});

function applyMuteCommand({ target, action }) {
  const muted = action === 'mute';
  if (target === 'all' || target === 'voice') setVoiceMuted(muted);
  if (target === 'all' || target === 'music') setMusicMuted(muted);
  const label = target === 'all' ? 'Voice and music' : target === 'voice' ? 'Voice' : 'Music';
  return `${label} ${muted ? 'muted' : 'unmuted'}, sir.`;
}

async function routeUserMessage(text) {
  const voiceAllowed = shouldSpeakReturnedMessage(text);
  // /html <path> or html <path> - open HTML file directly without Claude delegation
  const htmlCmdMatch = text.match(/^\/html\s+(.+)/i) || text.match(/^html\s+(.+)/i);
  if (htmlCmdMatch) {
    const pathMatch = htmlCmdMatch[1].trim();
    const filePath = pathMatch.startsWith('"') && pathMatch.endsWith('"')
      ? pathMatch.slice(1, -1)
      : pathMatch;
    appendChatLine('You', text);
    try {
      const result = await window.marvis.readExternalHtml(filePath);
      if (result?.ok) {
        showHTMLSafe(result.html);
        currentHtmlPath = filePath; // Track for joint analysis with screenshots
        appendChatLine('Marvis', `Displaying ${filePath}`);
      } else {
        appendChatLine('Marvis', `I couldn't read that file, sir: ${result?.error || 'unknown error'}`);
      }
    } catch (err) {
      appendChatLine('Marvis', `I couldn't read that file, sir: ${err.message}`);
    }
    return;
  }

  // /open <keyword>, open <keyword>, or show <keyword> - search and open HTML panel by keyword
  const openCmdMatch = text.match(/^\/open\s+(.+)/i) || text.match(/^(?:open|show)\s+(.+)/i);
  if (openCmdMatch) {
    const keyword = openCmdMatch[1].trim();
    appendChatLine('You', text);
    try {
      const result = await window.marvis.openHtmlPanelByKeyword(keyword);
      if (result?.ok) {
        showHTMLSafe(result.html);
        currentHtmlPath = result.filePath; // Track for joint analysis with screenshots
        appendChatLine('Marvis', `Displaying ${result.fileName}`);
      } else {
        appendChatLine('Marvis', result?.error || `I couldn't find an HTML panel matching "${keyword}", sir.`);
      }
    } catch (err) {
      appendChatLine('Marvis', `I couldn't open that panel, sir: ${err.message}`);
    }
    return;
  }

  if (pendingAttachments.length > 0) {
    // Image attachments can only be read off disk by the CLI delegate
    // channels (Claude Code / Codex) - never the plain chat providers. An
    // explicit /code or /codex prefix the user typed still overrides the
    // default routing to the preferred CLI channel.
    const explicitChannel = parseCliCommand(text)?.channel;
    const channel = explicitChannel || CLI_CHANNELS[`/${currentSettings.preferredCliChannel || 'code'}`];
    const taskText = text || 'Take a look at the attached screenshot(s).';
    const lines = [taskText];
    // Include HTML file path if currently displayed (for joint analysis)
    if (currentHtmlPath) {
      lines.push(`[html] ${currentHtmlPath}`);
    }
    for (const att of pendingAttachments) {
      lines.push(`[screenshot] ${att.filePath}`);
    }
    const fullTask = lines.join('\n');
    await sendToCli(text, channel, fullTask, { forceReport: isReportRequest(taskText), voiceAllowed });
    clearAttachments();
    return;
  }
  const muteCommand = parseMuteCommand(text);
  if (muteCommand) {
    appendChatLine('You', text);
    const reply = await applyMuteCommand(muteCommand);
    appendChatLine('Marvis', reply);
    if (voiceAllowed) await speakReply(reply);
    return;
  }
  const detailRow = matchStatusDetailRequest(text, statusRows);
  if (detailRow) {
    appendChatLine('You', text);
    const reply = detailRow.detail || `I don't have further detail on ${detailRow.type.toLowerCase()}, sir.`;
    appendChatLine('Marvis', reply);
    if (voiceAllowed) await speakReply(reply);
    return;
  }
  const cliCommand = parseCliCommand(text);
  if (cliCommand) {
    await sendToCli(text, cliCommand.channel, cliCommand.task, {
      forceReport: isReportRequest(cliCommand.task),
      voiceAllowed,
    });
  } else if (currentSettings.preferredCliChannel) {
    const channel = CLI_CHANNELS[`/${currentSettings.preferredCliChannel}`];
    if (channel) {
      // Even with a sticky CLI channel routing every message here, the CLI's
      // own self-classification step can still judge a report-phrased
      // request as a quick factual answer and skip writing the file - force
      // the report branch whenever the user's own wording asked for one.
      await sendToCli(text, channel, text, { forceReport: isReportRequest(text), voiceAllowed });
    } else {
      await sendToMarvis(text, { voiceAllowed });
    }
  } else if (isReportRequest(text)) {
    // No explicit /code prefix and no sticky CLI preference, but the
    // phrasing clearly asks for a report - route to Claude Code (the
    // general-purpose "heavy lifting" channel) so it can actually write
    // the HTML file and hand back a clickable panel, which the plain chat
    // providers have no file-write access to produce.
    await sendToCli(text, CLI_CHANNELS['/code'], text, { forceReport: true, voiceAllowed });
  } else {
    await sendToMarvis(text, { voiceAllowed });
  }
}

async function sendTextFromInput() {
  if (isBusy) return;
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text && !pendingAttachments.length) return;
  input.value = '';
  isBusy = true;
  shouldAbortResponse = false;
  updateSendButton();
  stopNewsBriefingCycle();
  stopCachedVoice();
  ttsController.stop();
  await routeUserMessage(text);
  isBusy = false;
  shouldAbortResponse = false;
  updateSendButton();
}

document.getElementById('chat-input').addEventListener('keydown', async (e) => {
  if (e.key !== 'Enter') return;
  await sendTextFromInput();
});

document.getElementById('provider-select').addEventListener('change', (e) => {
  updateProviderApiFields(e.target.value);
});

async function selectAndSetProject() {
  const selectedPath = await window.marvis.selectFolder();
  if (selectedPath) {
    currentSettings.activeProject = selectedPath;
    document.getElementById('project-input').value = selectedPath;
    await window.marvis.saveSettings(currentSettings);
    updateHud(currentSettings);
  }
}

document.getElementById('select-project-btn').addEventListener('click', selectAndSetProject);

document.getElementById('project-browse-btn').addEventListener('click', async () => {
  const selectedPath = await window.marvis.selectFolder();
  if (selectedPath) {
    document.getElementById('project-input').value = selectedPath;
  }
});

document.getElementById('continue-btn').addEventListener('click', () => {
  // Transition to Phase 3: Full-chat with avatar background
  stopCachedVoice();
  ttsController.stop();
  isSpeaking = false;
  updateSendButton();
  const appBody = document.getElementById('app-body');
  appBody.classList.add('phase-3');
  hidePanel();
  const continueSection = document.getElementById('continue-section');
  if (continueSection) {
    continueSection.style.display = 'none';
  }
});

document.getElementById('status-panel-dismiss-btn').addEventListener('click', () => {
  hidePanel();
});

function exitCaptureSelectMode(overlay) {
  if (overlay) overlay.remove();
  captureSelectMode = false;
  captureSelectStartX = null;
  captureSelectStartY = null;
}

document.getElementById('status-panel-capture-btn').addEventListener('click', () => {
  if (captureSelectMode) {
    exitCaptureSelectMode(document.getElementById('capture-select-overlay'));
    return;
  }

  const statusPanel = document.getElementById('status-panel');
  const statusPanelWrap = document.getElementById('status-panel-wrap');
  if (!statusPanel || !statusPanelWrap) return;

  captureSelectMode = true;

  const overlay = document.createElement('div');
  overlay.id = 'capture-select-overlay';

  // Position the overlay over the status panel's content box only, so the
  // capture/dismiss buttons stay clickable (e.g. to cancel selection).
  const panelRect = statusPanel.getBoundingClientRect();
  overlay.style.position = 'fixed';
  overlay.style.left = `${panelRect.left}px`;
  overlay.style.top = `${panelRect.top}px`;
  overlay.style.width = `${panelRect.width}px`;
  overlay.style.height = `${panelRect.height}px`;

  let isDrawing = false;

  overlay.addEventListener('mousedown', (e) => {
    isDrawing = true;
    captureSelectStartX = e.clientX;
    captureSelectStartY = e.clientY;

    const existingBox = document.getElementById('capture-select-box');
    if (existingBox) existingBox.remove();
  });

  overlay.addEventListener('mousemove', (e) => {
    if (!isDrawing) return;

    const currentX = e.clientX;
    const currentY = e.clientY;
    const left = Math.min(captureSelectStartX, currentX) - panelRect.left;
    const top = Math.min(captureSelectStartY, currentY) - panelRect.top;
    const width = Math.abs(currentX - captureSelectStartX);
    const height = Math.abs(currentY - captureSelectStartY);

    let box = document.getElementById('capture-select-box');
    if (!box) {
      box = document.createElement('div');
      box.id = 'capture-select-box';
      overlay.appendChild(box);
    }

    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
    box.style.width = `${width}px`;
    box.style.height = `${height}px`;
  });

  overlay.addEventListener('mouseup', async (e) => {
    isDrawing = false;

    if (captureSelectStartX === null || captureSelectStartY === null) {
      exitCaptureSelectMode(overlay);
      return;
    }

    const currentX = e.clientX;
    const currentY = e.clientY;
    const left = Math.min(captureSelectStartX, currentX) - panelRect.left;
    const top = Math.min(captureSelectStartY, currentY) - panelRect.top;
    const width = Math.abs(currentX - captureSelectStartX);
    const height = Math.abs(currentY - captureSelectStartY);

    // Reject zero/negative-area selections (accidental clicks, not drags).
    if (width <= 0 || height <= 0) {
      exitCaptureSelectMode(overlay);
      return;
    }

    // Remove the overlay immediately - don't wait for the IPC round-trip so
    // the UI doesn't feel stuck.
    exitCaptureSelectMode(overlay);

    const dpr = window.devicePixelRatio || 1;
    const rect = {
      x: (left + panelRect.left) * dpr,
      y: (top + panelRect.top) * dpr,
      width: width * dpr,
      height: height * dpr,
    };

    try {
      const result = await window.marvis.captureRegion(rect);
      if (result?.ok) {
        await addAttachmentChip(result.filePath, result.fileName);
      } else {
        setAvatarHeadline(`I couldn't capture that, sir: ${result?.error || 'unknown error'}`);
      }
    } catch (err) {
      setAvatarHeadline(`I couldn't capture that, sir: ${err.message}`);
    }
  });

  const handleEscape = (e) => {
    if (e.key !== 'Escape') return;
    exitCaptureSelectMode(document.getElementById('capture-select-overlay'));
    document.removeEventListener('keydown', handleEscape);
  };
  document.addEventListener('keydown', handleEscape);

  statusPanelWrap.appendChild(overlay);
});

async function addAttachmentChip(filePath, fileName) {
  pendingAttachments.push({ filePath, fileName });

  const container = document.getElementById('chat-attachments');
  if (!container) return;

  const chip = document.createElement('div');
  chip.className = 'attachment-chip';
  chip.dataset.filePath = filePath;

  try {
    const readResult = await window.marvis.readCapture(filePath);
    if (readResult?.ok) {
      const img = document.createElement('img');
      img.src = readResult.dataUrl;
      img.alt = fileName || 'Screenshot capture';
      chip.appendChild(img);
    }
  } catch (err) {
    console.error('[Attachment] Failed to read capture:', err);
  }

  const removeBtn = document.createElement('button');
  removeBtn.className = 'attachment-chip-remove';
  removeBtn.type = 'button';
  removeBtn.textContent = '×';
  removeBtn.title = 'Remove attachment';
  removeBtn.addEventListener('click', () => {
    const idx = pendingAttachments.findIndex((a) => a.filePath === filePath);
    if (idx >= 0) pendingAttachments.splice(idx, 1);
    chip.remove();
  });
  chip.appendChild(removeBtn);

  container.appendChild(chip);
}

function clearAttachments() {
  const container = document.getElementById('chat-attachments');
  if (container) container.innerHTML = '';
  pendingAttachments = [];
}

document.getElementById('settings-btn').addEventListener('click', () => {
  const isHidden = document.getElementById('settings-modal').classList.toggle('hidden');
  document.getElementById('avatar-mount').classList.toggle('avatar-paused', !isHidden);
});

document.getElementById('send-btn').addEventListener('click', async (e) => {
  if (isProcessingResponse) {
    await pauseActiveOperation();
    return;
  }

  if (isBusy) {
    return;
  } else {
    await sendTextFromInput();
  }
});

document.getElementById('audio-input-btn').addEventListener('click', toggleAudioInput);

function persistStateSetting(key, value) {
  if (!currentSettings) return;
  currentSettings[key] = value;
  window.marvis.saveSettings(currentSettings).catch(() => {});
}

function setVoiceMuted(muted) {
  isMuted = muted;
  document.getElementById('mute-toggle-btn').textContent = isMuted ? 'Unmute' : 'Mute';
  if (isMuted) {
    stopCachedVoice();
    ttsController.stop();
  }
  persistStateSetting('voiceMuted', isMuted);
}

function setMusicMuted(muted) {
  isMusicMuted = muted;
  if (muted) musicController.pause();
  else musicController.resume();
  updateNowPlayingWidget();
  persistStateSetting('musicMuted', isMusicMuted);
}

document.getElementById('mute-toggle-btn').addEventListener('click', () => {
  setVoiceMuted(!isMuted);
});

document.getElementById('settings-save-btn').addEventListener('click', async () => {
  saveCurrentVoicePhraseEditor();
  const settings = {
    provider: document.getElementById('provider-select').value,
    apiKeys: {
      deepseek: document.getElementById('deepseek-api-key-input').value,
      gemini: document.getElementById('gemini-api-key-input').value,
      elevenlabs: document.getElementById('elevenlabs-api-key-input').value,
    },
    elevenLabsVoiceId: document.getElementById('elevenlabs-voice-select').value,
    elevenLabsVoices: Array.from(document.getElementById('elevenlabs-voice-select').options)
      .slice(1)
      .map((o) => ({ id: o.value, name: o.textContent })),
    wakeWordEnabled: document.getElementById('wakeword-enabled-input').checked,
    voiceVolume: parseFloat(document.getElementById('voice-volume-input').value),
    musicVolume: parseFloat(document.getElementById('music-volume-input').value),
    personality: document.getElementById('personality-input').value,
    avatarStyle: document.getElementById('avatar-select').value,
    userName: document.getElementById('user-name-input').value.trim(),
    botName: document.getElementById('bot-name-input').value.trim() || 'MARVIS',
    voicePhrases: voicePhraseDraft || normalizeVoicePhrases(),
    preferredCliChannel: document.getElementById('preferred-cli-select').value || null,
    activeProject: document.getElementById('project-input').value,
    briefingVoiceFrequency: document.getElementById('briefing-voice-frequency-select').value,
    lastBriefingVoiceAt: currentSettings?.lastBriefingVoiceAt || null,
    maxHtmlPanels: Math.max(1, parseInt(document.getElementById('max-html-panels-input').value, 10) || 50),
    voiceMuted: isMuted,
    musicMuted: isMusicMuted,
  };
  const setupStatus = document.getElementById('setup-status');

  const userProfileResult = await window.marvis.saveUserProfile(
    document.getElementById('user-profile-input').value,
    document.getElementById('user-profile-geolocation-input').value
  );
  if (userProfileResult.ok) statusRows = userProfileResult.rows;

  const result = await window.marvis.saveSettings(settings);
  if (!result.ok) {
    const message = `I couldn't save your settings, sir: ${result.error}`;
    if (onboarding) {
      setupStatus.textContent = message;
    } else {
      appendChatLine('Marvis', message);
    }
    return;
  }
  currentSettings = settings;

  if (onboarding) {
    setupStatus.textContent = 'Testing connection, sir...';
    const test = await window.marvis.testConnection({ provider: settings.provider, apiKey: settings.apiKeys[settings.provider] });
    if (!test.ok) {
      setupStatus.textContent = `I couldn't verify that key, sir: ${test.error}`;
      return;
    }
    setupStatus.textContent = '';
    onboarding = false;
    showAppScreen();
    return;
  }

  mountAvatar(settings.avatarStyle);
  setAvatarState(currentAvatarState);
  updateHud(settings);
  document.getElementById('settings-modal').classList.add('hidden');
  document.getElementById('avatar-mount').classList.remove('avatar-paused');
  await wakeWordController.stop();
  startWakeWordIfConfigured();
});

init();
