# Marvis STT Provider Release Validation

- Date: 2026-06-25
- Scope: remove unused Whisper STT provider files, keep ElevenLabs STT path working, update app metadata, and tighten release packaging requirements for bundled music assets

## Summary

| Area | Status | Notes |
| --- | --- | --- |
| Unused STT provider deletions | Pass | `src/main/providers/whisperLocalProvider.js` and `src/main/providers/whisperSttProvider.js` are removed and no longer referenced by the active IPC STT flow. |
| Active STT flow | Pass | `ipcMain.handle('stt:transcribe')` still uses `createElevenLabsSttProvider()` in `src/main/ipcHandlers.js`. |
| Renderer syntax | Pass | `renderer.js`, `statusPanel.js`, and `ttsController.js` parse successfully. |
| Main-process syntax | Pass | `main.js` parses successfully. |
| Package metadata | Pass | `package.json` parses successfully after metadata updates. |
| Automated tests | Pass | `npm test` passed, 2/2 tests. |
| Windows packaging | Pass | `npm run dist:win -- --publish never` completed and produced fresh Windows output. |
| Release contract updates | Pass | App spec and validator checklist now explicitly require the full 7-track bundled music pack in release assets. |

## Checklist

| Requirement | Status | Notes |
| --- | --- | --- |
| Preserve ordinary chat routing | Pass | No routing logic changed. |
| Keep TTS path intact | Pass | No TTS regressions introduced by this change set. |
| Keep STT working through active provider | Pass | Active STT path remains ElevenLabs-based through IPC. |
| Remove dead Whisper provider files safely | Pass | No active imports or call sites remain for deleted provider files. |
| Windows ZIP uses portable EXE | Pass | Release packaging flow continues to use `release/Marvis 0.5.0.exe` as the packaged app executable. |
| Bundled music pack required by spec | Pass | Spec/checklist updated to require `ATTRIBUTION.md` plus all 7 MP3 files in `data/music`. |
| Validation report created | Pass | This report documents the release validation pass. |

## Commands Run

```powershell
node --check src\main\main.js
node --check src\renderer\renderer.js
node --check src\renderer\statusPanel.js
node --check src\renderer\voice\ttsController.js
node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('package.json','utf8')); console.log('package.json ok')"
npm test
npm run dist:win -- --publish never
```

## Residual Risks

- macOS release assets need a fresh GitHub Actions rebuild if release parity across platforms is required for this exact source state.
- The Windows executable still is not code-signed, so SmartScreen reputation behavior is unchanged by this validation pass.
