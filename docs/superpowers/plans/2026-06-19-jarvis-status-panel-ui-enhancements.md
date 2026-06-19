# Jarvis Status Panel UI/UX Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the status panel with a compact 3-column card layout, add staggered entrance animations, and implement a cinematic opening sequence where the avatar greets first, then the panel reveals with animated cards.

**Architecture:** Replace the current 30/70 chat-vs-panel split with a 33/67 avatar-vs-panel layout. Avatar occupies left third, status panel occupies right two-thirds. Status cards reorganize into a 3-column grid (Weather | Unread | Urgent) plus a full-width Email Content box. Panel entrance uses CSS staggered fade-slide animations (100ms between cards). Opening sequence waits for greeting to finish before showing panel. Data model expands to include `Email Content` row in JSON.

**Tech Stack:** HTML/CSS flexbox + CSS Grid, CSS `@keyframes` with `animation-delay`, existing statusPanel.js module, Node.js fs for template, jsdom for tests.

---

### Task 1: Update HTML layout for avatar + panel columns

**Files:**
- Modify: `src/renderer/index.html`

- [ ] **Step 1: Understand current structure**

Read the current layout in `src/renderer/index.html` (the `#app-screen` section). Identify `#app-body`, `#chat-column`, `#avatar-mount`, and `#status-panel`.

- [ ] **Step 2: Restructure to avatar + panel columns**

Replace the current `#app-body` and `#chat-column` structure:

**OLD (current):**
```html
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
```

**NEW:**
```html
<div id="app-body">
  <div id="avatar-column">
    <div id="avatar-mount"></div>
  </div>
  <div id="main-column">
    <div id="chat-column">
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

Note: Avatar is now in its own `#avatar-column` div (left 1/3). Chat and panel are siblings in `#main-column` (right 2/3). This allows avatar to be centered in its column independently.

- [ ] **Step 3: Verify no script breakage**

Run: `npm test`
Expected: All tests still pass (no regression in existing functionality). Some tests may fail if they rely on the old `#chat-column` structure — those will be fixed in later tasks or already pass because statusPanel tests don't depend on the HTML structure directly.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/index.html
git commit -m "refactor: restructure layout into avatar column (left) and main column (right)"
```

---

### Task 2: Update CSS for avatar + panel columns, grid layout, and animations

**Files:**
- Modify: `src/renderer/styles.css`

- [ ] **Step 1: Update #app-body and top-level column styles**

Find the current `/* === Status panel split layout === */` section in `styles.css`. Replace it with:

```css
/* === Avatar + Panel Layout === */
#app-body {
  display: flex;
  align-items: stretch;
  min-height: 0;
}

#avatar-column {
  flex: 0 0 33%;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.2);
}

#main-column {
  flex: 0 0 67%;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

#chat-column {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

#status-panel {
  flex: 0 0 0%;
  min-width: 0;
  overflow: hidden;
  opacity: 0;
  transition: flex-basis 0.35s ease, opacity 0.35s ease;
  padding: 0;
}

#app-body.panel-active #status-panel {
  flex: 0 0 100%;
  opacity: 1;
  overflow-y: auto;
  padding: 28px 32px;
}
```

- [ ] **Step 2: Add status card grid styles**

Add after the avatar/panel column styles:

```css
/* === Status Card Grid === */
#status-panel {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  auto-rows: max-content;
}

