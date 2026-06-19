# Jarvis Voice (Wake Word + STT + TTS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Jarvis a voice — detect the spoken wake word "Jarvis," transcribe what you say next, send it through the existing chat pipeline, and speak the reply back.

**Architecture:** All voice processing (wake-word detection, speech-to-text, Web Speech fallback) runs in the renderer process via browser APIs. ElevenLabs text-to-speech is the one piece that goes through the main process (via a new `tts:synthesize` IPC channel) to keep that API key off the renderer, matching how the other provider keys are handled.

**Tech Stack:** `@picovoice/porcupine-web` + `@picovoice/web-voice-processor` (wake word, loaded via plain `<script>` IIFE builds, no bundler), browser `SpeechRecognition` (STT), ElevenLabs REST API + browser `speechSynthesis` fallback (TTS).

---

## Task 1: Vendor the Porcupine wake-word model and add voice dependencies

Porcupine's wake-word engine needs a `porcupine_params.pv` binary model at runtime. Under Electron's `file://` loading (no HTTP server), the only reliable way to supply it is a base64-encoded JS file committed to the repo — fetching a relative file path doesn't work under `file://`. The "Jarvis" keyword itself is already embedded in the npm package, so only this one engine-parameter file needs vendoring.

**Files:**
- Modify: `package.json`
- Create: `src/renderer/voice/porcupineModel.js` (generated)

- [ ] **Step 1: Add the voice dependencies**

Run:
```bash
npm install --save @picovoice/porcupine-web@^4.0.0 @picovoice/web-voice-processor@^4.0.0 @picovoice/web-utils@^1.4.3
```

This adds a `"dependencies"` section to `package.json` (the project currently only has `devDependencies`) — these three packages are loaded directly by the renderer at runtime via their IIFE builds, and `@picovoice/web-utils` provides the `pvbase64` CLI used in the next step.

- [ ] **Step 2: Download the Porcupine English parameter model**

Run:
```bash
curl -sL -o /tmp/porcupine_params.pv "https://raw.githubusercontent.com/Picovoice/porcupine/master/lib/common/porcupine_params.pv"
```

Expected: a ~960KB binary file at `/tmp/porcupine_params.pv`. Verify with `ls -la /tmp/porcupine_params.pv` — it should NOT be empty or an HTML error page (if `curl` returns an HTML page, the GitHub raw URL path has changed upstream and needs investigating).

- [ ] **Step 3: Convert it to a base64 JS asset**

Run:
```bash
npx pvbase64 -i /tmp/porcupine_params.pv -o src/renderer/voice/porcupineModel.js -n PORCUPINE_PARAMS_BASE64
```

Expected output: `Done! Saved file to 'src/renderer/voice/porcupineModel.js'.` The generated file looks like this (content abbreviated):

```js
var PORCUPINE_PARAMS_BASE64 = "cG9yY3VwaW5lNC4wLjCa...(long base64 string)...";

(function() {
  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined')
    module.exports = PORCUPINE_PARAMS_BASE64
})();
```

This matches the project's existing convention (e.g. `avatarController.js`) of declaring a plain global and conditionally exporting for Node.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/renderer/voice/porcupineModel.js
git commit -m "build: vendor Porcupine wake-word model and add voice dependencies"
```

---

## Task 2: ElevenLabs TTS provider

**Files:**
- Create: `src/main/providers/elevenLabsProvider.js`
- Test: `tests/main/elevenLabsProvider.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/main/elevenLabsProvider.test.js`:

```js
// tests/main/elevenLabsProvider.test.js
const test = require('node:test');
const assert = require('node:assert');
const { createElevenLabsProvider } = require('../../src/main/providers/elevenLabsProvider');

