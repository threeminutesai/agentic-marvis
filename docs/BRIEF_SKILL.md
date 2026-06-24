# Agentic Marvis Brief Skill

## Overview
The brief skill enables Marvis to generate and deliver structured briefings covering weather, news, email summaries, and custom updates. Briefings are displayed on the status panel and can be spoken aloud as part of daily greetings.

## Features

### Briefing Types

#### Weather Brief
- Current conditions and forecast
- Temperature, precipitation, wind
- UV index and air quality
- Location-based or manually configured

#### News Brief
- Personalized news stories
- Topic filtering and prioritization
- Source attribution
- Update frequency (hourly, daily, weekly)

#### Email Brief
- Unread email count
- Urgent/flagged emails
- Sender and subject preview
- Quick action flags

#### Custom Briefing
- Business metrics
- Personal updates
- Calendar summaries
- Task status

### Integration with Marvis
- Display on startup greeting
- Update in status panel
- Read aloud via TTS (text-to-speech)
- Schedule recurring briefings
- Voice trigger: "Give me today's briefing"

## Data Format

Briefings are stored in `data/marvis-status.json`:

```json
{
  "type": "Weather",
  "value": "Sunny, 28°C",
  "detail": "Light breeze from the northwest"
}
```

Supported types:
- `Weather` - Current conditions
- `News Briefing` - Multiple news stories
- `Unread Emails` - Email count
- `Urgent Emails` - Priority emails
- `Email Content` - Full email details
- `Custom` - Any custom briefing

## Usage

### Voice Commands
```
"Give me today's briefing"
"What's the weather?"
"Any new emails?"
"Show me today's updates"
```

### Scheduled Briefings
Configure in `data/marvis-status.json`:
```json
[
  {
    "type": "Weather",
    "value": "Sunny, 28°C",
    "detail": "Morning forecast"
  },
  {
    "type": "News Briefing",
    "value": ["Breaking News 1", "Breaking News 2"],
    "detail": ["Summary 1", "Summary 2"]
  }
]
```

### Update Briefings
Send updates to the status file from external processes:
1. Weather service writes weather data
2. News aggregator updates stories
3. Email sync service updates email count
4. Custom scripts add business metrics

Marvis reads and displays the latest data.

## Configuration

### Enable Briefings
In Settings → Briefing Options:
- ✅ Enable weather briefing
- ✅ Enable news briefing
- ✅ Enable email summary
- ✅ Speak briefing on startup
- ⚙️ Update frequency: every 30 minutes
- ⚙️ Time zone: Auto-detect or manual

## v0.2.0 Updates

### Enhanced Display
- Safe iframe rendering for dashboard integration
- Better status panel layout
- Improved responsive design

### HTML Panel Integration
- Status can now display dashboards
- Briefings can link to detailed panels
- Unified search for both briefings and dashboards

### Voice Integration
- TTS provider: ElevenLabs (with Web Speech fallback)
- Voice selection: Configurable per briefing type
- Playback: Background ducking while speaking

## Data Flow

```
External Source → marvis-status.json → Marvis reads → Display/Speak
```

Example flow:
1. Weather API fetches current conditions
2. Writes to `data/marvis-status.json`
3. Marvis detects change
4. Updates status panel
5. Reads weather aloud if enabled

## Best Practices

### Data Updates
- Update `marvis-status.json` atomically (write to temp file, then rename)
- Include timestamp for freshness detection
- Limit array lengths (cap news items at 15)
- Clean old entries periodically

### Performance
- Keep status file under 100KB
- Limit news stories to top 5-10 items
- Batch updates (don't write 50 times/minute)
- Cache expensive data fetches

## Examples

### Weather Integration
```json
{
  "type": "Weather",
  "value": "Sunny, 28°C, 65% humidity",
  "detail": "Light breeze from NW, feels like 26°C"
}
```

### News Integration
```json
{
  "type": "News Briefing",
  "value": [
    "Tech News: AI model surpasses human benchmark",
    "Business: Markets up 1.2% this week"
  ],
  "detail": [
    "Full story about AI development...",
    "Market analysis and implications..."
  ]
}
```

### Email Integration
```json
{
  "type": "Unread Emails",
  "value": "5 unread messages",
  "detail": "2 from your manager, 3 from team"
}
```

## Troubleshooting

**Briefing not appearing:**
1. Check `data/marvis-status.json` exists
2. Verify file is valid JSON
3. Ensure status rows have `type` and `value` fields
4. Restart Marvis to reload

**Voice not playing:**
1. Check if briefing TTS is enabled in Settings
2. Verify ElevenLabs key is configured (or use Web Speech)
3. Check system volume and app muting
4. Review browser speaker permissions

## Related Documentation
- [README.md](../README.md) - Main Marvis documentation
- [Dashboard Skill](./DASHBOARD_SKILL.md) - Dashboard generation
- [CHANGELOG.md](../CHANGELOG.md) - Version history
