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
  await ttsController.speak(text);
  setAvatarState('idle');
  isSpeaking = false;
  updateSendButton();
}

async function init() {
  try {
    currentSettings = await window.jarvis.getSettings();
    populateSettingsForm(currentSettings);

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
  const generalGreetings = [
    'Hello, sir.',
    'Welcome back, sir.',
    'At your service, sir.',
    'Online and ready, sir.',
    'Systems are fully operational.',
    'Welcome home, sir.'
  ];
  const morningGreetings = [
    'Good morning, sir.',
    'Morning, sir.',
    'Rise and shine, sir.',
    'Systems are awake and ready, sir.',
    'A fresh morning, sir.'
  ];
  const afternoonGreetings = [
    'Good afternoon, sir.',
    'Afternoon, sir.',
    'Ready for the afternoon run, sir.',
    'All systems standing by this afternoon, sir.',
    'Back online for the afternoon, sir.'
  ];
  const eveningGreetings = [
    'Good evening, sir.',
    'Evening, sir.',
    'The evening systems are online, sir.',
    'Standing by for the night shift, sir.',
    'Welcome back this evening, sir.'
  ];

  const hour = new Date().getHours();
  const timeGreetings = hour < 12
    ? morningGreetings
    : hour < 18
      ? afternoonGreetings
      : eveningGreetings;
  const greetings = [...timeGreetings, ...generalGreetings];
  return greetings[Math.floor(Math.random() * greetings.length)];
}

function buildBriefing(rows) {
  const byType = Object.fromEntries(rows.map((r) => [r.type, r.value]));
  const fragments = [];
  if (byType['Weather']) fragments.push(`it's ${byType['Weather']} out`);
  if (byType['Unread Emails']) fragments.push(`${byType['Unread Emails']} unread emails`);
  if (byType['Urgent Emails']) fragments.push(`${byType['Urgent Emails']} urgent`);
  if (byType['News Briefing']) fragments.push(`today's briefing: ${byType['News Briefing']}`);
  if (!fragments.length) return `I'm online and ready.`;
  const joined = fragments.length === 1
    ? fragments[0]
    : `${fragments.slice(0, -1).join(', ')}, and ${fragments[fragments.length - 1]}`;
  return joined;
}

function buildBriefingDisplay(rows, spokenBriefing) {
  const avatarBriefing = rows.find((row) => row.type === 'Avatar Briefing')?.value;
  if (avatarBriefing) return avatarBriefing;
  const newsBriefing = rows.find((row) => row.type === 'News Briefing')?.value;
  if (!newsBriefing) return spokenBriefing;
  return `today's briefing: ${newsBriefing.replace(/,\s+/g, ',\n')}`;
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

async function speakGreeting(text) {
  // Plays the saved local voice file for this greeting, reusing it on every
  // future greet. Only synthesizes via ElevenLabs the first time this
  // greeting + voice combination is used.
  if (isMuted) return;
  isSpeaking = true;
  updateSendButton();
  setAvatarState('speaking');

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
      // Fallback to Web Speech
      await ttsController.speak(text);
    }
  } catch (err) {
    console.log('[TTS Greeting Error]', err);
    await ttsController.speak(text);
  } finally {
    setAvatarState('idle');
    isSpeaking = false;
    updateSendButton();
  }
}

