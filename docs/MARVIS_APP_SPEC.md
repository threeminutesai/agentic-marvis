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
- The app must not automatically switch the user back to the briefing/status panel a few minutes later while they are chatting.
- TTS speaks the returned answer, not only the first paragraph.
- The Mute button immediately stops voice playback.
- When ElevenLabs TTS is unavailable or out of credits, browser speech is used as fallback.
- Marvis may use a small local summary-memory store to recall relevant past conversations, but it should inject only concise relevant summaries rather than replaying full transcript history.

### Voice Input and Output

Voice input uses the Mic button or wake word flow. Voice output speaks greetings, briefings, processing cues, command confirmations, and assistant replies.

Expected outcome:

- Mic button records and transcribes user speech.
- Mic recording should minimize self-capture by stopping Marvis voice output and pausing active music while recording, then resuming music afterward.
- Mic capture should request echo cancellation, noise suppression, auto gain control, and mono audio when the browser supports those constraints.
- Wake word can trigger a follow-up voice capture when enabled.
- Voice volume applies to TTS playback.
- Music ducks under voice and returns afterward.
- Voice playback must not depend on only a tiny set of sample phrases; any accepted user message can produce spoken returned output.
- On first run, if the status JSON exists but briefing/news fields are still empty, Marvis should still speak a short fallback stage-2 line rather than going silent after the initial greeting.

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
- When a report panel is prepared, the task description is used immediately to derive a searchable title stored in the panel index. After Codex writes the HTML file, the title is injected into the file itself at generation time (promoting any existing `<h1>` or falling back to the task-derived title) so `open <keyword>` can trace it by content title without waiting for the first explicit open.
- HTML panels are named by date and content slug (`YYYYMMDD-slug.html`) and pruned oldest-first by file creation date when the count exceeds the `maxHtmlPanels` setting.

### CLI Delegation

Claude Code and Codex are heavy-lifting channels. They are used when a request needs project files, code changes, file creation, report generation, screenshots, or other work beyond a quick bot reply.

Expected outcome:

- `/code <task>` and `/claude <task>` delegate to Claude Code.
- `/codex <task>` delegates to Codex.
- Plain follow-up chat should not blindly keep using the preferred CLI. Marvis should decide whether the next turn still belongs to the active CLI task or should return to ordinary chat.
- Marvis tracks a managed task session for any CLI channel (`/claude`, `/code`, `/codex`), not just Codex. The session records the channel, objective, recent turns, and whether the last reply had HTML.
- When Gemini routing decides the user is continuing the same CLI task, Marvis should include the recent task context and last result in the next delegation.
- When the user changes topic or clearly concludes the task, the managed session and any open HTML panel should be closed before handling the next turn.
- Delivering an HTML/report result alone does not close the session; the user may follow up immediately on the displayed content.
- If the user clearly requests a report, Marvis delegates to Claude Code by default when no explicit CLI prefix is present.
- If screenshots/captures are attached, Marvis delegates to a CLI channel because the bot API cannot read local files.
- CLI output must be summarized for voice and, when HTML is involved, returned by file path only.
- When the right-side live CLI panel is shown during Codex work, it should display backend CLI stream output rather than duplicating the summarized chat/voice progress text.
- When the user asks a follow-up question about the currently displayed HTML report, Marvis should answer using the HTML content without replacing the panel or showing a new CLI activity panel (quiet follow-up mode). The HTML panel stays visible; the response appears in chat.
- When the user asks something unrelated to the displayed HTML, the panel should close and the new task should start fresh.

### Capture

The panel capture button lets the user select a region of the visible panel and attach the resulting image to the next message.

Expected outcome:

- Capture mode overlays the panel.
- A selected region becomes an attachment chip.
- Attachment-bearing messages route to Claude Code/Codex, not Gemini/DeepSeek.
- Capture and close controls stay above HTML panel content.
- Capture files are named by creation timestamp (`YYYYMMDD-HHMMSS-mmm.png`) and pruned oldest-first by file creation date when the count exceeds the configured limit.

