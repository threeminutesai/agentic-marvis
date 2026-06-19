# Jarvis HTML Status Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Excel-backed status board with a JSON-backed one, and add a side panel inside the main Jarvis window that shows either the status board's figures or HTML pulled from a Codex/Claude Code delegate result.

**Architecture:** A renderer-side `statusPanel.js` module owns a `showPanel(html)`/`hidePanel()` API plus two pure helpers (`renderStatusBoard(rows)`, `extractHtmlBlock(text)`). Two independent call sites in `renderer.js` (`greetUser()` and `sendToCli()`) feed it. A main-process `statusFile.js` module (replacing `statusSheet.js`) reads/writes `~/.jarvis-status.json` instead of an Excel workbook. The IPC contract (`status:get`) is unchanged.

**Tech Stack:** Node.js `node:fs`/`JSON`, Electron IPC (existing), jsdom for renderer unit tests (existing `node --test` setup).

---

### Task 1: JSON-backed status file module

**Files:**
- Create: `src/main/status/statusFile.js`
- Create: `tests/main/statusFile.test.js`
- Delete: `src/main/status/statusSheet.js`
- Delete: `tests/main/statusSheet.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/main/statusFile.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ensureStatusFile, readStatusRows } = require('../../src/main/status/statusFile');

function tempFilePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-status-'));
  return path.join(dir, 'status.json');
}

test('ensureStatusFile creates a template JSON file with empty value/detail fields', () => {
  const filePath = tempFilePath();
  ensureStatusFile(filePath);
  assert.strictEqual(fs.existsSync(filePath), true);

  const rows = readStatusRows(filePath);
  assert.deepStrictEqual(rows.map((r) => r.type), ['Weather', 'Unread Emails', 'Urgent Emails', 'News Briefing']);
  for (const row of rows) {
    assert.strictEqual(row.value, '');
    assert.strictEqual(row.detail, '');
  }
});

test('ensureStatusFile does not overwrite an existing file', () => {
  const filePath = tempFilePath();
  ensureStatusFile(filePath);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  data[0].value = '22C and sunny';
  data[0].detail = 'Clear skies all day with a light breeze.';
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

  ensureStatusFile(filePath);
  const rows = readStatusRows(filePath);
  assert.strictEqual(rows[0].value, '22C and sunny');
  assert.strictEqual(rows[0].detail, 'Clear skies all day with a light breeze.');
});

test('readStatusRows trims whitespace and skips rows with no type', () => {
  const filePath = tempFilePath();
  fs.writeFileSync(filePath, JSON.stringify([
    { type: ' Weather ', value: ' 22C ', detail: ' Clear. ' },
    { type: '', value: 'orphan value', detail: '' },
  ]));

  const rows = readStatusRows(filePath);
  assert.deepStrictEqual(rows, [{ type: 'Weather', value: '22C', detail: 'Clear.' }]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --test-name-pattern="statusFile"`
Expected: FAIL with "Cannot find module '../../src/main/status/statusFile'"

- [ ] **Step 3: Write the implementation**

Create `src/main/status/statusFile.js`:

```javascript
// src/main/status/statusFile.js
const fs = require('node:fs');

const TEMPLATE_TYPES = [
  'Weather',
  'Unread Emails',
  'Urgent Emails',
  'News Briefing',
];

function ensureStatusFile(filePath) {
  if (fs.existsSync(filePath)) return;
  const rows = TEMPLATE_TYPES.map((type) => ({ type, value: '', detail: '' }));
  fs.writeFileSync(filePath, JSON.stringify(rows, null, 2));
}

function readStatusRows(filePath) {
  ensureStatusFile(filePath);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => ({
      type: String(row?.type ?? '').trim(),
      value: String(row?.value ?? '').trim(),
      detail: String(row?.detail ?? '').trim(),
    }))
    .filter((row) => row.type);
}

module.exports = { ensureStatusFile, readStatusRows };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --test-name-pattern="statusFile"`
Expected: PASS (3/3)

- [ ] **Step 5: Delete the old Excel-backed module and its test**

