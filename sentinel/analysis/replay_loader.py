#!/usr/bin/env python3
"""Replay loader (spec §5 analysis/): loads M9 audit JSONL files, verifies
every hash chain, and joins each case's input, output, and human outcome into
one record — the substrate for the §7 surveillance jobs.
"""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "engine-py"))
from sentinel import verify_chain  # noqa: E402


def load_chain(path):
    """One JSONL file = one hash chain. Verified before anything is used."""
    records = []
    with open(path, "r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                records.append(json.loads(line))
    verify_chain(records)
    return records


def join_cases(records):
    """Returns case rows: {case_id, input, output, outcome|None, content_version}.
    A case_id can be re-evaluated (watch mode); the LAST output wins, matching
    the operational state. Outcomes attach by case_id."""
    inputs, outputs, outcomes = {}, {}, {}
    for r in records:
        if r["record_type"] == "case_input":
            inputs[r["case_id"]] = r
        elif r["record_type"] == "case_output":
            outputs[r["case_id"]] = r
        elif r["record_type"] == "outcome":
            outcomes[r["case_id"]] = r["payload"]
    rows = []
    for case_id in sorted(outputs):
        rows.append({
            "case_id": case_id,
            "input": inputs.get(case_id, {}).get("payload"),
            "output": outputs[case_id]["payload"]["output"],
            "outcome": outcomes.get(case_id),
            "content_version": outputs[case_id]["content_version"],
        })
    return rows


def load_cases(paths):
    """Load and join one or more audit chains (one chain per file)."""
    rows = []
    for path in paths:
        rows.extend(join_cases(load_chain(path)))
    return rows


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("usage: replay_loader.py <audit.jsonl> [...]", file=sys.stderr)
        sys.exit(2)
    rows = load_cases(sys.argv[1:])
    with_outcome = sum(1 for r in rows if r["outcome"] is not None)
    print(f"{len(rows)} cases loaded ({with_outcome} with recorded outcomes); all chains verified")