### Music

Marvis can seed, import, organize, and schedule music.

Expected outcome:

- The music library loads from `data/music-library.json`.
- Sample music lives under `data/music`.
- User-imported tracks and playlists can be managed in Settings.
- Music volume is separate from voice volume.
- Music ducks while Marvis speaks.
- The chat-page now-playing `Pause` control pauses the current track in place, and `Play` resumes the same track from the stored position.
- The chat-page `Skip` control advances to the next scheduled track.
- When the user previews a track from Settings, scheduled/background music pauses for the duration of the preview and resumes when the preview ends or is stopped.

## APIs and Integrations

### Gemini

Gemini is a bot API provider for ordinary conversational chat and the intelligent plain-message router for CLI follow-up decisions.

Use Gemini when:

- the user selected Gemini as the provider,
- the message is simple chat, factual Q&A, brainstorming, or a voice-friendly answer,
- no local file access, project edits, screenshot reading, or HTML report generation is required.
- a plain user message needs routing judgment about whether to stay in Marvis chat, route to Claude Code, route to Codex, continue the active CLI task, or close that task session first.
- local summary memory contains relevant prior conversation context that can improve routing or ordinary chat quality (only when no active CLI session exists).

Do not use Gemini for:

- local project edits,
- local screenshots,
- report HTML file creation,
- tasks that must write files to the active project.

### DeepSeek

DeepSeek is another bot API provider for ordinary conversational chat.

Use DeepSeek under the same routing rules as Gemini, based on the selected provider.

### Ollama

Ollama is a local chat provider for ordinary conversational chat when the user wants Marvis to use a model running on the same machine instead of a cloud API.

Use Ollama when:

- the user selected Ollama as the provider,
- an Ollama runtime is reachable at the configured base URL,
- a configured local model name is present,
- the message is simple chat, factual Q&A, brainstorming, or a voice-friendly answer that does not need project delegation.

Do not use Ollama for:

- local project edits by itself,
- screenshot analysis without CLI delegation,
- report HTML generation,
- tasks that must write files to the active project.

### OpenRouter

OpenRouter is a hosted chat provider for ordinary conversational chat when the user wants one API key that can target multiple remote model families through a standard chat-completions interface.

Use OpenRouter when:

- the user selected OpenRouter as the provider,
- an OpenRouter API key is configured,
- a model slug is configured, such as `openai/gpt-4o-mini`,
- the message is simple chat, factual Q&A, brainstorming, or a voice-friendly answer that does not need project delegation.

Do not use OpenRouter for:

- local project edits by itself,
- screenshot analysis without CLI delegation,
- report HTML generation,
- tasks that must write files to the active project.

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
- Speech-to-text requests should bias expected language and important user terms when available, such as English financial vocabulary for finance-related use.
- Non-speech audio event tags returned by STT, such as music, phone, outro, silence, or noise tags, should be removed before routing the transcript.
- If cleanup leaves no usable words, Marvis should ask the user to try again instead of submitting the transcript as chat or a CLI command.
- Bad STT output should not create noisy CLI prefix warnings unless the user actually spoke or typed a slash command.

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

Codex handles project-aware work when explicitly requested with `/codex`, when Gemini decides a plain user message belongs to Codex, or when attachment routing selects Codex.

Use Codex when:

- the user uses `/codex`,
- Gemini judges the plain user message is a new Codex-worthy project task,
- Gemini judges the plain user message is a continuation of the same active Codex task,
- a screenshot/local-file task routes to the preferred CLI and that preference is Codex.

Codex follows the same report contract as Claude Code: write HTML to disk, then return the path.

CLI task-session expectations:

- Marvis keeps a managed task session for any CLI channel (`/claude`, `/code`, `/codex`), not just Codex. Each CLI turn is a fresh process invocation; the session is a renderer-side context window, not a persistent process.
- Continuing CLI work should reuse recent task context and the last result when Gemini marks the next turn as `continue`.
- Returning an HTML/report result does not automatically end the current managed session; the session stays live so the user can immediately follow up with edits, additions, or questions about the delivered result.
- Switching to plain Marvis chat, asking an unrelated question, or the user clearly concluding the task should end the current managed session and close any open HTML panel.
- The Gemini router is responsible for issuing a `close` or `start` session action when the session should end or a new one should begin.

### GitHub and GitHub Actions

GitHub is used for source control, macOS builds, and release assets.

Expected behavior:

- Never push, commit, tag, upload, or release unless the user explicitly asks.
- Preserve unrelated local changes.
- Use GitHub Actions for macOS packaging because Electron Builder requires macOS for macOS artifacts.
- Windows release ZIP must use the portable EXE, not `win-unpacked/Marvis.exe`.

## Conversation Routing Rules

### Intelligent Plain-Message Routing

Plain user messages with no explicit `/code`, `/claude`, or `/codex` prefix should be routed as follows:

- First, handle any hard-coded direct commands such as `/html`, `open`, `show`, mute commands, or status-detail shortcuts.
- If there are screenshot attachments, route to a CLI channel because ordinary bot providers cannot read local files.
- Otherwise, Gemini should decide whether the plain message belongs to normal Marvis chat, Claude Code (`claudeCode`), or Codex (`codex`).
- Gemini returns one of three routes: `marvis`, `claudeCode`, or `codex`.
- Gemini returns one of four session actions: `start`, `continue`, `close`, or `none`.
- `start` means begin a new managed CLI task session (clears any existing HTML panel).
- `continue` means the user is following the same CLI task and Marvis should include recent context in the next delegation.
- `close` means the previous task should be finished or abandoned; clear the session and HTML panel before handling the current message.
- `none` means no session control change is needed.
- When `currentHtmlPath` is set and the user's question clearly relates to the displayed content, Gemini should return `route: "claudeCode", sessionAction: "continue"` to trigger a quiet HTML follow-up (answered from content, panel stays visible).
- When `currentHtmlPath` is set but the user is asking for something unrelated, Gemini should return `route: "claudeCode", sessionAction: "start"` to close the old panel and start a new task.
- If Gemini routing is unavailable, Marvis falls back to the preferred-CLI behavior using the active session's channel.
- Gemini routing receives relevant local memory summaries as soft context only when there is no active CLI session. When an active session is present, the session context takes full priority and memory is excluded from the routing prompt to prevent older memories from overriding current task intent.

### Handle with Gemini/DeepSeek/Ollama

Use the selected bot provider when the user asks for:

- greeting or small talk,
- jokes,
- simple questions,
- short explanations,
- advice or brainstorming that does not need local files,
- ordinary conversation.

The response should stay in chat and be spoken aloud when voice is enabled.

When Gemini is the selected provider, it should also be allowed to act as the plain-message router even if the final answer for that turn is still ordinary Marvis chat rather than a CLI delegation.

### Local Conversation Memory

Marvis may maintain a small fully local conversation-memory store under `data/` for lightweight recall.

Expected behavior:

- Memory storage stays local on disk and does not require an external vector database.
- Memory entries should focus on concise summaries of successful past exchanges rather than full raw transcripts.
- Each memory entry may include a lightweight local vector representation for similarity search.
- Relevant memory summaries may be injected into ordinary Marvis chat prompts and Gemini routing prompts.
- Memory should help with continuity and recall, but Marvis should not present remembered summaries as guaranteed facts if they might be stale or ambiguous.
- HTML/report completions may be remembered as summary outcomes such as "finished with a visual/report result".

Suggested storage layout:

```text
data/
  conversation-memory.json
```

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

### User Profile Metadata

The `User Profile` row may carry metadata in `detail`, including:

- `Geolocation: <place>`
- `Language: English`
- `Language: 中文`

Expected behavior:

- The app should preserve that metadata format when saving profile changes.
- Changing the app language should update the `Language:` value in the status JSON.
- Profile editing should not discard `Language:` metadata when saving geolocation or background text.
- Generated briefing content should follow the language stored in the JSON metadata.

### News Briefing

News Briefing uses parallel string arrays on the status row:

- `value[]` holds one short headline per story.
- `detail[]` holds the matching longer summary for each story.
- `image[]` should hold one thumbnail URL per story when a thumbnail is available.
- `link[]` should hold one source URL per story when available.
- Keep the same item order across all arrays so the renderer can reveal and speak each story news-by-news.
- Do not store objects in these arrays; the renderer expects strings and will show `[object Object]` if objects are written.
- Include a concise "why it matters" angle in each detail string, especially when user profile context is available.
- `detail[]` should not embed raw article URLs when `link[]` is present. Source URLs belong in `link[]`, while `detail[]` should stay readable for both layout and TTS.
- If a thumbnail is unavailable for a story, the UI should still preserve stable card layout with a placeholder treatment rather than collapsing or misaligning the news stack.

News should be current and source-aware. If the status file is stale, Marvis should not pretend it refreshed the news itself. The app reads whatever is in the status file; external automation is responsible for keeping it fresh.

### Briefing Skill Default Target

When the bundled `agentic-marvis-brief` skill is used without an explicit target path:

- first look for `data/marvis-status.json` in the current working directory,
- use it automatically if present and preserve its schema,
- ask the user for a path only if that default file is missing.

This default matters because users are expected to run the CLI from the same folder that contains `Marvis.exe` and the adjacent `data/` directory.

### Briefing Language

Language is stored in two places:
1. **settings.json** - UI language preference
2. **User Profile.detail** - Language metadata for briefing generation (e.g., `Language: English` or `Language: 中文`)

Expected behavior:

- On app startup, if language is not in settings, read from `User Profile.detail` metadata
- When user changes language in settings, sync it to `User Profile.detail` (preserving other metadata like geolocation)
- Briefing generation should read language from `User Profile.detail` and generate content in that language
- Profile editing should not discard the `Language:` metadata when saving geolocation or background text
- Do not let language setting disappear due to initialization or sync failures

This applies to generated content:

- weather summary text,
- unread and urgent email summaries,
- news headlines and news detail blurbs,
- avatar briefing text.

The app should preserve JSON structure and card type names while changing only the generated content language.

### Briefing Voice Behavior

Briefing voice should respect:

- Mute setting,
- status-file content changes,
- `lastBriefingStatusHash`,
- per-item voice synchronization for news cards when item arrays are available.
- Marvis should hash normalized status content and auto-trigger briefing voice only during the greeting/status-load flow when that hash changes and real `News Briefing` item content exists.
- A fallback or avatar-only spoken line with empty news content may still speak during that same stage-2 greeting flow, but it must not mark the current status hash as already briefed.
- After the user has moved into ordinary chat, Marvis should not reopen the briefing/status panel or re-run briefing voice on a background timer.

## Settings

Settings should include and preserve:

- AI provider selection: Gemini, DeepSeek, OpenRouter, or Ollama.
- Provider configuration: DeepSeek key, Gemini key, OpenRouter key, OpenRouter model slug, Ollama base URL, Ollama model, and ElevenLabs key.
- ElevenLabs voice ID and saved voice list.
- Voice volume.
- Bot name and wake word label.
- Wake word enable/disable.
- Personality prompt.
- Voice phrases for morning, afternoon, evening, and processing.
- User name.
- Music volume.
- Music library, playlists, and schedule.
- User profile, geolocation, and language.
- Avatar style.
- Preferred CLI channel: none, Claude Code, or Codex.
- Active project path.
- Max HTML panels to keep.
- Voice muted and music muted state.