test('createElevenLabsProvider sends synthesis request and returns audio buffer', async () => {
  let capturedUrl, capturedOptions;
  const fakeAudioBytes = new Uint8Array([1, 2, 3, 4]);
  const fakeFetch = async (url, options) => {
    capturedUrl = url;
    capturedOptions = options;
    return { ok: true, arrayBuffer: async () => fakeAudioBytes.buffer };
  };

  const provider = createElevenLabsProvider({ apiKey: 'el-test', fetchImpl: fakeFetch });
  const buffer = await provider.synthesize('Hello, sir.');

  assert.ok(Buffer.isBuffer(buffer));
  assert.deepStrictEqual([...buffer], [1, 2, 3, 4]);
  assert.ok(capturedUrl.includes('api.elevenlabs.io/v1/text-to-speech/'));
  assert.strictEqual(capturedOptions.headers['xi-api-key'], 'el-test');
  const body = JSON.parse(capturedOptions.body);
  assert.strictEqual(body.text, 'Hello, sir.');
});

test('createElevenLabsProvider throws a clear error on non-ok response', async () => {
  const fakeFetch = async () => ({
    ok: false,
    status: 401,
    json: async () => ({ detail: { message: 'Invalid API key' } }),
  });
  const provider = createElevenLabsProvider({ apiKey: 'bad-key', fetchImpl: fakeFetch });

  await assert.rejects(
    () => provider.synthesize('Hello'),
    /ElevenLabs API error \(401\) — Invalid API key/
  );
});

