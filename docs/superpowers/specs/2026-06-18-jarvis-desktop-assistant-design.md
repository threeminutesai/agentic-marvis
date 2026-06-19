# Jarvis Desktop Assistant — Design Spec

## Overview

A desktop AI assistant inspired by Tony Stark's JARVIS: voice-driven (wake word, STT, TTS), backed by a swappable LLM API (DeepSeek by default), with long-term semantic memory, and the ability to delegate coding tasks to Claude Code CLI while staying purely a conversational orchestrator itself (no direct code editing).

Reference research:
- Public JARVIS-style open source projects (OpenJarvis, OpenClaw, various Python voice assistants) converge on: voice I/O, swappable LLM backend, tool/agent execution, persistent memory.
- Fictional JARVIS personality: calm, witty, formal, dutiful, British-butler cadence, addresses user respectfully, dry humor, analytical, loyal.
- Real JARVIS HUD visual design (Jayse Hansen / Perception, Iron Man films): concentric rotating rings around a central glowing orb — inner ring (slow) = system stats, middle ring (medium) = processing, outer ring (fast) = alerts/activity. Rings shift color/speed and pulse outward based on activity/complexity.
- 2026 AI agent memory landscape: dedicated memory layer (Mem0/Letta/Zep pattern) extracting salient facts into a vector store with semantic retrieval, rather than replaying full chat logs.
- Voice tooling: openWakeWord (free, local, ships a pretrained "hey jarvis" model) for wake-word detection; whisper.cpp (free, local, unlimited) for STT; ElevenLabs (best quality, ~10-15 free min/month) for TTS with Web Speech API as a free fallback.

## Architecture

Electron desktop app (Node.js + HTML/CSS/JS), three layers:

1. **Renderer (UI process)** — HUD-style window. Central avatar (switchable preset: Rings/HUD or Electrical Brain, both audio-reactive via Web Audio API analyzing TTS output amplitude), HUD status readouts (active project, task state), chat transcript that fades in below the avatar, settings panel.
2. **Main process (orchestrator)** — owns: wake-word listener, STT/TTS pipeline, AI provider client (provider-agnostic interface, DeepSeek default), Mem0 memory read/write, Claude Code CLI process spawning and event parsing, settings persistence.
3. **Local data** — `settings.json` (provider, encrypted API keys via Electron `safeStorage`, personality system prompt, avatar style, active project path), local vector store (Chroma or LanceDB) for Mem0-managed long-term memory, conversation log (recent session only, not the long-term memory store).

## Avatar System

Two switchable presets, selected in settings, both rendered via SVG/Canvas in the renderer and driven by:
- **Idle**: slow ambient animation (ring rotation / vein pulse).
- **Speaking**: animation intensity (rotation speed, glow, scale) driven by real-time TTS audio amplitude via Web Audio API `AnalyserNode`.

Presets:
- **Rings/HUD** — three concentric rotating rings (different speeds) around a glowing core, cyan holographic palette. Matches the authentic Iron Man JARVIS look.
- **Electrical Brain** — pulsing core with animated synaptic "veins," sparks intensify when speaking.

## Conversation Flow

1. openWakeWord runs continuously in the main process listening for "Hey Jarvis" (local, lightweight, no cloud dependency).
2. On detection, mic audio is captured until silence is detected, then transcribed locally via whisper.cpp.
3. The transcript plus semantically-relevant memories (retrieved from Mem0/local vector store) are sent to the active AI provider (DeepSeek by default) along with the configurable JARVIS-style system prompt.
4. The response streams back, is synthesized via ElevenLabs TTS (falls back to Web Speech API TTS if ElevenLabs credits are exhausted), and the avatar animates from the live audio amplitude.
5. Mem0 extracts salient facts from the exchange and stores/updates them in the local vector store for future semantic recall — no full-transcript SQL log is treated as the source of truth for memory.

## Task Delegation (Claude Code)

Jarvis is a pure conversational orchestrator for delegated tasks — it does not edit code itself; Claude Code CLI does all the heavy lifting.

- **Trigger**: explicit conversational intent only (you ask Jarvis to have Claude Code do something). No auto-routing of "code-looking" requests.
- **Project targeting**: one active project directory at a time, set via settings (file picker) or voice command ("switch to project X"), persists until changed.
- **Invocation**: headless mode — `claude -p "<task>" --output-format stream-json`, spawned as a child process scoped to the active project directory.
- **Progress reporting**: minimal by default ("Working on it, sir" / brief status). If you ask for an update mid-task, Jarvis peeks at the latest stream-json events and gives a short spoken summary — no full streaming narration unless asked.
- **Completion**: Jarvis reads the final result, summarizes conversationally, and speaks the summary.
- **Future**: Codex CLI support is an explicit stretch goal, not in initial scope.

## Settings Panel

- **AI provider**: dropdown (DeepSeek default; OpenAI/Anthropic/etc. as alternates) + API key field, encrypted at rest via Electron `safeStorage`.
- **Personality**: editable system-prompt textarea, pre-filled with a JARVIS-style default (calm, witty, formal, loyal, addresses user respectfully).
- **Avatar style**: Rings/HUD or Electrical Brain picker.
- **Active project**: file/folder picker for the Claude Code working directory.
- **Voice**: ElevenLabs API key (optional; falls back to Web Speech API TTS if absent or exhausted).

## Error Handling

- **Claude Code CLI not found / not authenticated**: spawn failure is caught and reported conversationally ("I can't reach Claude Code, sir — is it installed and logged in?"), never a silent crash.
- **Mic / wake-word permission denied**: settings panel shows a clear status indicator; app falls back to a manual "click to talk" control.
- **AI provider failure** (bad key, rate limit, network): spoken error plus HUD status changes to "ERROR"; current conversation state is preserved, not discarded.
- **ElevenLabs credits exhausted**: silent fallback to Web Speech API TTS; optional one-time spoken notice the first time this happens per session.

## Testing Strategy

- Unit tests (Node test runner or Jest) for: AI provider abstraction, Mem0 memory retrieval/storage logic, Claude Code process spawning and stream-json parsing — all with mocked child processes and API calls.
- Manual verification for wake-word detection, STT/TTS accuracy, and avatar animation — these depend on real audio/mic input and are not meaningfully unit-testable.

## Out of Scope (initial build)

- Codex CLI support (stretch goal).
- Multiple simultaneous active projects.
- Cloud-hosted Mem0 (self-hosted/local only for v1).
- Mobile or web-hosted versions — desktop Electron only.
