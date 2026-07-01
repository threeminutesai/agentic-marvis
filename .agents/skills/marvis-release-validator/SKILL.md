---
name: marvis-release-validator
description: Validate Marvis desktop app behavior, routing, voice, HTML panel handling, briefing content, settings, packaging, GitHub push, and release assets against the project app specification. Use when Codex is asked to verify Marvis functionality, prevent regressions, prepare a Marvis release, update GitHub, push local changes, or replace release assets; only push or publish when the user explicitly asks.
---

# Marvis Release Validator

## Overview

Use this skill to validate Marvis changes against the project contract, then optionally publish source and release assets when the user explicitly requests it.

## Required Context

Read `docs/MARVIS_APP_SPEC.md` before making validation judgments. When the task involves release preparation, GitHub pushing, package validation, or broad regression checks, use the release checklist embedded in this skill file.

## Workflow

1. Inspect `git status --short` and identify only task-relevant changes.
2. Read the app spec and the files touched by the task.
3. Validate behavior against the spec, especially chat routing, TTS, HTML panel isolation, briefing, settings, and release packaging.
   - For briefing validation, confirm Marvis hashes normalized status content and only auto-voices a briefing when a new status hash arrives with real news items.
   - Confirm fallback/avatar-only speech does not mark the current status hash as already briefed when real news items are missing.
   - For provider validation, confirm Ollama can be selected in onboarding and Settings without requiring an API key, and that its base URL and model persist correctly.
   - For the bundled `agentic-marvis-brief` skill, confirm it defaults to `data/marvis-status.json` in the current working directory when no explicit path is provided.
   - For release validation, confirm both `skills/agentic-marvis-brief/` and `skills/agentic-marvis-dashboard/` are included in packaged release artifacts alongside the app and `data/` payload.
   - For CLI output validation, confirm Codex or Claude diff output does not dump raw HTML file contents into the right-side terminal or CLI activity panel; HTML diffs must be collapsed to a redacted summary such as `[content omitted]`.
   - For CLI helper-line validation, confirm the right-side terminal or CLI activity panel hides raw helper chatter such as bare `exec`, full shell command invocations, and timing boilerplate like `succeeded in 560ms:` when those lines do not add user value.
   - For screenshot validation, confirm sending a request with attached screenshots does not replace or close the currently visible right-side HTML panel during analysis.
   - For voice-plus-image validation, confirm a voice transcript sent with pending screenshots still includes the screenshot attachments in the delegated CLI task and the UI makes that combined send obvious to the user.
   - For HTML panel storage validation, confirm generated reports end up with title-based filenames under `data/html-panels/` rather than generic `date-report.html` names when a more specific report title is available.
   - For HTML panel metadata validation, confirm Marvis no longer depends on `data/html-panels/index.json` for panel discovery or reopening.
   - For reopen-history validation, confirm asking to open previous reports works by matching the user request against remembered conversation context plus actual HTML filenames/titles on disk.
4. Run targeted syntax checks for changed JavaScript files and `npm test`.
5. Report failures before publishing. Fix failures when they are in scope.
6. Commit only relevant files when the user asks to update GitHub or publish.
7. Push only when the user explicitly asks to push/update GitHub.
8. Build and upload release assets only when the user explicitly asks to update the release.

## Cross-Platform Release Build Method

Use this method when the user asks for macOS or Linux packages, especially from the Windows Marvis workspace.

### Required GitHub Checks

Run these before creating or uploading release assets:

```powershell
gh auth status
gh api user --jq '{login: .login, name: .name, email: .email}'
git remote -v
gh release view v1.0.0 --json tagName,name,isDraft,isPrerelease,assets --jq '{tag: .tagName, name: .name, draft: .isDraft, prerelease: .isPrerelease, assets: [.assets[].name]}'
```

Confirm the active GitHub account and repository match the intended release target. For the current Marvis project this is expected to be `threeminutesai/agentic-marvis`.

