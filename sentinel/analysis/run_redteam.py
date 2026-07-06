#!/usr/bin/env python3
"""§7.4 red-team suite runner: adversarial cases (boundary values exactly at
thresholds, subtle unit errors, plausible-but-wrong inputs) pinned as
executable expectations. The suite only grows — no incident closes without
adding its case here (add to redteam_cases.json).

Usage: python analysis/run_redteam.py [cases.json]
"""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "engine-py"))
from sentinel import Engine, load_content  # noqa: E402

HERE = os.path.dirname(__file__)
PKG = os.path.join(HERE, "..", "content", "packages", "demo-2026.07.0")
TIERS = ["D0", "D1", "D2", "D3", "D4", "D5"]


def check_case(content, case):
    inp = case["input"]
    out = Engine(content).evaluate(inp.get("unit_profile", {}), inp.get("observations", []),
                                   inp.get("context"), inp.get("reference_time"))
    expect = case["expect"]
    problems = []
    if "min_action_tier" in expect and TIERS.index(out["action_tier"]) < TIERS.index(expect["min_action_tier"]):
        problems.append(f"action_tier {out['action_tier']} < required {expect['min_action_tier']}")
    if "max_action_tier" in expect and TIERS.index(out["action_tier"]) > TIERS.index(expect["max_action_tier"]):
        problems.append(f"action_tier {out['action_tier']} > allowed {expect['max_action_tier']}")
    if "confidence" in expect and out["confidence"] != expect["confidence"]:
        problems.append(f"confidence {out['confidence']} != {expect['confidence']}")
    for sig in expect.get("matched_includes", []):
        if sig not in out["matched_signatures"]:
            problems.append(f"expected match {sig} absent")
    for sig in expect.get("matched_excludes", []):
        if sig in out["matched_signatures"]:
            problems.append(f"unexpected match {sig}")
    for flag in expect.get("flags_include", []):
        if flag not in out["flags"]:
            problems.append(f"expected flag {flag} absent")
    for flag in expect.get("flags_exclude", []):
        if flag in out["flags"]:
            problems.append(f"unexpected flag {flag}")
    return problems, out


def main():
    cases_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "redteam_cases.json")
    with open(cases_path, encoding="utf-8") as fh:
        suite = json.load(fh)
    content = load_content(PKG)
    failures = 0
    for case in suite["cases"]:
        problems, out = check_case(content, case)
        if problems:
            failures += 1
            print(f"FAIL {case['name']}: {'; '.join(problems)}")
            print(f"     got: tier={out['action_tier']} sev={out['severity']} conf={out['confidence']} "
                  f"matched={out['matched_signatures']} flags={out['flags']}")
        else:
            print(f"pass {case['name']}")
    print(f"\nred-team: {len(suite['cases']) - failures}/{len(suite['cases'])} cases hold")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
