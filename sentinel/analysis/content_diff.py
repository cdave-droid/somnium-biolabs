#!/usr/bin/env python3
"""§7.3 content-change regression: run every golden input under TWO content
packages and report every case whose output changed — the sign-off artifact a
content update must carry before publish (in addition to passing the golden
suite under the new package).

Usage: python analysis/content_diff.py <old_package> <new_package> [--markdown out.md]
Exit 0 with "no behavioral changes", else exit 1 and print/write the diff.
"""
from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "engine-py"))
from sentinel import Engine, load_content  # noqa: E402

GOLDEN = os.path.join(os.path.dirname(__file__), "..", "golden", "cases")
SCHEMA_DIR = os.path.join(os.path.dirname(__file__), "..", "content", "schema")

COMPARED_FIELDS = ["severity", "action_tier", "trajectory", "confidence",
                   "matched_signatures", "suppressed_signatures",
                   "not_evaluable_signatures", "flags", "recommended_recheck_min"]


def run_case(content, inp):
    return Engine(content).evaluate(inp["unit_profile"], inp["observations"],
                                    inp["context"], inp["reference_time"])


def diff_packages(old_pkg, new_pkg):
    # explicit schema dir so packages OUTSIDE the repo tree (e.g. staging
    # copies) validate against the repo's schemas
    old_content = load_content(old_pkg, SCHEMA_DIR)
    new_content = load_content(new_pkg, SCHEMA_DIR)
    diffs = []
    for name in sorted(os.listdir(GOLDEN)):
        input_path = os.path.join(GOLDEN, name, "input.json")
        if not os.path.exists(input_path):
            continue
        with open(input_path, encoding="utf-8") as fh:
            inp = json.load(fh)
        old_out = run_case(old_content, inp)
        new_out = run_case(new_content, inp)
        changed = {}
        for field in COMPARED_FIELDS:
            if old_out[field] != new_out[field]:
                changed[field] = {"old": old_out[field], "new": new_out[field]}
        if changed:
            diffs.append({"case": name, "changes": changed})
    return diffs


def render_markdown(diffs, old_pkg, new_pkg):
    lines = [f"# Content-change regression report",
             f"",
             f"- old: `{old_pkg}`",
             f"- new: `{new_pkg}`",
             f"- golden cases with changed output: **{len(diffs)}**",
             f""]
    for d in diffs:
        lines.append(f"## {d['case']}")
        for field, ch in d["changes"].items():
            lines.append(f"- **{field}**: `{json.dumps(ch['old'])}` → `{json.dumps(ch['new'])}`")
        lines.append("")
    lines.append("Each change above requires explicit sign-off before publish (§7.3).")
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("old_package")
    ap.add_argument("new_package")
    ap.add_argument("--markdown")
    args = ap.parse_args()
    diffs = diff_packages(args.old_package, args.new_package)
    if not diffs:
        print("no behavioral changes across the golden suite")
        return
    report = render_markdown(diffs, args.old_package, args.new_package)
    if args.markdown:
        with open(args.markdown, "w", encoding="utf-8") as fh:
            fh.write(report + "\n")
        print(f"{len(diffs)} case(s) changed — report written to {args.markdown}")
    else:
        print(report)
    sys.exit(1)


if __name__ == "__main__":
    main()
