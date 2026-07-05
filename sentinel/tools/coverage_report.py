#!/usr/bin/env python3
"""Coverage reporter (§6 G5): lists every published signature and how many
golden cases exercise it (matched OR suppressed OR counterfactual-referenced).
Signatures exercised by fewer than 3 golden cases are flagged — the release
gate blocks them from `published` status.
"""
from __future__ import annotations

import json
import os
import sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(ROOT, "engine-py"))
from sentinel import load_content  # noqa: E402

PKG = os.path.join(ROOT, "content", "packages", "demo-2026.07.0")
GOLDEN = os.path.join(ROOT, "golden", "cases")
MIN_CASES = 3


def main():
    content = load_content(PKG)
    counts = {s["signature_id"]: 0 for s in content["published_signatures"]}
    for name in sorted(os.listdir(GOLDEN)):
        expected_path = os.path.join(GOLDEN, name, "expected.json")
        if not os.path.exists(expected_path):
            continue
        with open(expected_path, encoding="utf-8") as fh:
            out = json.load(fh)
        exercised = set(out["matched_signatures"])
        exercised.update(s["id"] for s in out["suppressed_signatures"])
        exercised.update(s["id"] for s in out["not_evaluable_signatures"])
        # counterfactuals exercise the signature they refute
        if name.startswith("ct_"):
            stem = name.split("_")[1]
            for sid in counts:
                if sid.startswith(stem) or stem in sid:
                    exercised.add(sid)
        for sid in exercised:
            if sid in counts:
                counts[sid] += 1

    under = {sid: n for sid, n in counts.items() if n < MIN_CASES}
    print("signature coverage (golden cases exercising each):")
    for sid in sorted(counts):
        marker = "  BLOCKED (<3)" if sid in under else ""
        print(f"  {counts[sid]:3d}  {sid}{marker}")
    if under:
        print(f"\nFAIL: {len(under)} published signature(s) below {MIN_CASES}-case coverage")
        sys.exit(1)
    print("\nOK: all published signatures exercised by >= 3 golden cases")


if __name__ == "__main__":
    main()
