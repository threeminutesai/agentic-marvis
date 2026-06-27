# RELEASE VALIDATOR CHECKLIST

**Use this checklist BEFORE every release to GitHub. Run each check in order.**

---

## English

### Purpose
Comprehensive checklist to verify app quality, package integrity, and UI completeness before releasing to GitHub.

### How to Use
1. Follow each section in order
2. Check all items as you complete them
3. Do not skip any validation steps
4. If any check fails, stop and fix the issue before continuing

---

## 中文

### 目的
在发布到 GitHub 前验证应用质量、包完整性和 UI 完整性的全面清单。

### 使用方法
1. 按顺序跟随每个部分
2. 完成时检查所有项目
3. 不要跳过任何验证步骤
4. 如果任何检查失败，停止并修复问题后再继续

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

---

## 中文版本 (Chinese Version)

### 快速参考大小目标

```
EXE:  90-150 MB (失败 > 200 MB)
ZIP:  120-180 MB (失败 > 250 MB)
比率: EXE 应该是 ZIP 的 75-85%
```

### 验证步骤概览

1. **预构建验证** - 测试、git 状态、版本检查
2. **构建步骤** - 编译 Windows 版本
3. **大小验证** - 检查 EXE 大小（防止 4 倍膨胀）
4. **打包步骤** - 创建发布 ZIP
5. **ZIP 大小验证** - 验证最终包大小
6. **发布说明** - 验证格式（版本号标题、双语内容）
7. **UI 元素验证** - 检查所有 UI 控件和默认值
8. **GitHub 发布** - 创建和发布版本
9. **清理** - 删除旧版本

### 常见问题修复

| 问题 | 症状 | 解决方案 |
| --- | --- | --- |
| 构建膨胀 | EXE > 200 MB | 使用 stage 构建而不是 portable |
| 缓存问题 | Portable 大 4-5 倍 | `rm -rf node_modules/.cache` 后重新构建 |
| ZIP 中有源代码 | .js 文件在发布中 | 检查 `package.json` `"files"` 数组 |
| 发布说明错误 | 混合语言或无标题 | 使用双语格式、仅版本号标题 |

### 关键检查点

- ✅ EXE 大小：90-150 MB
- ✅ ZIP 大小：120-180 MB
- ✅ 发布标题：仅版本号 (v0.5.2)
- ✅ 发布说明：英文优先，然后中文
- ✅ UI 元素：所有按钮、设置、音乐播放器
- ✅ 默认值：音乐音量 20%、语言选择
- ✅ 无源代码：仅 EXE、数据和技能文件

✅ **在发布前完整运行此清单**

