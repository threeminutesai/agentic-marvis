# Jarvis Voice (Wake Word + STT + TTS) — Design Spec

## Overview

This is the Phase 2 voice build for Jarvis: wake-word activation, speech-to-text, and text-to-speech, layered onto the existing Phase 1 chat/settings/avatar/Claude-Code-delegation app. It deviates from the original Phase 1 spec's voice-tooling picks (`docs/superpowers/specs/2026-06-18-jarvis-desktop-assistant-design.md`) on two points, decided during brainstorming:

- **Wake word**: Picovoice Porcupine (browser/WASM, JS-only) instead of openWakeWord (Python), to avoid requiring a Python runtime on the user's machine. Porcupine ships a built-in "Jarvis" keyword, so no custom model training is needed. Requires a free Picovoice AccessKey.
- **STT**: the browser's native `SpeechRecognition` API instead of whisper.cpp, to avoid bundling a native binary and model file. Trade-off: not fully offline (sends audio to the browser vendor's recognition service), but zero extra setup.

TTS keeps the original plan: ElevenLabs as primary, Web Speech API (`speechSynthesis`) as a free, no-key fallback.

## Architecture

All voice processing lives in the **renderer** process, since it needs direct browser APIs (`getUserMedia`, `SpeechRecognition`, `speechSynthesis`, WASM audio processing). The one exception is the ElevenLabs TTS call, which goes through the **main** process via IPC, consistent with how the other AI provider API keys are kept off the renderer.

### Conversation flow

1. On app screen load, if a Picovoice AccessKey is configured, start the wake-word listener (built-in "Jarvis" keyword).
2. On wake-word detection: ignore if Jarvis is already listening or speaking (no overlapping sessions). Otherwise, set avatar state to `listening` and start one `SpeechRecognition` session.
3. On a finalized transcript: append it to the chat log as a "You" message and send it through the **existing** `chat:send` IPC channel — no changes to that path.
4. On reply: set avatar state to `speaking`, append the reply to chat, and speak it — try ElevenLabs via the new `tts:synthesize` IPC channel first; if that fails (no key, network error, API error) or returns no audio, fall back to `window.speechSynthesis.speak(...)`.
5. Typed (non-voice) messages go through the same reply-then-speak step, since every reply is spoken regardless of input method.
6. A mute/unmute toggle button in the app screen suppresses the speak step entirely when muted. Mute state is in-memory only (resets on relaunch).

## New Components

