# Agentic Jarvis

Agentic Jarvis is a dashboard-oriented desktop assistant that bridges Codex and Claude Code with a Jarvis-style voice and status interface.

## Setup

1. `npm install`
2. `npm start`
3. Add an API key (DeepSeek or Gemini) when prompted on first launch, then set an active project folder in Settings.

## AI Providers

Switchable from the Settings panel:
- **DeepSeek** (default) — paid, no free tier.
- **Gemini** — has a free tier (Google AI Studio); get a key at https://aistudio.google.com/apikey.

Each provider's key is stored separately (encrypted at rest), so switching the provider dropdown doesn't lose the other key.

### Quick launch (Windows)

Double-click `run.bat` — installs dependencies on first run if needed, then starts the app.

## Testing

`npm test`

## Voice

Optional, configured in Settings:
- **Wake word** — check "Enable wake word" to have Jarvis always listen in the background for the word "Jarvis," using the browser's built-in speech recognition. No key, signup, or usage limits required. Off by default.
- **Speech-to-text** — uses the browser's built-in speech recognition, no key needed.
- **Text-to-speech** — every reply is spoken aloud. Uses ElevenLabs if a key is configured (https://elevenlabs.io/), otherwise falls back to the browser's built-in voice. Use the Mute button to silence it — muting immediately interrupts any speech currently playing. Manage ElevenLabs voices in Settings: enter a voice's name and ID (find the ID on a voice's page in the ElevenLabs Voice Library) and click "Add Voice" to save it to the dropdown; pick the active voice from the "ElevenLabs Voice" dropdown, or remove a saved one with "Remove Selected". Defaults to "Adam" if none is selected.

## CLI delegation channels

Jarvis isn't limited to its own chat replies — it can hand a task off to the Claude Code or Codex CLI running against your active project. Set an active project folder in Settings first, then type:

- `/code <task>` or `/claude <task>` — delegates to the `claude` CLI (must be installed and logged in).
- `/codex <task>` — delegates to the `codex` CLI (must be installed and logged in).

Jarvis waits for the CLI to finish (up to 10 minutes) and reads back its summary, same as a normal reply.

## Status

Phase 1 (complete): chat, settings, avatar, Claude Code delegation.
Phase 2 (this build): voice — wake word ("Jarvis" via continuous browser SpeechRecognition), STT (browser SpeechRecognition), TTS (ElevenLabs + Web Speech fallback).
Phase 3 (planned): long-term memory via Mem0 + local vector store.