```bash
rm src/main/status/statusSheet.js
rm tests/main/statusSheet.test.js
```

- [ ] **Step 6: Update the IPC handler to use the new module**

In `src/main/ipcHandlers.js`, change:

```javascript
const { readStatusRows } = require('./status/statusSheet');
```

to:

```javascript
const { readStatusRows } = require('./status/statusFile');
```

Also change the file path the handler reads, in the `status:get` handler:

```javascript
  ipcMain.handle('status:get', () => {
    const filePath = path.join(os.homedir(), '.jarvis-status.xlsx');
```

to:

```javascript
  ipcMain.handle('status:get', () => {
    const filePath = path.join(os.homedir(), '.jarvis-status.json');
```

- [ ] **Step 7: Remove the xlsx dependency**

Edit `package.json`, remove the `"dependencies"` block's `xlsx` entry so it reads:

```json
  "dependencies": {}
```

Then run:

```bash
npm install
```

- [ ] **Step 8: Run the full test suite**

Run: `npm test`
Expected: All tests pass, no references to `xlsx` or `statusSheet` remain.

- [ ] **Step 9: Commit**

```bash
git add src/main/status/statusFile.js tests/main/statusFile.test.js src/main/ipcHandlers.js package.json package-lock.json
git rm src/main/status/statusSheet.js tests/main/statusSheet.test.js
git commit -m "feat: replace Excel-backed status sheet with JSON-backed status file"
```

---

### Task 2: Status panel layout (HTML + CSS)

**Files:**
- Modify: `src/renderer/index.html`
- Modify: `src/renderer/styles.css`

- [ ] **Step 1: Restructure index.html to wrap the chat column and add the panel container**

In `src/renderer/index.html`, replace:

```html
  <div id="app-screen" class="hidden">
    <header id="app-header">
      <span id="brand-mark">JARVIS</span>
      <div id="header-right">
        <span id="hud-status">PROJECT: none // STATUS: idle</span>
        <button id="select-project-btn" type="button">Select Project</button>
      </div>
    </header>
    <div id="avatar-mount"></div>
    <div id="chat-log"></div>
    <div id="chat-bar">
      <input id="chat-input" placeholder="Talk to Jarvis...">
      <button id="send-btn" type="button" title="Send message">⏵</button>
      <button id="mute-toggle-btn">Mute</button>
      <button id="settings-btn">Settings</button>
    </div>
  </div>
```

with:

```html
  <div id="app-screen" class="hidden">
    <header id="app-header">
      <span id="brand-mark">JARVIS</span>
      <div id="header-right">
        <span id="hud-status">PROJECT: none // STATUS: idle</span>
        <button id="select-project-btn" type="button">Select Project</button>
      </div>
    </header>
    <div id="app-body">
      <div id="chat-column">
        <div id="avatar-mount"></div>
        <div id="chat-log"></div>
        <div id="chat-bar">
          <input id="chat-input" placeholder="Talk to Jarvis...">
          <button id="send-btn" type="button" title="Send message">⏵</button>
          <button id="mute-toggle-btn">Mute</button>
          <button id="settings-btn">Settings</button>
        </div>
      </div>
      <div id="status-panel"></div>
    </div>
  </div>
```

- [ ] **Step 2: Add the `statusPanel.js` script tag**

In `src/renderer/index.html`, change:

```html
  <script src="voice/ttsController.js"></script>
  <script src="renderer.js"></script>
```

to:

```html
  <script src="voice/ttsController.js"></script>
  <script src="statusPanel.js"></script>
  <script src="renderer.js"></script>
```

- [ ] **Step 3: Add the split-layout and panel styling**

In `src/renderer/styles.css`, append at the end of the file:

