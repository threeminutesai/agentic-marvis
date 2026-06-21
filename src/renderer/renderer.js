// src/renderer/renderer.js
let avatarController = null;
let currentSettings = null;
let onboarding = false;
let isMuted = false;
let isBusy = false;
let isSpeaking = false;
let isProcessingResponse = false;
let shouldAbortResponse = false;
let currentAvatarState = 'idle';
let statusRows = [];
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

window.addEventListener('jarvis:temporaryNotice', (event) => {
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
      await window.jarvis.cancelOperation(operationId);
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
  const result = await window.jarvis.transcribeSpeech({
    audioBase64,
    mimeType: blob.type || 'audio/webm',
  });
  if (!result.ok) {
    appendChatLine('Jarvis', `I couldn't transcribe that, sir: ${result.error}`);
    return;
  }
  const transcript = result.text.trim();
  if (!transcript) {
    appendChatLine('Jarvis', "I couldn't hear any speech in that recording, sir.");
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
        appendChatLine('Jarvis', `I couldn't process that recording, sir: ${err.message}`);
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
    appendChatLine('Jarvis', `I couldn't access the microphone, sir: ${err.message}`);
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
  return String(text || '')
    .replace(/\[user\]/gi, userName || 'sir')
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
  const result = await window.jarvis.synthesizeCachedSpeech({ text, category });
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
      const result = await window.jarvis.synthesizeCachedSpeech({ text, category: 'processing' });
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

function buildCliTaskWithHtmlContract(task, htmlPanel) {
  if (!htmlPanel?.filePath) return task;
  const templateSection = htmlPanel.templatePath
    ? `a style/structure reference template at ${htmlPanel.templatePath} (read it only now, inside this branch) - you don't need to follow it strictly, just keep a similar look and feel (no inline styles or extra <style>/<script> tags beyond what's needed)`
    : `a standalone HTML fragment (no <script> or <style> tags) with the full display content - title, body, source links, image/placeholder area`;

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

Then write ${templateSection} to this exact file path: ${htmlPanel.filePath} (keep the file name exactly as given: ${htmlPanel.fileName}).`;
}

function extractPlainVoiceSummary(text) {
  const cleaned = String(text || '')
    .replace(/^Source:.*$/gim, '')
    .replace(/\[[^\]]+\]\(https?:\/\/[^)]+\)/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .trim();
  return cleaned.split(/\r?\n\s*\r?\n/)[0]?.trim() || cleaned || 'I found the summary, sir.';
}

async function formatAssistantResponse(text) {
  const voiceBlock = extractVoiceContentBlock(text);
  if (voiceBlock) {
    // The right panel is for actual HTML/content blocks only - a voice-only
    // reply (no [html] file, no [content] block) must never open it, even
    // though displayText would otherwise fall back to the voice text.
    let html = null;
    if (voiceBlock.htmlPath) {
      const result = await window.jarvis.readHtmlPanel(voiceBlock.htmlPath);
      if (result.ok) html = result.html;
    } else if (voiceBlock.displayText) {
      html = renderContentBlock(voiceBlock.displayText);
    }
    return {
      reply: voiceBlock.voiceText || extractPlainVoiceSummary(voiceBlock.displayText),
      displayReply: voiceBlock.voiceText,
      html,
    };
  }

  const extracted = extractHtmlBlock(text);
  if (extracted) {
    return {
      reply: [extracted.before, extracted.after].filter(Boolean).join(' ') || "Here's the report, sir.",
      displayReply: [extracted.before, extracted.after].filter(Boolean).join(' ') || "Here's the report, sir.",
      html: extracted.html,
    };
  }

  // CLI ignored the [voice]/[html] contract and returned raw content directly.
  // Route long-form output to the panel instead of dumping it into the chat bubble.
  const plainSummary = extractPlainVoiceSummary(text);
  if (text && text.trim().length > plainSummary.length + 40) {
    return {
      reply: plainSummary,
      displayReply: plainSummary,
      html: renderContentBlock(text),
    };
  }

  return { reply: plainSummary, displayReply: text, html: null };
}

async function init() {
  try {
    currentSettings = await window.jarvis.getSettings();
    populateSettingsForm(currentSettings);

    try {
      const musicCatalog = await musicPanel.load();
      musicController.start(musicCatalog);
      if (nowPlayingWidgetTimer) clearInterval(nowPlayingWidgetTimer);
      nowPlayingWidgetTimer = setInterval(updateNowPlayingWidget, 5000);
      updateNowPlayingWidget();
    } catch (err) {
      console.log(`[Music] Failed to start scheduled playback: ${err.message}`);
    }

    if (!currentSettings.apiKeys?.[currentSettings.provider]) {
      onboarding = true;
      document.getElementById('setup-banner').classList.remove('hidden');
      document.getElementById('settings-modal').classList.remove('hidden');
      showAppScreen({ keepSettingsOpen: true });
      return;
    }

    showAppScreen();
  } catch (err) {
    console.log(`[Init] ${err.message}`);
    showStartupProblem(err.message);
  }
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

function updateNowPlayingWidget() {
  const widget = document.getElementById('now-playing-widget');
  const trackLabel = document.getElementById('now-playing-track');
  const toggleBtn = document.getElementById('now-playing-toggle-btn');
  if (!widget || !trackLabel || !toggleBtn) return;
  const nowPlaying = musicController.getNowPlaying();
  if (!nowPlaying) {
    widget.classList.add('hidden');
    return;
  }
  widget.classList.remove('hidden');
  trackLabel.textContent = nowPlaying.name;
  toggleBtn.textContent = nowPlaying.isPaused ? 'Play' : 'Pause';
}

document.getElementById('now-playing-toggle-btn')?.addEventListener('click', () => {
  const nowPlaying = musicController.getNowPlaying();
  if (nowPlaying?.isPaused) {
    musicController.resume();
  } else {
    musicController.pause();
  }
  updateNowPlayingWidget();
});

document.getElementById('now-playing-skip-btn')?.addEventListener('click', () => {
  musicController.skip();
  updateNowPlayingWidget();
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

let newsBriefingTimer = null;
let newsBriefingToken = 0;

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
  document.getElementById(`news-briefing-item-${index}`)?.classList.add('revealed');
}

function revealAllNewsBriefingItems(count) {
  for (let i = 0; i < count; i++) revealNewsBriefingItem(i);
}

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
    const result = await window.jarvis.synthesizeGreeting(text);
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
    const result = await window.jarvis.getStatus();
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
  appendChatLine('Jarvis', simpleGreeting);
  await speakGreeting(simpleGreeting);
  if (userProfileWasDefaulted) {
    appendChatLine('Jarvis', "I don't have your profile yet, sir - I've set a default. Update it anytime under Settings > User Profile.");
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
    const newsItems = avatarBriefing ? [] : getNewsBriefingItems(newsBriefingRow);
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
      continueSection.style.display = 'block';
    }
    if (voiceDue && currentSettings) {
      currentSettings.lastBriefingVoiceAt = new Date().toISOString();
      await window.jarvis.saveSettings(currentSettings);
    }
  }
}

const CLI_CHANNELS = {
  '/code': { label: 'Claude Code', delegate: (task, operationId) => window.jarvis.delegateTask(task, operationId) },
  '/claude': { label: 'Claude Code', delegate: (task, operationId) => window.jarvis.delegateTask(task, operationId) },
  '/codex': { label: 'Codex', delegate: (task, operationId) => window.jarvis.delegateCodexTask(task, operationId) },
};

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

async function sendToCli(text, channel, task) {
  appendChatLine('You', text);
  if (!task) {
    const prompt = `What would you like me to ask ${channel.label} to do, sir?`;
    appendChatLine('Jarvis', prompt);
    await speakReply(prompt);
    return;
  }
  const operationId = createOperationId();
  activeOperationId = operationId;
  setProcessingResponse(true);
  setAvatarState('processing');
  speakProcessingCue();
  // Placeholder bubble updated in place (no speech) as progress events stream
  // in from the CLI, then overwritten with the real reply once it resolves.
  appendChatLine('Jarvis', 'Thinking...');
  const unsubscribeProgress = window.jarvis.onCliProgress(({ operationId: progressOperationId, text: progressText }) => {
    if (progressOperationId !== operationId) return;
    setAvatarHeadline(progressText);
  });
  let htmlPanel = null;
  try {
    htmlPanel = await window.jarvis.prepareHtmlPanel();
    const delegatedTask = buildCliTaskWithHtmlContract(task, htmlPanel);
    console.log(`[CLI] Delegating to ${channel.label}: "${task}"`);
    console.log(`[CLI] Calling channel.delegate (this is an IPC call)...`);
    const result = await channel.delegate(delegatedTask, operationId);
    console.log(`[CLI] Received result from IPC:`, result);
    console.log(`[CLI] Result status: ${result?.status}, summary length: ${result?.summary?.length}`);
    unsubscribeProgress();
    if (result?.status !== 'success' && htmlPanel?.filePath) {
      window.jarvis.discardHtmlPanel(htmlPanel.filePath).catch(() => {});
    }
    if (activeOperationId !== operationId && shouldAbortResponse) return;
    activeOperationId = null;
    setProcessingResponse(false);
    if (shouldAbortResponse || result?.status === 'cancelled') return;
    const summary = result.summary || `${channel.label} finished, sir.`;
    const formatted = await formatAssistantResponse(summary);
    if (formatted.html) showHTML(formatted.html);
    const reply = formatted.reply;
    console.log(`[CLI] Displaying reply: "${reply}"`);
    setAvatarHeadline(formatted.displayReply);
    stopProcessingCue();
    stopCachedVoice();
    ttsController.stop();
    await speakReply(reply);
  } catch (err) {
    console.log(`[CLI] Error:`, err);
    unsubscribeProgress();
    if (htmlPanel?.filePath) window.jarvis.discardHtmlPanel(htmlPanel.filePath).catch(() => {});
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
  if (!currentSettings.wakeWordEnabled) return;
  wakeWordController.start(onWakeWordDetected);
}

function onWakeWordDetected() {
  if (isBusy) return;
  isBusy = true;
  setAvatarState('listening');
  sttController.listenOnce(
    async (transcript) => {
      await sendToJarvis(transcript);
      isBusy = false;
      startWakeWordIfConfigured();
    },
    (err) => {
      appendChatLine('Jarvis', `I couldn't catch that, sir: ${err.message}`);
      setAvatarState('idle');
      isBusy = false;
      startWakeWordIfConfigured();
    }
  );
}

async function sendToJarvis(text) {
  appendChatLine('You', text);
  const operationId = createOperationId();
  activeOperationId = operationId;
  setProcessingResponse(true);
  setAvatarState('processing');
  speakProcessingCue();
  try {
    const { reply, cancelled } = await window.jarvis.sendMessage(text, operationId);
    if (activeOperationId !== operationId && shouldAbortResponse) return;
    activeOperationId = null;
    setProcessingResponse(false);
    if (shouldAbortResponse || cancelled) return;
    const formatted = await formatAssistantResponse(reply);
    if (formatted.html) showHTML(formatted.html);
    appendChatLine('Jarvis', formatted.displayReply);
    stopProcessingCue();
    stopCachedVoice();
    ttsController.stop();
    await speakReply(formatted.reply);
  } catch (err) {
    if (activeOperationId === operationId) activeOperationId = null;
    setProcessingResponse(false);
    if (shouldAbortResponse) return;
    appendChatLine('Jarvis', `I ran into a problem, sir: ${err.message}`);
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
  line.className = `chat-line ${role === 'You' ? 'role-user' : 'role-jarvis'}`;
  const roleEl = document.createElement('span');
  roleEl.className = 'chat-role';
  roleEl.textContent = role;
  const textEl = document.createElement('span');
  textEl.className = 'chat-text';
  textEl.textContent = text;
  line.append(roleEl, textEl);
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
  voicePhraseDraft = normalizeVoicePhrases(settings);
  renderVoicePhraseEditor('morning');
  document.getElementById('preferred-cli-select').value = settings.preferredCliChannel || '';
  document.getElementById('anthropic-api-key-input').value = settings.apiKeys.anthropic || '';
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

document.querySelectorAll('.voice-phrase-tab').forEach((button) => {
  button.addEventListener('click', () => {
    saveCurrentVoicePhraseEditor();
    renderVoicePhraseEditor(button.dataset.phraseTab);
  });
});

async function routeUserMessage(text) {
  const detailRow = matchStatusDetailRequest(text, statusRows);
  if (detailRow) {
    appendChatLine('You', text);
    const reply = detailRow.detail || `I don't have further detail on ${detailRow.type.toLowerCase()}, sir.`;
    appendChatLine('Jarvis', reply);
    await speakReply(reply);
    return;
  }
  const cliCommand = parseCliCommand(text);
  if (cliCommand) {
    await sendToCli(text, cliCommand.channel, cliCommand.task);
  } else if (currentSettings.preferredCliChannel) {
    const channel = CLI_CHANNELS[`/${currentSettings.preferredCliChannel}`];
    if (channel) {
      await sendToCli(text, channel, text);
    } else {
      await sendToJarvis(text);
    }
  } else {
    await sendToJarvis(text);
  }
}

async function sendTextFromInput() {
  if (isBusy) return;
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;
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
  const selectedPath = await window.jarvis.selectFolder();
  if (selectedPath) {
    currentSettings.activeProject = selectedPath;
    document.getElementById('project-input').value = selectedPath;
    await window.jarvis.saveSettings(currentSettings);
    updateHud(currentSettings);
  }
}

document.getElementById('select-project-btn').addEventListener('click', selectAndSetProject);

document.getElementById('project-browse-btn').addEventListener('click', async () => {
  const selectedPath = await window.jarvis.selectFolder();
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

document.getElementById('mute-toggle-btn').addEventListener('click', (e) => {
  isMuted = !isMuted;
  e.target.textContent = isMuted ? 'Unmute' : 'Mute';
  if (isMuted) {
    stopCachedVoice();
    ttsController.stop();
  }
});

document.getElementById('settings-save-btn').addEventListener('click', async () => {
  saveCurrentVoicePhraseEditor();
  const settings = {
    provider: document.getElementById('provider-select').value,
    apiKeys: {
      deepseek: document.getElementById('deepseek-api-key-input').value,
      gemini: document.getElementById('gemini-api-key-input').value,
      elevenlabs: document.getElementById('elevenlabs-api-key-input').value,
      anthropic: document.getElementById('anthropic-api-key-input').value,
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
    voicePhrases: voicePhraseDraft || normalizeVoicePhrases(),
    preferredCliChannel: document.getElementById('preferred-cli-select').value || null,
    activeProject: document.getElementById('project-input').value,
    briefingVoiceFrequency: document.getElementById('briefing-voice-frequency-select').value,
    lastBriefingVoiceAt: currentSettings?.lastBriefingVoiceAt || null,
    maxHtmlPanels: Math.max(1, parseInt(document.getElementById('max-html-panels-input').value, 10) || 50),
  };
  const setupStatus = document.getElementById('setup-status');

  const userProfileResult = await window.jarvis.saveUserProfile(
    document.getElementById('user-profile-input').value,
    document.getElementById('user-profile-geolocation-input').value
  );
  if (userProfileResult.ok) statusRows = userProfileResult.rows;

  const result = await window.jarvis.saveSettings(settings);
  if (!result.ok) {
    const message = `I couldn't save your settings, sir: ${result.error}`;
    if (onboarding) {
      setupStatus.textContent = message;
    } else {
      appendChatLine('Jarvis', message);
    }
    return;
  }
  currentSettings = settings;

  if (onboarding) {
    setupStatus.textContent = 'Testing connection, sir...';
    const test = await window.jarvis.testConnection({ provider: settings.provider, apiKey: settings.apiKeys[settings.provider] });
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
