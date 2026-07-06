#!/usr/bin/env python3
"""§7.1 human-override telemetry — the cheapest misalignment detector: the
users grade the engine constantly.

Clusters overrides by matched signature. A signature is auto-flagged for SME
review when its override fraction exceeds --threshold AND it has at least
--min-n outcome-graded firings (the spec's bare >20% rule would flag 1
override in 3 firings on noise; the sample-size guard is a documented fix,
see GAPS.md).

Usage: python analysis/override_report.py <audit.jsonl> [...] \
           [--threshold 0.2] [--min-n 10]
Exit 1 when any signature is flagged (CI/cron friendly).
"""
from __future__ import annotations

import argparse
import sys

from replay_loader import load_cases

TIERS = ["D0", "D1", "D2", "D3", "D4", "D5"]


def build_report(rows, threshold=0.2, min_n=10):
    per_sig: dict = {}
    for row in rows:
        if row["outcome"] is None:
            continue
        engine_tier = row["output"]["action_tier"]
        human_tier = row["outcome"].get("human_action_tier")
        if human_tier not in TIERS:
            continue
        overridden = human_tier != engine_tier
        direction = None
        if overridden:
            direction = "down" if TIERS.index(human_tier) < TIERS.index(engine_tier) else "up"
        for sig in row["output"]["matched_signatures"] or ["(no_signature_matched)"]:
            stats = per_sig.setdefault(sig, {"graded_firings": 0, "overrides": 0,
                                             "down_overrides": 0, "up_overrides": 0})
            stats["graded_firings"] += 1
            if overridden:
                stats["overrides"] += 1
                stats[f"{direction}_overrides"] += 1

    report = []
    for sig in sorted(per_sig):
        s = per_sig[sig]
        frac = s["overrides"] / s["graded_firings"]
        flagged = frac > threshold and s["graded_firings"] >= min_n
        report.append({
            "signature": sig,
            **s,
            "override_fraction": round(frac, 4),
            "flagged_for_review": flagged,
            # down-overrides are the alert-fatigue signal: humans repeatedly
            # judging the engine too aggressive.
            "dominant_direction": ("down" if s["down_overrides"] >= s["up_overrides"] else "up")
            if s["overrides"] else None,
        })
    return report


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("audit_files", nargs="+")
    ap.add_argument("--threshold", type=float, default=0.2)
    ap.add_argument("--min-n", type=int, default=10)
    args = ap.parse_args()
    report = build_report(load_cases(args.audit_files), args.threshold, args.min_n)
    if not report:
        print("no outcome-graded firings yet — nothing to report")
        return
    flagged = [r for r in report if r["flagged_for_review"]]
    for r in report:
        mark = "  ⚠ FLAGGED FOR SME REVIEW" if r["flagged_for_review"] else ""
        print(f"{r['signature']}: {r['overrides']}/{r['graded_firings']} overridden "
              f"({r['override_fraction']:.0%}, {r['down_overrides']} down / {r['up_overrides']} up){mark}")
    if flagged:
        print(f"\n{len(flagged)} signature(s) exceed the override threshold with sufficient sample size")
        sys.exit(1)


if __name__ == "__main__":
    main()
