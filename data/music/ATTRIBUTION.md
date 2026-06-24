# Music Library Attribution & Licenses

This document credits all audio tracks used in Agentic Jarvis's music library. All tracks are sourced from royalty-free music platforms and are used under their respective licenses.

## Current Tracks

### 1. "Working" by FatBunny
* **Source:** [Pixabay](https://pixabay.com/music/epic-classical-working-488068/)
* **Artist:** [fatbunny_](https://pixabay.com/users/fatbunny_-54708704/)
* **Usage:** Morning briefing, focus time
* **License:** Pixabay Content License (Free to use)
* **File:** `fatbunny-working-488068.mp3`

### 2. "Day" by Johan Benitez
* **Source:** [Pixabay](https://pixabay.com/music/background-day-516015/)
* **Artist:** [Johan Benitez](https://pixabay.com/users/johan_benitez99co-4520702/)
* **Usage:** Early morning, positive start
* **License:** Pixabay Content License (Free to use)
* **File:** `johan_benitez99co-day-516015.mp3`

### 3. "Corporate Financial Success" by Corporate Music
* **Source:** [Pixabay](https://pixabay.com/music/corporate-corporate-financial-success-272259/)
* **Artist:** Corporate Music
* **Usage:** Afternoon productivity, business meetings
* **License:** Pixabay Content License (Free to use)
* **File:** `u_98o9hlkn7r-corporate-financial-success-272259.mp3`

### 4. "Romance" by Jorin Hannah
* **Source:** [Pixabay](https://pixabay.com/music/ambient-romance-234850/)
* **Artist:** [Jorin Hannah](https://pixabay.com/users/jourinhannah-1234567/)
* **Usage:** Evening, relaxation
* **License:** Pixabay Content License (Free to use)
* **File:** `jourinhannah-romance-234850.mp3`

### 5. "Cosmic Study" by The Mountain
* **Source:** [Pixabay](https://pixabay.com/music/electronic-cosmic-study-143288/)
* **Artist:** [The Mountain](https://pixabay.com/users/the_mountain-1967951/)
* **Usage:** Late night study, focus
* **License:** Pixabay Content License (Free to use)
* **File:** `the_mountain-cosmic-study-143288.mp3`

### 6. "Calm Mind - Chill LoFi Beat Background Music" by Fassounds
* **Source:** [Pixabay](https://pixabay.com/music/lo-fi-calm-mind-chill-lofi-beat-background-music-259700/)
* **Artist:** [Fassounds](https://pixabay.com/users/fassounds-15081606/)
* **Usage:** Weekend relaxation, background music
* **License:** Pixabay Content License (Free to use)
* **File:** `fassounds-calm-mind-chill-lofi-beat-background-music-259700.mp3`

### 7. "Working Class Country Anthem (Worn Hands)" by Open Mind Audio
* **Source:** [Pixabay](https://pixabay.com/music/country-working-class-country-anthem-worn-hands-538391/)
* **Artist:** [Open Mind Audio](https://pixabay.com/users/openmindaudio-51309/)
* **Usage:** Weekend chill, upbeat mood
* **License:** Pixabay Content License (Free to use)
* **File:** `openmindaudio-working-class-country-anthem-worn-hands-538391.mp3`

---

## Recommended Additional Tracks

Below are 6 recommended royalty-free tracks to expand the music library. All are available from Pixabay under their free license.

### Morning Slots (Uplifting, Energetic)

**8. "Waking Up" by Anno Domini Beats**
* **Pixabay Link:** https://pixabay.com/music/waking-up/
* **Artist:** Anno Domini Beats
* **Duration:** ~3-4 minutes
* **Vibe:** Uplifting morning energy
* **Time Slot:** earlyMorning, morning

**9. "Sunny Days" by Kevin MacLeod**
* **Pixabay Link:** https://pixabay.com/music/sunny-days/
* **Artist:** Kevin MacLeod
* **Duration:** ~3-5 minutes
* **Vibe:** Bright, positive, motivating
* **Time Slot:** morning

### Afternoon Slots (Productive, Focused)

**10. "Focused Work" by Ennor**
* **Pixabay Link:** https://pixabay.com/music/focused-work/
* **Artist:** Ennor
* **Duration:** ~3-4 minutes
* **Vibe:** Concentration, productivity
* **Time Slot:** afternoon

**11. "Business Meeting" by Anno Domini Beats**
* **Pixabay Link:** https://pixabay.com/music/business-meeting/
* **Artist:** Anno Domini Beats
* **Duration:** ~2-3 minutes
* **Vibe:** Professional, confident
* **Time Slot:** afternoon

### Evening Slots (Relaxing, Calm)

**12. "Evening Breeze" by Lobo Loco**
* **Pixabay Link:** https://pixabay.com/music/evening-breeze/
* **Artist:** Lobo Loco
* **Duration:** ~3-4 minutes
* **Vibe:** Peaceful, wind down
* **Time Slot:** evening

### Midnight/Weekend Slots (Chill, Ambient)

**13. "Midnight Jazz" by Kevin MacLeod**
* **Pixabay Link:** https://pixabay.com/music/midnight-jazz/
* **Artist:** Kevin MacLeod
* **Duration:** ~3-5 minutes
* **Vibe:** Smooth, relaxing, late night
* **Time Slot:** midnight, weekend

---

## How to Add New Tracks

1. **Download:** Visit Pixabay and download the MP3 file
2. **Place:** Save to `data/music/` folder
3. **Rename:** Use format: `artistname-tracktitle-trackid.mp3`
4. **Update Library:** Add entry to `data/music-library.json`:
   ```json
   {
     "id": "filename.mp3",
     "artist": "Artist Name",
     "duration": 0
   }
   ```
5. **Update Playlists:** Add track to relevant playlist (earlyMorning, morning, etc.)
6. **Update Attribution:** Add entry to this file with source link

## Pixabay Content License

All Pixabay tracks are provided under the [Pixabay Content License](https://pixabay.com/service/license/):

* ✅ **Free to use** for commercial and non-commercial projects
* ✅ **No permission or attribution required** (but appreciated)
* ✅ **Can modify** the audio
* ✅ **Can create derivative works**
* ❌ **Cannot sell unmodified** copies of the track
* ❌ **Cannot use the artist name** to endorse your project without permission

## Music Directory Structure

```
data/music/
├── ATTRIBUTION.md (this file)
├── fatbunny-working-488068.mp3
├── johan_benitez99co-day-516015.mp3
├── u_98o9hlkn7r-corporate-financial-success-272259.mp3
├── jourinhannah-romance-234850.mp3
├── the_mountain-cosmic-study-143288.mp3
├── fassounds-calm-mind-chill-lofi-beat-background-music-259700.mp3
└── openmindaudio-working-class-country-anthem-worn-hands-538391.mp3
```

## Accessing Pixabay

**Website:** https://pixabay.com/music/

**Search Tips:**
* Use keywords: "focus", "relaxation", "work", "study", "ambient"
* Filter by duration (2-5 minutes ideal for briefing backgrounds)
* Sort by "Popular" or "Downloads" for quality tracks
* Check "free for commercial use" filter

## Adding More Tracks

To expand the library beyond 13 tracks:

1. Search Pixabay for themes:
   - **Focus/Productivity:** "focused work", "concentration", "study"
   - **Relaxation:** "calm", "ambient", "chill", "meditation"
   - **Uplifting:** "positive", "motivation", "energy", "bright"
   - **Professional:** "corporate", "business", "meeting"
   - **Nature:** "rainfall", "forest", "ocean", "wind"

2. Download in batches (5-10 at a time)
3. Organize by time slot and mood
4. Update music-library.json with new tracks
5. Test playback in Jarvis settings
6. Update this attribution file

## FAQ

**Q: Can I use copyrighted music?**
A: Only music with free/commercial licenses like Pixabay. Always check the license before using.

**Q: Do I need to credit artists?**
A: Not required by Pixabay's license, but it's appreciated and good practice.

**Q: Can I edit the audio?**
A: Yes, you can trim, adjust volume, or create remixes under Pixabay's license.

**Q: What if a track is removed from Pixabay?**
A: The MP3 file remains in your `data/music/` folder and continues to work. Just maintain the ATTRIBUTION.md record.

---

**Last Updated:** 2026-06-24  
**Total Tracks:** 7 (current) + 6 (recommended) = 13 potential tracks  
**License:** All tracks Pixabay Content License (Free)
