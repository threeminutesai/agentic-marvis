# Marvis Mic STT Validation

- Date: 2026-06-25 14:20:52 +08:00
- Scope: Investigate degraded mic STT where saying "financial" produced bracketed audio tags such as `[outro]` or `[phone]`, which then appeared as unrecognized CLI prefixes.
- Release action: Not performed. This pass checks and fixes local source only.

## Summary

| Area | Result | Evidence |
| --- | --- | --- |
| Mic capture noise control | Pass | Mic capture now stops Marvis voice cues, pauses active music while recording, requests echo cancellation/noise suppression/auto gain control, and records mono Opus when available. |
| STT API hints | Pass | ElevenLabs STT request now sends `language_code=eng` and finance keyterms to improve recognition of words like "financial". |
| Audio-event transcript cleanup | Pass | STT output removes bracketed non-speech tags such as `[outro music]` and `[phone rings]` before sending text into chat routing. |
| CLI noise reduction | Pass | Unrecognized CLI prefix logging is now limited to slash-prefixed command attempts, so bad STT tags do not appear as CLI command warnings. |
| Regression tests | Pass | Added tests for STT tag cleanup and MIME filename selection. |

## Checklist

| Requirement | Status | Notes |
| --- | --- | --- |
| Mic button records and transcribes user speech | Pass by code review | Recording path remains `MediaRecorder` -> `stt:transcribe` -> chat input send. |
| Mic should avoid recording Marvis music/TTS | Pass | Music is paused during mic capture and resumed afterward; cached/processing/TTS voice is stopped before recording. |
| STT should not submit non-speech tags as user commands | Pass | Audio-event tags are cleaned, and empty cleaned transcripts show "I couldn't hear clear speech". |
| Saying "financial" should be favored over similar noise tags | Pass by implementation | `language_code=eng` and keyterms `financial`/`finance` are sent to Scribe v2. |
| Wake word disabled log is not treated as failure | Pass | `[WakeWord] startWakeWordIfConfigured - enabled: false` is informational when wake word is disabled. |
| Live microphone recognition quality | Not manually verified | Needs a live packaged/electron mic test with the user's actual microphone and environment. |

## Commands Run

```powershell
node --check .\src\renderer\renderer.js
node --check .\src\main\providers\elevenLabsSttProvider.js
node --check .\src\renderer\statusPanel.js
node --check .\src\renderer\voice\ttsController.js
npm test
```

## Residual Risks

- Actual STT quality still depends on microphone hardware, speaker output bleed, room noise, and ElevenLabs service behavior.
- If the user intentionally says bracketed words such as "open bracket phone close bracket", the cleanup may remove them because they match non-speech audio-event tags.