.status-card {
  background: var(--glass);
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  padding: 18px 22px;
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

.status-card-email-content {
  grid-column: 1 / -1;
}

.status-panel-html {
  background: var(--glass);
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  padding: 22px;
  backdrop-filter: blur(10px);
}
```

- [ ] **Step 3: Add staggered animation keyframes**

Add before the `@media (prefers-reduced-motion: reduce)` media query:

```css
/* === Staggered Card Animations === */
@keyframes fadeSlideInFromRight {
  from {
    opacity: 0;
    transform: translateX(60px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.status-card {
  animation: fadeSlideInFromRight 0.4s ease-out forwards;
  opacity: 0;
}

.status-card:nth-child(1) {
  animation-delay: 0ms;
}

.status-card:nth-child(2) {
  animation-delay: 100ms;
}

.status-card:nth-child(3) {
  animation-delay: 200ms;
}

.status-card:nth-child(4) {
  animation-delay: 300ms;
}
```

- [ ] **Step 4: Update reduced-motion styles**

Ensure the `@media (prefers-reduced-motion: reduce)` block includes the animation override:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
}
```

(This should already exist; verify it's still in place and appears AFTER the staggered animation styles so it takes precedence.)

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: All tests still pass. Visual layout may look different (wider avatar area, different grid), but tests should not fail.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/styles.css
git commit -m "feat: add avatar column layout, 3-column card grid, and staggered animations"
```

---

### Task 3: Update statusFile.js to include Email Content in template

**Files:**
- Modify: `src/main/status/statusFile.js`

- [ ] **Step 1: Read current statusFile.js**

Understand the current `TEMPLATE_TYPES` and `ensureStatusFile()` function.

- [ ] **Step 2: Expand TEMPLATE_TYPES to include Email Content**

Update the `TEMPLATE_TYPES` array:

```javascript
const TEMPLATE_TYPES = [
  'Weather',
  'Unread Emails',
  'Urgent Emails',
  'News Briefing',
  'Email Content',
];
```

- [ ] **Step 3: No other changes needed**

The `ensureStatusFile()` function already creates all rows in `TEMPLATE_TYPES` with empty `value`/`detail`, so adding the new type automatically includes it in the template.

- [ ] **Step 4: Run tests**

Run: `npm test -- --test-name-pattern="statusFile"`
Expected: All 4 existing statusFile tests pass. (Tests don't assert the exact types, just that rows exist and are trimmed.)

- [ ] **Step 5: Commit**

```bash
git add src/main/status/statusFile.js
git commit -m "feat: add Email Content to status file template"
```

---

### Task 4: Update statusPanel.js renderStatusBoard() for 3-column grid + email content

**Files:**
- Modify: `src/renderer/statusPanel.js`
- Modify: `tests/renderer/statusPanel.test.js`

- [ ] **Step 1: Write failing tests for new grid structure**

Update `tests/renderer/statusPanel.test.js`. Add/replace the `renderStatusBoard` test:

```javascript
test('renderStatusBoard renders 3-column grid for first 3 cards, full-width for email content', () => {
  const { mod } = loadStatusPanel('<div id="app-body"><div id="status-panel"></div></div>');

  const html = mod.renderStatusBoard([
    { type: 'Weather', value: '22C and sunny', detail: 'Clear.' },
    { type: 'Unread Emails', value: '5', detail: '' },
    { type: 'Urgent Emails', value: '1', detail: '' },
    { type: 'Email Content', value: '', detail: 'Recent emails summary.' },
  ]);

  // Grid should have 4 cards total
  assert.match(html, /status-card/g);
  const cardMatches = html.match(/status-card/g) || [];
  assert.strictEqual(cardMatches.length, 4);

  // Email Content should have full-width class
  assert.match(html, /status-card-email-content/);

  // Weather, Unread, Urgent should be in the HTML
  assert.match(html, /Weather/);
  assert.match(html, /Unread Emails/);
  assert.match(html, /Urgent Emails/);
  assert.match(html, /Recent emails summary/);

  delete global.document;
});

test('renderStatusBoard renders email content box even if detail is empty', () => {
  const { mod } = loadStatusPanel('<div id="app-body"><div id="status-panel"></div></div>');

  const html = mod.renderStatusBoard([
    { type: 'Email Content', value: '', detail: '' },
  ]);

  // Should still render the card, just empty
  assert.match(html, /status-card-email-content/);

  delete global.document;
});

test('renderStatusBoard filters out rows with empty value except Email Content', () => {
  const { mod } = loadStatusPanel('<div id="app-body"><div id="status-panel"></div></div>');

  const html = mod.renderStatusBoard([
    { type: 'Weather', value: '22C', detail: 'Clear.' },
    { type: 'Unread Emails', value: '', detail: '' },
    { type: 'Email Content', value: '', detail: 'Some content' },
  ]);

  // Should have Weather (has value) and Email Content (always rendered)
  const cardMatches = html.match(/status-card/g) || [];
  assert.strictEqual(cardMatches.length, 2);

  assert.match(html, /Weather/);
  assert.doesNotMatch(html, /Unread Emails/);
  assert.match(html, /Some content/);

  delete global.document;
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --test-name-pattern="renderStatusBoard"`
Expected: FAIL with errors about not finding `status-card-email-content` or grid structure mismatch.

- [ ] **Step 3: Update renderStatusBoard() implementation**

Replace the `renderStatusBoard()` function in `src/renderer/statusPanel.js`:

```javascript
function renderStatusBoard(rows) {
  const filtered = rows.filter((row) => row.value || row.type === 'Email Content');
  const firstThree = filtered.filter((row) => row.type !== 'Email Content').slice(0, 3);
  const emailContent = filtered.find((row) => row.type === 'Email Content');

  let html = '';

  // Render first 3 non-email-content cards
  firstThree.forEach((row) => {
    html += `
      <div class="status-card">
        <div class="status-card-type">${escapeHtml(row.type)}</div>
        <div class="status-card-value">${escapeHtml(row.value)}</div>
      </div>
    `;
  });

  // Render email content card (full-width)
  if (emailContent) {
    html += `
      <div class="status-card status-card-email-content">
        <div class="status-card-type">Email Content</div>
        <div style="color: var(--text-normal); margin-top: 8px; line-height: 1.5;">
          ${escapeHtml(emailContent.detail || '')}
        </div>
      </div>
    `;
  }

  return html;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --test-name-pattern="renderStatusBoard"`
Expected: PASS (3 new tests pass).

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: All tests pass, no regressions.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/statusPanel.js tests/renderer/statusPanel.test.js
git commit -m "feat: update renderStatusBoard for 3-column grid and full-width email content box"
```

---

### Task 5: Update renderer.js greetUser() to delay showPanel() until after greeting finishes

**Files:**
- Modify: `src/renderer/renderer.js`

- [ ] **Step 1: Read current greetUser() function**

Understand the current logic: load status → build greeting → append chat → speak reply.

- [ ] **Step 2: Delay showPanel() until after speakReply() completes**

Replace the `greetUser()` function:

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
  // Panel shows AFTER greeting finishes speaking
  if (statusRows.some((row) => row.value)) {
    showPanel(renderStatusBoard(statusRows));
  }
}
```

Key change: `showPanel(renderStatusBoard(statusRows))` is now called AFTER `await speakReply(greeting)` completes, not before.

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: All tests still pass. (Renderer tests don't directly test greetUser's timing, but no regressions should occur.)

- [ ] **Step 4: Commit**

```bash
git add src/renderer/renderer.js
git commit -m "feat: delay panel display until after greeting finishes speaking"
```

---

### Task 6: Manual end-to-end verification

**Files:** None (manual testing only).

- [ ] **Step 1: Prepare sample status data**

Create/update `~/.jarvis-status.json`:

```json
[
  { "type": "Weather", "value": "22C and sunny", "detail": "Clear skies all day." },
  { "type": "Unread Emails", "value": "5", "detail": "" },
  { "type": "Urgent Emails", "value": "1", "detail": "" },
  { "type": "News Briefing", "value": "Markets up, no major headlines.", "detail": "" },
  { "type": "Email Content", "value": "", "detail": "You have 3 urgent emails from Q4 budget team." }
]
```

- [ ] **Step 2: Launch the app**

Run: `npm start`

- [ ] **Step 3: Verify opening sequence**

Confirm:
- Avatar appears centered on the left side (1/3 of window)
- Jarvis speaks the greeting
- After greeting finishes, the status panel slides in from the right
- Cards appear with staggered animation (Weather first, then Unread after 100ms, then Urgent after 100ms more, then Email Content after 100ms more)
- Avatar remains visible on the left, panel on the right

- [ ] **Step 4: Verify 3-column layout**

Confirm:
- First row has 3 cards side-by-side: Weather | Unread Emails | Urgent Emails (equal width)
- Second row has full-width Email Content box
- All cards have proper styling (glass effect, glow, etc.)

- [ ] **Step 5: Verify animations respect prefers-reduced-motion**

If on macOS: System Preferences → Accessibility → Display → Reduce motion (on). Relaunch app and confirm cards appear instantly without animation.

If on Windows: Settings → Ease of Access → Display → Show animations (off). Relaunch app and confirm instant display.

If on Linux: Set environment variable `PREFERS_REDUCED_MOTION=reduce` and relaunch.

- [ ] **Step 6: Verify empty/missing data**

Delete `~/.jarvis-status.json` and relaunch. Confirm:
- Template is recreated
- Generic fallback greeting is shown (no panel opens, since all rows have empty value)
- No errors in console

- [ ] **Step 7: Verify email content with various data**

Edit `~/.jarvis-status.json` to test:
- Email Content with long text (should wrap)
- Email Content with empty detail (should render empty box)
- Some status rows with empty value (should not appear in first row)

Confirm layout adapts correctly.

- [ ] **Step 8: Test CLI HTML result display**

Send a `/codex` or `/claude` command with HTML. Confirm:
- Panel displays the HTML content (existing behavior preserved)
- CLI result HTML is shown, not replaced by status cards

---

## Self-Review Notes

- **Spec coverage:** Avatar column layout (Task 1), 3-column grid + Email Content box (Task 2 + Task 4), staggered animations (Task 2), opening sequence delay (Task 5), Email Content data field (Task 3), error handling for empty data (Task 6), reduced-motion support (Task 2) — all covered.
- **Type consistency:** `status-card`, `status-card-email-content`, `fadeSlideInFromRight` used consistently across CSS and HTML. `renderStatusBoard()` signature unchanged (still takes `rows` array, returns HTML string).
- **No placeholders:** all tasks contain complete, runnable code. No "add styling", "handle edge cases", or TBD sections.
- **File modifications:** HTML (layout), CSS (grid + animations), statusFile.js (template), statusPanel.js (render), renderer.js (timing) — all touched files are directly called out in the spec.
