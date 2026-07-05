#!/usr/bin/env python3
"""Content-validator CLI (Phase 0 deliverable). Validates a whole package —
schemas, manifest hashes, semantic cross-checks — or a single content file
against a named schema.

Usage:
  python tools/validate_content.py <package_path>
  python tools/validate_content.py --file <file.json> --schema <signature|observation|...>
"""
from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "engine-py"))
from sentinel.content import TABLE_TYPES, load_content  # noqa: E402
from sentinel.errors import ContentError  # noqa: E402
from sentinel.schema_validator import validate  # noqa: E402

SCHEMA_DIR = os.path.join(os.path.dirname(__file__), "..", "content", "schema")


def validate_single(path: str, schema_name: str) -> list[str]:
    with open(path, "r", encoding="utf-8") as fh:
        doc = json.load(fh)
    if schema_name in TABLE_TYPES:
        with open(os.path.join(SCHEMA_DIR, "content_tables.schema.json"), encoding="utf-8") as fh:
            tables = json.load(fh)
        return validate(doc, {"$defs": tables["$defs"], "$ref": f"#/$defs/{schema_name}"}, tables)
    schema_path = os.path.join(SCHEMA_DIR, f"{schema_name}.schema.json")
    if not os.path.exists(schema_path):
        return [f"unknown schema '{schema_name}'"]
    with open(schema_path, encoding="utf-8") as fh:
        schema = json.load(fh)
    return validate(doc, schema)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("package_path", nargs="?")
    ap.add_argument("--file")
    ap.add_argument("--schema")
    args = ap.parse_args()

    if args.file:
        try:
            errors = validate_single(args.file, args.schema or "")
        except json.JSONDecodeError as e:
            errors = [f"not valid JSON: {e}"]
        if errors:
            print(f"INVALID ({len(errors)} errors):")
            for e in errors:
                print(f"  - {e}")
            sys.exit(1)
        print("VALID (schema only — package mode adds manifest hashes and "
              "cross-file semantic checks; a file valid here can still fail the package gate)")
        sys.exit(0)

    if not args.package_path:
        ap.error("provide a package path or --file/--schema")
    try:
        handle = load_content(args.package_path)
    except ContentError as e:
        print(f"INVALID PACKAGE ({len(e.messages)} errors):")
        for msg in e.messages:
            print(f"  - {msg}")
        sys.exit(1)
    n_sig = len(handle["signatures"])
    n_pub = len(handle["published_signatures"])
    print(f"VALID: content {handle['content_version']}; {n_sig} signatures ({n_pub} published); flags={handle['flags']}")
