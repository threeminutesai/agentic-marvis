---
name: marvis-release-validator
description: Validate Marvis desktop app behavior, routing, voice, HTML panel handling, briefing content, settings, packaging, GitHub push, and release assets against the project app specification. Use when Codex is asked to verify Marvis functionality, prevent regressions, prepare a Marvis release, update GitHub, push local changes, or replace release assets; only push or publish when the user explicitly asks.
---

# Marvis Release Validator

## Overview

Use this skill to validate Marvis changes against the project contract, then optionally publish source and release assets when the user explicitly requests it.

## Required Context

Read `docs/MARVIS_APP_SPEC.md` before making validation judgments. Read `references/validation-checklist.md` when the task involves release preparation, GitHub pushing, package validation, or broad regression checks.

## Workflow

1. Inspect `git status --short` and identify only task-relevant changes.
2. Read the app spec and the files touched by the task.
3. Validate behavior against the spec, especially chat routing, TTS, HTML panel isolation, briefing, settings, and release packaging.
4. Run targeted syntax checks for changed JavaScript files and `npm test`.
5. Report failures before publishing. Fix failures when they are in scope.
6. Commit only relevant files when the user asks to update GitHub or publish.
7. Push only when the user explicitly asks to push/update GitHub.
8. Build and upload release assets only when the user explicitly asks to update the release.

## Routing Rules To Protect

- Use Gemini/DeepSeek for ordinary chat.
- Use Claude Code/Codex for project work, local files, screenshots, code edits, and report generation.
- Open the HTML panel only from `[html] <path>`, `/html <path>`, `html <path>`, `open <keyword>`, `show <keyword>`, or `/open <keyword>`.
- Never convert long bot replies, Markdown, inline HTML, or `[content]` blocks into report panels.
- Speak returned chat replies fully unless muted.

## Release Safety

Preserve unrelated local changes. Never package `release/win-unpacked/Marvis.exe` as the standalone Windows release executable; use the portable build `release/Marvis 0.5.0.exe` renamed to `Marvis.exe`.
