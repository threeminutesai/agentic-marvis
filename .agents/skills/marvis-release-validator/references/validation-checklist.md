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
- Report generation asks CLI delegates to write an HTML file and return `[html] <path>`.
- HTML panel opens only from explicit file paths or open/show commands.
- `open <keyword>`, `show <keyword>`, and `/open <keyword>` search saved panels.
- `/html <path>` opens a specific HTML file.
- Report HTML renders in an iframe and does not leak CSS into Marvis.
- Crop and close controls stay above report iframe content.
- Attachments route to Claude Code/Codex, not Gemini/DeepSeek.
- Briefing uses status rows, news item arrays, voice frequency, and mute state correctly.
- Settings save and restore provider, API keys, voice, music, profile, CLI, and panel retention values.

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
- `data/music-library.json`
- `data/music/`

Do not package `release/win-unpacked/Marvis.exe` alone. It requires adjacent DLLs such as `ffmpeg.dll`.

Verify:

```powershell
tar -tvf release\Marvis-v0.5.0-win32-x64.zip | Select-String "Marvis.exe|music-library|ATTRIBUTION"
```

### macOS

Use the GitHub Actions workflow `Build macOS Release`.

Verify the downloaded ZIP contains:

- `Marvis.app/`
- `data/music-library.json`
- `data/music/`

### Upload

Use the existing release asset names unless the user asks otherwise:

- `Marvis-v0.5.0-win32-x64.zip`
- `Marvis-v0.5.0-macos-arm64.zip`
- `Marvis-0.5.0-arm64.dmg`

After upload, read the GitHub release back and confirm asset names and sizes.