async function greetUser() {
  try {
    const result = await window.jarvis.getStatus();
    statusRows = result.ok ? result.rows : [];
  } catch (err) {
    console.log(`[Status] Failed to load status sheet: ${err.message}`);
    statusRows = [];
  }
  // Stage 1: Speak simple greeting only (with caching)
  const simpleGreeting = buildSimpleGreeting(statusRows);
  appendChatLine('Jarvis', simpleGreeting);
  await speakGreeting(simpleGreeting);

  // Stage 2: Enter interaction mode and speak briefing
  const appBody = document.getElementById('app-body');
  appBody.classList.add('interaction-mode');
  if (statusRows.some((row) => row.value)) {
    try {
      showPanel(renderStatusBoard(statusRows));
    } catch (err) {
      console.log(`[Status] Failed to render status board: ${err.message}`);
    }
    const briefing = buildBriefing(statusRows);
    const briefingDisplay = buildBriefingDisplay(statusRows, briefing);
    // Replace greeting text with briefing in chat
    const chatLog = document.getElementById('chat-log');
    const lastLine = chatLog.lastElementChild;
    if (lastLine) {
      const textEl = lastLine.querySelector('.chat-text');
      if (textEl) {
        textEl.textContent = briefingDisplay;
      }
    }
    // Show Continue button right away; don't make the user wait for voice playback to finish
    const continueSection = document.getElementById('continue-section');
    if (continueSection) {
      continueSection.style.display = 'block';
    }
    speakReply(briefing);
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
  try {
    console.log(`[CLI] Delegating to ${channel.label}: "${task}"`);
    console.log(`[CLI] Calling channel.delegate (this is an IPC call)...`);
    const result = await channel.delegate(task, operationId);
    console.log(`[CLI] Received result from IPC:`, result);
    console.log(`[CLI] Result status: ${result?.status}, summary length: ${result?.summary?.length}`);
    if (activeOperationId !== operationId && shouldAbortResponse) return;
    activeOperationId = null;
    setProcessingResponse(false);
    if (shouldAbortResponse || result?.status === 'cancelled') return;
    const summary = result.summary || `${channel.label} finished, sir.`;
    const extracted = extractHtmlBlock(summary);
    let reply;
    if (extracted) {
      reply = [extracted.before, extracted.after].filter(Boolean).join(' ') || "Here's the report, sir.";
      showHTML(extracted.html);
    } else {
      reply = summary;
    }
    console.log(`[CLI] Displaying reply: "${reply}"`);
    appendChatLine('Jarvis', reply);
    await speakReply(reply);
  } catch (err) {
    console.log(`[CLI] Error:`, err);
    if (activeOperationId === operationId) activeOperationId = null;
    setProcessingResponse(false);
    if (shouldAbortResponse) return;
    appendChatLine('Jarvis', `I ran into a problem reaching ${channel.label}, sir: ${err.message}`);
  } finally {
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
  try {
    const { reply, cancelled } = await window.jarvis.sendMessage(text, operationId);
    if (activeOperationId !== operationId && shouldAbortResponse) return;
    activeOperationId = null;
    setProcessingResponse(false);
    if (shouldAbortResponse || cancelled) return;
    appendChatLine('Jarvis', reply);
    await speakReply(reply);
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
  document.getElementById('wakeword-enabled-input').checked = settings.wakeWordEnabled;
  document.getElementById('personality-input').value = settings.personality;
  document.getElementById('avatar-select').value = settings.avatarStyle;
  document.getElementById('preferred-cli-select').value = settings.preferredCliChannel || '';
  document.getElementById('project-input').value = settings.activeProject;
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
  ttsController.stop();
  isSpeaking = false;
  updateSendButton();
  const appBody = document.getElementById('app-body');
  appBody.classList.add('phase-3');
  const continueSection = document.getElementById('continue-section');
  if (continueSection) {
    continueSection.style.display = 'none';
  }
});

document.getElementById('settings-btn').addEventListener('click', () => {
  document.getElementById('settings-modal').classList.toggle('hidden');
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
  if (isMuted) ttsController.stop();
});

document.getElementById('settings-save-btn').addEventListener('click', async () => {
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
    personality: document.getElementById('personality-input').value,
    avatarStyle: document.getElementById('avatar-select').value,
    preferredCliChannel: document.getElementById('preferred-cli-select').value || null,
    activeProject: document.getElementById('project-input').value,
  };
  const setupStatus = document.getElementById('setup-status');

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
  updateHud(settings);
  document.getElementById('settings-modal').classList.add('hidden');
  await wakeWordController.stop();
  startWakeWordIfConfigured();
});

init();
