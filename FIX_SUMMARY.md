# Bug Fix: HTML Panel Search - Wrong File Opening

## Problem
The search algorithm was opening the wrong file even with exact filename matches.

## Root Cause
Two issues in the `searchHtmlPanels()` function in `src/main/ipcHandlers.js`:

1. **Inverted sorting logic** - The sort comparison for substring matches was reversed
2. **Overly strict filtering** - Substring matches were being filtered out if their fuzzy similarity score was below 0.4

## Solution
Updated the search algorithm with clear priority levels:

### Priority System (NEW)
```
1. Exact Match (score: 1.5)
   - Entire filename matches the keyword exactly
   - Example: "open 00001" → opens "00001.html"

2. Substring Match (score: 1.0)
   - Keyword found as substring in filename
   - Example: "open financial" → opens "Q2 financial report.html"

3. Fuzzy Match (score: 0.4-0.9)
   - Similar filename using Levenshtein distance
   - Example: "open Q2_report" → opens "Q2 financial report.html"
```

### Code Changes
```javascript
// BEFORE (buggy):
score: containsKeyword ? similarity + 0.2 : similarity
// Uses fuzzy score + small boost - can lose to irrelevant matches

// AFTER (fixed):
score: isExactMatch ? 1.5 : (containsKeyword ? 1.0 : similarity)
// Clear priority: exact > substring > fuzzy

// BEFORE (buggy):
.filter((result) => result.score >= minSimilarity)
// Filters out substring matches that have low similarity

// AFTER (fixed):
.filter((result) => result.isExactMatch || result.containsKeyword || result.score >= minSimilarity)
// Keeps exact/substring matches regardless of similarity
```

## Test Results
✅ Test 1: `open "Q2 financial report"` → finds exact match (score 1.5)
✅ Test 2: `open financial` → finds substring match (score 1.0)
✅ Test 3: `open 00001` → finds exact match (score 1.5)
✅ Test 4: `open Q2` → finds substring match (score 1.0)
✅ Test 5: `open xyz123` → no results (too different)

## Files Modified
- `src/main/ipcHandlers.js` - Updated `searchHtmlPanels()` function

## Verification
- ✅ Syntax validated
- ✅ All test cases pass
- ✅ Exact matches now work correctly
- ✅ Substring matches now work correctly
- ✅ Fuzzy matches still work as fallback

The "open" command now reliably finds the correct file even with exact matches!
