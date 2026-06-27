# Marvis Validation Report

- Date/time: 2026-06-27 (updated after HTML follow-up routing session)
- Validation scope: current-state validator pass for chat routing, local memory, Codex backend CLI panel behavior, HTML title injection, capture file naming, HTML follow-up quiet routing, all-channel session tracking, settings update flow, and existing automated checks on the clean `main` branch

| Area | Status | Notes |
| --- | --- | --- |
| Git working tree | Pass | `git status --short` returned no local changes at start of session. |
| App specification review | Pass | `docs/MARVIS_APP_SPEC.md` updated to reflect session-keep-alive after HTML delivery, memory exclusion during active session, HTML title-at-generation, and timestamp capture naming. |
| Validator skill structure | Pass | `quick_validate.py .\.agents\skills\marvis-release-validator` returned `Skill is valid!`. |
| JavaScript syntax checks | Pass | Targeted `node --check` calls succeeded for current validator-relevant runtime files. |
| Automated tests | Pass | `npm test` passed with 9/9 tests green. |
| Backend Codex CLI panel contract | Pass | Source includes a dedicated `cli:output` path so the Codex right panel can show backend CLI stream lines rather than duplicated summarized progress. |
| Gemini routing and managed CLI session | Pass | Router uses `router:decide` returning `marvis`, `codex`, or `claudeCode`; session carry-forward/close rules updated for all CLI channels. |
| Memory excluded during active CLI session | Pass | `router:decide` now skips memory search when `session` is active; older vector results no longer corrupt routing for in-progress tasks. |
| All-channel CLI session tracking | Pass | `updateCliTaskSession` now tracks sessions for `/claude`, `/code`, and `/codex` — the previous `/codex`-only guard removed. |
| `claudeCode` route in router | Pass | `normalizeRouterDecision` accepts `claudeCode` as valid route with same session normalization as `codex`; fallback decision picks route from `session.channelKey`. |
| HTML follow-up quiet routing | Pass | When router returns `claudeCode + continue` with `currentHtmlPath` set, renderer calls `buildHtmlFollowUpTask` and delegates via `sendToCli` with `quietMode: true` — panel stays visible, CLI activity panel suppressed, reply appears in chat. |
| HTML panel closed on unrelated follow-up | Pass | When router returns `start` or `close`, `currentHtmlPath` is nulled before new task begins. |
| HTML panel title injected at generation time | Pass | `prepareHtmlPanel` now receives the task description so `index.json` has a proper title from the start. `html-panel:finalize` IPC is called after Codex succeeds to inject `<title>` into the HTML file itself (promoting `<h1>` or falling back to task-derived title). |
| Capture file timestamp naming | Pass | `captureFile.js` now uses `YYYYMMDD-HHMMSS-mmm.png` timestamps and prunes oldest-first by `birthtimeMs`; five-digit sequential counter removed. |
| Local summary memory | Pass | Source still persists and retrieves concise local summaries from `data/conversation-memory.json` without an external vector database. |
| Manual UI behavior | Not manually verified | No live Electron walkthrough was performed during this validation pass. |

## Checklist

