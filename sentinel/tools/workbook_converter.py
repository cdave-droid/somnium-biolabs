#!/usr/bin/env python3
"""Workbook-to-signature converter (§5 tools/): ingests the SME-authored
scenario workbook and emits DRAFT signature JSON for SME review.

The real scenario workbook does not exist yet (see GAPS.md) — this tool
defines the interchange format so SMEs can start filling it in. Input is a
JSON workbook:

{
  "workbook_version": "1",
  "author": "...",
  "scenarios": [
    {
      "scenario_id": "compensated_stress",
      "name": "...",
      "narrative": "free text describing the pattern (kept as a comment)",
      "severity": "S3",
      "conditions": [
        {"metric": "cycle_rate", "kind": "rise_from_baseline_pct", "amount": 20, "over_hours": 4},
        {"metric": "pressure_primary", "kind": "falling_trend", "per_min": 0.05, "over_hours": 4}
      ],
      "response_by_context": {"fixed_site": "D4", "mobile_platform": "D5", "default": "D4"},
      "explanation": "... may contain {var} placeholders ..."
    }
  ]
}

Output signatures are ALWAYS status="draft" with author "[workbook]" — the
converter never publishes; publication requires SME review + re-signing.
"""
from __future__ import annotations

import argparse
import json
import os

KIND_MAP = {
    "rise_from_baseline_pct": lambda c, i: {
        "id": f"c{i}", "metric": c["metric"], "op": "delta_from_baseline_pct",
        "gte": c["amount"], "window_min": int(c["over_hours"] * 60), "min_points": c.get("min_points", 2)},
    "fall_from_baseline_pct": lambda c, i: {
        "id": f"c{i}", "metric": c["metric"], "op": "delta_from_baseline_pct",
        "lte": -abs(c["amount"]), "window_min": int(c["over_hours"] * 60), "min_points": c.get("min_points", 2)},
    "falling_trend": lambda c, i: {
        "id": f"c{i}", "metric": c["metric"], "op": "trend_slope",
        "lte": -abs(c["per_min"]), "unit_per_min": True,
        "window_min": int(c["over_hours"] * 60), "min_points": c.get("min_points", 3)},
    "rising_trend": lambda c, i: {
        "id": f"c{i}", "metric": c["metric"], "op": "trend_slope",
        "gte": abs(c["per_min"]), "unit_per_min": True,
        "window_min": int(c["over_hours"] * 60), "min_points": c.get("min_points", 3)},
    "at_or_below": lambda c, i: {
        "id": f"c{i}", "metric": c["metric"], "op": "lte", "value": c["amount"],
        "window_min": int(c.get("over_hours", 1) * 60)},
    "at_or_above": lambda c, i: {
        "id": f"c{i}", "metric": c["metric"], "op": "gte", "value": c["amount"],
        "window_min": int(c.get("over_hours", 1) * 60)},
    "sustained_above": lambda c, i: {
        "id": f"c{i}", "metric": c["metric"], "op": "sustained_for_min",
        "threshold": c["amount"], "direction": "above", "gte": c["for_min"],
        "window_min": int(c.get("over_hours", 4) * 60)},
    "event_reported": lambda c, i: {
        "op": "event_present", "event_id": c["event_id"],
        "window_min": int(c.get("over_hours", 4) * 60)},
}


def convert_scenario(sc):
    conditions = [KIND_MAP[c["kind"]](c, i) for i, c in enumerate(sc["conditions"])]
    required = sorted({c["metric"] for c in sc["conditions"] if "metric" in c})
    sig = {
        "signature_id": f"{sc['scenario_id']}_v1",
        "version": "0.1.0",
        "status": "draft",
        "name": sc["name"],
        "author": "[workbook converter — requires SME review]",
        "reviewers": [],
        "required_inputs": required or ["event"],
        "logic": {"all_of": conditions},
        "severity": sc["severity"],
        "action_tier_by_context": sc["response_by_context"],
        "explanation_template": sc["explanation"],
        "counterfactual_tests": [],
    }
    if sc.get("trajectory"):
        sig["trajectory_override"] = sc["trajectory"]
    return sig


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("workbook")
    ap.add_argument("--out-dir", required=True)
    args = ap.parse_args()
    with open(args.workbook, encoding="utf-8") as fh:
        wb = json.load(fh)
    os.makedirs(args.out_dir, exist_ok=True)
    for sc in wb["scenarios"]:
        sig = convert_scenario(sc)
        path = os.path.join(args.out_dir, f"{sig['signature_id']}.json")
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(sig, fh, indent=2)
            fh.write("\n")
        print(f"drafted {path} (status=draft; NOT publishable until SME-reviewed)")


if __name__ == "__main__":
    main()
