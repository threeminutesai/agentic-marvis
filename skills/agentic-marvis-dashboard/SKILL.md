---
name: agentic-marvis-dashboard
description: Turn Excel, CSV, or spreadsheet tables into a single self-contained HTML dashboard. Use when Codex needs to summarize a workbook visually, build an exec-ready dashboard, create a director-level status page, or turn tabular business data into KPI cards, charts, progress bars, and tables.
---

# Agentic Marvis Dashboard

## Overview

Build a polished, single-file HTML dashboard from a workbook. The dashboard should read like an executive summary: clear headline, traceable numbers, and the right mix of KPI cards, charts, progress bars, and tables.

## Workflow

1. Inspect the workbook with `scripts/extract_excel.py` instead of reading it by eye.
   - Split sheets into logical tables.
   - Use the extracted JSON to understand headers, numeric columns, dates, and row counts.
2. Choose the right visual for each table.
   - Metric/value rows or tiny numeric tables -> KPI cards.
   - Date plus numeric series -> line chart.
   - Small categorical breakdown -> pie/doughnut or bar chart.
   - Percent-complete or utilization data -> progress bar.
   - Mixed text records, risks, or action items -> table.
3. Compute every number from the source data.
   - Use real cells, sums, means, ratios, or deltas derived from extracted values.
   - Never invent prior periods or targets.
4. Fill the dashboard template.
   - Read `references/data_schema.md` for the `DASHBOARD_DATA` shape.
   - Copy `assets/dashboard_template.html` to the output file.
   - Replace `__DASHBOARD_TITLE__` and `__DASHBOARD_DATA_JSON__`.
5. Sanity-check before finishing.
   - Make sure chart labels and data arrays match.
   - Confirm KPI formatting looks human-readable.
   - Open the rendered HTML if possible and verify the page is clean.
6. Handle workbook refreshes.
   - If a cache exists, use `scripts/diff_extract.py` to spot renamed, added, or removed tables and columns.
   - Rebuild the dashboard from the current extraction, not from stale assumptions.

## Resources

- `scripts/extract_excel.py` - workbook-to-JSON extractor.
- `scripts/diff_extract.py` - compare two extractions when numbers or structure change.
- `references/data_schema.md` - `DASHBOARD_DATA` schema and field guidance.
- `references/visual_design.md` - visual system and styling notes.
- `assets/dashboard_template.html` - self-contained dashboard template.