test('createElevenLabsProvider throws a clear error when error body has no detail message', async () => {
  const fakeFetch = async () => ({
    ok: false,
    status: 500,
    json: async () => { throw new Error('not json'); },
  });
  const provider = createElevenLabsProvider({ apiKey: 'el-test', fetchImpl: fakeFetch });

  await assert.rejects(
    () => provider.synthesize('Hello'),
    /ElevenLabs API error \(500\)$/
  );
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '../../src/main/providers/elevenLabsProvider'`

- [ ] **Step 3: Implement the provider**

Create `src/main/providers/elevenLabsProvider.js`:

```js
// src/main/providers/elevenLabsProvider.js
const VOICE_ID = 'pNInz6obpgDQGcFmaJgB'; // ElevenLabs "Adam" voice — calm, formal male voice

function createElevenLabsProvider({ apiKey, fetchImpl = fetch }) {
  async function synthesize(text) {
    const response = await fetchImpl(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',
      }),
    });

    if (!response.ok) {
      let detail = '';
      try {
        const errorBody = await response.json();
        detail = errorBody.detail?.message ? ` — ${errorBody.detail.message}` : '';
      } catch {
        detail = '';
      }
      throw new Error(`ElevenLabs API error (${response.status})${detail}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  return { synthesize };
}

module.exports = { createElevenLabsProvider };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: all 3 new tests PASS, plus all existing tests still pass (22 total).

- [ ] **Step 5: Commit**

```bash
git add src/main/providers/elevenLabsProvider.js tests/main/elevenLabsProvider.test.js
git commit -m "feat: add ElevenLabs TTS provider"
```

---

## Task 3: Extend settings store for ElevenLabs key and wake-word AccessKey

**Files:**
- Modify: `src/main/settings.js`
- Test: `tests/main/settings.test.js`

- [ ] **Step 1: Update existing tests for the new default fields**

In `tests/main/settings.test.js`, update the two `assert.deepStrictEqual(settings.apiKeys, ...)` lines (in `'createSettingsStore returns defaults when no file exists'` and `'createSettingsStore returns defaults when settings file is corrupt'`) from:

```js
assert.deepStrictEqual(settings.apiKeys, { deepseek: '', gemini: '' });
```

to:

```js
assert.deepStrictEqual(settings.apiKeys, { deepseek: '', gemini: '', elevenlabs: '' });
```

Then add two new tests at the end of the file:

```js
test('createSettingsStore defaults wakeWordKey to an empty string', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-settings-'));
  const store = createSettingsStore({ filePath: path.join(dir, 'settings.json'), crypto: fakeCrypto() });
  const settings = store.load();
  assert.strictEqual(settings.wakeWordKey, '');
});

test('createSettingsStore round-trips an encrypted wakeWordKey', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-settings-'));
  const filePath = path.join(dir, 'settings.json');
  const store = createSettingsStore({ filePath, crypto: fakeCrypto() });

  store.save({
    provider: 'deepseek',
    apiKeys: { deepseek: 'sk-deepseek-123', gemini: '', elevenlabs: 'el-456' },
    wakeWordKey: 'pv-access-key-789',
    personality: 'Be witty.',
    avatarStyle: 'rings',
    activeProject: '',
  });

  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert.ok(!raw.wakeWordKey.includes('pv-access-key-789'), 'wake word key must not be stored in plaintext');

  const reloaded = createSettingsStore({ filePath, crypto: fakeCrypto() }).load();
  assert.strictEqual(reloaded.wakeWordKey, 'pv-access-key-789');
  assert.strictEqual(reloaded.apiKeys.elevenlabs, 'el-456');
});
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `npm test`
Expected: FAIL — `settings.wakeWordKey` is `undefined`, and the `deepStrictEqual` checks fail because `elevenlabs` is missing from `DEFAULTS.apiKeys`.

- [ ] **Step 3: Implement the changes**

In `src/main/settings.js`, replace the `DEFAULTS` object:

```js
const DEFAULTS = {
  provider: 'deepseek',
  apiKeys: { deepseek: '', gemini: '', elevenlabs: '' },
  wakeWordKey: '',
  personality: 'You are Jarvis: calm, witty, formal, loyal. Address the user respectfully.',
  avatarStyle: 'rings',
  activeProject: '',
};
```

Replace the `load()` function:

```js
  function load() {
    if (!fs.existsSync(filePath)) return { ...DEFAULTS, apiKeys: { ...DEFAULTS.apiKeys } };
    let raw;
    try {
      raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      return { ...DEFAULTS, apiKeys: { ...DEFAULTS.apiKeys } };
    }

    const apiKeys = { ...DEFAULTS.apiKeys };
    if (raw.apiKeys) {
      for (const [provider, encoded] of Object.entries(raw.apiKeys)) {
        apiKeys[provider] = decryptKey(crypto, encoded);
      }
    } else if (raw.apiKey) {
      // Migrate legacy single-key format (pre-multi-provider) onto the deepseek slot.
      apiKeys.deepseek = decryptKey(crypto, raw.apiKey);
    }

    const wakeWordKey = decryptKey(crypto, raw.wakeWordKey);

    const { apiKey, ...rest } = raw;
    return { ...DEFAULTS, ...rest, apiKeys, wakeWordKey };
  }
```

Replace the `save()` function:

```js
  function save(settings) {
    const encryptedKeys = {};
    for (const [provider, key] of Object.entries(settings.apiKeys || {})) {
      encryptedKeys[provider] = key ? crypto.encryptString(key).toString('base64') : '';
    }
    const toWrite = {
      ...settings,
      apiKeys: encryptedKeys,
      wakeWordKey: settings.wakeWordKey ? crypto.encryptString(settings.wakeWordKey).toString('base64') : '',
    };
    fs.writeFileSync(filePath, JSON.stringify(toWrite, null, 2));
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: all tests PASS (24 total: 22 from before + 2 new).

- [ ] **Step 5: Commit**

```bash
git add src/main/settings.js tests/main/settings.test.js
git commit -m "feat: add ElevenLabs and wake-word key storage to settings"
```

---

## Task 4: Add `tts:synthesize` IPC channel and preload bridge

There's no existing test file for `ipcHandlers.js` (it isn't unit tested today — `chat:send`, `settings:get`, etc. have no dedicated test file), so this task has no new automated tests, consistent with the existing pattern. It will be covered by the manual verification in Task 13.

**Files:**
- Modify: `src/main/ipcHandlers.js`
- Modify: `src/renderer/preload.js`

- [ ] **Step 1: Add the ElevenLabs provider import and IPC handler**

In `src/main/ipcHandlers.js`, add the import alongside the existing provider imports:

```js
const { createElevenLabsProvider } = require('./providers/elevenLabsProvider');
```

Add a new handler inside `registerIpcHandlers()`, after the `chat:send` handler:

```js
  ipcMain.handle('tts:synthesize', async (_event, text) => {
    const settings = settingsStore.load();
    const apiKey = settings.apiKeys?.elevenlabs;
    if (!apiKey) {
      return { ok: false };
    }
    try {
      const provider = createElevenLabsProvider({ apiKey });
      const audioBuffer = await provider.synthesize(text);
      return { ok: true, audioBase64: audioBuffer.toString('base64') };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
```

- [ ] **Step 2: Add the preload bridge method**

In `src/renderer/preload.js`, add a new line inside the `exposeInMainWorld('jarvis', { ... })` object, after `testConnection`:

```js
  synthesizeSpeech: (text) => ipcRenderer.invoke('tts:synthesize', text),
```

- [ ] **Step 3: Verify syntax and run the full test suite**

Run:
```bash
node -c src/main/ipcHandlers.js
node -c src/renderer/preload.js
npm test
```
Expected: SYNTAX_OK on both, and all 24 tests still pass (this task doesn't add tests, just verify nothing broke).

- [ ] **Step 4: Commit**

```bash
git add src/main/ipcHandlers.js src/renderer/preload.js
git commit -m "feat: add tts:synthesize IPC channel"
```

---

## Task 5: Allow microphone access in the main process

Electron blocks media (microphone) permission requests by default; without this, `getUserMedia` calls from the wake-word listener and `SpeechRecognition` will silently fail.

**Files:**
- Modify: `src/main/main.js`

- [ ] **Step 1: Add the permission handler**

In `src/main/main.js`, change the import line:

```js
const { app, BrowserWindow, session } = require('electron');
```

Add the permission handler inside `app.whenReady().then(...)`, before `registerIpcHandlers()`:

```js
app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === 'media');
  });
  registerIpcHandlers();
  createWindow();
});
```

- [ ] **Step 2: Verify syntax**

Run: `node -c src/main/main.js`
Expected: no output (success).

- [ ] **Step 3: Commit**

```bash
git add src/main/main.js
git commit -m "feat: allow microphone permission requests for voice features"
```

---

## Task 6: Add a `listening` avatar state

**Files:**
- Modify: `src/renderer/avatar/ringsAvatar.js`
- Modify: `src/renderer/avatar/brainAvatar.js`
- Modify: `src/renderer/styles.css`
- Test: `tests/renderer/avatarController.test.js`

- [ ] **Step 1: Write the failing test additions**

In `tests/renderer/avatarController.test.js`, add these assertions inside the existing `'avatarController mounts the rings preset and toggles speaking state'` test, right before the `delete global.document;` line:

```js
  controller.setState('listening');
  assert.ok(mountEl.querySelector('.ring-stage').classList.contains('listening'));

  controller.setState('idle');
  assert.ok(!mountEl.querySelector('.ring-stage').classList.contains('listening'));
