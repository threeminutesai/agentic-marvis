# Benchmark: agentic-jarvis-dashboard

| Config | Pass rate | Time (s) | Tokens |
|---|---|---|---|
| with_skill | 100% | 75.3 | 72222 |
| without_skill | 100% | 61.2 | 52470 |

- Both configurations hit 100% pass rate on all 18 expectations across 3 evals - Sonnet 4.6 already builds reasonable business dashboards unaided, so this eval set doesn't show a correctness gap.
- With-skill runs used ~35-40% more tokens and ran somewhat slower, mainly from the extra step of running extract_excel.py and reading data_schema.md before building - that overhead isn't earning a pass-rate improvement on these particular (fairly clean, small) test workbooks.
- The skill's actual value on this eval set is consistency and traceability, not raw pass rate: with-skill outputs share one light-theme visual language, derive every KPI/chart number from extract_excel.py's computed stats (sum/mean) rather than ad hoc reading, and the finance-quarterly with-skill run explicitly caught and flagged a data inconsistency (KPI block revenue vs. monthly-table revenue not reconciling) rather than silently picking one number - the baseline run also flagged it, so this isn't a clean differentiator either.
- Expect the skill's edge to show up more on messier/larger real-world workbooks (many sheets, multiple tables per sheet, inconsistent formatting) where extract_excel.py's table-splitting and type inference save real rework, and on repeated dashboards where the shared template keeps look-and-feel consistent across deliverables - this synthetic test set was too clean to stress that.
