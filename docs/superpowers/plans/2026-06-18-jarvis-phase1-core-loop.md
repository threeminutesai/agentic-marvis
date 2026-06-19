# Jarvis Phase 1: Core Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working Electron desktop app where you can chat with Jarvis (DeepSeek-backed), see a switchable animated avatar react, configure settings, and delegate a task to Claude Code CLI and get a spoken-style text summary back.

**Architecture:** Electron app with a Node.js main process (settings, AI provider abstraction, Claude Code process spawning, IPC handlers) and a contextIsolated renderer (chat UI, avatar canvas, settings modal) talking to main only through a `preload.js` bridge. No bundler — plain script tags. Voice (STT/TTS/wake word) and Mem0 long-term memory are explicitly out of scope for this phase (see design spec's "Out of Scope" + follow-up phases).

**Tech Stack:** Electron, Node.js built-in `fetch` and `child_process`, Node's built-in test runner (`node:test` + `node:assert`), jsdom (for renderer unit tests only).

---

## File Structure

```
jarvis/
  package.json
  src/
    main/
      main.js                    - Electron entry point, creates BrowserWindow, wires IPC
      settings.js                - load/save settings.json, encrypt/decrypt API keys (injectable crypto provider)
      providers/
        deepseekProvider.js      - DeepSeek chat completion client (injectable fetch)
      claudeCode/
        delegate.js              - spawn `claude -p`, parse stream-json, return summary (injectable spawn)
      ipcHandlers.js             - registers all ipcMain handlers
    renderer/
      index.html
      preload.js                 - contextBridge exposing safe IPC API to renderer
      renderer.js                - DOM wiring: chat, settings modal, avatar mount
      avatar/
        ringsAvatar.js           - Rings/HUD preset (CommonJS + browser UMD guard)
        brainAvatar.js           - Electrical Brain preset (CommonJS + browser UMD guard)
        avatarController.js      - mounts selected preset, exposes setState('idle'|'speaking')
      styles.css
  tests/
    main/
      settings.test.js
      deepseekProvider.test.js
      delegate.test.js
    renderer/
      avatarController.test.js
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `src/main/main.js`
- Create: `src/renderer/index.html`
- Create: `src/renderer/preload.js`
- Create: `src/renderer/styles.css`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "jarvis",
  "version": "0.1.0",
  "description": "JARVIS-style desktop AI assistant",
  "main": "src/main/main.js",
  "scripts": {
    "start": "electron .",
    "test": "node --test tests/"
  },
  "devDependencies": {
    "electron": "^31.0.0",
    "jsdom": "^24.0.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, no errors.

- [ ] **Step 3: Create `src/renderer/preload.js`**

```js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('jarvis', {
  sendMessage: (text) => ipcRenderer.invoke('chat:send', text),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  delegateTask: (task) => ipcRenderer.invoke('claudeCode:delegate', task),
});
```

- [ ] **Step 4: Create `src/renderer/index.html`**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Jarvis</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="avatar-mount"></div>
  <div id="hud-status">PROJECT: none // STATUS: idle</div>
  <div id="chat-log"></div>
  <input id="chat-input" placeholder="Talk to Jarvis...">
  <button id="settings-btn">Settings</button>
  <div id="settings-modal" class="hidden">
    <label>AI Provider: <select id="provider-select"><option value="deepseek">DeepSeek</option></select></label>
    <label>API Key: <input id="api-key-input" type="password"></label>
    <label>Personality: <textarea id="personality-input"></textarea></label>
    <label>Avatar Style: <select id="avatar-select"><option value="rings">Rings/HUD</option><option value="brain">Electrical Brain</option></select></label>
    <label>Active Project: <input id="project-input" placeholder="/path/to/project"></label>
    <button id="settings-save-btn">Save</button>
  </div>
  <script src="avatar/ringsAvatar.js"></script>
  <script src="avatar/brainAvatar.js"></script>
  <script src="avatar/avatarController.js"></script>
  <script src="renderer.js"></script>
</body>
</html>
```

- [ ] **Step 5: Create `src/renderer/styles.css`**

```css
body { background: #06090d; color: #4fd6ff; font-family: monospace; margin: 0; padding: 16px; }
.hidden { display: none; }
#chat-log { min-height: 200px; max-height: 300px; overflow-y: auto; margin: 16px 0; }
#chat-input { width: 100%; background: #111; color: #4fd6ff; border: 1px solid #4fd6ff; padding: 8px; }
```

- [ ] **Step 6: Create `src/main/main.js`**

```js
const { app, BrowserWindow } = require('electron');
const path = require('path');
const { registerIpcHandlers } = require('./ipcHandlers');

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, '../renderer/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, '../renderer/index.html'));
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

- [ ] **Step 7: Commit**

```bash
git add package.json src/main/main.js src/renderer/index.html src/renderer/preload.js src/renderer/styles.css
git commit -m "feat: scaffold Electron app shell"
```

---

### Task 2: Settings persistence

**Files:**
- Create: `src/main/settings.js`
- Test: `tests/main/settings.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/main/settings.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createSettingsStore } = require('../../src/main/settings');

