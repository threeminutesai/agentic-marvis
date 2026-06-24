# Music Library Expansion Guide

## Overview
This guide helps you expand your Jarvis music library from 7 tracks to 13+ tracks with curated royalty-free music from Pixabay.

## Quick Start

### 1. Download Recommended Tracks
Visit [Pixabay Music](https://pixabay.com/music/) and search for these 6 tracks:

### 2. Save to Correct Folder
Place downloaded MP3 files in: `data/music/`

### 3. Update Configuration
Add entries to `data/music-library.json` and update `data/music/ATTRIBUTION.md`

### 4. Restart Jarvis
Changes take effect immediately

---

## 6 Recommended Tracks to Add

### Track 8: Morning Energy Boost

**Search on Pixabay:** "Waking Up" OR "Morning Energy"  
**Recommended Artist:** Anno Domini Beats or Kevin MacLeod  
**Duration:** 3-4 minutes  
**Vibe:** Uplifting, energetic, positive  
**Best For:** earlyMorning time slot

**Why This Track:**
- Provides contrast to "Day" (track 2)
- More energetic for workday start
- Perfect for 6-7 AM briefings

**Pixabay Search Tips:**
- Search: `anno domini waking up`
- Filter: "Music" → "Uplifting"
- Sort by: "Popular" or "Downloads"

**JSON Entry Template:**
```json
{
  "id": "artist-track-title-musicid.mp3",
  "artist": "Artist Name",
  "duration": 0
}
```

---

### Track 9: Bright & Positive Morning

**Search on Pixabay:** "Sunny Days" OR "Positive Music"  
**Recommended Artist:** Kevin MacLeod or Brandon Johnson  
**Duration:** 3-5 minutes  
**Vibe:** Bright, cheerful, motivating  
**Best For:** morning time slot

**Why This Track:**
- Complements "Working" (track 1)
- More optimistic tone
- Great for team briefings

**Pixabay Search Tips:**
- Search: `kevin macleod sunny`
- Filter: "Cheerful", "Bright"
- Check: "License: Free for commercial use"

**Alternative Keywords:**
- "positive background music"
- "motivational music"
- "uplifting instrumental"

---

### Track 10: Productivity & Focus

**Search on Pixabay:** "Focused Work" OR "Concentration"  
**Recommended Artist:** Ennor, Anno Domini Beats, or Kevin MacLeod  
**Duration:** 3-4 minutes  
**Vibe:** Concentrated, productive, steady  
**Best For:** afternoon time slot

**Why This Track:**
- Different from "Corporate Financial Success" (track 3)
- More subtle, less corporate
- Good for deep work sessions

**Pixabay Search Tips:**
- Search: `productivity focus background`
- Filter: "Instrumental", "No vocals"
- Duration: 3-5 minutes

**Alternative Keywords:**
- "deep work music"
- "study background"
- "focused instrumental"
- "concentration music"

---

### Track 11: Professional & Calm

**Search on Pixabay:** "Business Meeting" OR "Professional"  
**Recommended Artist:** Anno Domini Beats, Benjamin Tissot, or Kevin MacLeod  
**Duration:** 2-3 minutes  
**Vibe:** Professional, confident, polished  
**Best For:** afternoon time slot (alternative)

**Why This Track:**
- Shorter track (2-3 min) for quick briefings
- More refined than country/working class vibes
- Good for client calls or formal meetings

**Pixabay Search Tips:**
- Search: `business meeting professional`
- Filter: "Business", "Corporate"
- Sort: "Downloads" (most used = best quality)

**Alternative Keywords:**
- "corporate background music"
- "professional presentation"
- "business instrumental"

---

### Track 12: Evening Wind-Down

**Search on Pixabay:** "Evening Breeze" OR "Relaxing"  
**Recommended Artist:** Lobo Loco, Benjamin Tissot, or Dyalla  
**Duration:** 3-4 minutes  
**Vibe:** Peaceful, wind-down, calming  
**Best For:** evening time slot

**Why This Track:**
- Complements "Romance" (track 4)
- More instrumental/ambient
- Good for end-of-day decompression

**Pixabay Search Tips:**
- Search: `evening relaxation calm`
- Filter: "Ambient", "Relaxing"
- Check: Length 3-4 minutes

**Alternative Keywords:**
- "peaceful background music"
- "relaxation instrumental"
- "tranquil music"
- "wind down music"

---

### Track 13: Midnight Chill

**Search on Pixabay:** "Midnight Jazz" OR "Late Night"  
**Recommended Artist:** Kevin MacLeod, Jazz Cat, or Benjamin Tissot  
**Duration:** 3-5 minutes  
**Vibe:** Smooth, jazzy, late-night  
**Best For:** midnight time slot

**Why This Track:**
- Alternative to "Cosmic Study" (track 5)
- More musical/jazzy than electronic
- Great for late-night work

**Pixabay Search Tips:**
- Search: `midnight jazz lounge`
- Filter: "Jazz", "Music"
- Sort: "Popular" or "Downloads"

**Alternative Keywords:**
- "late night music"
- "smooth jazz"
- "night time instrumental"
- "midnight ambience"

---

## Step-by-Step Setup Instructions

### Step 1: Download Files (5 minutes)

```
1. Go to https://pixabay.com/music/
2. Search for first track: "Waking Up" OR use artist name
3. Click the track
4. Click "Download" button (Free)
5. Save to Downloads folder
6. Repeat for all 6 tracks
```

### Step 2: Move to Jarvis Music Folder (2 minutes)

```
1. Open: C:\L_Center\AI_devp\jarvis\data\music\
2. Copy/paste downloaded MP3 files here
3. Verify all 13 files now in folder (7 original + 6 new)
```

### Step 3: Rename Files (3 minutes)

Use consistent naming: `artist-title-musicid.mp3`

**Example:**
```
anno_domini_beats-waking_up-12345.mp3
kevin_macleod-sunny_days-67890.mp3
```

**Why:** Makes it easy to identify tracks

### Step 4: Update music-library.json (5 minutes)

Open `data/music-library.json` and add to "tracks" array:

```json
{
  "id": "anno_domini_beats-waking_up-12345.mp3",
  "artist": "Anno Domini Beats",
  "duration": 0
}
```

Repeat for all 6 new tracks.

### Step 5: Update Playlists (5 minutes)

Add new tracks to appropriate playlists:

```json
"playlists": [
  {
    "id": "pl_earlyMorning",
    "name": "earlyMorning",
    "trackIds": [
      "johan_benitez99co-day-516015.mp3",
      "anno_domini_beats-waking_up-12345.mp3"
    ]
  },
  ...
]
```

### Step 6: Update Attribution (3 minutes)

Add entries to `data/music/ATTRIBUTION.md`:

```markdown
### 8. "Waking Up" by Anno Domini Beats
* **Source:** [Pixabay](https://pixabay.com/music/epic-classical-waking-up-12345/)
* **Artist:** [Anno Domini Beats](https://pixabay.com/users/annodomini-1234567/)
* **Usage:** Early morning, positive start
* **License:** Pixabay Content License (Free to use)
* **File:** `anno_domini_beats-waking_up-12345.mp3`
```

### Step 7: Test in Jarvis (2 minutes)

1. Restart Jarvis
2. Go to Settings → Music
3. Verify all 13 tracks appear in library
4. Test playback for each time slot

---

## Pixabay Search Strategies

### By Time of Day

**Early Morning (5-7 AM):**
- Keywords: "dawn", "sunrise", "waking", "energetic", "uplifting"
- Artists: Anno Domini Beats, Kevin MacLeod
- Mood: Positive, gentle energy

**Morning (7-10 AM):**
- Keywords: "bright", "positive", "work", "focus", "productive"
- Artists: Benjamin Tissot, Brandon Johnson
- Mood: Cheerful, motivating

**Afternoon (10 AM-5 PM):**
- Keywords: "business", "corporate", "focus", "concentration"
- Artists: Anno Domini Beats, Ennor
- Mood: Professional, steady

**Evening (5-10 PM):**
- Keywords: "relaxation", "calm", "peaceful", "wind down"
- Artists: Lobo Loco, Dyalla
- Mood: Soothing, relaxing

**Midnight (10 PM-5 AM):**
- Keywords: "ambient", "jazz", "late night", "study"
- Artists: Kevin MacLeod, Jazz Cat
- Mood: Smooth, introspective

**Weekend (All Day):**
- Keywords: "chill", "lofi", "relaxation", "ambient"
- Artists: Fassounds, Lobo Loco
- Mood: Casual, easy-going

---

## Pro Tips

### Finding Quality Tracks

1. **Sort by Downloads** - Most downloaded = highest quality
2. **Check Duration** - Aim for 3-5 minutes per track
3. **Preview First** - Listen before downloading
4. **Read Descriptions** - Artist often includes details
5. **Check License** - Verify it's free for commercial use

### Naming Conventions

Keep consistent naming for organization:

```
✅ Good:
- kevin_macleod-sunny_days-401234.mp3
- anno_domini-focused_work-523456.mp3

❌ Bad:
- pixabay_music_1234.mp3
- download (1).mp3
```

### Avoiding Duplicates

Before downloading, check if Pixabay already has it in library:
- Search for artist name
- Look at "Music" filter
- Sort by recent/popular
- Avoid remixes/alternate versions

### Performance Considerations

- **File Size:** Keep under 5 MB per track
- **Duration:** 3-5 minutes ideal
- **Bitrate:** 128-192 kbps is standard
- **Format:** MP3 recommended for compatibility

---

## Troubleshooting

### Track Not Appearing in Jarvis

**Problem:** Newly added track doesn't show up

**Solutions:**
1. Verify file is in `data/music/` folder
2. Check `data/music-library.json` for entry
3. Ensure JSON syntax is valid (use linter)
4. Restart Jarvis application
5. Check file permissions (should be readable)

### Music Won't Play

**Problem:** Track selected but won't play

**Solutions:**
1. Verify MP3 file isn't corrupted (play in VLC)
2. Check file format is actually MP3
3. Ensure filename matches in music-library.json
4. Try different track (isolate problem)
5. Check browser audio permissions

### Library JSON Error

**Problem:** "Invalid JSON" error when saving

**Solutions:**
1. Use JSON validator: https://jsonlint.com/
2. Check for missing commas between entries
3. Ensure all quotes are matched
4. Look for extra/missing brackets
5. Use VS Code with JSON schema validation

---

## Recommended Artists on Pixabay

Top quality music creators:

| Artist | Style | Best For |
|--------|-------|----------|
| Kevin MacLeod | Instrumental, diverse | All slots |
| Anno Domini Beats | Uplifting, energetic | Morning |
| Benjamin Tissot | Professional, polished | Afternoon |
| Ennor | Focused, productive | Work |
| Lobo Loco | Relaxing, ambient | Evening |
| Fassounds | LoFi, chill | Weekend |
| Brandon Johnson | Positive, bright | Morning |
| Dyalla | Calm, peaceful | Evening |

---

## Next Steps

After adding these 6 tracks:

1. **Customize Schedules** - Adjust playlist assignments
2. **Test Rotation** - Verify each time slot plays different track
3. **Gather Feedback** - Ask users which tracks they prefer
4. **Add More** - Expand library with seasonal/themed playlists
5. **Update Docs** - Keep ATTRIBUTION.md current

---

## Resources

- **Pixabay Music:** https://pixabay.com/music/
- **Free Licenses:** https://pixabay.com/service/license/
- **JSON Validator:** https://jsonlint.com/
- **Duration Calculator:** Multiple tools available online
- **Music Streaming:** Verify in VLC or browser player first

---

**Difficulty Level:** ⭐⭐ (Easy to Medium)  
**Time Required:** 30-45 minutes total  
**Skills Needed:** Basic file management, JSON editing  
**Result:** 13-track music library with full attribution
