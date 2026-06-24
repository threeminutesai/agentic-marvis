# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2026-06-24

### Added
- **HTML Panel Search Feature** - Local fuzzy matching search for HTML files
  - Search HTML files in `html-panels` folder by keyword
  - Priority-based matching: exact > substring > fuzzy
  - Voice command support: `open <keyword>` or `/open <keyword>`
  - Examples: `open financial`, `open Q2`, `open report`

- **Safe HTML Display** - Isolated iframe rendering
  - Prevents CSS/script conflicts that corrupted UI
  - Sandboxed environment for third-party HTML
  - Maintains security while allowing JavaScript execution
  - Clean, consistent visual appearance

### Fixed
- **UI Corruption Bug** - HTML files with problematic CSS no longer break main interface
- **Search Result Sorting** - Fixed inverted sorting logic that opened wrong files
- **Substring Match Filtering** - Substring matches now work even with low fuzzy similarity

### Technical Details
- Implemented Levenshtein distance algorithm for fuzzy string matching
- Added `showHTMLSafe()` function for secure HTML rendering
- Updated IPC handlers: `html-panel:search`, `html-panel:openByKeyword`
- Enhanced command parsing in renderer for natural language interaction

### Files Modified
- `src/main/ipcHandlers.js` - Search algorithms and IPC handlers
- `src/renderer/preload.js` - New IPC APIs exposed
- `src/renderer/renderer.js` - Command parsing and safe display
- `src/renderer/statusPanel.js` - Secure iframe display function

## [0.1.0] - Initial Release

### Features
- Dashboard-oriented interface for Jarvis
- Integration with Claude Code and Codex
- Status panel display system
- Music library management
- Voice synthesis and transcription
- HTML panel rendering
- Settings persistence