function fakeCrypto() {
  return {
    isEncryptionAvailable: () => true,
    encryptString: (s) => Buffer.from('ENC:' + s),
    decryptString: (buf) => buf.toString().replace(/^ENC:/, ''),
  };
}

test('createSettingsStore returns defaults when no file exists', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-settings-'));
  const store = createSettingsStore({ filePath: path.join(dir, 'settings.json'), crypto: fakeCrypto() });
  const settings = store.load();
  assert.strictEqual(settings.provider, 'deepseek');
  assert.strictEqual(settings.apiKey, '');
  assert.strictEqual(settings.avatarStyle, 'rings');
});

test('createSettingsStore round-trips saved settings with encrypted API key', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-settings-'));
  const filePath = path.join(dir, 'settings.json');
  const store = createSettingsStore({ filePath, crypto: fakeCrypto() });

  store.save({ provider: 'deepseek', apiKey: 'sk-test-123', personality: 'Be witty.', avatarStyle: 'brain', activeProject: '/tmp/proj' });

  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert.ok(!raw.apiKey.includes('sk-test-123'), 'API key must not be stored in plaintext');

  const reloaded = createSettingsStore({ filePath, crypto: fakeCrypto() }).load();
  assert.strictEqual(reloaded.apiKey, 'sk-test-123');
  assert.strictEqual(reloaded.avatarStyle, 'brain');
  assert.strictEqual(reloaded.activeProject, '/tmp/proj');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/main/settings.test.js`
Expected: FAIL with "Cannot find module '../../src/main/settings'"

- [ ] **Step 3: Write minimal implementation**

```js
// src/main/settings.js
const fs = require('node:fs');

const DEFAULTS = {
  provider: 'deepseek',
  apiKey: '',
  personality: 'You are Jarvis: calm, witty, formal, loyal. Address the user respectfully.',
  avatarStyle: 'rings',
  activeProject: '',
};

function createSettingsStore({ filePath, crypto }) {
  function load() {
    if (!fs.existsSync(filePath)) return { ...DEFAULTS };
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const apiKey = raw.apiKey ? crypto.decryptString(Buffer.from(raw.apiKey, 'base64')) : '';
    return { ...DEFAULTS, ...raw, apiKey };
  }

  function save(settings) {
    const encryptedKey = settings.apiKey
      ? crypto.encryptString(settings.apiKey).toString('base64')
      : '';
    const toWrite = { ...settings, apiKey: encryptedKey };
    fs.writeFileSync(filePath, JSON.stringify(toWrite, null, 2));
  }

  return { load, save };
}

module.exports = { createSettingsStore, DEFAULTS };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/main/settings.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/main/settings.js tests/main/settings.test.js
git commit -m "feat: add encrypted settings persistence"
```

---

### Task 3: DeepSeek provider

**Files:**
- Create: `src/main/providers/deepseekProvider.js`
- Test: `tests/main/deepseekProvider.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/main/deepseekProvider.test.js
const test = require('node:test');
const assert = require('node:assert');
const { createDeepseekProvider } = require('../../src/main/providers/deepseekProvider');

test('createDeepseekProvider sends chat request and returns reply text', async () => {
  let capturedUrl, capturedOptions;
  const fakeFetch = async (url, options) => {
    capturedUrl = url;
    capturedOptions = options;
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'All systems nominal, sir.' } }] }),
    };
  };

  const provider = createDeepseekProvider({ apiKey: 'sk-test', fetchImpl: fakeFetch });
  const reply = await provider.chat({
    systemPrompt: 'You are Jarvis.',
    messages: [{ role: 'user', content: 'Status report.' }],
  });

  assert.strictEqual(reply, 'All systems nominal, sir.');
  assert.strictEqual(capturedUrl, 'https://api.deepseek.com/chat/completions');
  const body = JSON.parse(capturedOptions.body);
  assert.strictEqual(body.messages[0].role, 'system');
  assert.strictEqual(body.messages[0].content, 'You are Jarvis.');
  assert.strictEqual(capturedOptions.headers.Authorization, 'Bearer sk-test');
});