```css
/* === Status panel split layout === */
#app-body {
  display: flex;
  align-items: stretch;
  min-height: 0;
}
#chat-column {
  flex: 1 1 100%;
  min-width: 0;
  transition: flex-basis 0.35s ease;
  display: flex;
  flex-direction: column;
}
#status-panel {
  flex: 0 0 0%;
  min-width: 0;
  overflow: hidden;
  opacity: 0;
  transition: flex-basis 0.35s ease, opacity 0.35s ease;
}
#app-body.panel-active #chat-column {
  flex: 0 0 30%;
}
#app-body.panel-active #status-panel {
  flex: 0 0 70%;
  opacity: 1;
  overflow-y: auto;
  padding: 28px 32px;
}

/* === Status panel content === */
.status-card {
  background: var(--glass);
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  padding: 18px 22px;
  margin-bottom: 16px;
  backdrop-filter: blur(10px);
}
.status-card-type {
  font-family: 'Orbitron', sans-serif;
  font-size: 11px;
  letter-spacing: 2px;
  color: var(--text-dim);
  text-transform: uppercase;
}
.status-card-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--ion-bright);
  text-shadow: 0 0 14px var(--ion-soft);
  margin-top: 6px;
}
.status-panel-html {
  background: var(--glass);
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  padding: 22px;
  backdrop-filter: blur(10px);
}
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/index.html src/renderer/styles.css
git commit -m "feat: add 30/70 split layout and status panel styling"
```

---

### Task 3: `statusPanel.js` renderer module

**Files:**
- Create: `src/renderer/statusPanel.js`
- Test: `tests/renderer/statusPanel.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/renderer/statusPanel.test.js`:

```javascript
// tests/renderer/statusPanel.test.js
const test = require('node:test');
const assert = require('node:assert');
const { JSDOM } = require('jsdom');

function loadStatusPanel(html) {
  const dom = new JSDOM(html);
  global.document = dom.window.document;
  delete require.cache[require.resolve('../../src/renderer/statusPanel')];
  const mod = require('../../src/renderer/statusPanel');
  return { dom, mod };
}

test('showPanel injects HTML and activates the panel-active class', () => {
  const { dom, mod } = loadStatusPanel('<div id="app-body"><div id="status-panel"></div></div>');

  mod.showPanel('<p>hello</p>');

  const appBody = dom.window.document.getElementById('app-body');
  const panel = dom.window.document.getElementById('status-panel');
  assert.ok(appBody.classList.contains('panel-active'));
  assert.strictEqual(panel.innerHTML, '<p>hello</p>');

  delete global.document;
});

test('hidePanel removes the panel-active class', () => {
  const { dom, mod } = loadStatusPanel('<div id="app-body" class="panel-active"><div id="status-panel"><p>x</p></div></div>');

  mod.hidePanel();

  const appBody = dom.window.document.getElementById('app-body');
  assert.ok(!appBody.classList.contains('panel-active'));

  delete global.document;
});

test('renderStatusBoard renders a card per row with type and value, omitting empty values', () => {
  const { mod } = loadStatusPanel('<div id="app-body"><div id="status-panel"></div></div>');

  const html = mod.renderStatusBoard([
    { type: 'Weather', value: '22C and sunny', detail: 'Clear skies.' },
    { type: 'Unread Emails', value: '', detail: '' },
  ]);

  assert.match(html, /Weather/);
  assert.match(html, /22C and sunny/);
  assert.doesNotMatch(html, /Clear skies\./);

  delete global.document;
});

test('extractHtmlBlock returns null when there is no fenced html block', () => {
  const { mod } = loadStatusPanel('<div id="app-body"><div id="status-panel"></div></div>');

  assert.strictEqual(mod.extractHtmlBlock('just plain text, no code fence here'), null);

  delete global.document;
});

test('extractHtmlBlock extracts the block and surrounding text', () => {
  const { mod } = loadStatusPanel('<div id="app-body"><div id="status-panel"></div></div>');

  const text = 'Here is the report, sir.\n```html\n<table><tr><td>1</td></tr></table>\n```\nLet me know if you need more.';
  const result = mod.extractHtmlBlock(text);

  assert.strictEqual(result.html, '<table><tr><td>1</td></tr></table>');
  assert.strictEqual(result.before, 'Here is the report, sir.');
  assert.strictEqual(result.after, 'Let me know if you need more.');

  delete global.document;
});

test('extractHtmlBlock returns null for an unclosed fence', () => {
  const { mod } = loadStatusPanel('<div id="app-body"><div id="status-panel"></div></div>');

  const text = 'Here:\n```html\n<table></table>\nno closing fence';
  assert.strictEqual(mod.extractHtmlBlock(text), null);

  delete global.document;
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --test-name-pattern="statusPanel"`
Expected: FAIL with "Cannot find module '../../src/renderer/statusPanel'"

- [ ] **Step 3: Write the implementation**

Create `src/renderer/statusPanel.js`:

```javascript
// src/renderer/statusPanel.js
function showPanel(html) {
  const appBody = document.getElementById('app-body');
  const panel = document.getElementById('status-panel');
  panel.innerHTML = html;
  appBody.classList.add('panel-active');
}

