# Marvis Validation Report

- Date/time: 2026-06-26 17:05
- Validation scope: manual update-check Settings flow, briefing panel regression guard, packaging contents, GitHub push, and release preparation

| Area | Status | Notes |
| --- | --- | --- |
| Git working tree | Pass | `git status --short` returned clean output. |
| JavaScript syntax checks | Pass | `renderer.js`, `statusPanel.js`, and `voice/ttsController.js` passed `node --check`. |
| Automated tests | Pass | `npm test` passed with 4/4 tests green. |
| Windows release ZIP contents | Not applicable | Packaging had not been rebuilt yet at the time of this validation note; release verification is performed again before publish. |
| Bundled briefing skill default target | Pass | [skills/agentic-marvis-brief/SKILL.md](</C:/L_Center/AI_devp/jarvis/skills/agentic-marvis-brief/SKILL.md>) explicitly defaults to `data/marvis-status.json` in the current working directory. |
| Ollama onboarding/settings contract | Pass | Ollama is present in onboarding and settings UI, does not require an API key, and persists URL/model defaults in code. |
| HTML panel isolation and explicit open rules | Pass | Source uses sandboxed iframe rendering and explicit `/html`, `open`, `show`, `/open`, and `[html]` handling. |
| Briefing entry-only behavior | Pass | `renderer.js` no longer runs a periodic briefing refresh timer, so the app will not reopen the briefing panel while the user is chatting. |
| Briefing fallback voice behavior | Pass | `renderer.js` still allows avatar-only or empty-news briefings to speak during the initial stage-2 flow without marking the news status hash as already briefed. |
| Settings update-check contract | Pass | Source includes a footer `Check for Updates` button, GitHub release comparison logic, and browser-open fallback instead of in-place EXE replacement. |
| Manual UI behavior | Not manually verified | Chat scroll, mute interruption, crop/close layering, attachment routing, live provider fallback, and the visual update-check button flow were not exercised interactively in this pass. |

## Checklist

| Requirement | Status | Notes |
| --- | --- | --- |
| Normal chat stays out of HTML panel | Not manually verified | Source patterns look correct, but I did not run the UI end-to-end. |
| Chat history remains scrollable | Not manually verified | No live UI pass in this run. |
| Chat TTS speaks full reply | Not manually verified | No live audio verification in this run. |
| TTS falls back if ElevenLabs fails | Not manually verified | No forced provider failure test in this run. |
| `/code`, `/claude`, `/codex` route correctly | Pass | Routing hooks are present in [renderer.js](</C:/L_Center/AI_devp/jarvis/src/renderer/renderer.js>). |
| Report generation returns `[html] <path>` instead of inline HTML | Pass | Prompt scaffolding in [renderer.js](</C:/L_Center/AI_devp/jarvis/src/renderer/renderer.js>) enforces the file-path contract. |
| HTML panel renders in isolated iframe | Pass | [statusPanel.js](</C:/L_Center/AI_devp/jarvis/src/renderer/statusPanel.js>) creates a sandboxed iframe. |
| `open/show` and `/html` handling is explicit | Pass | Command parsing is implemented in [renderer.js](</C:/L_Center/AI_devp/jarvis/src/renderer/renderer.js>). |
| Briefing uses parallel news arrays | Pass | Source references parallel `value[]` and `detail[]` handling in both renderer and status panel code. |
| Briefing voice only hashes real news-item briefings | Pass | [renderer.js](</C:/L_Center/AI_devp/jarvis/src/renderer/renderer.js>) gates status-hash voice triggering on non-empty news items. |
| Fallback/avatar-only speech does not mark briefed hash | Pass | With empty news items, `shouldTriggerBriefingForStatusHash` returns false, so `markBriefingStatusHashPlayed` is not called. |
| First-run empty-status fallback still speaks | Pass | `renderer.js` speaks fallback/avatar-only briefing text during the initial stage-2 flow when no real news items exist, while keeping `lastBriefingStatusHash` reserved for real news briefings. |
| Briefing panel does not reopen itself during chat | Pass | The periodic briefing timer and frequency setting were removed, so ordinary chat no longer gets interrupted by a background status-panel reopen. |
| Settings hides briefing frequency control | Pass | Source no longer exposes the old briefing frequency setting in Settings. |
| Settings shows manual update-check button | Pass | [index.html](</C:/L_Center/AI_devp/jarvis/src/renderer/index.html>) includes `check-updates-btn` in the Settings footer and [renderer.js](</C:/L_Center/AI_devp/jarvis/src/renderer/renderer.js>) localizes it. |
| Update check compares installed version with GitHub release | Pass | [ipcHandlers.js](</C:/L_Center/AI_devp/jarvis/src/main/ipcHandlers.js>) fetches `releases/latest`, normalizes versions, and reports whether an update exists. |
| Update flow opens browser instead of replacing running app | Pass | The renderer asks for confirmation, then calls `shell.openExternal(...)` via preload/main IPC rather than attempting self-overwrite. |
| Ollama can be selected without API key | Pass | Onboarding/settings logic exempts Ollama from API-key requirements in [renderer.js](</C:/L_Center/AI_devp/jarvis/src/renderer/renderer.js>) and [ipcHandlers.js](</C:/L_Center/AI_devp/jarvis/src/main/ipcHandlers.js>). |
| Ollama URL/model persist | Pass | Defaults and save/load paths exist in [settings.js](</C:/L_Center/AI_devp/jarvis/src/main/settings.js>) and [renderer.js](</C:/L_Center/AI_devp/jarvis/src/renderer/renderer.js>). |
| Bundled skill defaults to `data/marvis-status.json` | Pass | Verified in [skills/agentic-marvis-brief/SKILL.md](</C:/L_Center/AI_devp/jarvis/skills/agentic-marvis-brief/SKILL.md>). |
| Windows ZIP uses portable build and includes skills/music | Not applicable | Re-verified during the publish step after rebuilding the package. |

## Commands Run

```powershell
git status --short
node --check .\src\renderer\renderer.js
node --check .\src\renderer\statusPanel.js
node --check .\src\renderer\voice\ttsController.js
npm test
rg -n "check-updates-btn|settings-footer-actions|briefingVoiceFrequency|briefing-voice-frequency-select|briefingCheckTimer" src
rg -n "settings:checkForUpdates|shell:openExternal|releases/latest|openExternalUrl" src
rg -n "lastBriefingStatusHash|News Briefing|lastBriefingVoiceAt" src
rg -n "ollama|baseUrl|model" src
rg -n "\[html\]|/html|iframe|sandbox" src
```

## Residual Risks

- This pass did not include a live Electron/manual UI run, so interaction-heavy checks remain manual follow-up items.
- The actual packaged release assets are validated again during the publish step because packaging was rebuilt after this source-level validation pass.
