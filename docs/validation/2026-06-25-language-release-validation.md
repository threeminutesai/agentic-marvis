# Marvis Language Release Validation

- Date/time: 2026-06-25 20:47:07 +08:00
- Validation scope: language-aware chat and briefing output, profile metadata persistence, settings/profile language sync, briefing/news format rules, Windows release packaging for `v0.5.0`

| Area | Status | Notes |
| --- | --- | --- |
| Renderer syntax | Pass | `src/renderer/renderer.js`, `src/renderer/statusPanel.js`, and related touched files passed syntax checks. |
| Main process syntax | Pass | `src/main/ipcHandlers.js` and `src/main/settings.js` passed syntax checks. |
| Tests | Pass | `npm test` passed with 2/2 tests. |
| Status JSON metadata | Pass | `User Profile.detail` now supports `Geolocation: ... | Language: ...` and save/update paths preserve it. |
| Briefing/news format docs | Pass | Skill, spec, and validator now document parallel news arrays and language-driven generation. |
| Bot and CLI output language routing | Pass | Bot system prompt and CLI HTML/voice contract now enforce user-facing output language. |
| Windows ZIP layout | Pass | ZIP contains top-level `Marvis.exe`, `data/music-library.json`, and `data/music/ATTRIBUTION.md`. |
| Chat and HTML routing manual verification | Not manually verified | Protected by code review and existing routing rules; no live UI walkthrough performed in this pass. |
| macOS asset rebuild | Not manually verified | Existing release assets remain present; no new macOS build was run locally. |

| Requirement | Status | Notes |
| --- | --- | --- |
| Normal chat stays in chat, not HTML panel | Not manually verified | Routing code was updated for language, not panel intent. |
| TTS speaks returned chat replies fully | Not manually verified | No regression seen in code path; not exercised manually. |
| HTML panel opens only from explicit file/open commands | Not manually verified | Command parsing expanded for Chinese `open/show` equivalents. |
| Briefing uses parallel news arrays | Pass | Renderer and docs aligned on `value[]`, `detail[]`, optional `image[]`, optional `link[]`. |
| `User Profile.detail` preserves geolocation and language metadata | Pass | Save and settings-sync paths now preserve `Geolocation` and `Language`. |
| Generated briefing content follows stored language | Pass | Skill rules, app prompt, and CLI contract now align on language-driven output. |
| Settings save/restore language | Pass | `language` added to settings defaults and renderer save/load flow. |
| Release ZIP uses portable EXE | Pass | Verified `Marvis.exe` from portable build is at ZIP root. |

- Commands run:
  - `node --check .\src\renderer\renderer.js`
  - `node --check .\src\renderer\statusPanel.js`
  - `node --check .\src\renderer\music\musicPanel.js`
  - `node --check .\src\main\ipcHandlers.js`
  - `node --check .\src\main\settings.js`
  - `node --check .\src\renderer\preload.js`
  - `node --check .\src\renderer\voice\ttsController.js`
  - `npm test`
  - `npm run dist:win -- --publish never`
  - `tar -tvf release\Marvis-v0.5.0-win32-x64.zip | Select-String "Marvis.exe|music-library|ATTRIBUTION"`

- Residual risks:
  - No live end-to-end UI run was performed after the latest language/routing changes.
  - macOS release artifacts were not rebuilt in this validation pass.