```

Add a new test at the end of the file:

```js
test('avatarController toggles listening state on the brain preset', () => {
  const dom = new JSDOM('<div id="mount"></div>');
  global.document = dom.window.document;

  const { createAvatarController } = require('../../src/renderer/avatar/avatarController');
  const mountEl = dom.window.document.getElementById('mount');

  const controller = createAvatarController({ mountEl, style: 'brain' });
  controller.setState('listening');
  assert.ok(mountEl.querySelector('.brain-core').classList.contains('listening'));

  controller.setState('idle');
  assert.ok(!mountEl.querySelector('.brain-core').classList.contains('listening'));

  delete global.document;
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — the `listening` class is never added because `setState` doesn't handle it yet.

- [ ] **Step 3: Implement the listening state**

In `src/renderer/avatar/ringsAvatar.js`, update `setState`:

```js
    setState(state) {
      stage.classList.toggle('speaking', state === 'speaking');
      stage.classList.toggle('listening', state === 'listening');
    },
```

In `src/renderer/avatar/brainAvatar.js`, update `setState`:

```js
    setState(state) {
      core.classList.toggle('speaking', state === 'speaking');
      core.classList.toggle('listening', state === 'listening');
    },
```

- [ ] **Step 4: Add visual styling**

In `src/renderer/styles.css`, add after the existing `.ring-stage.speaking .core` rule:

```css
.ring-stage.listening .outer { animation-duration: 2.5s; border-color: #ffb84f transparent #ffb84f transparent; }
.ring-stage.listening .middle { animation-duration: 3.5s; border-color: transparent #ffb84f transparent #ffb84f; }
.ring-stage.listening .core { background: radial-gradient(circle, #ffe2ae 0%, #ffb84f 60%, #4a2e0a 100%); box-shadow: 0 0 25px #ffb84fcc; }
```

And after the existing `.brain-core.speaking .vein` rule:

```css
.brain-core.listening { border-color: #ffb84f; animation: pulse-idle 1.2s ease-in-out infinite; }
.brain-core.listening .vein { stroke: #ffb84f; }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`
Expected: all tests PASS (25 total: 24 from before + 1 new test, plus the 2 added assertions in the existing rings test).

- [ ] **Step 6: Commit**

```bash
git add src/renderer/avatar/ringsAvatar.js src/renderer/avatar/brainAvatar.js src/renderer/styles.css tests/renderer/avatarController.test.js
git commit -m "feat: add listening state to both avatar presets"
```

---

## Task 7: Settings UI fields, mute button, and voice script tags

**Files:**
- Modify: `src/renderer/index.html`

- [ ] **Step 1: Add the new settings fields**

In `src/renderer/index.html`, add two new fields inside `#settings-modal`, after the `Gemini API Key` label and before the `Personality` label:

```html
    <label>ElevenLabs API Key (optional, for natural voice): <input id="elevenlabs-api-key-input" type="password"></label>
    <label>Picovoice AccessKey (optional, for "Jarvis" wake word): <input id="wakeword-key-input" type="password"></label>
```

- [ ] **Step 2: Add the mute toggle button**

In `#app-screen`, add a mute button after `#settings-btn`:

```html
    <button id="mute-toggle-btn">Mute</button>
```

- [ ] **Step 3: Add the voice library and controller script tags**

Replace the closing `<script>` block (everything from `<script src="avatar/ringsAvatar.js">` to the closing `</body>`) with:

```html
  <script src="avatar/ringsAvatar.js"></script>
  <script src="avatar/brainAvatar.js"></script>
  <script src="avatar/avatarController.js"></script>
  <script src="../../node_modules/@picovoice/porcupine-web/dist/iife/index.js"></script>
  <script src="../../node_modules/@picovoice/web-voice-processor/dist/iife/index.js"></script>
  <script src="voice/porcupineModel.js"></script>
  <script src="voice/wakeWordController.js"></script>
  <script src="voice/sttController.js"></script>
  <script src="voice/ttsController.js"></script>
  <script src="renderer.js"></script>
</body>
</html>
```

(The three `voice/*Controller.js` files are created in Tasks 8–10. `index.html` won't load correctly until those exist — that's expected and resolved by the end of Task 10.)

- [ ] **Step 4: Commit**

```bash
git add src/renderer/index.html
git commit -m "feat: add voice settings fields, mute button, and voice script tags"
```

---

## Task 8: Wake-word controller

This file depends on real browser APIs (`PorcupineWeb`, `WebVoiceProcessor` globals, microphone access via `getUserMedia`) that don't exist under the Node test runner — the same situation as `avatarController.js`'s underlying mount functions would be without jsdom, except here there's no WASM/audio equivalent in jsdom either. This is implemented directly and verified manually in Task 13, per the spec's testing strategy.

**Files:**
- Create: `src/renderer/voice/wakeWordController.js`

- [ ] **Step 1: Implement the controller**

Create `src/renderer/voice/wakeWordController.js`:

```js
// src/renderer/voice/wakeWordController.js
function createWakeWordController() {
  let porcupineWorker = null;

  async function start(accessKey, onWake) {
    if (!accessKey) return false;
    try {
      porcupineWorker = await PorcupineWeb.PorcupineWorker.create(
        accessKey,
        PorcupineWeb.BuiltInKeyword.Jarvis,
        () => onWake(),
        { base64: PORCUPINE_PARAMS_BASE64 }
      );
      await WebVoiceProcessor.subscribe(porcupineWorker.worker);
      return true;
    } catch (err) {
      console.error('Wake word listener failed to start, sir:', err.message);
      porcupineWorker = null;
      return false;
    }
  }

  async function stop() {
    if (!porcupineWorker) return;
    await WebVoiceProcessor.unsubscribe(porcupineWorker.worker);
    porcupineWorker.terminate();
    porcupineWorker = null;
  }

  return { start, stop };
}
```

- [ ] **Step 2: Verify syntax**

Run: `node -c src/renderer/voice/wakeWordController.js`
Expected: no output (success). Note this only checks JS syntax validity — `PorcupineWeb`/`WebVoiceProcessor`/`PORCUPINE_PARAMS_BASE64` are browser globals that don't exist under Node, so this file cannot run under `npm test`; that's expected.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/voice/wakeWordController.js
git commit -m "feat: add wake-word controller"
```

---

## Task 9: Speech-to-text controller

Same testing caveat as Task 8 — depends on the browser's native `SpeechRecognition`, verified manually in Task 13.

**Files:**
- Create: `src/renderer/voice/sttController.js`

- [ ] **Step 1: Implement the controller**

Create `src/renderer/voice/sttController.js`:

```js
// src/renderer/voice/sttController.js
function createSttController() {
  function listenOnce(onResult, onError) {
    const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionImpl) {
      onError(new Error('Speech recognition is not supported in this browser, sir.'));
      return;
    }

    const recognition = new SpeechRecognitionImpl();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    };

    recognition.onerror = (event) => {
      onError(new Error(`Speech recognition error: ${event.error}`));
    };

    recognition.start();
  }

  return { listenOnce };
}
```

- [ ] **Step 2: Verify syntax**

Run: `node -c src/renderer/voice/sttController.js`
Expected: no output (success).

- [ ] **Step 3: Commit**

```bash
git add src/renderer/voice/sttController.js
git commit -m "feat: add speech-to-text controller"
```

---

## Task 10: Text-to-speech controller

Same testing caveat as Task 8 — depends on `window.jarvis.synthesizeSpeech` (a real IPC bridge) and `window.speechSynthesis`, verified manually in Task 13.

**Files:**
- Create: `src/renderer/voice/ttsController.js`

- [ ] **Step 1: Implement the controller**

Create `src/renderer/voice/ttsController.js`:

```js
// src/renderer/voice/ttsController.js
function createTtsController() {
  function speakWithWebSpeech(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
  }

  async function speak(text) {
    try {
      const result = await window.jarvis.synthesizeSpeech(text);
      if (!result.ok) {
        speakWithWebSpeech(text);
        return;
      }
      const audio = new Audio(`data:audio/mpeg;base64,${result.audioBase64}`);
      audio.play().catch(() => speakWithWebSpeech(text));
    } catch (err) {
      speakWithWebSpeech(text);
    }
  }

  return { speak };
}
```

- [ ] **Step 2: Verify syntax**

Run: `node -c src/renderer/voice/ttsController.js`
Expected: no output (success).

- [ ] **Step 3: Commit**

```bash
git add src/renderer/voice/ttsController.js
git commit -m "feat: add text-to-speech controller"
```

---

## Task 11: Wire voice into renderer.js

This task connects everything: settings form fields, the wake-word → STT → chat → TTS flow, and the mute toggle. It also refactors the existing inline send logic into a shared `sendToJarvis` function so both typed and spoken input go through one path (avoiding duplicating the avatar-state/IPC/error-handling logic).

**Files:**
- Modify: `src/renderer/renderer.js`

- [ ] **Step 1: Replace the full file**

Replace the entire contents of `src/renderer/renderer.js` with:

```js
// src/renderer/renderer.js
let avatarController = null;
let currentSettings = null;
let onboarding = false;
let isMuted = false;
let isBusy = false;

