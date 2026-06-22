# Agentic Jarvis

Agentic Jarvis is a dashboard-oriented desktop assistant that bridges Codex and Claude Code with a Jarvis-style voice and status interface.

## Download

A packaged Windows build is available on the [Releases page](https://github.com/threeminutesai/agentic-jarvis/releases) — download the portable `.exe` and run it directly, no installation or Node.js required.

macOS and Ubuntu builds are planned for a future release. Until then, Linux/macOS users can run from source via the [Setup](#setup) instructions below.

## Setup

1. `npm install`
2. `npm start`
3. Add an API key (DeepSeek or Gemini) when prompted on first launch, then set an active project folder in Settings.

## AI Providers

Jarvis combines three kinds of AI integration, each doing a different job:

- **Chat bot (DeepSeek or Gemini)** — powers Jarvis's own conversational replies. Pick one from the Settings panel's provider dropdown:
  - **DeepSeek** (default) — paid, no free tier.
  - **Gemini** — has a free tier (Google AI Studio); get a key at https://aistudio.google.com/apikey.

  Each provider's key is stored separately (encrypted at rest), so switching the dropdown doesn't lose the other key. More providers may be added in the future.

- **Claude Code / Codex CLI (heavy lifting)** — not a chat provider; these are delegated to for actual work against your project (writing code, running tasks) when a plain chat reply isn't enough. See [CLI delegation channels](#cli-delegation-channels) below. Claude Code authenticates via its own CLI subscription login, not an API key.

- **ElevenLabs (speech)** — powers both directions of voice: text-to-speech for Jarvis's spoken replies, and speech-to-text for transcribing what you say. See [Voice](#voice) below.

### Quick launch (Windows)

Double-click `run.bat` — installs dependencies on first run if needed, then starts the app.

## Testing

`npm test`

## Voice

Optional, configured in Settings:
- **Wake word** — check "Enable wake word" to have Jarvis always listen in the background for the word "Jarvis," using the browser's built-in speech recognition. No key, signup, or usage limits required. Off by default. The follow-up command after wake-word detection is also transcribed via the browser's built-in recognition.
- **Speech-to-text (Mic button)** — recording your own messages via the Mic button is transcribed by ElevenLabs and requires an ElevenLabs API key configured in Settings; without one it reports that transcription isn't available rather than falling back.
- **Text-to-speech** — every reply is spoken aloud. Uses ElevenLabs if a key is configured (https://elevenlabs.io/), otherwise falls back to the browser's built-in voice. Use the Mute button to silence it — muting immediately interrupts any speech currently playing. Manage ElevenLabs voices in Settings: enter a voice's name and ID (find the ID on a voice's page in the ElevenLabs Voice Library) and click "Add Voice" to save it to the dropdown; pick the active voice from the "ElevenLabs Voice" dropdown, or remove a saved one with "Remove Selected". Defaults to "Adam" if none is selected.

### ElevenLabs Signup

You can create an ElevenLabs account with this link: https://try.elevenlabs.io/inxig6woaojq

Disclosure: this is an affiliate link and may provide affiliate credit to the project owner.

## CLI delegation channels

Jarvis isn't limited to its own chat replies — it can hand a task off to the Claude Code or Codex CLI running against your active project. Set an active project folder in Settings first, then type:

- `/code <task>` or `/claude <task>` — delegates to the `claude` CLI (must be installed and logged in).
- `/codex <task>` — delegates to the `codex` CLI (must be installed and logged in).

Jarvis waits for the CLI to finish (up to 10 minutes) and reads back its summary, same as a normal reply.

## Status

Phase 1 (complete): chat, settings, avatar, Claude Code delegation.
Phase 2 (this build): voice — wake word ("Jarvis" via continuous browser SpeechRecognition), STT (browser SpeechRecognition), TTS (ElevenLabs + Web Speech fallback).
Phase 3 (planned): long-term memory via Mem0 + local vector store.
