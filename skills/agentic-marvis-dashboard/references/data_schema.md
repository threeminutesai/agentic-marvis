# DASHBOARD_DATA schema

This is the single JSON object injected into `assets/dashboard_template.html`
in place of `__DASHBOARD_DATA_JSON__`. The template's JS renders it — you
never need to hand-write HTML for cards, charts, or tables, only produce
data in this shape.

```json
{
  "meta": {
    "title": "Finance Dashboard — Q2 Review",
    "subtitle": "Reporting period: Apr 1 - Jun 30, 2026 · Source: Fin_database.xlsx",
    "badges": [
      {"label": "Budget: Watching", "status": "watching"},
      {"label": "Schedule: On Track", "status": "on track"}
    ],
    "footer": "Generated from Fin_database.xlsx · Numbers reflect raw transactions, not forecasts."
  },
  "kpis": [
    {
      "label": "Total Revenue",
      "value": "$13.7M",
      "delta": {"direction": "up", "text": "+4.2% vs prior period"},
      "note": "From raw transactions"
    },
    {
      "label": "Gross Profit",
      "value": "-$1.3M",
      "note": "-10% margin"
    }
  ],
  "charts": [
    {
      "title": "Revenue vs COGS vs Gross Profit",
      "type": "line",
      "data": {
        "labels": ["Jan", "Feb", "Mar"],
        "datasets": [
          {"label": "Revenue", "data": [610000, 590000, 640000]},
          {"label": "COGS", "data": [520000, 500000, 540000]}
        ]
      }
    },
    {
      "title": "Revenue by Region",
      "type": "doughnut",
      "data": {
        "labels": ["North America", "APAC", "Europe", "LATAM"],
        "datasets": [{"data": [5200000, 3100000, 2900000, 2500000]}]
      }
    }
  ],
  "progress": [
    {"label": "AI Chatbot Completion", "percent": 65},
    {"label": "AI Development Budget Used", "percent": 75}
  ],
  "tables": [
    {
      "title": "Top Risks & Mitigation Actions",
      "columns": [
        {"key": "risk", "label": "Risk"},
        {"key": "owner", "label": "Owner"},
        {"key": "status", "label": "Status", "statusPill": true}
      ],
      "rows": [
        {"risk": "Vendor SLA breach on model latency", "owner": "J. Tan", "status": "At Risk"},
        {"risk": "Headcount backfill delayed", "owner": "M. Reyes", "status": "Watching"}
      ]
    }
  ]
}
```

## Field notes

- **kpis** — single headline numbers a director reads in 2 seconds. Good
  candidates from the extracted Excel: any table with a `Metric`/`Value`
  shape (2 columns, few rows), or a numeric column's `sum`/`mean`/`max`
  computed by `extract_excel.py`. Format `value` as a human string
  (`$13.7M`, `88`, `35.3 hours`) — do the unit conversion yourself, the
  template renders it as-is. Only add `delta` if the source data actually
  has a prior-period or budget figure to compare against — don't invent a
  trend.
- **charts** — `type` maps directly to Chart.js: `"line"` for any table
  with a date/period column plus 1+ numeric columns (trend over time),
  `"doughnut"` or `"pie"` for a categorical column + one numeric column
  with a handful of categories (breakdown/mix), `"bar"` for comparing a
  numeric column across categories (use `options: {"indexAxis": "y"}` for
  horizontal bars when category labels are long). `data` is passed through
  verbatim to `new Chart(ctx, {data: ...})`, so any valid Chart.js dataset
  config works (colors, stacking, multiple axes). Leave `backgroundColor`/
  `borderColor` off each dataset unless you have a specific reason to
  override them — the template auto-assigns its own navy/rust/green/amber
  palette (the same one used for badges and pills) so every chart matches
  the page's design system instead of Chart.js's default blue.
- **progress** — only for genuine completion/utilization percentages found
  in the data (e.g. "% complete", "budget used"). `percent` is 0-100.
- **tables** — anything that doesn't reduce to a KPI or chart: risk
  registers, milestone lists, action items, team rosters. Set
  `statusPill: true` on a status-like column to get a colored pill instead
  of plain text — the template's `pillClass()` maps common status words
  (on track/watching/at risk/blocked/etc.) to green/amber/red automatically;
  anything it doesn't recognize falls back to a neutral gray pill.
- **badges** — top-of-page status chips (schedule, budget, risk level).
  Same status-word mapping as table pills. Only include if the source data
  states a status explicitly — don't infer "at risk" from numbers alone
  without the data calling it out, unless the user has asked you to make
  that judgment call.

## Non-negotiables

Every number that lands in `kpis`, `charts`, or `progress` must trace back
to a real cell value or an aggregate computed from real cells (the `sum`/
`mean`/`min`/`max` stats `extract_excel.py` already computes, or a
straightforward derived calculation like a percentage or variance). Do not
estimate, round in a way that flips the sign or changes the takeaway, or
fill in a plausible-looking number when the source data doesn't have it —
this is a document a director will act on.