const wakeWordController = createWakeWordController();
const sttController = createSttController();
const ttsController = createTtsController();

async function init() {
  try {
    currentSettings = await window.jarvis.getSettings();
    populateSettingsForm(currentSettings);

    if (!currentSettings.apiKeys[currentSettings.provider]) {
      onboarding = true;
      document.getElementById('setup-banner').classList.remove('hidden');
      document.getElementById('settings-modal').classList.remove('hidden');
      return;
    }

    showAppScreen();
  } catch (err) {
    document.getElementById('hud-status').textContent = `STATUS: ERROR — ${err.message}`;
  }
}

function showAppScreen() {
  document.getElementById('app-screen').classList.remove('hidden');
  document.getElementById('settings-modal').classList.add('hidden');
  document.getElementById('setup-banner').classList.add('hidden');
  mountAvatar(currentSettings.avatarStyle);
  updateHud(currentSettings);
  greetUser();
  startWakeWordIfConfigured();
}

function greetUser() {
  appendChatLine(
    'Jarvis',
    "Good to see you, sir. I'm online and ready — I can chat, answer questions, and delegate coding tasks to Claude Code in your active project. You can switch AI providers or update settings anytime from the Settings panel."
  );
}

async function startWakeWordIfConfigured() {
  if (!currentSettings.wakeWordKey) return;
  await wakeWordController.start(currentSettings.wakeWordKey, onWakeWordDetected);
}

