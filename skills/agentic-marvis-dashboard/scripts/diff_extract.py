#!/usr/bin/env python3
"""
Compare two extract_excel.py JSON outputs and report what changed
structurally - not just "the numbers are different" (expected every time)
but added/removed/renamed columns, added/removed tables, and row-count
swings. Use this when rebuilding a dashboard for a workbook you've
dashboarded before, so a new "Marketing Spend" column or a column rename
gets a deliberate decision instead of silently vanishing or silently
getting ignored.

Usage:
    python diff_extract.py <old.json> <new.json>

Tables are matched between the two extractions by header-set similarity
(Jaccard overlap), not by table_id/position - inserting, removing, or
reordering a table on the sheet should not break the match. A table with
no good match on the other side is reported as added/removed outright.

Output: JSON on stdout. Shape:
{
  "table_changes": {
    "added_tables": ["Sheet1__t2"],
    "removed_tables": [],
    "matched": [
      {
        "old_table_id": "Finance__t1", "new_table_id": "Finance__t1",
        "headers_added": ["Marketing Spend"],
        "headers_removed": [],
        "headers_possibly_renamed": [["Profit", "Gross Profit"]],
        "row_count_old": 12, "row_count_new": 12,
        "numeric_sum_changes": {"Revenue": {"old": 1640000, "new": 1820000, "pct_change": 11.0}}
      }
    ]
  }
}

A "possibly renamed" guess fires when one column vanished and another
appeared in the same table with the same inferred_type and a similar
position - it's a heuristic, not a certainty, so treat it as "go look at
this" rather than an automatic rename.
"""

import difflib
import json
import re
import sys


def header_set(table):
    return set(table["headers"])


def jaccard(a, b):
    if not a and not b:
        return 1.0
    inter = len(a & b)
    union = len(a | b)
    return inter / union if union else 0.0


def match_tables(old_tables, new_tables):
    """Greedily pair tables across the two extractions by header overlap."""
    pairs = []
    used_new = set()
    for ot in old_tables:
        best = None
        best_score = 0.0
        for j, nt in enumerate(new_tables):
            if j in used_new:
                continue
            score = jaccard(header_set(ot), header_set(nt))
            if score > best_score:
                best_score = score
                best = j
        if best is not None and best_score > 0.3:
            used_new.add(best)
            pairs.append((ot, new_tables[best]))
        else:
            pairs.append((ot, None))
    for j, nt in enumerate(new_tables):
        if j not in used_new:
            pairs.append((None, nt))
    return pairs


def name_similarity(a, b):
    """0-1 similarity between two header names. Plain string similarity
    plus an acronym check, since 'COGS' -> 'Cost of Goods Sold' is exactly
    the kind of rename a real workbook produces and a naive ratio alone
    scores it low."""
    a_l, b_l = a.lower().strip(), b.lower().strip()
    ratio = difflib.SequenceMatcher(None, a_l, b_l).ratio()
    words = re.findall(r"[a-z0-9]+", b_l)
    if words:
        initials = "".join(w[0] for w in words)
        if a_l.replace(" ", "") == initials:
            ratio = max(ratio, 0.92)
    words_a = re.findall(r"[a-z0-9]+", a_l)
    if words_a:
        initials_a = "".join(w[0] for w in words_a)
        if b_l.replace(" ", "") == initials_a:
            ratio = max(ratio, 0.92)
    return ratio


def guess_renames(removed, added, old_columns, new_columns, old_headers, new_headers):
    """Pair up removed/added headers that look like the same metric
    continuing under a new name. Type match is required; name similarity
    (with an acronym bonus) and position proximity break ties when several
    same-typed columns were added/removed at once - without this, two new
    numeric columns are indistinguishable from a single rename and the
    match becomes arbitrary. This is still a heuristic, not a guarantee:
    the caller should treat it as "go check this," not ground truth."""
    candidates = []
    for r in removed:
        r_type = old_columns.get(r, {}).get("inferred_type")
        r_pos = old_headers.index(r) if r in old_headers else -1
        for a in added:
            a_type = new_columns.get(a, {}).get("inferred_type")
            if not r_type or r_type != a_type:
                continue
            a_pos = new_headers.index(a) if a in new_headers else -1
            name_score = name_similarity(r, a)
            pos_score = 1.0 / (1 + abs(r_pos - a_pos)) if r_pos >= 0 and a_pos >= 0 else 0.0
            score = name_score * 0.8 + pos_score * 0.2
            candidates.append((score, r, a))

    candidates.sort(key=lambda c: c[0], reverse=True)
    used_removed, used_added = set(), set()
    guesses = []
    for score, r, a in candidates:
        if r in used_removed or a in used_added:
            continue
        if score < 0.45:
            continue
        guesses.append([r, a])
        used_removed.add(r)
        used_added.add(a)

    remaining_removed = [r for r in removed if r not in used_removed]
    remaining_added = [a for a in added if a not in used_added]
    return guesses, remaining_removed, remaining_added


def diff_table(old_t, new_t):
    old_h, new_h = header_set(old_t), header_set(new_t)
    removed = old_h - new_h
    added = new_h - old_h
    renamed_guesses, removed, added = guess_renames(
        removed, added, old_t["columns"], new_t["columns"],
        old_t["headers"], new_t["headers"],
    )

    numeric_changes = {}
    for h in old_h & new_h:
        oc = old_t["columns"].get(h, {})
        nc = new_t["columns"].get(h, {})
        if oc.get("inferred_type") == "numeric" and nc.get("inferred_type") == "numeric":
            old_sum, new_sum = oc.get("sum"), nc.get("sum")
            if old_sum is not None and new_sum is not None and old_sum != new_sum:
                pct = round((new_sum - old_sum) / old_sum * 100, 2) if old_sum else None
                numeric_changes[h] = {"old": old_sum, "new": new_sum, "pct_change": pct}

    return {
        "old_table_id": old_t["table_id"],
        "new_table_id": new_t["table_id"],
        "headers_added": sorted(added),
        "headers_removed": sorted(removed),
        "headers_possibly_renamed": renamed_guesses,
        "row_count_old": old_t["row_count"],
        "row_count_new": new_t["row_count"],
        "numeric_sum_changes": numeric_changes,
    }


def main():
    if len(sys.argv) != 3:
        print("Usage: python diff_extract.py <old.json> <new.json>", file=sys.stderr)
        sys.exit(1)

    with open(sys.argv[1], encoding="utf-8") as f:
        old = json.load(f)
    with open(sys.argv[2], encoding="utf-8") as f:
        new = json.load(f)

    old_tables = [t for s in old["sheets"] for t in s["tables"]]
    new_tables = [t for s in new["sheets"] for t in s["tables"]]

    pairs = match_tables(old_tables, new_tables)

    added_tables = [nt["table_id"] for ot, nt in pairs if ot is None]
    removed_tables = [ot["table_id"] for ot, nt in pairs if nt is None]
    matched = [diff_table(ot, nt) for ot, nt in pairs if ot is not None and nt is not None]

    result = {
        "table_changes": {
            "added_tables": added_tables,
            "removed_tables": removed_tables,
            "matched": matched,
        }
    }
    json.dump(result, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
