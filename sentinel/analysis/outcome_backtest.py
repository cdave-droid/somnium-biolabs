#!/usr/bin/env python3
"""§7.2 outcome back-testing: recompute each signature's real-world precision
(positive predictive value) and the engine's detection recall from recorded
outcome labels; drift beyond tolerance bands opens a review ticket (here:
non-zero exit + report line).

Ground truth comes from `record_outcome(..., outcome_label=...)`:
  deterioration_confirmed | no_deterioration | indeterminate

Per-signature PPV  = confirmed firings / labeled firings (indeterminate excluded).
Engine recall      = confirmed cases where ANY signature matched (or the tier
                     reached --response-tier) / all confirmed cases.
Recall is engine-level by design: individual signatures target different
mechanisms, so per-signature recall against a global label would be misleading.

Usage: python analysis/outcome_backtest.py <audit.jsonl> [...] \
           [--min-ppv 0.5] [--min-recall 0.9] [--min-n 10] [--response-tier D3]
"""
from __future__ import annotations

import argparse
import sys

from replay_loader import load_cases

TIERS = ["D0", "D1", "D2", "D3", "D4", "D5"]


def backtest(rows, response_tier="D3"):
    per_sig: dict = {}
    confirmed_total = 0
    confirmed_detected = 0
    for row in rows:
        outcome = row["outcome"]
        label = (outcome or {}).get("outcome_label")
        if label not in ("deterioration_confirmed", "no_deterioration"):
            continue
        confirmed = label == "deterioration_confirmed"
        out = row["output"]
        if confirmed:
            confirmed_total += 1
            responded = bool(out["matched_signatures"]) or \
                TIERS.index(out["action_tier"]) >= TIERS.index(response_tier)
            if responded:
                confirmed_detected += 1
        for sig in out["matched_signatures"]:
            stats = per_sig.setdefault(sig, {"labeled_firings": 0, "confirmed": 0})
            stats["labeled_firings"] += 1
            if confirmed:
                stats["confirmed"] += 1

    signatures = []
    for sig in sorted(per_sig):
        s = per_sig[sig]
        signatures.append({
            "signature": sig,
            **s,
            "ppv": round(s["confirmed"] / s["labeled_firings"], 4),
        })
    recall = round(confirmed_detected / confirmed_total, 4) if confirmed_total else None
    return {"signatures": signatures,
            "confirmed_cases": confirmed_total,
            "confirmed_detected": confirmed_detected,
            "engine_recall": recall}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("audit_files", nargs="+")
    ap.add_argument("--min-ppv", type=float, default=0.5)
    ap.add_argument("--min-recall", type=float, default=0.9)
    ap.add_argument("--min-n", type=int, default=10)
    ap.add_argument("--response-tier", default="D3", choices=TIERS)
    args = ap.parse_args()
    result = backtest(load_cases(args.audit_files), args.response_tier)

    breaches = []
    for s in result["signatures"]:
        drifted = s["labeled_firings"] >= args.min_n and s["ppv"] < args.min_ppv
        mark = "  ⚠ PPV BELOW TOLERANCE — open review ticket" if drifted else ""
        print(f"{s['signature']}: PPV {s['ppv']:.0%} ({s['confirmed']}/{s['labeled_firings']} labeled firings){mark}")
        if drifted:
            breaches.append(s["signature"])
    if result["engine_recall"] is not None:
        low = (result["confirmed_cases"] >= args.min_n
               and result["engine_recall"] < args.min_recall)
        mark = "  ⚠ RECALL BELOW TOLERANCE — open review ticket" if low else ""
        print(f"engine recall: {result['engine_recall']:.0%} "
              f"({result['confirmed_detected']}/{result['confirmed_cases']} confirmed cases answered){mark}")
        if low:
            breaches.append("(engine_recall)")
    else:
        print("no confirmed-deterioration outcomes labeled yet — recall unavailable")
    if breaches:
        sys.exit(1)


if __name__ == "__main__":
    main()
