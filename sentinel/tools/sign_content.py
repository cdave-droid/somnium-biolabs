#!/usr/bin/env python3
"""Content signer: hashes every JSON file in a package and (re)writes
manifest.json. v1 uses hash-integrity only (signing.algorithm="none");
see GAPS.md for the key-management open item.

Usage: python tools/sign_content.py <package_path> --version 2026.07.0-demo
"""
from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "engine-py"))
from sentinel.canonical import canonical_json, sha256_hex  # noqa: E402


def sign(package_path: str, version: str, min_engine_version: str) -> dict:
    files = []
    for root, _dirs, names in os.walk(package_path):
        for name in sorted(names):
            if not name.endswith(".json") or name == "manifest.json":
                continue
            full = os.path.join(root, name)
            rel = os.path.relpath(full, package_path).replace(os.sep, "/")
            with open(full, "rb") as fh:
                digest = sha256_hex(fh.read().decode("utf-8"))
            files.append({"path": rel, "sha256": digest})
    files.sort(key=lambda f: f["path"])
    manifest = {
        "content_type": "manifest",
        "package_version": version,
        "min_engine_version": min_engine_version,
        "signing": {"algorithm": "none"},
        "files": files,
        "package_hash": sha256_hex(canonical_json(files)),
    }
    out = os.path.join(package_path, "manifest.json")
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2)
        fh.write("\n")
    return manifest


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("package_path")
    ap.add_argument("--version", required=True)
    ap.add_argument("--min-engine-version", default="1.0.0")
    args = ap.parse_args()
    m = sign(args.package_path, args.version, args.min_engine_version)
    print(f"signed {len(m['files'])} files; package_hash={m['package_hash']}")
