# Jarvis Status Panel UI/UX Enhancements — Design

## Purpose

Redesign the status panel layout to be more compact and scannable, add entrance animations for visual appeal, and create a cinematic opening sequence where the avatar greets first, then the status panel reveals itself with a staggered card animation.

## Current State

- Status panel displays in a 30/70 split (chat on left, panel on right)
- Individual `.status-card` per status type (Weather, Unread Emails, Urgent Emails, News Briefing)
- Panel shows immediately on app load, no entrance animation
- Status data comes from `~/.jarvis-status.json` with fields: `type`, `value`, `detail`

## Changes

### Layout Architecture

**After app opens and greeting finishes:**
- **Left 1/3:** Avatar, centered and persistent
- **Right 2/3:** Status panel with compact multi-card grid

**Status panel grid:**
- **Row 1:** Three equal-width columns
  - Column 1: Weather card
  - Column 2: Unread Emails card
  - Column 3: Urgent Emails card
- **Row 2:** Full-width Email Content box

### Opening Sequence Flow

1. App launches
2. Avatar appears centered in left 1/3 of window
3. Jarvis speaks greeting (avatar animates during speech per existing avatar state)
4. Greeting finishes speaking
5. Status panel slides in from the right (from opacity 0 and off-screen to full visibility)
6. Cards reveal with staggered fade-slide animation:
   - Weather card (0ms delay)
   - Unread Emails card (100ms delay)
   - Urgent Emails card (200ms delay)
   - Email Content box (300ms delay)
7. Avatar and panel both remain visible simultaneously for user interaction

### Data Model Changes

Expand `~/.jarvis-status.json` to include email content:

```json
[
  { "type": "Weather", "value": "22C and sunny", "detail": "Clear skies all day." },
  { "type": "Unread Emails", "value": "5", "detail": "" },
  { "type": "Urgent Emails", "value": "1", "detail": "" },
  { "type": "News Briefing", "value": "Markets up, no major headlines.", "detail": "" },
  { "type": "Email Content", "value": "", "detail": "Brief summary of recent emails or urgent items." }
]
```

The `Email Content` row is new and serves as the source for the full-width box in the panel. The `value` field remains empty (display only); `detail` holds the content text.

### Component Changes

**CSS/Layout (`src/renderer/styles.css`):**
- Refactor `#app-body` flex layout: avatar column (flex-basis 30%) + panel column (flex-basis 70%)
- New grid system for status cards: 3-column grid in row 1, full-width in row 2
- Add `@keyframes` for staggered card fade-slide animations
- Ensure animations respect `@media (prefers-reduced-motion: reduce)`

**HTML (`src/renderer/index.html`):**
- Restructure to place avatar in its own column container
- Panel content remains in `#status-panel` div

**statusPanel.js (`src/renderer/statusPanel.js`):**
- Update `renderStatusBoard(rows)` to output 3-column grid HTML for first 3 cards (Weather, Unread, Urgent), then full-width Email Content box
- Each card applies CSS class for staggered animation timing
- Filter out rows with empty `value` (except Email Content, which renders even if empty as a placeholder box)

**renderer.js (`src/renderer/renderer.js`):**
- Modify `greetUser()`: 
  - Load status data
  - Build and speak greeting
  - Wait for greeting to finish speaking (`await speakReply()` completes)
  - Call `showPanel(renderStatusBoard(statusRows))` after speech ends
- CLI result path (`sendToCli()`) unchanged — HTML blocks still display in panel as before

### Animation Behavior

**Standard user (prefers-reduced-motion: no):**
- Panel slides in from right as flex-basis transitions (0% → 70%)
- Cards fade in from opacity 0 to 1 and slide from right simultaneously
- 100ms stagger between each card
- Each card animates over 0.4s
- Total reveal time for all 4 cards: ~0.7s (300ms for last card delay + 0.4s animation)

**Accessibility (prefers-reduced-motion: reduce):**
- Cards display instantly with no animation (animation-duration: 0.001ms)
- Layout transitions still apply but may be disabled per broader prefers-reduced-motion media query
- Content is immediately visible and usable

### Error Handling

- **Missing `Email Content` row in status JSON:** Template creation adds it with empty `value`/`detail`; renders as empty styled box
- **Empty `email_content` detail field:** Renders empty box gracefully (no error, no spam)
- **No status data on startup:** `greetUser()` calls `showPanel()` only if any row has non-empty `value`; panel does not appear, generic fallback greeting is shown
- **CLI HTML results with no surrounding text:** Falls back to "Here's the report, sir." (existing behavior)

### Testing

- Unit test: `renderStatusBoard()` outputs correct 3-column + full-width grid structure
- Unit test: Email Content box renders even with empty detail
- Unit test: Staggered animation CSS classes applied correctly to cards
- Visual regression: Avatar + panel side-by-side proportions (1/3 + 2/3)
- Manual verification: opening sequence timing (avatar speaks, then panel reveals with stagger)
- Manual verification: animations respect prefers-reduced-motion

## Out of Scope

- Interactive email content (email-content box is display-only, no click/expand)
- Persistence of panel state across app restart
- Manual open/close controls (panel opens only via avatar greeting or CLI HTML result)
- Changes to avatar animation or greeting logic beyond the new "wait before showPanel" sequencing

## Architecture Notes

**Layout shift:** Current 30/70 chat-vs-panel split becomes 33/67 avatar-vs-panel. Avatar was previously centered in chat column; now has its own dedicated column. This is a visual restructure, not a behavioral one—avatar interaction (state changes, speech) remain the same.

**Animation timing:** Stagger uses CSS animation-delay, not JS. All four cards receive `@keyframes fadeSlideIn`, with each getting a different `animation-delay` value (0ms, 100ms, 200ms, 300ms). This keeps animations efficient and responsive.

**Panel visibility:** `showPanel()` is still called once from `greetUser()`, but now it's delayed until after speech finishes. Subsequent CLI results can call `showPanel()` anytime (current behavior preserved).
