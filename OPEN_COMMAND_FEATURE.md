# HTML Panel Search & Open Command Feature

## Overview
Added local fuzzy-matching search functionality to find and open HTML files in the `html-panels` folder using natural language commands.

## Features

### 1. Fuzzy Matching Search
- **Local processing only** - no cloud API calls
- Uses **Levenshtein distance** algorithm for string similarity
- Minimum similarity threshold: 0.4 (40%)
- Prioritizes exact substring matches

### 2. Command Syntax
Users can open HTML panels using either syntax:
```
open financial
/open financial
```

Both forms work with voice commands or text input.

### 3. How It Works

#### Example Scenario
- User says: "open financial"
- System searches `html-panels` folder
- Finds: "Q2 financial report.html" (filename matches with high similarity)
- Opens the matching HTML panel
- Displays: "Displaying Q2 financial report.html"

#### Matching Logic
1. Search all HTML files in `html-panels` folder (except `_template.html`)
2. Calculate similarity score between search keyword and filename
3. Apply boost (+0.2) for exact substring matches
4. Sort results by score (highest first)
5. Return top match if similarity ≥ 0.4

### 4. Code Changes

#### `src/main/ipcHandlers.js`
- Added `calculateSimilarity(str1, str2)` - normalized similarity score
- Added `levenshteinDistance(s1, s2)` - character distance calculation
- Added `searchHtmlPanels(keyword, minSimilarity)` - local search function
- Added IPC handler `html-panel:search` - search endpoint
- Added IPC handler `html-panel:openByKeyword` - search & open endpoint

#### `src/renderer/preload.js`
- Exposed `searchHtmlPanels(keyword)` - search API
- Exposed `openHtmlPanelByKeyword(keyword)` - open API

#### `src/renderer/renderer.js`
- Added "open" command parsing in `routeUserMessage()`
- Supports both `/open keyword` and `open keyword` syntax
- Integrates with existing panel display system

## Usage Examples

### Text Commands
```
open report
/open Q2
open financial
/open template
```

### Voice Commands
```
"open financial"
"open report"
"open dashboard"
```

## Technical Details

### Similarity Scoring
**Priority Levels (highest to lowest):**
1. **Exact Match** (score: 1.5) - filename exactly equals keyword
   - `open "Q2 financial report"` → finds `Q2 financial report.html`
2. **Substring Match** (score: 1.0) - keyword found within filename
   - `open financial` → finds `Q2 financial report.html`
   - `open Q2` → finds `Q2 financial report.html`
3. **Fuzzy Match** (score: 0.4-0.9) - similar filename using Levenshtein distance
   - `open Q2_report` → finds `Q2 financial report.html` (if no better match)

The algorithm uses Levenshtein distance normalized to 0-1 scale.

### File Handling
- Searches only `.html` files
- Excludes `_template.html` (reference file)
- Supports numeric filenames (e.g., `00001.html`)
- Existing files remain untouched (no deletion/modification)

## Error Handling
- No matches found: User-friendly error message
- File read errors: Detailed error feedback
- All operations are safe (read-only from filesystem)

## Performance
- **Local execution** - instant response (milliseconds)
- **No network calls** - works offline
- **Efficient search** - linear O(n) complexity, fast for typical folder sizes
- **Scalable** - handles hundreds of HTML files efficiently
