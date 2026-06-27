# RELEASE VALIDATOR CHECKLIST

**Use this checklist BEFORE every release to GitHub. Run each check in order.**

---

## Pre-Build Verification

- [ ] Tests pass: `npm test`
- [ ] No uncommitted changes: `git status --short`
- [ ] Latest commit pushed: `git log -1 --oneline`
- [ ] Verify package.json version is correct

## Build Step

- [ ] Clean previous builds: `rm -rf release/ dist/ node_modules/.cache`
- [ ] Build Windows: `npm run dist:win`

## Size Validation (Catch 4x Bloat)

**After build completes, CHECK SIZES BEFORE PACKAGING:**

- [ ] Portable EXE size check:
  ```
  ls -lh "release/Marvis 0.5.1.exe"
  ```
  - ✅ Expected: 90-150 MB
  - ❌ FAIL if > 200 MB (use stage build instead)

- [ ] Compare with stage build:
  ```
  ls -lh "release/stage/Marvis.exe"
  ```
  - If portable > stage by 3-5x, use stage build:
    ```
    cp release/stage/Marvis.exe "release/Marvis 0.5.1.exe"
    ```

- [ ] Size vs previous release (±20% acceptable)
  - v0.5.1 was ~99 MB
  - v0.5.2 should be ~100-120 MB

## Packaging Step

- [ ] Run packaging script: `powershell -File scripts/package-win-release.ps1`
- [ ] ZIP created: `release/Marvis-v*.zip` exists

## ZIP Size Validation

- [ ] ZIP size check:
  ```
  ls -lh release/Marvis-v*.zip
  ```
  - ✅ Expected: 120-180 MB
  - ❌ FAIL if > 250 MB

- [ ] Verify ZIP contents:
  ```
  unzip -l release/Marvis-v*.zip | grep -E "Marvis.exe|extract_excel|diff_extract|music-library"
  ```
  - [ ] Marvis.exe present (~99 MB)
  - [ ] extract_excel.py present
  - [ ] diff_extract.py present
  - [ ] music-library.json present
  - [ ] ❌ NO .js, .py, .ts source files at top level

## Release Notes Validation

- [ ] Title is version only: `v0.5.2` (NOT "v0.5.2 - Description")
- [ ] Notes are bilingual:
  - [ ] English section first
  - [ ] 中文 section second
  - [ ] Clear dividers between languages
- [ ] Contents documented:
  - [ ] What's included (EXE, music, skills)
  - [ ] No source code included
  - [ ] Skills with bundled scripts listed

## GitHub Release

- [ ] Create release (not draft):
  ```
  gh release create v0.5.2 "release/Marvis-v*.zip" --title "v0.5.2" --notes "..."
  ```

- [ ] Verify on GitHub:
  - [ ] Version number correct
  - [ ] Asset uploaded and correct size (~130 MB)
  - [ ] Release notes bilingual
  - [ ] No previous version in "Latest"

## UI Elements Validation

**Run the app locally and verify all UI elements are present and functional:**

### Main Interface
- [ ] Chat input bar present and functional
- [ ] Mic button present and clickable
- [ ] Mute button present and toggles audio
- [ ] Avatar displays and animates correctly
- [ ] Status panel visible and updates
- [ ] HTML panel for reports opens correctly

### Music Player
- [ ] Music player controls visible (play, pause, skip, volume)
- [ ] Music volume slider present
- [ ] Playlist selector works
- [ ] Music preview pauses when recording

### Settings Panel
- [ ] All settings fields visible and editable:
  - [ ] API key inputs (Deepseek, Gemini, etc.)
  - [ ] STT provider selection
  - [ ] TTS provider selection
  - [ ] Avatar selection
  - [ ] Music settings (library, schedule)
  - [ ] Geolocation input
  - [ ] Language selector (English/中文)
  - [ ] Project path input
  - [ ] CLI channel preference
- [ ] Settings save button works
- [ ] Settings load/persist on app restart

### Onboarding Screen
- [ ] Welcome message displays
- [ ] Profile template options present:
  - [ ] At least 3-5 profile templates
  - [ ] Custom profile text input option
- [ ] Geolocation input present
- [ ] Language selector present (English/中文)
- [ ] Step back/forward buttons work
- [ ] Completion leads to main app

### Default Settings Values
- [ ] Music volume: **20** (NOT 50)
- [ ] Max HTML panels: 50
- [ ] Default language: English
- [ ] Default avatar: Rings or Brain
- [ ] STT provider: Browser (or configured)
- [ ] TTS provider: ElevenLabs or Browser fallback
- [ ] Default profile: Robotics educator text
- [ ] Default geolocation: Washington
- [ ] CLI channel: None (or last used)

### Status Panel Content
- [ ] User Profile displays with correct format
- [ ] Weather card shows (or "unavailable")
- [ ] Unread emails count displays
- [ ] Urgent emails section present
- [ ] News briefing shows headlines and images
- [ ] Avatar briefing displays spoken text
- [ ] Last updated timestamp shows

### Voice/Audio Features
- [ ] Voice output works when TTS enabled
- [ ] Voice stops when mute clicked
- [ ] Music ducks under voice output
- [ ] Wake word trigger (if enabled) works
- [ ] Greeting voice plays on startup

## Post-Release Cleanup

- [ ] Remove old release (if applicable):
  ```
  gh release delete v0.5.1 --yes
  ```

- [ ] Verify new release is "Latest"
- [ ] Test download and run Windows ZIP locally
- [ ] Verify all UI elements in running app match checklist above

---

## Validation History

| Version | Date | EXE Size | ZIP Size | Status |
| --- | --- | --- | --- | --- |
| v0.5.2 | 2026-06-27 | 99 MB (fixed) | 130 MB ✅ | PASS (4x bloat caught & fixed) |
| v0.5.1 | 2026-06-27 | 99 MB | 130 MB | ✅ |
| v0.5.0 | 2026-06-24 | ~99 MB | ~100 MB | ✅ |

---

## Common Issues & Fixes

| Issue | Symptom | Fix |
| --- | --- | --- |
| Build bloat | EXE > 200 MB | Use `release/stage/Marvis.exe` instead |
| Cache issue | Portable 4-5x larger than stage | `rm -rf node_modules/.cache` then rebuild |
| Source in ZIP | .js files in release | Check `package.json` `"files"` array |
| Size not matching | ZIP >> expected | Rebuild with clean cache |
| Release notes wrong | Mixed languages or no title | Use bilingual format, version-only title |

---

## Quick Reference Size Targets

```
EXE:  90-150 MB (FAIL > 200 MB)
ZIP:  120-180 MB (FAIL > 250 MB)
Ratio: EXE should be 75-85% of ZIP
```

✅ **Run this checklist start-to-finish before releasing**

