import json, os

GRADES = {
  "eval-project-status/with_skill": [
    ("Output is a single self-contained HTML file that opens in a browser with no build step", True, "Single dashboard.html, Chart.js + Google Fonts via CDN/link tags only, no build step."),
    ("Includes at least one KPI card showing a progress/completion percentage from the source data", True, "progress[] has Overall Project Progress 45% and AI Chatbot Completion 65%, rendered as progress bars (agent moved these from KPI cards to progress bars, which the schema explicitly prefers for completion percentages)."),
    ("Includes a progress bar element for at least one completion percentage", True, "3 progress entries: Overall Progress 45%, Chatbot Completion 65%, Budget Used 45%."),
    ("Includes a risk table listing the 3 risks from the source sheet with a status indicator per row (At Risk / Watching / On Track)", True, "tables[0] = 'Top Risks', 3 rows, statusPill:true."),
    ("All numeric values in the output (budget figures, percentages) match values derivable from the source workbook, not invented numbers", True, "Budget KPIs ($275,000 / $123,750 / $151,250) match source rows exactly; agent explicitly self-corrected an invented 'Schedule: Watching' badge that wasn't backed by source data, replacing it with one derived from actual risk-status counts."),
    ("Includes some visualization (chart or bar) of team utilization across the 3 teams", True, "charts[0] = 'Team Utilization %' bar chart, 3 data points (90/68/35).")
  ],
  "eval-finance-quarterly/with_skill": [
    ("Output is a single self-contained HTML file that opens in a browser with no build step", True, "Single dashboard.html, CDN/link tags only."),
    ("Includes KPI cards for at least 4 of: Total Revenue, Gross Profit, Marketing Spend, CAC, Active Customers", True, "All 5 present in kpis[]."),
    ("Includes a 12-month trend chart (line) plotting revenue and at least one other metric (COGS or gross profit) by month", True, "charts[0] line chart, 12 labels, Revenue + COGS datasets each length 12."),
    ("Includes a region breakdown visualization (chart or table) showing North America, APAC, Europe, and LATAM", True, "charts[2] doughnut chart, 4 regions, plus a detail table with the same 4 regions."),
    ("Monthly chart data point count matches the 12 months present in the source workbook", True, "Verified directly from DASHBOARD_DATA: line chart labels length 12, each dataset length 12; gross-profit bar chart also 12."),
    ("Numeric KPI values are human-formatted (e.g. $13.7M) rather than raw unformatted numbers (e.g. 13700000)", True, "Values shown as '$13.7M', '-$1.3M', '$2.0M', '$48.8K'.")
  ],
  "eval-sales-ops/with_skill": [
    ("Output is a single self-contained HTML file that opens in a browser with no build step", True, "Single dashboard.html, CDN/link tags only."),
    ("Includes KPI cards for Total Sales and Customers", True, "kpis[] includes Total Sales ($15,880) and Customers (20)."),
    ("Includes a visual showing progress toward the $16,000 sales goal (progress bar or equivalent)", True, "progress[0] = 'Sales Goal Progress ($15,880 of $16,000)' at 99.25%."),
    ("Includes a category breakdown chart (e.g. doughnut or bar) across the 4 product categories", True, "charts[1] doughnut chart, 4 categories."),
    ("Includes a per-store table or chart with all 4 stores, flagging Airport Kiosk as At Risk / underperforming", True, "charts[0] bar chart of 4 stores + tables[0] 'Store Performance' table with status pills; Airport Kiosk flagged At Risk in both. Agent caught and fixed a 'at-risk' (hyphenated) vs 'at risk' status-string mismatch before finalizing, which would otherwise have silently rendered as a neutral gray pill."),
    ("Numeric values (sales, goal) are human-formatted with currency symbols", True, "Values shown as '$15,880', '$16,000' etc.")
  ],
}

base = os.path.dirname(__file__)
iteration_dir = os.path.join(base, "iteration-2")

for run_key, items in GRADES.items():
    run_dir = os.path.join(iteration_dir, run_key.replace("/", os.sep))
    expectations = [{"text": t, "passed": p, "evidence": e} for t, p, e in items]
    passed = sum(1 for e in expectations if e["passed"])
    total = len(expectations)
    grading = {
        "expectations": expectations,
        "summary": {"passed": passed, "failed": total - passed, "total": total, "pass_rate": round(passed / total, 4)},
    }
    out_path = os.path.join(run_dir, "grading.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(grading, f, indent=2)
    print(out_path, grading["summary"])
