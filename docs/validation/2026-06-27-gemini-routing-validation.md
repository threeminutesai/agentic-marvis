# Marvis Validation Report

- Date/time: 2026-06-27
- Validation scope: Gemini-controlled plain-message routing for Codex, managed Codex task-session carry-forward, CLI warm-up/standby behavior, and spec/validator documentation alignment

| Area | Status | Notes |
| --- | --- | --- |
| JavaScript syntax checks | Pass | `node --check` passed for `src/main/ipcHandlers.js`, `src/renderer/preload.js`, and `src/renderer/renderer.js`. |
| Automated tests | Pass | `npm test` passed with 6/6 tests green. |
| Gemini router IPC | Pass | Main/preload/renderer now expose a dedicated `router:decide` path for plain-message routing decisions. |
| Managed Codex task session | Pass | Renderer keeps recent Codex turn context in app state and only reuses it when Gemini marks the next turn as a continuation. |
| HTML/report close behavior | Pass | A delivered HTML/report result closes the managed Codex task session so the next plain turn re-enters Gemini routing. |
| CLI warm-up and standby panel | Pass | Preferred CLI can warm in the background and the right panel can stay as a standby CLI panel, but this is still not a true persistent CLI process. |
| App spec update | Pass | `docs/MARVIS_APP_SPEC.md` now documents Gemini routing, Codex task-session behavior, and CLI warm-up expectations. |
| Validator checklist update | Pass | `.agents/skills/marvis-release-validator/references/validation-checklist.md` now checks Gemini routing and Codex session-closing expectations. |
| Manual UI behavior | Not manually verified | No live Electron walkthrough was performed to prove the new routing decisions visually. |

## Checklist

| Requirement | Status | Notes |
| --- | --- | --- |
| Plain chat does not blindly stick to preferred CLI | Pass | [renderer.js](</C:/L_Center/AI_devp/jarvis/src/renderer/renderer.js>) now calls Gemini routing for plain messages before deciding on Codex. |
| Plain-message Gemini routing can choose Marvis or Codex | Pass | [ipcHandlers.js](</C:/L_Center/AI_devp/jarvis/src/main/ipcHandlers.js>) returns normalized `route` and `sessionAction` values from Gemini. |
| Codex follow-up carries recent task context | Pass | [renderer.js](</C:/L_Center/AI_devp/jarvis/src/renderer/renderer.js>) builds a managed Codex session summary and prepends recent context when continuing. |
| HTML/report result closes managed Codex task session | Pass | [renderer.js](</C:/L_Center/AI_devp/jarvis/src/renderer/renderer.js>) clears the managed Codex task session when an HTML result is returned. |
| Switching away from Codex closes managed session | Pass | Plain-message routing and non-Codex attachment/explicit CLI paths clear the stored Codex task session before returning to chat or another CLI. |
| Preferred CLI warm-up is documented as warm-up, not true persistence | Pass | Spec and validator now explicitly distinguish background warm-up from a genuinely persistent always-open CLI process. |
| Manual end-to-end UI proof | Not manually verified | No interactive run confirmed that Gemini now chooses continue/start/close exactly as expected for multiple real conversations. |

## Commands Run

```powershell
node --check .\src\main\ipcHandlers.js
node --check .\src\renderer\preload.js
node --check .\src\renderer\renderer.js
npm test
rg -n "router:decide|sessionAction|activeCliTaskSession|buildCliSessionTask|decideIntelligentRoute" src
```

## Residual Risks

- The current implementation is still a managed task-session layer, not one forever-open Codex or Claude terminal process.
- No live UI run was performed, so Gemini routing quality is validated by source review and command checks rather than interactive proof.
- The validator checklist file lives under `.agents/skills/`; depending on Git ignore rules, it may need force-add during commit if it is not already tracked.
