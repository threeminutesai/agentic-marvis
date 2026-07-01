# Marvis App Spec

This file captures local product and release rules that the Marvis release validator must enforce.

## Wake Word Contract

Wake word mode is opt-in and must only listen when `wakeWordEnabled` is true in saved settings.

Expected runtime behavior:

- Passive listening uses local mic volume detection first; it should not send idle background audio to STT.
- Passive wake capture must include preroll audio so the leading syllable of the wake word is not clipped.
- After speech starts, passive wake capture ends only after user silence, not on a short fixed-duration cutoff.
- Passive wake capture is transcribed with ElevenLabs STT and matched with fuzzy wake-word logic.
- The fuzzy matcher must accept common Marvis STT substitutions such as `mavis`, `maurice`, and `marcus`.
- On a wake match, Marvis speaks a short acknowledgement, then opens the mic automatically for the real command.
- Command capture must auto-stop after about 1 second of post-speech silence.
- Wake-word training in Settings must run three user voice trials, store the STT outputs as learned wake patterns, and allow clearing learned patterns.
- Wake-word training must use the current configured bot name as the spoken training target, not a hardcoded `Marvis` prompt.
- Learned wake-word patterns must apply only to the bot name they were trained for; changing the bot name should require retraining or leave the learned pool inactive.

Validation notes:

- Saying `Marvis` should not commonly clip into tail-only transcripts such as `itch` because preroll audio is required.
- If ElevenLabs STT fails during wake listening, the UI must surface a visible error instead of silently doing nothing.

## HTML Panel And Attachment Contract

Expected runtime behavior:

- When Codex or Claude emits diffs or file output involving `.html` files, the right-side terminal or CLI activity panel must not show the raw HTML body; HTML diff content must be redacted to a compact placeholder such as `[content omitted]`.
- The right-side terminal or CLI activity panel should also hide low-value helper chatter such as bare `exec`, raw shell command invocations, and timing boilerplate like `succeeded in 560ms:` when those lines would only repeat backend implementation details.
- Generated HTML reports should use a title-derived filename under `data/html-panels/` whenever a specific report title is available.
- HTML panel discovery and reopen behavior must use the HTML files themselves plus remembered conversation context; it must not depend on a sidecar `data/html-panels/index.json`.
- For new generated reports, the delegated CLI response should return an explicit `[html]` path to the finished file. The app may reserve the path before delegation, but the CLI should write the HTML directly to that final path and the app should open it from the returned path.
- The report path should not require a placeholder file or a separate post-write finalize/rename step in the common flow.
- The delegated CLI may still include a `[title]` block, but the returned HTML path is the authoritative handoff for opening the panel.
- If the user is viewing an HTML panel and sends a follow-up with attached screenshots, Marvis must keep the current right-side panel visible while the analysis runs.
- Screenshot attachments must still be included in the delegated CLI task even when the right-side panel stays open.
- When a voice transcript is sent together with attached screenshots, the user-visible message should make it clear that images were attached, rather than looking like a voice-only send.

Validation notes:

- A deleted or modified `.html` diff from Codex must not spill full markup into the backend CLI panel, even when stderr arrives in multiple chunks.
- A raw shell line that only says `exec`, prints a full PowerShell command, or only reports that a command succeeded in a short duration should be hidden when a concise higher-level summary is already shown.
- A report saved with a weak temporary or date-like title should be upgraded to a stronger title when the app has a better explicit report title or HTML heading available.
- A report generated through the faster Codex flow should still open correctly when Codex returns only the final `[html]` path and no separate finalize metadata.
- Sending an image-assisted voice request against the current HTML panel should preserve the panel while still analyzing the screenshot and current panel path together.

## Release Packaging Contract

Release artifacts must be built only after syntax checks and tests pass.

Required checks:

```powershell
node --check src\main\main.js
node --check src\main\ipcHandlers.js
node --check src\renderer\renderer.js
node --check src\renderer\preload.js
npm test
```

## Required Packaged Payload

All platform packages must include the app plus the portable data and bundled skills payload:

- `data/music-library.json`
- `data/music/**/*`
- `skills/agentic-marvis-brief/**/*`
- `skills/agentic-marvis-dashboard/**/*`

Before packaging, verify every file referenced by `data/music-library.json` exists under `data/music/`. If a default release music file is missing, restore it from `release pack/data/music/` before rebuilding.

## GitHub Release Target

Before publishing source or release assets, verify the active GitHub account and target repository:

```powershell
gh auth status
gh api user --jq '{login: .login, name: .name, email: .email}'
git remote -v
gh release view v<version> --json tagName,name,isDraft,isPrerelease,assets --jq '{tag: .tagName, name: .name, draft: .isDraft, prerelease: .isPrerelease, assets: [.assets[].name]}'
```

The expected project repository is `threeminutesai/agentic-marvis`.

## Linux Build From Windows

Linux packages should be produced in a Linux environment. From the Windows workspace, use Docker Desktop's Linux engine instead of direct `npm run dist:linux`, because direct Windows builds can fail at the AppImage `mksquashfs` step.

Build method:

```powershell
Start-Process -FilePath 'C:\Program Files\Docker\Docker\Docker Desktop.exe' -WindowStyle Hidden
docker info --format '{{.ServerVersion}} {{.OSType}}/{{.Architecture}}'
docker pull electronuserland/builder:20
$pwdPath = (Get-Location).Path
docker run --rm -v "${pwdPath}:/project" -v /project/node_modules -w /project electronuserland/builder:20 /bin/bash -lc "npm ci && npm run dist:linux -- --publish never"
```

Expected Linux artifacts:

- `release/Marvis-<version>.AppImage`
- `release/agentic-marvis_<version>_amd64.deb`

The `.deb` target requires Linux maintainer metadata in `package.json`:

```json
"linux": {
  "target": ["AppImage", "deb"],
  "category": "Utility",
  "maintainer": "ThreeMinutesAI <threeminutesai@users.noreply.github.com>"
}
```

Validate Linux payload:

```powershell
npx asar list release\linux-unpacked\resources\app.asar | Select-String -Pattern 'music-library|agentic-marvis-brief|agentic-marvis-dashboard'
Get-FileHash -Algorithm SHA256 -LiteralPath 'release\Marvis-<version>.AppImage','release\agentic-marvis_<version>_amd64.deb'
```

## macOS Build

macOS artifacts cannot be built from Windows. `npm run dist:mac` must run on macOS, either on a real Mac or through GitHub Actions `macos-latest`.

If workflow files live under `.github/` and `.github/` is ignored, they must be intentionally force-added and pushed before GitHub can run them:

```powershell
git add -f .github/workflows/<workflow>.yml
git commit -m "ci: add marvis macos release build workflow"
git push
gh workflow run <workflow>.yml --ref main
```

macOS output must include a `.dmg` and a zip containing `Marvis.app`, `data/`, and the bundled `skills/` folders.

## Publish Rule

Only push commits or upload GitHub release assets when the user explicitly asks for GitHub update, push, publish, or release upload.