| Requirement | Status | Notes |
| --- | --- | --- |
| Normal chat remains in chat column and does not open HTML panel | Not manually verified | No interactive UI run in this pass. Source contract remains unchanged. |
| Chat history remains scrollable | Not manually verified | No visual overflow test in this pass. |
| Full chat reply TTS behavior | Not manually verified | No live audio verification in this pass. |
| `/code`, `/claude`, and `/codex` delegate correctly | Pass | Current source keeps explicit CLI channel mapping in [renderer.js](</C:/L_Center/AI_devp/jarvis/src/renderer/renderer.js>). |
| Plain messages route through Gemini decision logic | Pass | Current source still calls `router:decide` before choosing Codex for plain messages. |
| Codex continuation uses managed task context | Pass | Current source still carries recent Codex task context when Gemini returns `continue`. |
| Managed CLI session stays alive after HTML delivery | Pass | `updateCliTaskSession` no longer calls `closeActiveCliTaskSession()` on `hadHtml`; session closes only on router `close`/`start` decision or explicit topic switch. |
| Memory skipped when active CLI session exists | Pass | `memoryResults` is `[]` when `session` is truthy in `router:decide` handler. |
| Claude Code session tracked after `/claude` report | Pass | `updateCliTaskSession` now saves `/claude` channel sessions; follow-up questions can see the objective and recent turns. |
| Follow-up question on displayed HTML answered from content | Pass | `buildHtmlFollowUpTask` constructs a task with `[html] <path>`, instructs Claude to answer without generating new HTML; panel stays visible. |
| CLI activity panel suppressed during HTML follow-up | Pass | `sendToCli` with `quietMode: true` skips `showCliActivityPanel`, `prepareHtmlPanel`, and `showCliStandbyPanel`; progress lines stay off screen. |
| HTML panel index has proper title from task description | Pass | `prepareHtmlPanel({ task })` now passes the task so `deriveHtmlPanelTitle` produces a meaningful title rather than generic "Marvis Report". |
| `<title>` injected into HTML file at generation time | Pass | `html-panel:finalize` IPC added; renderer calls `finalizeHtmlPanel(filePath, title)` after Codex success, before `formatAssistantResponse`. `ensureHtmlPanelTitle` promotes `<h1>` or injects task-derived fallback. |
| `open <keyword>` can trace HTML reports by content title | Pass | `searchHtmlPanels` uses `index.json` (now task-titled from creation) plus actual HTML `<title>`/`<h1>` content for scoring. |
| HTML panels pruned oldest-first by creation date | Pass | `pruneHtmlPanels` already sorted by `createdMs` ascending and removes from the front. No change needed; spec updated to document. |
| Capture files use timestamp names, pruned by creation date | Pass | `captureFile.js` rewritten — `getNextCapturePath` uses ISO-style timestamp stamp; `pruneCaptures` sorts by `birthtimeMs` and removes oldest. |
| Local memory stays summary-first and fully local | Pass | Current source still uses [memoryStore.js](</C:/L_Center/AI_devp/jarvis/src/main/memory/memoryStore.js>) with concise summaries and local vector search. |
| Codex right panel shows backend CLI stream, not duplicate summary text | Pass | Current source uses `cli:output` for Codex panel output and reserves `cli:progress` for summarized chat/avatar state. |
| Report generation returns `[html] <path>` rather than inline panel content | Pass | Source still builds the report contract in [renderer.js](</C:/L_Center/AI_devp/jarvis/src/renderer/renderer.js>). |
| HTML panel opens only from explicit file/open commands | Pass | Source still limits panel opening to explicit `[html]`, `/html`, `open`, `show`, and `/open` flows. |
| Briefing does not reopen itself during ordinary chat | Pass | Spec and source still preserve entry-only briefing behavior; no periodic reopen rule is present. |
| Settings update button flow | Pass | Source still includes the footer update button and GitHub release-page open flow instead of self-replacing the running app. |
| Music pause/skip/preview contract | Pass by source review | Current source still contains separate pause/resume/skip behavior and preview pause/resume logic. |

## Session Changes (2026-06-27)

### 1. Codex session mismatch fix (`renderer.js`)
`updateCliTaskSession` previously called `closeActiveCliTaskSession()` immediately when `hadHtml` was true. This contradicted both the stateless-exec backend (each Codex turn is a fresh `codex exec` call, not a persistent process) and the router prompt which already instructed "HTML/report delivery does not automatically close the Codex session." The early-close block was removed. The session now stays alive after HTML delivery for follow-up edits and additions.

### 2. Memory priority fix (`ipcHandlers.js`)
The `router:decide` handler previously searched memory using both the current text and the session objective, feeding up to 3 results to Gemini even when an active session was present. Older memory entries were overriding current-task intent ("memory answer is wrong for just now"). Memory search is now skipped entirely when `session` is active. The session context (objective + recent turns) is the authoritative current-task state; background memory is only consulted on fresh sessions.

### 3. HTML title injected at generation time (`ipcHandlers.js`, `preload.js`, `renderer.js`)
- `prepareHtmlPanel()` was being called without arguments, so every report got "Marvis Report" as its `index.json` title. Fixed to pass `{ task }`.
- New `html-panel:finalize` IPC handler calls `finalizeHtmlPanelMetadata(filePath, fallbackTitle)` — reads generated HTML for `<title>` or `<h1>`, injects a `<title>` tag if missing, and updates `index.json` with the actual content title.
- `finalizeHtmlPanel` bridge added to `preload.js`.
- Renderer calls `finalizeHtmlPanel` after Codex succeeds, before `formatAssistantResponse`. `readHtmlPanel` inside `formatAssistantResponse` remains as a second idempotent pass.

