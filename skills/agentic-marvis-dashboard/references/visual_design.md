# Visual design system

`assets/dashboard_template.html` already implements this — you shouldn't
need to touch its CSS for a normal dashboard. Read this when you want to
understand *why* it looks the way it does, or when a user asks for a
different mood and you need to know what to change without breaking the
rest of the system.

The template borrows its design discipline from the `frontend-slides`
skill's design-aesthetics principles, adapted for a single-page business
document instead of a slide deck (no 16:9 fixed stage, no multi-style
preview picker — those are slide-deck-specific; a director dashboard is a
one-shot deliverable, not something worth a design-discovery dialog every
time).

## What's deliberate here

- **Typography**: Archivo (700/800, display — headings, KPI values' label
  weight) + IBM Plex Sans (body) + IBM Plex Mono (every *number* — KPI
  values, badges, pills, progress percentages). Never Inter, Roboto, Arial,
  or a bare system-font stack — those read as generic/AI-default. The mono
  face on numbers specifically is a "data visualization focus" cue: it
  gives KPI figures a tabular, precise feel appropriate for a financial or
  status document.
- **Color**: one dominant color (deep navy — header rule, section titles,
  progress fill, chart line accents) plus one sharp accent (burnt rust —
  KPI card left-border) on a warm paper background, not cold gray. This is
  "dominant + sharp accent" rather than the generic AI pattern of a
  timid even-toned palette or a purple-gradient-on-white hero. Status
  colors (green/amber/red) are kept separate from the brand palette on
  purpose — a director needs to recognize "at risk" instantly, and
  overloading the brand accent for status would blur that signal.
- **Atmosphere**: a faint grid-line texture across the whole page
  (`--bg-line` in two linear-gradients) instead of a flat background —
  enough depth to not look like a default Bootstrap-ish admin panel,
  subtle enough to stay print/skim-friendly.
- **Motion**: one orchestrated load animation (`revealUp` keyframes,
  staggered via a `--card-index` custom property incremented per card as
  it's created) rather than scattered micro-interactions. Timing is fast
  (450ms reveal, 55ms stagger step) — this matches frontend-slides'
  "Professional / Corporate" feeling guide (subtle, fast, 200-300ms-class
  motion), not the slower "Dramatic / Cinematic" timing that fits a title
  slide. Cards also get a small hover lift; table rows get a hover
  background tint. `prefers-reduced-motion` disables all of it.
- **Chart colors**: `paletteColor(i)` in the template's `<script>` block
  generates colors from the same brand hues (navy/rust/green/amber/plum/
  teal) and cycles through varied lightness once a chart has more
  categories than base hues — see "Handling more categories than the
  palette" below. You almost never need to set `backgroundColor`/
  `borderColor` in `DASHBOARD_DATA.charts[].data.datasets[]` yourself.

## If the user wants a different mood

The system is CSS-variable-driven (`:root` block at the top of the
template), so a different mood is a palette/font swap, not a rewrite.
Keep the same discipline frontend-slides uses for its own style presets —
commit to a font pairing and a dominant-color-plus-accent palette, don't
default to Inter/indigo/purple-gradient. A few starting points adapted
from `frontend-slides`' `STYLE_PRESETS.md` (read that file directly for
more — there are a dozen full presets there with hex values and font
pairings):

- **Darker / more dramatic** (closer to the original screenshot
  references this skill was scoped from): swap `--bg` to a near-black,
  `--card-bg` to a dark slate, push `--ink`/`--ink-soft` to light warm
  grays, keep the navy/rust accent pairing or swap to "Bold Signal"'s
  orange-on-charcoal.
- **Editorial / literary** (good for a narrative-heavy report): Cormorant
  or Fraunces for display instead of Archivo, Source Serif 4 or Work Sans
  for body, cream background, crimson accent (`frontend-slides`'
  "Paper & Ink" preset).
- **Swiss / precise** (good for an ops/metrics-heavy audience): Archivo
  (800) + Nunito, pure white/black with a single red accent, tighter
  grid rhythm.

Whatever you pick, keep the rest of the system intact: the `--card-index`
stagger animation, the `paletteColor()` chart generator, and the status
badge/pill color mapping (`pillClass()`) are independent of the palette
and don't need to change.

## Handling more categories than the palette

`paletteColor(i)` cycles through 6 base hues, then on the second pass
through varies lightness so a 12-slice doughnut chart (say, a regional
breakdown that grew from 4 regions to 12) still reads as visually distinct
slices instead of silently repeating the same 6 colors. This is generated
at render time from the data's actual length — you don't need to count
categories yourself or pre-assign colors.
