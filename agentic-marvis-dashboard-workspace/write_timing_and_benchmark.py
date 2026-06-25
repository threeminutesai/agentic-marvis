import json, os, statistics

base = os.path.dirname(__file__)
iteration_dir = os.path.join(base, "iteration-1")

TIMING = {
  "eval-project-status/with_skill": (71371, 66819),
  "eval-project-status/without_skill": (52072, 59727),
  "eval-finance-quarterly/with_skill": (73866, 88107),
  "eval-finance-quarterly/without_skill": (54069, 73692),
  "eval-sales-ops/with_skill": (71428, 71061),
  "eval-sales-ops/without_skill": (51270, 50088),
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
        "timestamp": "2026-06-23T00:00:00Z",
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
        "Both configurations hit 100% pass rate on all 18 expectations across 3 evals - Sonnet 4.6 already builds reasonable business dashboards unaided, so this eval set doesn't show a correctness gap.",
        "With-skill runs used ~35-40% more tokens and ran somewhat slower, mainly from the extra step of running extract_excel.py and reading data_schema.md before building - that overhead isn't earning a pass-rate improvement on these particular (fairly clean, small) test workbooks.",
        "The skill's actual value on this eval set is consistency and traceability, not raw pass rate: with-skill outputs share one light-theme visual language, derive every KPI/chart number from extract_excel.py's computed stats (sum/mean) rather than ad hoc reading, and the finance-quarterly with-skill run explicitly caught and flagged a data inconsistency (KPI block revenue vs. monthly-table revenue not reconciling) rather than silently picking one number - the baseline run also flagged it, so this isn't a clean differentiator either.",
        "Expect the skill's edge to show up more on messier/larger real-world workbooks (many sheets, multiple tables per sheet, inconsistent formatting) where extract_excel.py's table-splitting and type inference save real rework, and on repeated dashboards where the shared template keeps look-and-feel consistent across deliverables - this synthetic test set was too clean to stress that.",
    ],
}

with open(os.path.join(iteration_dir, "benchmark.json"), "w", encoding="utf-8") as f:
    json.dump(benchmark, f, indent=2)

with open(os.path.join(iteration_dir, "benchmark.md"), "w", encoding="utf-8") as f:
    f.write(f"# Benchmark: agentic-marvis-dashboard\n\n")
    f.write(f"| Config | Pass rate | Time (s) | Tokens |\n|---|---|---|---|\n")
    f.write(f"| with_skill | {with_s['pass_rate']['mean']*100:.0f}% | {with_s['time_seconds']['mean']:.1f} | {with_s['tokens']['mean']:.0f} |\n")
    f.write(f"| without_skill | {without_s['pass_rate']['mean']*100:.0f}% | {without_s['time_seconds']['mean']:.1f} | {without_s['tokens']['mean']:.0f} |\n\n")
    for n in benchmark["notes"]:
        f.write(f"- {n}\n")

print("wrote benchmark.json and benchmark.md")
print(json.dumps(benchmark["run_summary"], indent=2))
