# Marvis App Specification

## Purpose

Marvis is a desktop assistant for a solo user who wants a voice-first, dashboard-aware interface that can:

- answer conversational questions through a normal bot API,
- speak useful replies aloud,
- show personal briefing information,
- open and preserve generated HTML reports,
- delegate heavier project work to Claude Code or Codex,
- package and release the app for Windows and macOS.

The app is not a general project management system. It is a personal assistant shell that routes the right request to the right capability while keeping routine chat fast and report/code work delegated.

## Core Functions and Expected Outcomes

### Chat

Users type or speak messages in the chat bar. Marvis should append the user message, get a response, display the returned message, and speak the returned message when voice is enabled.

Expected outcome:

- Simple conversation stays in the chat area.
- Chat history is scrollable when messages exceed the visible area.
- Normal bot replies do not open the HTML panel.
- TTS speaks the returned answer, not only the first paragraph.
- The Mute button immediately stops voice playback.
- When ElevenLabs TTS is unavailable or out of credits, browser speech is used as fallback.

### Voice Input and Output

Voice input uses the Mic button or wake word flow. Voice output speaks greetings, briefings, processing cues, command confirmations, and assistant replies.

Expected outcome:

- Mic button records and transcribes user speech.
- Wake word can trigger a follow-up voice capture when enabled.
- Voice volume applies to TTS playback.
- Music ducks under voice and returns afterward.
- Voice playback must not depend on only a tiny set of sample phrases; any accepted user message can produce spoken returned output.

### HTML Reports and Panels

The HTML panel is for structured visual output, dashboards, reports, and saved HTML files. It must not be used for ordinary chat.

Expected outcome:

- Normal Gemini/DeepSeek chat does not create or open an HTML panel.
- Claude Code/Codex report tasks write HTML to a file path prepared by Marvis.
- Claude Code/Codex return a short `[voice]` response and an `[html] <path>` line.
- Marvis opens only the returned HTML file path.
- Inline HTML, Markdown content, or long text should not be converted into a panel.
- HTML renders inside a sandboxed iframe so report CSS or scripts cannot corrupt the Marvis UI.
- The crop and close buttons remain visible and clickable above report content.
- `open <keyword>`, `show <keyword>`, and `/open <keyword>` search saved HTML panels by keyword.
- `/html <path>` and `html <path>` open a specific local HTML file directly.

### CLI Delegation

Claude Code and Codex are heavy-lifting channels. They are used when a request needs project files, code changes, file creation, report generation, screenshots, or other work beyond a quick bot reply.

Expected outcome:

- `/code <task>` and `/claude <task>` delegate to Claude Code.
- `/codex <task>` delegates to Codex.
- If the user clearly requests a report, Marvis delegates to Claude Code by default when no explicit CLI prefix is present.
- If screenshots/captures are attached, Marvis delegates to a CLI channel because the bot API cannot read local files.
- CLI output must be summarized for voice and, when HTML is involved, returned by file path only.

### Capture

The panel capture button lets the user select a region of the visible panel and attach the resulting image to the next message.

Expected outcome:

- Capture mode overlays the panel.
- A selected region becomes an attachment chip.
- Attachment-bearing messages route to Claude Code/Codex, not Gemini/DeepSeek.
- Capture and close controls stay above HTML panel content.

### Music

Marvis can seed, import, organize, and schedule music.

Expected outcome:

- The music library loads from `data/music-library.json`.
- Sample music lives under `data/music`.
- User-imported tracks and playlists can be managed in Settings.
- Music volume is separate from voice volume.
- Music ducks while Marvis speaks.

## APIs and Integrations

### Gemini

Gemini is a bot API provider for ordinary conversational chat.

Use Gemini when:

- the user selected Gemini as the provider,
- the message is simple chat, factual Q&A, brainstorming, or a voice-friendly answer,
- no local file access, project edits, screenshot reading, or HTML report generation is required.

Do not use Gemini for:

- local project edits,
- local screenshots,
- report HTML file creation,
- tasks that must write files to the active project.

### DeepSeek

DeepSeek is another bot API provider for ordinary conversational chat.

Use DeepSeek under the same routing rules as Gemini, based on the selected provider.

### ElevenLabs Text-to-Speech

ElevenLabs provides natural voice playback when an API key is configured.

Use ElevenLabs for:

- assistant replies,
- greeting and briefing audio,
- processing cues,
- cached voice snippets.

Fallback:

- If ElevenLabs fails or quota is low, use browser speech synthesis for reply playback.

### ElevenLabs Speech-to-Text

ElevenLabs transcribes Mic button recordings when an API key is configured.

Expected outcome:

- Mic recordings are converted to text and sent through the normal routing path.
- If no key is configured, the app should report that transcription is unavailable rather than silently failing.

### Browser Speech APIs

Browser speech APIs support wake word and fallback TTS.

Use them for:

- wake word listening,
- browser TTS fallback.

### Claude Code

Claude Code handles project-aware work and report generation.

Use Claude Code when:

