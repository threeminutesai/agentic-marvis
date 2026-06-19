# Jarvis HTML Status Panel — Design

## Purpose

Replace the Excel-backed status board (`~/.jarvis-status.xlsx`) with a JSON-backed one, and add a side panel inside the main Jarvis window that displays styled HTML — either the status board's figures, or HTML produced by a Codex/Claude Code delegate result. Spoken replies stay short; detailed figures live in the panel.

## Triggers

Two independent paths can open the panel. Both converge on the same panel API; neither path knows about the other.

1. **Status board** — on app start (`greetUser()`), and whenever the status data is otherwise reloaded. Reads `~/.jarvis-status.json`, renders it as a styled HTML fragment, opens the panel. The spoken greeting remains the existing one-sentence summary; full figures appear only in the panel.
2. **CLI delegate result** — after a Codex/Claude Code task returns (`sendToCli()`), Jarvis scans `result.summary` for a fenced ` ```html ... ``` ` code block.
   - **Block found:** the block's contents become the panel HTML; the panel opens. The spoken/chat reply is whatever plain text surrounds the fence (text before and after, trimmed and joined). If no surrounding text exists, fall back to `"Here's the report, sir."`.
   - **No block found:** unchanged current behavior — `result.summary` is spoken and shown in chat as-is; the panel is left in whatever state it was already in (not force-hidden).

No other mechanism opens or closes the panel in this design (no manual toggle button, no auto-hide timer). The user can revisit this later if it proves needed.

## Panel Layout

The main window is a single Electron window with two regions, toggled via a CSS state class rather than a separate window:

- **Hidden state (default):** chat/avatar panel occupies the full window, as today.
- **Active state:** chat/avatar panel shrinks to ~30% width, HTML panel occupies the remaining ~70%, both visible side by side. Transition is an animated width change (CSS transition on flex-basis or grid-template-columns), not an abrupt layout jump.

This matches the "Report-dominant (30/70)" mockup option selected during brainstorming.

## Data: `~/.jarvis-status.json`

Replaces `~/.jarvis-status.xlsx`. Same row shape as the old Excel sheet, just JSON instead of a workbook:

```json
[
  { "type": "Weather", "value": "", "detail": "" },
  { "type": "Unread Emails", "value": "", "detail": "" },
  { "type": "Urgent Emails", "value": "", "detail": "" },
  { "type": "News Briefing", "value": "", "detail": "" }
]
```

- `type` — the matter being reported (fixed set of 4 rows, same as before).
- `value` — short string spoken/shown as the headline figure.
- `detail` — longer string, spoken only if the user explicitly asks for more detail (existing `matchStatusDetailRequest()` behavior, unchanged).

Jarvis is read-only on this file: it never writes `value`/`detail`, only creates the template (with empty `value`/`detail`) if the file doesn't exist. An external process is expected to fill in `value`/`detail` over time, exactly as with the Excel version.

## Components

### `src/main/status/statusFile.js` (replaces `src/main/status/statusSheet.js`)

- `ensureStatusFile(filePath)` — if `filePath` doesn't exist, write the 4-row JSON template (pretty-printed) via `fs.writeFileSync`. If it exists, do nothing.
- `readStatusRows(filePath)` — call `ensureStatusFile(filePath)` first, then `JSON.parse(fs.readFileSync(filePath, 'utf8'))`. Trim string fields; skip rows with no `type`. Same trimming/filtering semantics as the current Excel-based `readStatusRows`.
- The `xlsx` npm dependency is removed from `package.json` (no longer needed anywhere in the codebase).

### `src/renderer/statusPanel.js` (new)

- `showPanel(html)` — injects `html` into the panel container, adds the active-state CSS class to the app root (triggers the 30/70 layout).
- `hidePanel()` — removes the active-state class, returns to full-width chat. (Exposed for completeness/tests; this design's only trigger paths never call it — see Triggers section.)
- `renderStatusBoard(rows)` — maps `[{type, value, detail}]` rows into an HTML fragment styled per the frontend-slides aesthetic (distinctive type, committed color palette, no default Inter/Arial/purple-gradient look). One card/row per status type, headline `value` shown large, `detail` not shown (spoken-only, per existing UX).
- `extractHtmlBlock(text)` — regex-extracts the first ` ```html\n...\n``` ` fenced block from `text`. Returns `{ html: string, before: string, after: string } | null` where `before`/`after` are the trimmed plain text surrounding the fence. Used by the CLI delegate path to split spoken text from panel content.

### `index.html` / CSS

- Add `<div id="status-panel"></div>` alongside the existing chat/avatar markup.
- Add a CSS class (e.g. `.panel-active`) on the app root that switches the layout from full-width chat to the 30/70 split, with a transition on the width/flex properties.
- Panel-internal styling (cards, typography, palette) lives in its own stylesheet section, scoped under `#status-panel`, following frontend-slides principles — not the rest of the app's existing chat UI styling.

### `src/renderer/renderer.js` changes

- `greetUser()`: after loading `statusRows` and building the spoken greeting (unchanged), call `statusPanel.showPanel(statusPanel.renderStatusBoard(statusRows))`.
- `sendToCli()`: after receiving `result`, call `statusPanel.extractHtmlBlock(result.summary)`. If it returns non-null, speak/show `before + after` (or the fallback line) and call `statusPanel.showPanel(extracted.html)`. If it returns `null`, behavior is unchanged from today (speak/show `result.summary` directly, no panel call).
- `ipcHandlers.js`'s `status:get` handler swaps its `require('./status/statusSheet')` import for `./status/statusFile`; the IPC contract (`{ ok, rows, error }`) is unchanged, so `preload.js` and the renderer's `window.jarvis.getStatus()` call need no changes.

## Error Handling

- Missing/corrupt `~/.jarvis-status.json`: `ensureStatusFile` recreates the template on next read. If `JSON.parse` throws on a corrupt-but-present file, `readStatusRows` lets the error propagate to the existing `try/catch` in `ipcHandlers.js`'s `status:get` handler, which already returns `{ ok: false, rows: [], error }` — `greetUser()` already handles `result.ok === false` by falling back to an empty `statusRows` array, which `buildGreeting([])` already turns into a generic greeting. No panel is shown in that case (empty rows render nothing meaningful).
- Malformed/unclosed code fence in a CLI result: `extractHtmlBlock` returns `null` (no match), so the existing text-only path runs unchanged. No partial/broken HTML is ever shown.

## Testing

- `tests/main/statusFile.test.js` (replaces `tests/main/statusSheet.test.js`): same 3 cases as today (template creation with empty value/detail, non-overwrite of existing data, trimming/filtering of malformed rows), adapted from `xlsx` calls to `JSON.parse`/`fs.writeFileSync`.
- `tests/renderer/statusPanel.test.js` (new): unit tests for `extractHtmlBlock` covering: no code block (returns `null`), one block with no surrounding text, one block with text before and after, an unclosed fence (returns `null`).
- Manual verification: run the app, confirm the panel opens with the 30/70 split on greeting, confirm a CLI delegate task that returns an ` ```html ` block opens the panel with that content while chat shows only the short spoken line, confirm a CLI task with plain-text-only output leaves chat-only behavior unchanged.

## Out of Scope

- No manual open/close control for the panel (e.g., a toggle button) — only the two triggers above.
- No persistence of panel content across app restarts.
- No support for multiple simultaneous panel "pages" or history/back navigation within the panel.
- The external process that fills in `~/.jarvis-status.json`'s `value`/`detail` fields is not part of this design — same boundary as the existing Excel-based status board.