function onWakeWordDetected() {
  if (isBusy) return;
  isBusy = true;
  avatarController.setState('listening');
  sttController.listenOnce(
    async (transcript) => {
      await sendToJarvis(transcript);
      isBusy = false;
    },
    (err) => {
      appendChatLine('Jarvis', `I couldn't catch that, sir: ${err.message}`);
      avatarController.setState('idle');
      isBusy = false;
    }
  );
}

async function sendToJarvis(text) {
  appendChatLine('You', text);
  avatarController.setState('speaking');
  try {
    const { reply } = await window.jarvis.sendMessage(text);
    appendChatLine('Jarvis', reply);
    if (!isMuted) await ttsController.speak(reply);
  } catch (err) {
    appendChatLine('Jarvis', `I ran into a problem, sir: ${err.message}`);
  } finally {
    avatarController.setState('idle');
  }
}

function mountAvatar(style) {
  const mountEl = document.getElementById('avatar-mount');
  avatarController = createAvatarController({ mountEl, style });
}

function updateHud(settings) {
  const status = document.getElementById('hud-status');
  status.textContent = `PROJECT: ${settings.activeProject || 'none'} // STATUS: idle`;
}

function appendChatLine(role, text) {
  const log = document.getElementById('chat-log');
  const line = document.createElement('div');
  line.textContent = `${role}: ${text}`;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}

