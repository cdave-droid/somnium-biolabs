#!/usr/bin/env python3
"""Silent-unit watchdog CLI (GAPS.md B3). Reads a last-seen state file and
prints overdue reports. Wire this to a scheduler (cron/queue) in deployment;
the check itself is pure and deterministic (`--now` is explicit).

State file format:
  {"last_seen": {"unit-1": "2026-07-03T12:00:00Z", ...},
   "deployment_by_unit": {"unit-1": "mobile_platform", ...}}

Usage:
  python tools/watchdog_check.py --state state.json --now 2026-07-03T13:00:00Z
Exit code 1 when any unit is overdue (scheduler-friendly).
"""
from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "engine-py"))
from sentinel import check_overdue, load_content  # noqa: E402

PKG = os.path.join(os.path.dirname(__file__), "..", "content", "packages", "demo-2026.07.0")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--state", required=True)
    ap.add_argument("--now", required=True, help="ISO-8601 UTC evaluation instant (explicit for determinism)")
    ap.add_argument("--package", default=PKG)
    args = ap.parse_args()
    with open(args.state, encoding="utf-8") as fh:
        state = json.load(fh)
    content = load_content(args.package)
    reports = check_overdue(content, state["last_seen"], args.now,
                            state.get("deployment_by_unit", {}))
    print(json.dumps(reports, indent=2))
    sys.exit(1 if reports else 0)


if __name__ == "__main__":
    main()