- the user uses `/code` or `/claude`,
- the user asks for a report and no explicit Codex route is given,
- attachments need local file access,
- the task needs code/file changes in the active project.

Expected report contract:

```text
[voice]
Short spoken summary.
[html] C:\path\to\generated-report.html
```

Claude Code must write the HTML file before returning the path.

### Codex

Codex handles project-aware work when explicitly requested with `/codex` or when it is the selected preferred CLI channel.

Use Codex when:

- the user uses `/codex`,
- preferred CLI is Codex,
- a screenshot/local-file task routes to the preferred CLI and that preference is Codex.

Codex follows the same report contract as Claude Code: write HTML to disk, then return the path.

### GitHub and GitHub Actions

GitHub is used for source control, macOS builds, and release assets.

Expected behavior:

- Never push, commit, tag, upload, or release unless the user explicitly asks.
- Preserve unrelated local changes.
- Use GitHub Actions for macOS packaging because Electron Builder requires macOS for macOS artifacts.
- Windows release ZIP must use the portable EXE, not `win-unpacked/Marvis.exe`.

## Conversation Routing Rules

### Handle with Gemini/DeepSeek

Use the selected bot provider when the user asks for:

- greeting or small talk,
- jokes,
- simple questions,
- short explanations,
- advice or brainstorming that does not need local files,
- ordinary conversation.

The response should stay in chat and be spoken aloud when voice is enabled.

### Delegate to Claude Code/Codex

Delegate when the user asks for:

- code changes,
- debugging in the local project,
- command execution against the project,
- report generation,
- HTML/dashboard creation,
- file creation or file edits,
- screenshot/capture analysis,
- "use Claude Code", "use Codex", `/code`, `/claude`, `/codex`.

### Report and HTML Detection

Treat these as report/HTML requests:

- "make/generate/create/write/prepare a report",
- "put it in report",
- "dashboard",
- "HTML report",
- "visualization",
- "open/show <saved report keyword>",
- `/html <path>`.

For report generation, delegate to Claude Code/Codex. For existing report opening, open the saved panel directly.

## HTML Panel Rules

Use the HTML panel only when:

- a CLI delegate returns `[html] <path>`,
- the user explicitly opens an existing panel with `open`, `show`, or `/open`,
- the user explicitly opens a file with `/html` or `html`.

Do not use the HTML panel when:

- Gemini/DeepSeek returns a long text reply,
- a response contains Markdown,
- a response contains inline HTML,
- the task is simple chat.

Panel rendering must be isolated in an iframe.

## Briefing Content

The briefing should be a useful daily operating snapshot, not generic filler.

Include:

- Greeting using the configured user name when available.
- Weather for the configured geolocation when available.
- Unread email count.
- Urgent unread emails and why they matter.
- Important email content or next actions.
- News briefing items.
- Avatar briefing summary.
- User profile context when useful.

### News Briefing

News items should include:

- headline,
- concise detail,
- source link,
- image URL when available,
- why it matters for the user when profile context is available.

News should be current and source-aware. If the status file is stale, Marvis should not pretend it refreshed the news itself. The app reads whatever is in the status file; external automation is responsible for keeping it fresh.

### Briefing Voice Behavior

Briefing voice should respect:

- Mute setting,
- configured briefing frequency,
- `lastBriefingVoiceAt`,
- per-item voice synchronization for news cards when item arrays are available.

## Settings

Settings should include and preserve:

- AI provider selection: Gemini or DeepSeek.
- API keys: DeepSeek, Gemini, ElevenLabs.
- ElevenLabs voice ID and saved voice list.
- Voice volume.
- Bot name and wake word label.
- Wake word enable/disable.
- Personality prompt.
- Voice briefing frequency.
- Voice phrases for morning, afternoon, evening, and processing.
- User name.
- Music volume.
- Music library, playlists, and schedule.
- User profile and geolocation.
- Avatar style.
- Preferred CLI channel: none, Claude Code, or Codex.
- Active project path.
- Max HTML panels to keep.
- Voice muted and music muted state.

## Packaging and Release Expectations

### Windows

Windows release ZIP layout:

```text
Marvis.exe
data/
  music-library.json
  music/
    ATTRIBUTION.md
    ...
```

Important:

- `Marvis.exe` must be the portable build output, normally `release/Marvis 0.5.0.exe` renamed to `Marvis.exe`.
- Do not package `release/win-unpacked/Marvis.exe` by itself because it depends on nearby DLLs such as `ffmpeg.dll`.

### macOS

macOS release ZIP layout:

```text
Marvis.app/
data/
  music-library.json
  music/
    ATTRIBUTION.md
    ...
```

macOS must be built on a macOS runner through GitHub Actions.

### Release Publishing

Only publish releases when the user explicitly asks to update GitHub/release.

Before publishing:

- run syntax checks for changed JavaScript files,
- run `npm test`,
- build Windows package,
- build macOS package through GitHub Actions,
- verify ZIP layouts,
- verify `data/music-library.json` is present,
- verify Windows ZIP uses portable EXE,
- upload assets with the expected names.