function populateSettingsForm(settings) {
  document.getElementById('provider-select').value = settings.provider;
  document.getElementById('deepseek-api-key-input').value = settings.apiKeys.deepseek;
  document.getElementById('gemini-api-key-input').value = settings.apiKeys.gemini;
  document.getElementById('elevenlabs-api-key-input').value = settings.apiKeys.elevenlabs;
  document.getElementById('wakeword-key-input').value = settings.wakeWordKey;
  document.getElementById('personality-input').value = settings.personality;
  document.getElementById('avatar-select').value = settings.avatarStyle;
  document.getElementById('project-input').value = settings.activeProject;
}

document.getElementById('chat-input').addEventListener('keydown', async (e) => {
  if (e.key !== 'Enter') return;
  const input = e.target;
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  if (isBusy) return;
  isBusy = true;
  await sendToJarvis(text);
  isBusy = false;
});

document.getElementById('settings-btn').addEventListener('click', () => {
  document.getElementById('settings-modal').classList.toggle('hidden');
});

document.getElementById('mute-toggle-btn').addEventListener('click', (e) => {
  isMuted = !isMuted;
  e.target.textContent = isMuted ? 'Unmute' : 'Mute';
});

document.getElementById('settings-save-btn').addEventListener('click', async () => {
  const settings = {
    provider: document.getElementById('provider-select').value,
    apiKeys: {
      deepseek: document.getElementById('deepseek-api-key-input').value,
      gemini: document.getElementById('gemini-api-key-input').value,
      elevenlabs: document.getElementById('elevenlabs-api-key-input').value,
    },
    wakeWordKey: document.getElementById('wakeword-key-input').value,
    personality: document.getElementById('personality-input').value,
    avatarStyle: document.getElementById('avatar-select').value,
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
```

- [ ] **Step 2: Verify syntax**

Run: `node -c src/renderer/renderer.js`
Expected: no output (success).

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: all 25 tests still pass — `renderer.js` itself has no dedicated test file (it's wired up live in the running app), so this step is a regression check that nothing else broke.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/renderer.js
git commit -m "feat: wire wake word, STT, and TTS into the chat flow"
```

---

## Task 12: Update README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the Status and add a Voice section**

In `README.md`, replace:

```markdown
## Status

Phase 1 (this build): chat, settings, avatar, Claude Code delegation.
Phase 2 (planned): voice — wake word ("Hey Jarvis" via openWakeWord), STT (whisper.cpp), TTS (ElevenLabs + Web Speech fallback).
Phase 3 (planned): long-term memory via Mem0 + local vector store.
```

with:

```markdown
## Voice

Optional, configured in Settings:
- **Wake word** — say "Jarvis" to start listening. Requires a free Picovoice AccessKey from https://console.picovoice.ai/. Without one, voice is simply off and typing works as normal.
- **Speech-to-text** — uses the browser's built-in speech recognition, no key needed.
- **Text-to-speech** — every reply is spoken aloud. Uses ElevenLabs if a key is configured (https://elevenlabs.io/), otherwise falls back to the browser's built-in voice. Use the Mute button to silence it.

## Status

Phase 1 (complete): chat, settings, avatar, Claude Code delegation.
Phase 2 (this build): voice — wake word ("Jarvis" via Picovoice Porcupine), STT (browser SpeechRecognition), TTS (ElevenLabs + Web Speech fallback).
Phase 3 (planned): long-term memory via Mem0 + local vector store.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document voice setup and update status"
```

---

## Task 13: Manual end-to-end verification

Voice features depend on real microphone hardware, network speech recognition, and (optionally) a paid ElevenLabs key — none of which are available in the automated test suite. This checklist must be run in the actual Electron app before considering this phase done.

- [ ] **Step 1: Launch the app**

Run: `npm start` (or double-click `run.bat`)
Expected: app launches without console errors related to the new voice scripts (open DevTools via `Ctrl+Shift+I` if needed to check for script-load failures from the `<script src="../../node_modules/...">` tags).

- [ ] **Step 2: Verify voice is off by default**

With no Picovoice key configured, confirm the app behaves exactly as before — text chat works, no mic permission prompt appears.

- [ ] **Step 3: Configure a Picovoice AccessKey**

Get a free key at https://console.picovoice.ai/, paste it into the new "Picovoice AccessKey" field in Settings, save. Confirm a microphone permission prompt appears (first time only) and grant it.

- [ ] **Step 4: Test the wake word**

Say "Jarvis" clearly. Expected: the avatar switches to the `listening` state (amber/orange pulse instead of cyan).

- [ ] **Step 5: Test STT and the chat round-trip**

After the avatar shows `listening`, say a short question. Expected: your words appear in the chat log as a "You" message, Jarvis responds, and the avatar switches to `speaking`.

- [ ] **Step 6: Test TTS fallback (no ElevenLabs key)**

With no ElevenLabs key configured, confirm Jarvis's reply is spoken aloud using the browser's built-in voice.

- [ ] **Step 7: Test ElevenLabs TTS (optional, if you have a key)**

Add an ElevenLabs key in Settings, save, send another message. Expected: the reply is spoken in the ElevenLabs voice instead of the robotic browser voice.

- [ ] **Step 8: Test mute**

Click the Mute button, send a message. Expected: the reply appears in chat but is not spoken. Click Unmute, send another message, confirm speech resumes.

- [ ] **Step 9: Test removing the wake-word key**

Clear the Picovoice AccessKey field, save. Expected: no errors; saying "Jarvis" no longer does anything; typed chat still works.
