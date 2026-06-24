# Benchmark: agentic-jarvis-dashboard (iteration 2)

| Config | Pass rate | Time (s) | Tokens |
|---|---|---|---|
| with_skill | 100% | 84.9 | 74264 |
| without_skill | 100% | 61.2 | 52470 |

- without_skill runs reused from iteration-1 unchanged - the baseline (no skill) is unaffected by this iteration's template/diff-tool changes, so re-running it would just add noise, not signal.
- with_skill still hits 100% pass rate (18/18) on the same functional expectations as iteration-1, now built on the new Archivo/IBM Plex type system, navy+rust palette, and HSL-based unlimited-category chart colors - the visual overhaul didn't cost any correctness.
- Two of the three with-skill runs this iteration show the skill actively catching mistakes before finalizing: the project-status run caught and removed an unsupported 'Schedule: Watching' badge it had invented, and the sales-ops run caught a 'at-risk' vs 'at risk' status-string mismatch that would have silently rendered as a neutral gray pill instead of red. Both are exactly the kind of error references/data_schema.md and the template's pillClass() word-list are meant to make self-checkable.
- Token/time usage is roughly flat vs iteration-1's with-skill numbers (~72-76K tokens, 73-94s) - the added visual-design read and diff-capable extraction didn't meaningfully increase cost for these single-pass builds (diff_extract.py wasn't exercised in this benchmark since none of the 3 evals simulate a re-run against a cached prior extraction - that workflow was validated separately).
- This benchmark does not exercise the new schema-drift workflow (extract_excel.py --cache + diff_extract.py) - that was validated in a separate live test (rename + new column + new category row), which also caught and led to a fix for a rename-matching bug (ambiguous pairing when multiple same-typed columns changed at once, now broken by name-similarity + position scoring).