function hidePanel() {
  const appBody = document.getElementById('app-body');
  appBody.classList.remove('panel-active');
}

function renderStatusBoard(rows) {
  return rows
    .filter((row) => row.value)
    .map((row) => `
      <div class="status-card">
        <div class="status-card-type">${escapeHtml(row.type)}</div>
        <div class="status-card-value">${escapeHtml(row.value)}</div>
      </div>
    `)
    .join('');
}

function extractHtmlBlock(text) {
  const match = /```html\r?\n([\s\S]*?)\r?\n```/.exec(text);
  if (!match) return null;
  const before = text.slice(0, match.index).trim();
  const after = text.slice(match.index + match[0].length).trim();
  return { html: match[1].trim(), before, after };
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

if (typeof module !== 'undefined') {
  module.exports = { showPanel, hidePanel, renderStatusBoard, extractHtmlBlock };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --test-name-pattern="statusPanel"`
Expected: PASS (6/6)

- [ ] **Step 5: Commit**

```bash
git add src/renderer/statusPanel.js tests/renderer/statusPanel.test.js
git commit -m "feat: add statusPanel renderer module for panel show/hide, status cards, and HTML-block extraction"
```

---

### Task 4: Wire the panel into `renderer.js`

**Files:**
- Modify: `src/renderer/renderer.js:98-109` (greetUser)
- Modify: `src/renderer/renderer.js:130-157` (sendToCli)

- [ ] **Step 1: Update `greetUser()` to show the status panel**

In `src/renderer/renderer.js`, change:

```javascript
async function greetUser() {
  try {
    const result = await window.jarvis.getStatus();
    statusRows = result.ok ? result.rows : [];
  } catch (err) {
    console.log(`[Status] Failed to load status sheet: ${err.message}`);
    statusRows = [];
  }
  const greeting = buildGreeting(statusRows);
  appendChatLine('Jarvis', greeting);
  await speakReply(greeting);
}
```

to:

```javascript
async function greetUser() {
  try {
    const result = await window.jarvis.getStatus();
    statusRows = result.ok ? result.rows : [];
  } catch (err) {
    console.log(`[Status] Failed to load status sheet: ${err.message}`);
    statusRows = [];
  }
  if (statusRows.some((row) => row.value)) {
    showPanel(renderStatusBoard(statusRows));
  }
  const greeting = buildGreeting(statusRows);
  appendChatLine('Jarvis', greeting);
  await speakReply(greeting);
}
```

- [ ] **Step 2: Update `sendToCli()` to detect and display an HTML block**

In `src/renderer/renderer.js`, change:

```javascript
  setAvatarState('processing');
  try {
    console.log(`[CLI] Delegating to ${channel.label}: "${task}"`);
    console.log(`[CLI] Calling channel.delegate (this is an IPC call)...`);
    const result = await channel.delegate(task);
    console.log(`[CLI] Received result from IPC:`, result);
    console.log(`[CLI] Result status: ${result?.status}, summary length: ${result?.summary?.length}`);
    if (shouldAbortResponse) return;
    const reply = result.summary || `${channel.label} finished, sir.`;
    console.log(`[CLI] Displaying reply: "${reply}"`);
    appendChatLine('Jarvis', reply);
    await speakReply(reply);
  } catch (err) {
```

to:

```javascript
  setAvatarState('processing');
  try {
    console.log(`[CLI] Delegating to ${channel.label}: "${task}"`);
    console.log(`[CLI] Calling channel.delegate (this is an IPC call)...`);
    const result = await channel.delegate(task);
    console.log(`[CLI] Received result from IPC:`, result);
    console.log(`[CLI] Result status: ${result?.status}, summary length: ${result?.summary?.length}`);
    if (shouldAbortResponse) return;
    const summary = result.summary || `${channel.label} finished, sir.`;
    const extracted = extractHtmlBlock(summary);
    let reply;
    if (extracted) {
      reply = [extracted.before, extracted.after].filter(Boolean).join(' ') || "Here's the report, sir.";
      showPanel(extracted.html);
    } else {
      reply = summary;
    }
    console.log(`[CLI] Displaying reply: "${reply}"`);
    appendChatLine('Jarvis', reply);
    await speakReply(reply);
  } catch (err) {
```

- [ ] **Step 3: Manually verify the wiring compiles**

Run: `npm test`
Expected: All existing tests still pass (this step doesn't add new automated renderer.js tests — `renderer.js` has no existing test file and isn't being given one in this plan; behavior is covered by the manual verification in Task 5).

- [ ] **Step 4: Commit**

```bash
git add src/renderer/renderer.js
git commit -m "feat: wire status panel into greeting and CLI delegate result handling"
```

---

### Task 5: Manual end-to-end verification

**Files:** None (manual testing only).

- [ ] **Step 1: Launch the app**

Run: `npm start`

- [ ] **Step 2: Verify the status board panel on greeting**

Before launching, put sample data in `~/.jarvis-status.json`:

```json
[
  { "type": "Weather", "value": "22C and sunny", "detail": "Clear skies all day." },
  { "type": "Unread Emails", "value": "5", "detail": "" },
  { "type": "Urgent Emails", "value": "1", "detail": "" },
  { "type": "News Briefing", "value": "Markets up, no major headlines.", "detail": "" }
]
```

Launch the app. Confirm:
- The chat column shrinks to roughly 30% width and a status panel appears on the right with 4 cards (Weather, Unread Emails, Urgent Emails, News Briefing), each showing its `value`.
- Jarvis speaks/shows only the short one-sentence greeting in chat, not the full card contents.

- [ ] **Step 3: Verify CLI delegate HTML-block detection**

In the chat input, send a `/codex` or `/claude` command whose task asks the CLI to wrap its answer in a fenced ` ```html ` block, e.g.:

```
/codex respond with a one-sentence summary, then a ```html code block containing a small table, then a closing sentence
```

Confirm:
- The panel updates to show the table from the HTML block.
- The chat/spoken reply shows only the sentences outside the code fence, not the raw HTML.

- [ ] **Step 4: Verify the no-HTML fallback path is unchanged**

Send a `/codex` or `/claude` command with a plain-text-only task (no HTML requested). Confirm:
- The reply is shown/spoken in full as before.
- The panel is left showing whatever it last displayed (not cleared, not erroring).

- [ ] **Step 5: Verify missing/corrupt status file handling**

Rename or delete `~/.jarvis-status.json`, relaunch the app. Confirm:
- A new template file is created at `~/.jarvis-status.json` with empty `value`/`detail` fields (use `Get-Content` or similar to confirm).
- Since all rows have empty `value`, the panel does not open and the generic fallback greeting is spoken (no panel, no error).

---

## Self-Review Notes

- **Spec coverage:** Status board trigger (Task 4 Step 1), CLI HTML-block trigger (Task 4 Step 2), 30/70 split layout (Task 2), JSON file replacing Excel (Task 1), `xlsx` dependency removal (Task 1 Step 7), error handling for missing/corrupt JSON and unclosed fences (Task 3 tests + Task 5 Step 5) — all covered.
- **Type consistency:** `{ type, value, detail }` row shape used consistently across `statusFile.js`, `statusPanel.js`'s `renderStatusBoard`, and `renderer.js`. `extractHtmlBlock` return shape `{ html, before, after }` used consistently in its tests and in `sendToCli()`.
- **No placeholders:** all steps contain complete, runnable code.