- `src/renderer/voice/wakeWordController.js` — wraps `@picovoice/porcupine-web` + `@picovoice/web-voice-processor`. Exposes `start(accessKey, onWake)` / `stop()`. Requests mic access via the Web Voice Processor; if access is denied or the AccessKey is invalid, calls back with an error and leaves voice disabled (text chat still works).
- `src/renderer/voice/sttController.js` — wraps the browser's native `SpeechRecognition`/`webkitSpeechRecognition`. Exposes `listenOnce(onResult, onError)`, one recognition session per call. Feature-detects availability; if unsupported, calls back with an error.
- `src/renderer/voice/ttsController.js` — exposes `speak(text)`. Calls `window.jarvis.synthesizeSpeech(text)`; if the result is `{ ok: false }` or playback errors, falls back to `window.speechSynthesis.speak(new SpeechSynthesisUtterance(text))`.
- `src/main/providers/elevenLabsProvider.js` — `synthesize(text)`: POSTs to `https://api.elevenlabs.io/v1/text-to-speech/pNInz6obpgDQGcFmaJgB` (ElevenLabs' "Adam" voice — a calm, formal male voice, default in their public voice library) with the `eleven_turbo_v2_5` model, returns the response audio as a Buffer. Throws a descriptive error on non-ok responses, following the same pattern as `geminiProvider.js`/`deepseekProvider.js`.
- `src/main/ipcHandlers.js` — new `ipcMain.handle('tts:synthesize', ...)`: loads settings, and if `settings.apiKeys.elevenlabs` is present, calls `elevenLabsProvider.synthesize(text)` and returns `{ ok: true, audioBase64 }`; otherwise (or on error) returns `{ ok: false }` so the renderer falls back to Web Speech.
- `src/renderer/preload.js` — new `synthesizeSpeech: (text) => ipcRenderer.invoke('tts:synthesize', text)` bridge method.
- `src/main/settings.js` — extend `DEFAULTS.apiKeys` to include `elevenlabs: ''`. Add a new top-level `DEFAULTS.wakeWordKey: ''` (Picovoice AccessKey — kept separate from `apiKeys` since it isn't an AI chat provider, but follows the same encrypted-string storage as the rest of `settings.js`).
- `src/renderer/index.html` — Settings panel: two new password-type inputs (`elevenlabs-api-key-input`, `wakeword-key-input`). App screen: a mute/unmute `<button id="mute-toggle-btn">`.
- `src/renderer/renderer.js` — wires it all together: starts the wake-word listener after `showAppScreen()` if a key is present, handles the wake → listen → send → speak sequence, handles the mute toggle, and saves the two new settings fields alongside the existing ones.
- `src/renderer/avatar/ringsAvatar.js` & `brainAvatar.js` — `setState` gains a `listening` case (`stage.classList.toggle('listening', state === 'listening')`), alongside the existing `speaking` toggle.
- `src/renderer/styles.css` — add a `.listening` visual treatment (e.g. a slow pulse / different glow color) for both avatar presets, and basic styling for the mute toggle button.
- `src/main/main.js` — add `session.defaultSession.setPermissionRequestHandler(...)` to allow `media` (microphone) permission requests, which Electron blocks by default.

## Credential & Degrade Behavior

Both new credentials are optional and degrade independently, consistent with the existing per-key defensive-degrade pattern in `settings.js`:

- **No Picovoice AccessKey**: wake-word listening never starts. The app behaves exactly as it does today — text chat only. No error shown; this is treated as "voice not configured," not a failure.
- **No ElevenLabs key, or ElevenLabs call fails**: TTS falls back to Web Speech automatically, no user-facing error.
- **Mic permission denied by the OS or user**: `wakeWordController.start()`'s error callback fires; voice stays disabled, logged but not surfaced as a blocking error.
- **`SpeechRecognition` unsupported in the renderer's Chromium build**: feature-detected at call time; `sttController` reports unavailable, wake-word detection still fires the avatar's `listening` state briefly but then reports "I couldn't catch that, sir" rather than hanging indefinitely.

## Testing Strategy

- `elevenLabsProvider.js` gets unit tests with a fake `fetch`, mirroring `deepseekProvider.test.js` / `geminiProvider.test.js`: successful synthesis, non-ok response error message, and (if applicable) malformed response handling.
- `wakeWordController.js`, `sttController.js`, and `ttsController.js` depend on real browser APIs (microphone access, WASM wake-word inference, native speech recognition/synthesis) that don't exist under the Node test runner — the same situation as the existing `avatarController.js`. These are **manually verified** in the running Electron app (per the project's standing instruction to test UI/voice changes live in the browser/app, not just via unit tests), not unit tested.
- Manual verification checklist (to run before considering this phase done): say "Jarvis" and confirm the avatar switches to `listening`; speak a question and confirm it's transcribed and sent; confirm the reply is both shown in chat and spoken; toggle mute and confirm replies stop being spoken; remove the ElevenLabs key and confirm TTS still works via Web Speech; remove the Picovoice key and confirm the app still launches and works via typing with no errors.

## Out of Scope (this phase)

- Custom wake-word phrases other than the built-in "Jarvis" keyword.
- Persisting the mute toggle across relaunches.
- Streaming/partial STT transcripts (only finalized transcripts are sent).
- Audio-reactive avatar animation driven by live TTS amplitude (mentioned in the original Phase 1 spec as a stretch visual; not required for voice to function and deferred to a future pass).
- Multi-language wake word/STT/TTS — English only for now.
