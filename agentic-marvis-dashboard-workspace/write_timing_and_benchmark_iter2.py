import json, os, statistics

base = os.path.dirname(__file__)
iteration_dir = os.path.join(base, "iteration-2")

TIMING = {
  "eval-project-status/with_skill": (75712, 88583),
  "eval-finance-quarterly/with_skill": (72044, 72541),
  "eval-sales-ops/with_skill": (75037, 93531),
}

for run_key, (tokens, ms) in TIMING.items():
    run_dir = os.path.join(iteration_dir, run_key.replace("/", os.sep))
    with open(os.path.join(run_dir, "timing.json"), "w", encoding="utf-8") as f:
        json.dump({"total_tokens": tokens, "duration_ms": ms, "total_duration_seconds": round(ms / 1000, 1)}, f, indent=2)

EVAL_NAMES = {
    "eval-project-status": "project-status",
    "eval-finance-quarterly": "finance-quarterly",
    "eval-sales-ops": "sales-ops",
}

runs = []
for eval_dir, eval_name in EVAL_NAMES.items():
    for config in ["with_skill", "without_skill"]:
        run_key = f"{eval_dir}/{config}"
        run_dir = os.path.join(iteration_dir, run_key.replace("/", os.sep))
        with open(os.path.join(run_dir, "grading.json"), encoding="utf-8") as f:
            grading = json.load(f)
        with open(os.path.join(run_dir, "timing.json"), encoding="utf-8") as f:
            timing = json.load(f)
        runs.append({
            "eval_id": list(EVAL_NAMES.keys()).index(eval_dir),
            "eval_name": eval_name,
            "configuration": config,
            "run_number": 1,
            "result": {
                "pass_rate": grading["summary"]["pass_rate"],
                "passed": grading["summary"]["passed"],
                "failed": grading["summary"]["failed"],
                "total": grading["summary"]["total"],
                "time_seconds": timing["total_duration_seconds"],
                "tokens": timing["total_tokens"],
                "tool_calls": None,
                "errors": 0,
            },
            "expectations": grading["expectations"],
            "notes": [],
        })

def agg(vals):
    return {
        "mean": round(statistics.mean(vals), 4),
        "stddev": round(statistics.pstdev(vals), 4) if len(vals) > 1 else 0.0,
        "min": round(min(vals), 4),
        "max": round(max(vals), 4),
    }

def summary_for(config):
    rs = [r for r in runs if r["configuration"] == config]
    return {
        "pass_rate": agg([r["result"]["pass_rate"] for r in rs]),
        "time_seconds": agg([r["result"]["time_seconds"] for r in rs]),
        "tokens": agg([r["result"]["tokens"] for r in rs]),
    }

with_s = summary_for("with_skill")
without_s = summary_for("without_skill")

benchmark = {
    "metadata": {
        "skill_name": "agentic-marvis-dashboard",
        "skill_path": r"C:\Users\leona\.claude\skills\agentic-marvis-dashboard",
        "executor_model": "claude-sonnet-4-6",
        "analyzer_model": "claude-sonnet-4-6",
        "timestamp": "2026-06-23T01:00:00Z",
        "evals_run": list(EVAL_NAMES.values()),
        "runs_per_configuration": 1,
    },
    "runs": runs,
    "run_summary": {
        "with_skill": with_s,
        "without_skill": without_s,
        "delta": {
            "pass_rate": f"{with_s['pass_rate']['mean'] - without_s['pass_rate']['mean']:+.2f}",
            "time_seconds": f"{with_s['time_seconds']['mean'] - without_s['time_seconds']['mean']:+.1f}",
            "tokens": f"{with_s['tokens']['mean'] - without_s['tokens']['mean']:+.0f}",
        },
    },
    "notes": [
        "without_skill runs reused from iteration-1 unchanged - the baseline (no skill) is unaffected by this iteration's template/diff-tool changes, so re-running it would just add noise, not signal.",
        "with_skill still hits 100% pass rate (18/18) on the same functional expectations as iteration-1, now built on the new Archivo/IBM Plex type system, navy+rust palette, and HSL-based unlimited-category chart colors - the visual overhaul didn't cost any correctness.",
        "Two of the three with-skill runs this iteration show the skill actively catching mistakes before finalizing: the project-status run caught and removed an unsupported 'Schedule: Watching' badge it had invented, and the sales-ops run caught a 'at-risk' vs 'at risk' status-string mismatch that would have silently rendered as a neutral gray pill instead of red. Both are exactly the kind of error references/data_schema.md and the template's pillClass() word-list are meant to make self-checkable.",
        "Token/time usage is roughly flat vs iteration-1's with-skill numbers (~72-76K tokens, 73-94s) - the added visual-design read and diff-capable extraction didn't meaningfully increase cost for these single-pass builds (diff_extract.py wasn't exercised in this benchmark since none of the 3 evals simulate a re-run against a cached prior extraction - that workflow was validated separately).",
        "This benchmark does not exercise the new schema-drift workflow (extract_excel.py --cache + diff_extract.py) - that was validated in a separate live test (rename + new column + new category row), which also caught and led to a fix for a rename-matching bug (ambiguous pairing when multiple same-typed columns changed at once, now broken by name-similarity + position scoring).",
    ],
}

with open(os.path.join(iteration_dir, "benchmark.json"), "w", encoding="utf-8") as f:
    json.dump(benchmark, f, indent=2)

with open(os.path.join(iteration_dir, "benchmark.md"), "w", encoding="utf-8") as f:
    f.write(f"# Benchmark: agentic-marvis-dashboard (iteration 2)\n\n")
    f.write(f"| Config | Pass rate | Time (s) | Tokens |\n|---|---|---|---|\n")
    f.write(f"| with_skill | {with_s['pass_rate']['mean']*100:.0f}% | {with_s['time_seconds']['mean']:.1f} | {with_s['tokens']['mean']:.0f} |\n")
    f.write(f"| without_skill | {without_s['pass_rate']['mean']*100:.0f}% | {without_s['time_seconds']['mean']:.1f} | {without_s['tokens']['mean']:.0f} |\n\n")
    for n in benchmark["notes"]:
        f.write(f"- {n}\n")

print("wrote benchmark.json and benchmark.md")
print(json.dumps(benchmark["run_summary"], indent=2))