### 4. Capture file timestamp naming (`captureFile.js`)
Five-digit sequential ID scheme (`00001.png`) replaced with ISO-style timestamp filenames (`YYYYMMDD-HHMMSS-mmm.png`). `pruneCaptures` now sorts all `.png` files by `birthtimeMs → ctimeMs → mtimeMs` and deletes the oldest when count exceeds `maxCount`. `listCaptureIds` removed.

## Session Changes (2026-06-27 — HTML follow-up routing)

### 5. All-channel CLI session tracking (`renderer.js`)
`updateCliTaskSession` previously had a hard guard `if (channelKey !== '/codex') return` that silently discarded every `/claude` and `/code` session. After `/claude 找乐子新闻` generates an HTML report, no session was recorded, so follow-up questions had no task context and were routed to Marvis chat which cannot see the file. Guard removed — all CLI channels now record and carry session state.

### 6. `claudeCode` route in Gemini router (`ipcHandlers.js`)
The router previously returned only `marvis` or `codex`. A new `claudeCode` route was added. `normalizeRouterDecision` accepts it with the same session normalization rules as `codex`. The router system prompt was updated to explain:
- Use `claudeCode` when `currentHtmlPath` is set and the question relates to the displayed content (quiet follow-up), or for new Claude Code tasks.
- Use `codex` for explicit Codex work.
- Use `marvis` for ordinary chat.
The fallback decision (when router JSON cannot be parsed) now picks the route from `session.channelKey` — `/codex` → `codex`, anything else → `claudeCode`.

### 7. `quietMode` in `sendToCli` + `buildHtmlFollowUpTask` (`renderer.js`)
New `quietMode` flag on `sendToCli`. When true:
- Skips `prepareHtmlPanel` (no new HTML expected).
- Skips `currentHtmlPath = null` (existing panel stays visible).
- Skips `showCliActivityPanel` and `showCliStandbyPanel`.
- Uses the pre-built `task` string directly instead of `buildCliTaskWithHtmlContract`.
- Progress events update the avatar headline only, not the CLI activity panel.
- If Claude unexpectedly returns new HTML, it is still shown normally.

`buildHtmlFollowUpTask(userText, htmlPath, sessionState)` constructs the task: includes `[html] <path>`, recent session turns, the user's question, and an explicit instruction to answer from the file without generating a new report.

### 8. Routing dispatch panel management (`renderer.js`)
- Explicit CLI prefix commands (`/claude task`) now always call `closeActiveCliTaskSession()` unconditionally (previously only closed for non-Codex channels).
- Router `start` or `close` actions now also null `currentHtmlPath` so the HTML panel closes before the new task begins.
- Router `marvis` route now nulls `currentHtmlPath` (panel closes when switching to plain chat).
- All `sessionState` guards that were `getChannelKey(channel) === '/codex' ? snapshot : null` are now just `getActiveCliTaskSessionSnapshot()` so session context flows to any CLI channel.

## Commands Run

```powershell
git status --short
python C:\Users\leona\.codex\skills\.system\skill-creator\scripts\quick_validate.py .\.agents\skills\marvis-release-validator
node --check .\src\main\codex\delegate.js
node --check .\src\main\ipcHandlers.js
node --check .\src\renderer\preload.js
node --check .\src\renderer\renderer.js
npm test
rg -n "cli:output|Backend CLI|conversation-memory|router:decide|Check for Updates|preferred CLI|music preview|skip\(|pause\(|resume\(" src docs
```

## Residual Risks

- This pass relied on source review and command checks, not a live Electron session, so interaction-heavy UI behavior remains manual follow-up territory.
- Claude Code still uses summarized progress behavior in the right-side panel path; only the Codex panel currently uses backend stream output.
- The `finalizeHtmlPanel` call fires as a fire-and-forget (`.catch(() => {})`); if the HTML file is still being written when finalize runs on a very slow Codex task, the injected title may fall back to task-derived. The `readHtmlPanel` call inside `formatAssistantResponse` serves as a second idempotent pass that catches the actual content title.
