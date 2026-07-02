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
   - For message-flow validation, treat `docs/validation/marvis-message-flow.html` as the authoritative routing diagram and confirm implementation still matches its top-down contract: user message -> decision layer -> action layer.
   - For saved-report routing validation, confirm explicit `/html <path>` and `html <path>` requests open the HTML panel locally without delegating to Codex or Claude Code.
   - For report-open command validation, confirm `/open <keyword>` remains a hard local command that fuzzy-searches saved reports and opens the best match locally.
   - For natural-language report-open validation, confirm phrases like `open previous report`, `open latest report`, `打开之前的报告`, and similar reopen wording are resolved before heavy-agent delegation and can open locally.
   - For intent-fallback validation, confirm natural-language recent/latest report-open requests still open locally when the internal intent resolver is unavailable, returns non-JSON, or returns `none`, by using the built-in lightweight heuristic fallback instead of spilling into Codex.
   - For non-hijack validation, confirm phrases like `open browser`, opening a website/app/folder, or generating a new report are not misclassified as saved-report reopening.
   - For action-domain validation, confirm saved-report decisions map only to local actions such as `recent`, `latest`, and `keyword`, while non-report decisions continue through ordinary chat or external-agent routing as appropriate.
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
   - For the faster Codex report flow, confirm the app can reserve a final path, let Codex write the HTML directly there, and open the returned `[html]` path without requiring a placeholder file or a separate finalize/rename pass in the common case.
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
- Validate message handling against the reference flow in `docs/validation/marvis-message-flow.html`.
- The routing contract is top-down: user message -> decision layer -> action layer.
- Open the HTML panel only from `[html] <path>`, `/html <path>`, `html <path>`, `/open <keyword>`, or a saved-report local-open decision that came from the internal intent resolver or its local fallback.
- Treat `/open <keyword>` as a hard local command for saved-report fuzzy search.
- Natural-language reopen requests such as `open previous report` or `打开之前的报告` should be intercepted locally only when classified as saved-report intent, or when the recent/latest heuristic fallback matches after resolver failure.
- If the user means browser/site/app/folder opening or new report generation, do not hijack the request into saved-report local open.
- When screenshots are attached for a follow-up on the current panel, preserve the visible right-side HTML panel instead of swapping it to a CLI activity view.
- Never convert long bot replies, Markdown, inline HTML, or `[content]` blocks into report panels.
- Never stream raw HTML diff bodies or full HTML file contents into the backend CLI panel; redact them before display.
- Hide raw CLI helper chatter such as `exec`, full shell command lines, and plain timing boilerplate when a shorter summary already represents the same action.
- Store generated HTML reports with a title-derived filename when possible, and treat the HTML file itself as the source of truth instead of a sidecar `index.json`.
- When validating the newer Codex report path, treat the returned `[html]` file path as authoritative; the app may reserve that path up front but should not require the CLI to emit a separate finalize metadata step to be considered correct.
- Speak returned chat replies fully unless muted.

## Release Safety

Preserve unrelated local changes. Never package `release/win-unpacked/Marvis.exe` as the standalone Windows release executable; use the portable build `release/Marvis 0.5.0.exe` renamed to `Marvis.exe`.

## Manual Test Script

Use this script when validating message flow and saved-report opening before release.

### Setup

1. Launch Marvis with an existing `data/html-panels/` folder.
2. Confirm there is at least:
   - one recently generated report
   - one older report with a recognizable topic in the filename or HTML title
3. Open one saved report in the right-side HTML panel before starting the routing checks.

### Step-By-Step Checks

1. **Direct path open**
   - Send: `/html C:\full\path\to\report.html`
   - Expect:
     - the requested HTML opens locally
     - the right-side panel shows the report
     - no Codex or Claude delegation is triggered

2. **Hard keyword open**
   - Send: `/open malaysia`
   - Expect:
     - Marvis fuzzy-searches saved reports locally
     - the best match opens
     - no heavy-agent reply appears

3. **Natural-language recent reopen**
   - Send: `open previous report`
   - Expect:
     - Marvis resolves this as saved-report reopening
     - it opens locally from recent history
     - it does not fall through to Codex or Claude Code text output

4. **Natural-language latest reopen**
   - Send: `open latest report`
   - Expect:
     - Marvis opens the newest saved report locally
     - no heavy-agent delegation is used unless the local open actually fails

5. **Chinese recent reopen**
   - Send: `打开之前的报告`
   - Expect:
     - same behavior as the English recent reopen
     - local panel open, not heavy-agent delegation

6. **Specific-topic natural-language reopen**
   - Send: `打开马来西亚那份报告` or `open the Malaysia report`
   - Expect:
     - Marvis treats this as saved-report intent
     - it opens the best topic match locally
     - if no good match exists, the app shows a local no-match style failure instead of pretending the report opened

7. **Non-report open should not hijack**
   - Send: `open browser`
   - Expect:
     - Marvis does not classify this as a saved-report open
     - it does not open an unrelated report
     - it stays in the normal browser/external/chat path

8. **New report request should not hijack**
   - Send: `近日新闻 生成报告`
   - Expect:
     - Marvis routes to Codex or Claude Code for generation
     - it does not reopen an old local report by mistake

9. **Current panel plus screenshots**
   - Keep an HTML report open on the right
   - Attach a screenshot and ask a follow-up question about the current report
   - Expect:
     - the current right-side HTML panel stays visible
     - the delegated task still includes the screenshot attachment and current HTML context

10. **CLI output cleanliness during report work**
    - Trigger a report-generation or report-editing task through Codex or Claude
    - Expect:
      - raw HTML bodies are not dumped into the CLI activity panel
      - helper chatter like bare `exec`, full shell commands, and low-value timing boilerplate stays hidden or redacted

### Pass Criteria

- Direct and natural-language report reopen requests open locally when they should.
- Browser or new-generation requests are not misclassified as report reopen actions.
- Failed intent resolution does not cause simple recent/latest reopen requests to spill into Codex when a local heuristic fallback should handle them.
- The visible HTML panel remains stable during screenshot-assisted follow-up analysis.
- CLI activity stays readable and does not leak raw HTML content.
