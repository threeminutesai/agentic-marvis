# Testing the Open Command Feature

## Test Setup
The feature has been integrated into three key files:

1. **src/main/ipcHandlers.js** - Backend search logic
2. **src/renderer/preload.js** - IPC bridges
3. **src/renderer/renderer.js** - Command parsing & UI

## Manual Test Cases

### Test 1: Exact Substring Match
**Command:** `open financial`
- Searches html-panels for files containing "financial"
- Expected: Finds "Q2 financial report.html" (highest match)
- Result: Opens and displays the panel

### Test 2: Partial Fuzzy Match
**Command:** `open Q2`
- Searches for files similar to "Q2"
- Expected: Finds "Q2 financial report.html"
- Result: Opens and displays the panel

### Test 3: No Match Found
**Command:** `open xyz123`
- Searches for files similar to "xyz123"
- Expected: No results (similarity score < 0.4)
- Result: Error message "No HTML panel found matching \"xyz123\""

### Test 4: Alternative Syntax
**Command:** `/open financial`
- Same as `open financial` (slash prefix is optional)
- Expected: Same result as Test 1
- Result: Opens and displays the panel

### Test 5: Numeric Filenames
**Command:** `open 00001`
- Searches for files with "00001"
- Expected: Finds "00001.html" if it exists
- Result: Opens and displays the panel

## Test in App

1. Start the Jarvis application
2. In the chat input field, type: `open financial`
3. Press Enter or click Send
4. Expected: HTML panel displays "Q2 financial report.html"

## Debug Info

To verify the search is working, check browser console:
- Navigate to DevTools (F12)
- Check the Console tab for any errors
- The command should be logged as processed

## Current HTML Files Available
```
data/html-panels/
├── _template.html (reference template)
├── 00001.html
└── Q2 financial report.html
```

## Notes
- All files ending with `.html` are searchable (except `_template.html`)
- Search is case-insensitive
- Minimum match quality required: 40% similarity
- Search is local (no network required)