test('createDeepseekProvider throws a clear error on non-ok response', async () => {
  const fakeFetch = async () => ({ ok: false, status: 401, json: async () => ({ error: 'invalid key' }) });
  const provider = createDeepseekProvider({ apiKey: 'bad-key', fetchImpl: fakeFetch });

  await assert.rejects(
    () => provider.chat({ systemPrompt: 'x', messages: [] }),
    /DeepSeek API error \(401\)/
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/main/deepseekProvider.test.js`
Expected: FAIL with "Cannot find module '../../src/main/providers/deepseekProvider'"

- [ ] **Step 3: Write minimal implementation**

```js
// src/main/providers/deepseekProvider.js
function createDeepseekProvider({ apiKey, fetchImpl = fetch }) {
  async function chat({ systemPrompt, messages }) {
    const response = await fetchImpl('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
      }),
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error (${response.status})`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  return { chat };
}

module.exports = { createDeepseekProvider };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/main/deepseekProvider.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/main/providers/deepseekProvider.js tests/main/deepseekProvider.test.js
git commit -m "feat: add DeepSeek chat provider"
```

---

### Task 4: Claude Code delegation

**Files:**
- Create: `src/main/claudeCode/delegate.js`
- Test: `tests/main/delegate.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/main/delegate.test.js
const test = require('node:test');
const assert = require('node:assert');
const { EventEmitter } = require('node:events');
const { delegateTask } = require('../../src/main/claudeCode/delegate');

function fakeChildProcess(stdoutLines, exitCode = 0) {
  const proc = new EventEmitter();
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  setImmediate(() => {
    for (const line of stdoutLines) proc.stdout.emit('data', Buffer.from(line + '\n'));
    proc.emit('close', exitCode);
  });
  return proc;
}

test('delegateTask spawns claude -p with the task and project cwd', async () => {
  let capturedCmd, capturedArgs, capturedOptions;
  const fakeSpawn = (cmd, args, options) => {
    capturedCmd = cmd; capturedArgs = args; capturedOptions = options;
    return fakeChildProcess([
      JSON.stringify({ type: 'result', subtype: 'success', result: 'Refactored auth.py successfully.' }),
    ]);
  };

  const result = await delegateTask({
    task: 'Refactor auth.py',
    projectPath: '/tmp/myproject',
    spawnImpl: fakeSpawn,
  });

  assert.strictEqual(capturedCmd, 'claude');
  assert.deepStrictEqual(capturedArgs, ['-p', 'Refactor auth.py', '--output-format', 'stream-json']);
  assert.strictEqual(capturedOptions.cwd, '/tmp/myproject');
  assert.strictEqual(result.status, 'success');
  assert.strictEqual(result.summary, 'Refactored auth.py successfully.');
});

test('delegateTask reports a clear error when claude CLI is missing', async () => {
  const fakeSpawn = () => {
    const proc = new EventEmitter();
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    setImmediate(() => proc.emit('error', new Error('spawn claude ENOENT')));
    return proc;
  };

  const result = await delegateTask({ task: 'Anything', projectPath: '/tmp/x', spawnImpl: fakeSpawn });

  assert.strictEqual(result.status, 'error');
  assert.match(result.summary, /can't reach Claude Code/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/main/delegate.test.js`
Expected: FAIL with "Cannot find module '../../src/main/claudeCode/delegate'"

- [ ] **Step 3: Write minimal implementation**

```js
// src/main/claudeCode/delegate.js
const { spawn } = require('node:child_process');

function delegateTask({ task, projectPath, spawnImpl = spawn }) {
  return new Promise((resolve) => {
    const proc = spawnImpl('claude', ['-p', task, '--output-format', 'stream-json'], { cwd: projectPath });
    let buffer = '';
    let finalResult = null;

    proc.on('error', () => {
      resolve({ status: 'error', summary: "I can't reach Claude Code, sir — is it installed and logged in?" });
    });

    proc.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          if (event.type === 'result') finalResult = event;
        } catch {
          // ignore non-JSON lines
        }
      }
    });

    proc.on('close', (code) => {
      if (finalResult && finalResult.subtype === 'success') {
        resolve({ status: 'success', summary: finalResult.result });
      } else if (finalResult) {
        resolve({ status: 'error', summary: finalResult.result || `Claude Code exited with an error (code ${code}).` });
      } else {
        resolve({ status: 'error', summary: `Claude Code exited unexpectedly (code ${code}).` });
      }
    });
  });
}

module.exports = { delegateTask };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/main/delegate.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/main/claudeCode/delegate.js tests/main/delegate.test.js
git commit -m "feat: add Claude Code headless delegation"
```

---

### Task 5: IPC handlers wiring main process

**Files:**
- Create: `src/main/ipcHandlers.js`
- Modify: `src/main/main.js` (already wired in Task 1 — no change needed)

- [ ] **Step 1: Create `src/main/ipcHandlers.js`**

```js
// src/main/ipcHandlers.js
const { ipcMain, safeStorage } = require('electron');
const path = require('node:path');
const os = require('node:os');
const { createSettingsStore } = require('./settings');
const { createDeepseekProvider } = require('./providers/deepseekProvider');
const { delegateTask } = require('./claudeCode/delegate');

function registerIpcHandlers() {
  const settingsStore = createSettingsStore({
    filePath: path.join(os.homedir(), '.jarvis-settings.json'),
    crypto: safeStorage,
  });

  ipcMain.handle('settings:get', () => settingsStore.load());

  ipcMain.handle('settings:save', (_event, settings) => {
    settingsStore.save(settings);
    return { ok: true };
  });

  ipcMain.handle('chat:send', async (_event, text) => {
    const settings = settingsStore.load();
    const provider = createDeepseekProvider({ apiKey: settings.apiKey });
    try {
      const reply = await provider.chat({
        systemPrompt: settings.personality,
        messages: [{ role: 'user', content: text }],
      });
      return { ok: true, reply };
    } catch (err) {
      return { ok: false, reply: `I'm having trouble reaching my AI provider, sir: ${err.message}` };
    }
  });

  ipcMain.handle('claudeCode:delegate', async (_event, task) => {
    const settings = settingsStore.load();
    if (!settings.activeProject) {
      return { status: 'error', summary: 'No active project is set, sir. Please choose one in settings first.' };
    }
    return delegateTask({ task, projectPath: settings.activeProject });
  });
}

