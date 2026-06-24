# Agentic Jarvis v0.2.0 - Release Manifest

## 🚀 Release Information

**Version:** 0.2.0  
**Release Date:** 2026-06-24  
**Status:** Production Ready  
**GitHub Release:** https://github.com/threeminutesai/agentic-jarvis/releases/tag/v0.2.0

---

## 📦 What's Included

### Downloadable from GitHub Release

**File:** `Jarvis 0.2.0.exe` (97.4 MB)
- Portable Windows executable
- No installation required
- All code and dependencies included
- Ready to run immediately

### Built Into the EXE

The executable includes:
- ✅ All application source code
- ✅ Electron framework
- ✅ HTML panel search feature
- ✅ Safe iframe display
- ✅ Music library configuration
- ✅ All settings and default data

---

## 📂 What You Get After Installation

When you run `Jarvis 0.2.0.exe`, it creates:

```
C:\Users\YourUsername\AppData\Local\jarvis\data\
├── jarvis-status.json (status board data)
├── settings.json (user settings)
├── music-library.json (7 pre-configured tracks)
├── .env (API keys - create on first run)
├── music/ (7 MP3 tracks - 27.9 MB)
│   ├── fatbunny-working-488068.mp3
│   ├── johan_benitez99co-day-516015.mp3
│   ├── u_98o9hlkn7r-corporate-financial-success-272259.mp3
│   ├── jourinhannah-romance-234850.mp3
│   ├── the_mountain-cosmic-study-143288.mp3
│   ├── fassounds-calm-mind-chill-lofi-beat-background-music-259700.mp3
│   ├── openmindaudio-working-class-country-anthem-worn-hands-538391.mp3
│   └── ATTRIBUTION.md
├── html-panels/ (store dashboards here)
│   └── _template.html (auto-generated)
├── voice-cache/ (TTS audio cache)
└── captures/ (screenshot captures)
```

---

## 🎵 Music Library

### Pre-Loaded (7 Tracks)

All included automatically:

| Track | Artist | Duration | Slot |
|-------|--------|----------|------|
| Day | Johan Benitez | ~3:30 | Early Morning |
| Working | FatBunny | ~3:30 | Morning |
| Corporate Financial Success | Corporate Music | ~3:00 | Afternoon |
| Romance | Jorin Hannah | ~4:00 | Evening |
| Cosmic Study | The Mountain | ~3:30 | Midnight |
| Calm Mind - LoFi Beat | Fassounds | ~3:30 | Weekend |
| Working Class Country Anthem | Open Mind Audio | ~3:30 | Weekend |

**Total Size:** 27.9 MB  
**License:** Pixabay Free (commercial use allowed)

### How to Access

1. Launch Jarvis
2. Go to Settings → Music
3. View library (all 7 tracks visible)
4. Configure schedule by day/time
5. Enable/disable music playback

### Credits & Attribution

**File:** Located in app at `data/music/ATTRIBUTION.md`

**Includes:**
- Full artist credits for all 7 tracks
- Direct Pixabay source links
- License information
- 6 recommended additional tracks
- How to add more music

---

## 📊 System Requirements

### Minimum
- Windows 7+ (64-bit)
- 100 MB free disk space (for app)
- 50 MB additional (for music cache)
- 1 GB RAM
- Network connection (for API keys)

### Recommended
- Windows 10/11
- 500 MB free disk space
- 2+ GB RAM
- Broadband connection

---

## 🎯 First Run Setup

### Step 1: Download
- Download `Jarvis 0.2.0.exe` from GitHub release
- Save to desired location (e.g., Desktop)

### Step 2: Run
- Double-click `Jarvis 0.2.0.exe`
- Windows may show security warning (expected)
- Application launches

### Step 3: Configure (First Launch Only)
- Set API key (DeepSeek or Gemini)
- Set active project folder (optional)
- Verify music library loads

### Step 4: Use
- Start chatting immediately
- Try: `open financial` to test dashboard search
- Access Settings → Music to configure playback

---

## ✨ Key Features

### HTML Panel Search
```
User Input: "open financial"
↓
Local fuzzy search in html-panels folder
↓
Finds: "Q2 financial report.html"
↓
Displays in safe iframe (no UI corruption)
```

### Safe Display
```
HTML file contains: problematic CSS
↓
Rendered in sandboxed iframe
↓
CSS isolated from main app
↓
Main UI protected from corruption
```

### Music System
```
7 pre-configured tracks
↓
Schedule by day of week
↓
Time-based playback (5 AM to midnight)
↓
Ducks under voice (automatic volume down)
```

---

## 📋 What's Different from v0.1.0

### Added in v0.2.0
- ✅ HTML panel search with fuzzy matching
- ✅ Safe iframe display for HTML rendering
- ✅ 7 pre-loaded music tracks
- ✅ Music scheduling system
- ✅ Local search (no cloud API)
- ✅ Comprehensive documentation

### Fixed in v0.2.0
- ✅ UI corruption from HTML files
- ✅ Search result sorting
- ✅ Over-filtering of matches

### Unchanged
- Chat interface
- Settings system
- CLI delegation (Claude Code/Codex)
- Voice synthesis (TTS)
- Status panel display

---

## 🔧 Troubleshooting

### Music Not Playing
1. Check Settings → Music (should show 7 tracks)
2. Verify volume slider is not at 0
3. Check system volume is on
4. Try a different track

### HTML Files Won't Open
1. Place HTML files in: `data/html-panels/`
2. Try exact filename: `open "filename"`
3. Or use keyword search: `open keyword`
4. Check file is valid HTML

### API Key Issues
1. Go to Settings
2. Select provider (DeepSeek or Gemini)
3. Enter valid API key
4. Click "Test Connection"
5. Should see success message

---

## 📚 Documentation

All docs available in GitHub repository:

| File | Purpose |
|------|---------|
| README.md | Main guide |
| CHANGELOG.md | Version history |
| docs/MUSIC_EXPANSION_GUIDE.md | Add 6 more tracks |
| docs/DASHBOARD_SKILL.md | Dashboard usage |
| docs/BRIEF_SKILL.md | Briefing system |
| data/music/ATTRIBUTION.md | Music credits |

---

## 🌐 Repository Access

**GitHub:** https://github.com/threeminutesai/agentic-jarvis

**Clone for Development:**
```bash
git clone https://github.com/threeminutesai/agentic-jarvis.git
cd agentic-jarvis
npm install
npm start
```

**Note:** Cloning includes music files and configuration.

---

## ✅ Verification Checklist

Before using v0.2.0, verify:

- [ ] Downloaded from correct GitHub release (v0.2.0)
- [ ] EXE filename is "Jarvis 0.2.0.exe"
- [ ] File size is approximately 97 MB
- [ ] Runs without errors on first launch
- [ ] Settings panel loads
- [ ] Music library shows 7 tracks
- [ ] Can search for HTML panels

---

## 🎉 Ready to Use

v0.2.0 is production-ready and includes:

✅ All source code  
✅ Music library (7 tracks)  
✅ HTML panel search  
✅ Safe display system  
✅ Complete documentation  
✅ No additional setup needed  

**Just download and run!**

---

## 📞 Support

For issues or questions:
1. Check GitHub Issues
2. Review documentation in `docs/`
3. Check CHANGELOG for known issues
4. See README for troubleshooting

---

**Version:** 0.2.0  
**Status:** ✅ Production Ready  
**Release Date:** 2026-06-24  
**Platform:** Windows (64-bit)
