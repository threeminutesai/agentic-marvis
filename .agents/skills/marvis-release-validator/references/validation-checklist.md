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
- Briefing uses status rows, parallel news string arrays (`value[]`, `detail[]`, thumbnail `image[]`, optional `link[]`), voice frequency, and mute state correctly.
- News detail strings stay readable in the UI and spoken output: if `link[]` is present, raw article URLs should not be left embedded in `detail[]`.
- Missing news thumbnails do not break layout: empty `image[]` entries should still render with a stable placeholder or equivalent visual fallback.
- `User Profile.detail` preserves metadata such as `Geolocation: ... | Language: ...` and language changes update the saved JSON.
- Generated briefing content follows the language stored in the status JSON metadata.
- On first run with an empty or not-yet-filled status JSON, Marvis still speaks a short fallback stage-2 line instead of staying silent after the initial greeting.
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
- `data/music/ATTRIBUTION.md`
- `data/music/fassounds-calm-mind-chill-lofi-beat-background-music-259700.mp3`
- `data/music/fatbunny-working-488068.mp3`
- `data/music/johan_benitez99co-day-516015.mp3`
- `data/music/jourinhannah-romance-234850.mp3`
- `data/music/openmindaudio-working-class-country-anthem-worn-hands-538391.mp3`
- `data/music/the_mountain-cosmic-study-143288.mp3`
- `data/music/u_98o9hlkn7r-corporate-financial-success-272259.mp3`

Do not package `release/win-unpacked/Marvis.exe` alone. It requires adjacent DLLs such as `ffmpeg.dll`.
Do not treat the package as valid if only `music-library.json` is present; the full 7-track bundled music pack must ship inside `data/music`.

Verify:

```powershell
tar -tvf release\Marvis-v0.5.0-win32-x64.zip | Select-String "Marvis.exe|music-library|ATTRIBUTION"
```

Also verify all 7 MP3 filenames are present in the ZIP listing.

### macOS

Use the GitHub Actions workflow `Build macOS Release`.

Verify the downloaded ZIP contains:

- `Marvis.app/`
- `data/music-library.json`
- `data/music/ATTRIBUTION.md`
- all 7 bundled MP3 files under `data/music/`

### Upload

Use the existing release asset names unless the user asks otherwise:

- `Marvis-v0.5.0-win32-x64.zip`
- `Marvis-v0.5.0-macos-arm64.zip`
- `Marvis-0.5.0-arm64.dmg`

After upload, read the GitHub release back and confirm asset names and sizes.