Settings should also behave as follows:

- The old briefing frequency setting should not appear.
- A manual `Check for Updates` button should appear in the bottom Settings footer near Save Settings.
- The update check should call GitHub Releases for `threeminutesai/agentic-marvis`, compare the installed app version against the latest release tag, and show a clear up-to-date or update-available message.
- If a newer version exists, Marvis should offer to open the matching download asset or release page in the system browser.
- Marvis should not try to overwrite or replace its own running executable as part of this manual update flow.
- When a preferred CLI is configured, Marvis may warm that CLI in the background after startup, after Settings save, or after project changes to reduce first-use delay.

## Packaging and Release Expectations

### Windows

Windows release ZIP layout:

```text
Marvis.exe
data/
  music-library.json
  music/
    ATTRIBUTION.md
    fassounds-calm-mind-chill-lofi-beat-background-music-259700.mp3
    fatbunny-working-488068.mp3
    johan_benitez99co-day-516015.mp3
    jourinhannah-romance-234850.mp3
    openmindaudio-working-class-country-anthem-worn-hands-538391.mp3
    the_mountain-cosmic-study-143288.mp3
    u_98o9hlkn7r-corporate-financial-success-272259.mp3
skills/
  agentic-marvis-brief/
  agentic-marvis-dashboard/
    scripts/
      extract_excel.py
      diff_extract.py
```

Important:

- `Marvis.exe` must be the portable build output, normally `release/Marvis 0.5.0.exe` renamed to `Marvis.exe`.
- The bundled release `data/` payload should be sourced from `release pack/data/`, especially `release pack/data/music-library.json` and `release pack/data/music/`, rather than from mutable runtime files under the live `data/` folder.
- Do not package `release/win-unpacked/Marvis.exe` by itself because it depends on nearby DLLs such as `ffmpeg.dll`.
- The release ZIP must include the full bundled music pack under `data/music`: `ATTRIBUTION.md` plus all 7 shipped MP3 files listed above.
- The release ZIP must include both bundled skill folders under `skills/`: `agentic-marvis-brief` and `agentic-marvis-dashboard`.
- The dashboard skill includes utility scripts (`extract_excel.py`, `diff_extract.py`) in its own `scripts/` subfolder, which are bundled as part of the skill.
- A release is not valid if `data/music-library.json` is present but one or more of the shipped music files are missing from `data/music`.

### macOS

macOS release ZIP layout:

```text
Marvis.app/
data/
  music-library.json
  music/
    ATTRIBUTION.md
    fassounds-calm-mind-chill-lofi-beat-background-music-259700.mp3
    fatbunny-working-488068.mp3
    johan_benitez99co-day-516015.mp3
    jourinhannah-romance-234850.mp3
    openmindaudio-working-class-country-anthem-worn-hands-538391.mp3
    the_mountain-cosmic-study-143288.mp3
    u_98o9hlkn7r-corporate-financial-success-272259.mp3
skills/
  agentic-marvis-brief/
  agentic-marvis-dashboard/
    scripts/
      extract_excel.py
      diff_extract.py
```

macOS must be built on a macOS runner through GitHub Actions.

The macOS release ZIP should use the same bundled `data/` source of truth as Windows: `release pack/data/music-library.json` and `release pack/data/music/`. Utility scripts are bundled as part of the dashboard skill's own `scripts/` folder.

### Release Publishing

Only publish releases when the user explicitly asks to update GitHub/release.

Before publishing:

- run syntax checks for changed JavaScript files,
- run `npm test`,
- build Windows package,
- build macOS package through GitHub Actions,
- verify ZIP layouts,
- verify `data/music-library.json` is present,
- verify the full bundled `data/music` pack is present: `ATTRIBUTION.md` plus all 7 shipped MP3 files,
- verify both bundled skill folders are present under `skills/`,
- verify Windows ZIP uses portable EXE,
- upload assets with the expected names.