### Shared Release Data Rule

Before packaging, verify `data/music-library.json` does not reference missing files under `data/music/`. If a default release music file is missing, restore it from `release pack/data/music/` before rebuilding. The release payload must include:

- `data/music-library.json`
- `data/music/**/*`
- `skills/agentic-marvis-brief/**/*`
- `skills/agentic-marvis-dashboard/**/*`

### Linux From Windows

Do not rely on direct `npm run dist:linux` from Windows for final Linux artifacts: the AppImage step can fail because Windows cannot execute the Linux `mksquashfs` binary from the electron-builder cache.

Use Docker Desktop's Linux engine instead:

```powershell
Start-Process -FilePath 'C:\Program Files\Docker\Docker\Docker Desktop.exe' -WindowStyle Hidden
docker info --format '{{.ServerVersion}} {{.OSType}}/{{.Architecture}}'
docker pull electronuserland/builder:20
$pwdPath = (Get-Location).Path
docker run --rm -v "${pwdPath}:/project" -v /project/node_modules -w /project electronuserland/builder:20 /bin/bash -lc "npm ci && npm run dist:linux -- --publish never"
```

Expected Linux outputs:

- `release/Marvis-<version>.AppImage`
- `release/agentic-marvis_<version>_amd64.deb`

If the `.deb` target fails with "Please specify author email", add a Linux maintainer field in `package.json`:

```json
"linux": {
  "target": ["AppImage", "deb"],
  "category": "Utility",
  "maintainer": "ThreeMinutesAI <threeminutesai@users.noreply.github.com>"
}
```

After Linux build, validate:

```powershell
npm test
npx asar list release\linux-unpacked\resources\app.asar | Select-String -Pattern 'music-library|agentic-marvis-brief|agentic-marvis-dashboard'
Get-FileHash -Algorithm SHA256 -LiteralPath 'release\Marvis-<version>.AppImage','release\agentic-marvis_<version>_amd64.deb'
```

### macOS

`npm run dist:mac` cannot produce macOS artifacts on Windows. It must run on macOS, normally via GitHub Actions `macos-latest` or a real Mac.

If `.github/` is ignored locally, GitHub will not see workflow files unless they are force-added and pushed intentionally:

```powershell
git add -f .github/workflows/<workflow>.yml
git commit -m "ci: add marvis macos release build workflow"
git push
gh workflow run <workflow>.yml --ref main
```

macOS workflow output should include a `.dmg` and a zip containing `Marvis.app`, `data/`, and both bundled `skills/` folders. Do not claim macOS is built unless the GitHub Actions run or a real Mac build has produced artifacts.

## Routing Rules To Protect

- Use Gemini, DeepSeek, or Ollama for ordinary chat based on the selected provider.
- Use Claude Code/Codex for project work, local files, screenshots, code edits, and report generation.
- Open the HTML panel only from `[html] <path>`, `/html <path>`, `html <path>`, `open <keyword>`, `show <keyword>`, or `/open <keyword>`.
- When screenshots are attached for a follow-up on the current panel, preserve the visible right-side HTML panel instead of swapping it to a CLI activity view.
- Never convert long bot replies, Markdown, inline HTML, or `[content]` blocks into report panels.
- Never stream raw HTML diff bodies or full HTML file contents into the backend CLI panel; redact them before display.
- Hide raw CLI helper chatter such as `exec`, full shell command lines, and plain timing boilerplate when a shorter summary already represents the same action.
- Store generated HTML reports with a title-derived filename when possible, and treat the HTML file itself as the source of truth instead of a sidecar `index.json`.
- Speak returned chat replies fully unless muted.

## Release Safety

Preserve unrelated local changes. Never package `release/win-unpacked/Marvis.exe` as the standalone Windows release executable; use the portable build `release/Marvis 0.5.0.exe` renamed to `Marvis.exe`.
