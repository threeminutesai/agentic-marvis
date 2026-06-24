# Agentic Jarvis Dashboard Skill

## Overview
The dashboard skill enables Jarvis to generate, search, and display interactive HTML dashboards from data sources. It integrates with Jarvis's HTML panel management system for seamless display.

## Features

### Dashboard Generation
- Generate custom HTML dashboards from data
- Support for charts, metrics, and visualizations
- Responsive design that works in iframe sandboxes
- Template-based generation for consistency

### Integration with Jarvis
- Store generated dashboards in `data/html-panels` folder
- Access via: `open <dashboard-name>`
- Safe iframe display prevents CSS conflicts
- Full interactivity within sandboxed environment

### File Organization
Dashboards are stored with naming conventions:
- `finance-quarterly.html` - Finance reports
- `project-status.html` - Project tracking
- `sales-ops.html` - Sales operations
- Custom names based on your data

## Usage

### Generate a Dashboard
```
/code Generate a dashboard showing Q2 financial metrics
/claude Create a project status dashboard for the team
```

Jarvis will:
1. Delegate to Claude Code or Codex
2. Generate HTML file in `data/html-panels`
3. Display the dashboard in an isolated iframe
4. Save for quick access later

### Open a Stored Dashboard
```
open financial
open project
open Q2
```

The search system finds matching dashboards by keyword.

## Technical Details

### Storage
- Location: `data/html-panels/`
- Format: HTML with embedded CSS and data
- Max size: Typically < 500KB per dashboard
- Auto-pruned: Oldest files removed when limit reached (default: 50)

### Display
- Renderer: Sandboxed iframe (`showHTMLSafe()`)
- CSS: Isolated from main Jarvis UI
- Scripts: Allowed but restricted from accessing parent
- Styling: Modern, dark theme by default

### Dashboard Features
- Interactive charts (Chart.js, etc.)
- Real-time data updates
- Export functionality
- Print-friendly layout
- Mobile-responsive design

## v0.2.0 Updates

### New in This Release
- Integration with HTML panel search system
- Safe iframe display prevents UI corruption
- Fuzzy matching for quick dashboard access
- Multiple search strategies (exact, substring, fuzzy)

### Examples
```
open financial     → finds "finance-quarterly.html"
open dashboard     → finds "project-status.html"
open Q2 report     → finds "Q2-financial-report.html"
```

## Integration with Briefing

Dashboards can be triggered from:
- Voice commands: "show me the financial dashboard"
- Text commands: "open finance quarterly"
- Status panel interactions: Click to view detailed dashboards

## Related Documentation
- [README.md](../README.md) - Main Jarvis documentation
- [Brief Skill](./BRIEF_SKILL.md) - Status briefing generation
- [CHANGELOG.md](../CHANGELOG.md) - Version history
