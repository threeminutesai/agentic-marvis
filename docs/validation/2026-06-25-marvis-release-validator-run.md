# Marvis Release Validator Run

- Date: 2026-06-25 13:52:24 +08:00
- Scope: Local validation pass after adding the Marvis app specification, validator skill, validation checklist, and chat history scroll fix.
- Release action: Not performed. The user invoked validation only, without explicitly asking to push or update the GitHub release in this turn.

## Summary

| Area | Result | Evidence |
| --- | --- | --- |
| App specification | Pass | `docs/MARVIS_APP_SPEC.md` exists and includes purpose, functions, API routing, conversation rules, HTML panel rules, briefing content, settings, packaging, and scrollability expectations. |
| Validator skill | Pass | `quick_validate.py .\.agents\skills\marvis-release-validator` returned `Skill is valid!`. |
| Validation checklist | Pass | `.agents/skills/marvis-release-validator/references/validation-checklist.md` includes functional checks, command checks, release safety checks, and report requirements. |
| Chat scroll fix | Pass by code review | `src/renderer/styles.css` keeps `#chat-log` vertically scrollable, uses visible thin scrollbars, and changes interaction/chat phases to `justify-content: flex-start`. |
| JavaScript syntax | Pass | `node --check` passed for `renderer.js`, `statusPanel.js`, and `voice/ttsController.js`. |
| Project tests | Pass with coverage gap | `npm test` completed successfully, but the repository currently reports 0 registered tests. |
| Git/release safety | Pass | No commit, push, GitHub release upload, or release asset replacement was performed. |

## Functional Checklist

| Check | Result | Notes |
| --- | --- | --- |
| Normal chat stays in the chat column | Not manually exercised | No Electron UI run was performed in this validation pass. Existing routing code was not changed in this pass. |
| Normal chat does not raise the HTML panel | Not manually exercised | Covered by the app spec and validator checklist; should be visually retested before a release upload. |
| Chat history remains scrollable with many messages | Pass by code review | The chat log uses `overflow-y: auto`, visible scrollbar styling, and top-aligned overflow in interaction/chat modes. |
| Bot voice speaks returned replies, not only fixed inputs | Not manually exercised | Existing TTS files passed syntax checks. Audio playback should be retested in the packaged app before publishing. |
| HTML panel opens only from explicit HTML path/open/show commands | Not manually exercised | Covered by spec/checklist; no routing edits were made during this pass. |
| HTML report iframe does not wash out the chat UI | Not manually exercised | Should be visually retested in Electron with a generated report. |
| Crop and close buttons remain in front of the report iframe | Not manually exercised | Should be visually retested in Electron with an open report. |
| Settings content remains documented | Pass by specification | Settings coverage is included in `docs/MARVIS_APP_SPEC.md`. |
| Windows packaging avoids missing `ffmpeg.dll` | Not applicable | No Windows package was built in this pass. The checklist preserves the rule to package the portable EXE plus data/music assets. |
| macOS package mirrors Windows data layout | Not applicable | No macOS package was built in this pass. |

## Commands Run

```powershell
node --check .\src\renderer\renderer.js
node --check .\src\renderer\statusPanel.js
node --check .\src\renderer\voice\ttsController.js
npm test
python C:\Users\leona\.codex\skills\.system\skill-creator\scripts\quick_validate.py .\.agents\skills\marvis-release-validator
```

## Residual Risks

- Automated UI coverage is still missing; `npm test` passes but currently runs 0 tests.
- Voice playback and HTML panel layering should be verified in a live Electron build before publishing another release asset.
- The validator skill is under `.agents/skills/`, which is currently ignored by Git unless explicitly force-added or the ignore rule is changed.