module.exports = { registerIpcHandlers };
```

- [ ] **Step 2: Commit**

```bash
git add src/main/ipcHandlers.js
git commit -m "feat: wire IPC handlers for settings, chat, and delegation"
```

---

### Task 6: Avatar presets (Rings + Brain)

**Files:**
- Create: `src/renderer/avatar/ringsAvatar.js`
- Create: `src/renderer/avatar/brainAvatar.js`
- Create: `src/renderer/avatar/avatarController.js`
- Test: `tests/renderer/avatarController.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/renderer/avatarController.test.js
const test = require('node:test');
const assert = require('node:assert');
const { JSDOM } = require('jsdom');

test('avatarController mounts the rings preset and toggles speaking state', () => {
  const dom = new JSDOM('<div id="mount"></div>');
  global.document = dom.window.document;

  const { createAvatarController } = require('../../src/renderer/avatar/avatarController');
  const mountEl = dom.window.document.getElementById('mount');

  const controller = createAvatarController({ mountEl, style: 'rings' });
  assert.ok(mountEl.querySelector('.ring-stage'), 'rings preset should render a .ring-stage element');

  controller.setState('speaking');
  assert.ok(mountEl.querySelector('.ring-stage').classList.contains('speaking'));

  controller.setState('idle');
  assert.ok(!mountEl.querySelector('.ring-stage').classList.contains('speaking'));

  delete global.document;
});

