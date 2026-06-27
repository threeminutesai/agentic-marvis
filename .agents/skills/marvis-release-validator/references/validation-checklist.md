# Marvis Validation Checklist

Use this checklist when validating Marvis changes, especially before pushing or replacing release assets.

## Always Read

- `docs/MARVIS_APP_SPEC.md`
- Current changed files from `git status --short`
- Any files directly related to the user request

## Functional Checks

- Normal chat remains in the chat column and does not open the HTML panel.
- Chat history remains scrollable when enough messages accumulate.
- Normal chat TTS speaks the returned message, not only the first paragraph.
- TTS falls back to browser speech if ElevenLabs fails.
- `/code`, `/claude`, and `/codex` delegate to the correct CLI.
- Plain messages without a CLI prefix should not blindly reuse the preferred CLI; Gemini routing should decide whether the next turn belongs to ordinary chat or Codex.
- If Gemini decides to continue Codex, the next Codex delegation should carry recent task context instead of acting like a blank new topic.
- If Gemini decides a topic changed, or if Codex has just delivered HTML/report output, the managed Codex task session should close before the next plain-message routing decision.
- Local conversation memory should stay on disk in a small app-managed store and should save concise summaries rather than full transcript dumps.
- Relevant local memory summaries should be available to normal Marvis chat and Gemini routing, but stale memory should not override the latest user turn.
- Report generation asks CLI delegates to write an HTML file and return `[html] <path>`.
- HTML panel opens only from explicit file paths or open/show commands.
- `open <keyword>`, `show <keyword>`, and `/open <keyword>` search saved panels.
- `/html <path>` opens a specific HTML file.
- Report HTML renders in an iframe and does not leak CSS into Marvis.
- Crop and close controls stay above report iframe content.
- Attachments route to Claude Code/Codex, not Gemini/DeepSeek.
- Briefing uses status rows, parallel news string arrays (`value[]`, `detail[]`, thumbnail `image[]`, optional `link[]`), and mute state correctly.
- News detail strings stay readable in the UI and spoken output: if `link[]` is present, raw article URLs should not be left embedded in `detail[]`.
- Missing news thumbnails do not break layout: empty `image[]` entries should still render with a stable placeholder or equivalent visual fallback.
- `User Profile.detail` preserves metadata such as `Geolocation: ... | Language: ...` and language changes update the saved JSON.
- Generated briefing content follows the language stored in the status JSON metadata.
- On first run with an empty or not-yet-filled status JSON, Marvis still speaks a short fallback stage-2 line instead of staying silent after the initial greeting.
- Marvis hashes normalized status content and auto-triggers briefing voice only during greeting/status-load when the status hash changes and real `News Briefing` items exist.
- Fallback or avatar-only briefing speech with empty news content must not update the remembered briefed status hash.
- After the user is in ordinary chat, Marvis must not reopen the briefing/status panel on a background timer.
- Ollama appears as a first-run and Settings provider option, does not require an API key, and persists its base URL and model.
- OpenRouter appears as a first-run and Settings provider option, uses an API key, and persists its selected model slug.
- The bundled `agentic-marvis-brief` skill should default to `data/marvis-status.json` in the current working directory when no path is provided, and only ask for a path if that file is missing.
- Settings save and restore provider, API keys, voice, music, profile, CLI, and panel retention values.
- The chat-page now-playing `Pause` control must hold the current music track and resume from the same position; only `Skip` should advance to the next track.
- Settings music preview must pause background scheduled music while preview audio is playing and resume background playback when preview stops or ends.
- Settings must not show the old briefing frequency control.
- Settings includes a manual `Check for Updates` button at the bottom footer.
- `Check for Updates` compares the installed app version with the latest GitHub release for `threeminutesai/agentic-marvis`.
- When an update exists, Marvis should offer to open the release asset or release page in the system browser instead of trying to self-replace the running app.
- When no update exists, Marvis should clearly report that the installed version is already current.
- If a preferred CLI is configured, background warm-up may happen after startup/settings save/project change, but the validator should distinguish this from a true always-open CLI session.

## Required Local Verification

Run checks relevant to the changed files:

```powershell
node --check .\src\renderer\renderer.js
node --check .\src\renderer\statusPanel.js
node --check .\src\renderer\voice\ttsController.js
npm test
```

Skip only checks for files that do not exist or were not touched, and explain why.

## Validation Report

For any validation pass, create or update a concise Markdown report under `docs/validation/`.

Include:

- date/time,
- validation scope,
- summary table with pass/fail/not applicable rows,
- checklist table with requirement, status, and notes,
- commands run,
- residual risks or manual checks not performed.

Use statuses consistently:

- `Pass`
- `Fail`
- `Not applicable`
- `Not manually verified`

## Git Rules

- Commit only files relevant to the task.
- Preserve unrelated local changes.
- Never use destructive reset/checkout commands unless the user explicitly asks.
- Never push unless the user explicitly says to push/update GitHub.

## Release Rules

Release only when the user explicitly asks to update a release or publish assets.

### Windows

Build:

```powershell
npm run dist:win -- --publish never
```

Package the ZIP with:

- `release/Marvis 0.5.0.exe` copied/renamed as `Marvis.exe`
- bundled `data/music-library.json` from `release pack/data/music-library.json`
- bundled `data/music/*` from `release pack/data/music/`
- `skills/agentic-marvis-brief/**/*`
- `skills/agentic-marvis-dashboard/**/*`

Do not package `release/win-unpacked/Marvis.exe` alone. It requires adjacent DLLs such as `ffmpeg.dll`.
Do not treat the package as valid if only `music-library.json` is present; the full 7-track bundled music pack must ship inside `data/music`.
Do not treat the package as valid if either bundled Marvis skill folder is missing from `skills/`.

Verify:

```powershell
tar -tvf release\Marvis-v0.5.0-win32-x64.zip | Select-String "Marvis.exe|music-library|ATTRIBUTION"
```

Also verify all 7 MP3 filenames are present in the ZIP listing.

### macOS

Use the GitHub Actions workflow `Build macOS Release`.

Verify the downloaded ZIP contains:

- `Marvis.app/`
- bundled `data/music-library.json` from `release pack/data/music-library.json`
- bundled `data/music/*` from `release pack/data/music/`
- `skills/agentic-marvis-brief/`
- `skills/agentic-marvis-dashboard/`

### Upload

Use the existing release asset names unless the user asks otherwise:

- `Marvis-v0.5.0-win32-x64.zip`
- `Marvis-v0.5.0-macos-arm64.zip`
- `Marvis-0.5.0-arm64.dmg`

After upload, read the GitHub release back and confirm asset names and sizes.