test('avatarController mounts the brain preset', () => {
  const dom = new JSDOM('<div id="mount"></div>');
  global.document = dom.window.document;

  const { createAvatarController } = require('../../src/renderer/avatar/avatarController');
  const mountEl = dom.window.document.getElementById('mount');

  const controller = createAvatarController({ mountEl, style: 'brain' });
  assert.ok(mountEl.querySelector('.brain-core'), 'brain preset should render a .brain-core element');

  delete global.document;
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/renderer/avatarController.test.js`
Expected: FAIL with "Cannot find module '../../src/renderer/avatar/avatarController'"

- [ ] **Step 3: Write minimal implementation**

```js
// src/renderer/avatar/ringsAvatar.js
function mountRingsAvatar(mountEl) {
  mountEl.innerHTML = `
    <div class="ring-stage">
      <div class="ring outer"></div>
      <div class="ring middle"></div>
      <div class="ring inner"></div>
      <div class="core"></div>
    </div>`;
  const stage = mountEl.querySelector('.ring-stage');
  return {
    setState(state) {
      stage.classList.toggle('speaking', state === 'speaking');
    },
  };
}

if (typeof module !== 'undefined') module.exports = { mountRingsAvatar };
```

```js
// src/renderer/avatar/brainAvatar.js
function mountBrainAvatar(mountEl) {
  mountEl.innerHTML = `
    <div class="brain-core">
      <svg viewBox="0 0 100 100">
        <path class="vein" d="M20,50 Q35,20 50,50 T80,50"/>
        <path class="vein" d="M15,40 Q40,60 50,30 T85,45"/>
        <path class="vein" d="M25,65 Q45,40 60,65 T75,35"/>
        <circle cx="50" cy="50" r="8" fill="#5ad1e6" opacity="0.8"/>
      </svg>
    </div>`;
  const core = mountEl.querySelector('.brain-core');
  return {
    setState(state) {
      core.classList.toggle('speaking', state === 'speaking');
    },
  };
}

if (typeof module !== 'undefined') module.exports = { mountBrainAvatar };
```

```js
// src/renderer/avatar/avatarController.js
function createAvatarController({ mountEl, style }) {
  const mountFn = style === 'brain'
    ? require('./brainAvatar').mountBrainAvatar
    : require('./ringsAvatar').mountRingsAvatar;

  const preset = mountFn(mountEl);

  return {
    setState(state) {
      preset.setState(state);
    },
  };
}

if (typeof module !== 'undefined') module.exports = { createAvatarController };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/renderer/avatarController.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Add the CSS for both presets to `src/renderer/styles.css`**

```css
/* Rings preset */
.ring-stage { width: 200px; height: 200px; margin: 0 auto; position: relative; display: flex; align-items: center; justify-content: center; }
.ring { position: absolute; border-radius: 50%; border-style: solid; border-color: #4fd6ff transparent #4fd6ff transparent; box-shadow: 0 0 12px #4fd6ff66; }
.ring.outer { width: 190px; height: 190px; border-width: 1.5px; animation: spin 4s linear infinite; opacity: 0.6; }
.ring.middle { width: 140px; height: 140px; border-width: 2px; border-color: transparent #4fd6ff transparent #4fd6ff; animation: spin-rev 6s linear infinite; opacity: 0.75; }
.ring.inner { width: 90px; height: 90px; border-width: 2.5px; animation: spin 9s linear infinite; opacity: 0.9; }
.ring-stage.speaking .outer { animation-duration: 1.2s; }
.ring-stage.speaking .middle { animation-duration: 1.8s; }
.ring-stage.speaking .inner { animation-duration: 2.5s; }
.core { width: 40px; height: 40px; border-radius: 50%; background: radial-gradient(circle, #aef3ff 0%, #4fd6ff 60%, #0a3a4a 100%); box-shadow: 0 0 25px #4fd6ffcc; animation: breathe 2.5s ease-in-out infinite; }
.ring-stage.speaking .core { animation-duration: 0.5s; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes spin-rev { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
@keyframes breathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.15); } }

/* Brain preset */
.brain-core { width: 140px; height: 140px; border-radius: 50%; margin: 0 auto; background: radial-gradient(circle at 30% 30%, #1a3a4a, #0a0e14 70%); border: 2px solid #5ad1e6; display: flex; align-items: center; justify-content: center; animation: pulse-idle 3s ease-in-out infinite; }
.brain-core svg { width: 70%; height: 70%; }
.brain-core.speaking { animation: speak-bounce 0.6s ease-in-out infinite; }
.vein { stroke: #5ad1e6; stroke-width: 1.5; fill: none; opacity: 0.6; animation: spark 2.5s ease-in-out infinite; }
.vein:nth-child(2) { animation-delay: 0.3s; }
.vein:nth-child(3) { animation-delay: 0.6s; }
.brain-core.speaking .vein { animation: spark 0.4s ease-in-out infinite; }
@keyframes pulse-idle { 0%,100% { box-shadow: 0 0 20px #5ad1e655; } 50% { box-shadow: 0 0 35px #5ad1e688; } }
@keyframes spark { 0%,100% { opacity: 0.3; } 50% { opacity: 1; } }
@keyframes speak-bounce { 0%,100% { transform: scale(1); } 50% { transform: scale(1.1); } }
```

- [ ] **Step 6: Commit**

```bash
git add src/renderer/avatar tests/renderer/avatarController.test.js src/renderer/styles.css
git commit -m "feat: add switchable Rings and Brain avatar presets"
```

---

### Task 7: Renderer wiring (chat, settings modal, avatar mount)

**Files:**
- Create: `src/renderer/renderer.js`

- [ ] **Step 1: Create `src/renderer/renderer.js`**

```js
// src/renderer/renderer.js
let avatarController = null;
let currentSettings = null;

async function init() {
  currentSettings = await window.jarvis.getSettings();
  mountAvatar(currentSettings.avatarStyle);
  updateHud(currentSettings);
  populateSettingsForm(currentSettings);
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
  document.getElementById('api-key-input').value = settings.apiKey;
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
  appendChatLine('You', text);

  avatarController.setState('speaking');
  const { reply } = await window.jarvis.sendMessage(text);
  appendChatLine('Jarvis', reply);
  avatarController.setState('idle');
});

document.getElementById('settings-btn').addEventListener('click', () => {
  document.getElementById('settings-modal').classList.toggle('hidden');
});

document.getElementById('settings-save-btn').addEventListener('click', async () => {
  const settings = {
    provider: document.getElementById('provider-select').value,
    apiKey: document.getElementById('api-key-input').value,
    personality: document.getElementById('personality-input').value,
    avatarStyle: document.getElementById('avatar-select').value,
    activeProject: document.getElementById('project-input').value,
  };
  await window.jarvis.saveSettings(settings);
  currentSettings = settings;
  mountAvatar(settings.avatarStyle);
  updateHud(settings);
  document.getElementById('settings-modal').classList.add('hidden');
});

init();
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/renderer.js
git commit -m "feat: wire renderer chat, settings, and avatar mounting"
```

---

### Task 8: End-to-end manual verification

**Files:** none (manual run)

- [ ] **Step 1: Run the app**

Run: `npm start`
Expected: Electron window opens showing the idle avatar (Rings preset by default) and HUD status line.

- [ ] **Step 2: Configure settings**

In the app: click Settings, enter a real DeepSeek API key, set an active project folder, save.
Expected: modal closes, HUD status updates to show the project path.

- [ ] **Step 3: Test chat**

Type a message in the chat input and press Enter.
Expected: avatar switches to "speaking" animation while waiting, Jarvis's reply appears in the chat log, avatar returns to idle.

- [ ] **Step 4: Test avatar switching**

In Settings, change Avatar Style to "Electrical Brain", save.
Expected: avatar mount immediately re-renders as the brain preset.

- [ ] **Step 5: Test Claude Code delegation (requires `claude` CLI installed and authenticated)**

Add a temporary delegate button/flow if needed for manual testing, or call `window.jarvis.delegateTask('List the files in this project')` from the DevTools console.
Expected: returns `{ status: 'success', summary: '...' }` with a real summary from Claude Code, or a clear error message if the CLI isn't available.

- [ ] **Step 6: Commit a README documenting how to run**

```markdown
# Jarvis

JARVIS-style desktop AI assistant. Phase 1: core chat loop, switchable avatar, Claude Code delegation.

## Setup

1. `npm install`
2. `npm start`
3. Open Settings, add your DeepSeek API key, set an active project folder.

## Testing

`npm test`

## Status

Phase 1 (this build): chat, settings, avatar, Claude Code delegation.
Phase 2 (planned): voice — wake word ("Hey Jarvis" via openWakeWord), STT (whisper.cpp), TTS (ElevenLabs + Web Speech fallback).
Phase 3 (planned): long-term memory via Mem0 + local vector store.
```

```bash
git add README.md
git commit -m "docs: add Phase 1 README"
```

---

## Self-Review Notes

- **Spec coverage:** Architecture (3 layers) → Tasks 1, 5, 7. Avatar system (switchable, both presets) → Task 6. Conversation flow (chat) → Tasks 3, 5, 7. Task delegation → Tasks 4, 5. Settings panel → Tasks 2, 5, 7. Error handling (provider failure, CLI missing, no active project) → Tasks 3, 4, 5. Voice and Mem0 memory are explicitly deferred to Phase 2/3 per the spec's "Out of Scope" section.
- **Placeholder scan:** none found — every step has complete, runnable code.
- **Type consistency:** `delegateTask({ task, projectPath, spawnImpl })` signature matches between Task 4's implementation and Task 5's IPC handler call. `createAvatarController({ mountEl, style })` and `.setState(state)` match between Task 6's implementation and Task 7's renderer usage. `createSettingsStore({ filePath, crypto })` with `.load()`/`.save()` matches between Task 2 and Task 5.
