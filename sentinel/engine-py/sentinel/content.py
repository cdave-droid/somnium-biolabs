"""Content package loading: schema validation, manifest hash verification,
semantic cross-checks. Fails closed — any problem raises ContentError with
every message collected (prime directives 2 and 4).
"""
from __future__ import annotations

import json
import os

from .canonical import canonical_json, sha256_hex
from .constants import ENGINE_VERSION, NUMERIC_TYPES, OBSERVATION_TYPES, REFERENCEABLE_FLAGS
from .errors import ContentError
from .schema_validator import validate

TABLE_TYPES = [
    "operational_bounds", "never_ignore", "floors", "baseline_config",
    "population_baselines", "units", "worse_direction", "artifact_rules",
    "global_modifiers", "recheck_intervals", "trajectory_rules", "event_codes",
    "cadence", "stream_screening",
]

COMPARATOR_OPS = ["gte", "lte", "eq"]
FUNCTION_OPS = [
    "delta_from_baseline_abs", "delta_from_baseline_pct", "trend_slope",
    "crossed_threshold_count", "sustained_for_min", "event_present",
]


def _reject_constant(name):
    # Python's json accepts NaN/Infinity by default; engine-ts (JSON.parse)
    # never can, so such content must fail closed here too.
    raise ValueError(f"non-finite number ({name}) is not valid content JSON")


def _read_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f, parse_constant=_reject_constant)


def _semver_tuple(v: str):
    return tuple(int(x) for x in v.split("."))


def _walk_conditions(node, out):
    """Flatten a logic tree into its leaf conditions (depth-first, in order)."""
    if not isinstance(node, dict):
        return
    for comb in ("all_of", "any_of", "none_of"):
        if comb in node:
            for child in node[comb]:
                _walk_conditions(child, out)
            return
    if "at_least_n_of" in node:
        for child in node["at_least_n_of"]["of"]:
            _walk_conditions(child, out)
        return
    out.append(node)


_COMBINATORS = ("all_of", "any_of", "none_of", "at_least_n_of")


def _check_logic_structure(node, sid, errors):
    """Every node must be a leaf or carry EXACTLY one combinator — a second
    combinator key would otherwise be silently dropped at evaluation time."""
    if not isinstance(node, dict):
        return
    present = [k for k in _COMBINATORS if k in node]
    if len(present) > 1:
        errors.append(f"{sid}: logic node has multiple combinator keys ({','.join(present)})")
        return
    if not present:
        return
    comb = present[0]
    if comb == "at_least_n_of":
        spec = node[comb]
        if isinstance(spec, dict) and isinstance(spec.get("of"), list):
            if isinstance(spec.get("n"), int) and spec["n"] > len(spec["of"]):
                errors.append(f"{sid}: at_least_n_of n={spec['n']} exceeds available conditions ({len(spec['of'])})")
            for child in spec["of"]:
                _check_logic_structure(child, sid, errors)
        return
    if isinstance(node[comb], list):
        for child in node[comb]:
            _check_logic_structure(child, sid, errors)


def _check_signature_semantics(sig, known_metrics, event_ids, enums, errors):
    sid = sig.get("signature_id", "?")
    enum_metrics = set(enums)
    _check_logic_structure(sig.get("logic", {}), sid, errors)
    conditions = []
    _walk_conditions(sig.get("logic", {}), conditions)
    if not conditions:
        errors.append(f"{sid}: logic tree has no conditions")
    uses_event_present = False
    ids_seen = set()
    for i, cond in enumerate(conditions):
        where = f"{sid}: condition {i}"
        if "flag" in cond:
            if cond["flag"] not in REFERENCEABLE_FLAGS:
                errors.append(f"{where}: unknown flag '{cond['flag']}'")
            continue
        if "baseline_status" in cond and "op" in cond:
            # The op path would win and the guard would be silently discarded.
            errors.append(f"{where}: condition must not combine 'baseline_status' with 'op'")
            continue
        if "baseline_status" in cond:
            if "metric" not in cond:
                errors.append(f"{where}: baseline_status condition requires 'metric'")
            elif cond["metric"] not in known_metrics:
                errors.append(f"{where}: unknown metric '{cond['metric']}'")
            continue
        op = cond.get("op")
        metric = cond.get("metric")
        if op is None:
            errors.append(f"{where}: leaf condition needs 'op', 'flag', or 'baseline_status'")
            continue
        cid = cond.get("id")
        if cid:
            if cid in ids_seen:
                errors.append(f"{sid}: duplicate condition id '{cid}'")
            ids_seen.add(cid)
        if op == "event_present":
            uses_event_present = True
            if "event_id" not in cond:
                errors.append(f"{where}: event_present requires 'event_id'")
            elif cond["event_id"] not in event_ids:
                errors.append(f"{where}: event_id '{cond['event_id']}' not in controlled vocabulary")
            if "window_min" not in cond:
                errors.append(f"{where}: event_present requires 'window_min'")
            continue
        if metric is None:
            errors.append(f"{where}: op '{op}' requires 'metric'")
            continue
        if metric not in known_metrics:
            errors.append(f"{where}: unknown metric '{metric}'")
        comparators = [k for k in COMPARATOR_OPS if k in cond]
        if op in COMPARATOR_OPS:
            if "value" not in cond:
                errors.append(f"{where}: raw-value op '{op}' requires 'value'")
            elif metric in enum_metrics:
                if cond["value"] not in enums.get(metric, []):
                    errors.append(f"{where}: value is not a valid level for ordinal metric '{metric}'")
            elif isinstance(cond["value"], bool) or not isinstance(cond["value"], (int, float)):
                # A string value would compare against numbers at runtime:
                # TypeError in Python, silent nonsense in JS.
                errors.append(f"{where}: value must be numeric for metric '{metric}'")
            if comparators:
                errors.append(f"{where}: raw-value op '{op}' must not also carry comparator keys")
            if "window_min" not in cond:
                errors.append(f"{where}: raw-value op '{op}' requires 'window_min'")
        elif op in FUNCTION_OPS:
            if len(comparators) != 1:
                errors.append(f"{where}: op '{op}' requires exactly one of gte/lte/eq keys")
            if "window_min" not in cond:
                errors.append(f"{where}: op '{op}' requires 'window_min'")
            if op == "trend_slope" and "min_points" not in cond:
                errors.append(f"{where}: trend_slope requires 'min_points'")
            if op in ("crossed_threshold_count", "sustained_for_min"):
                if "threshold" not in cond or "direction" not in cond:
                    errors.append(f"{where}: op '{op}' requires 'threshold' and 'direction'")
            if metric in enum_metrics and op != "event_present" and op not in COMPARATOR_OPS:
                errors.append(f"{where}: op '{op}' not valid for ordinal metric '{metric}'")
        else:
            errors.append(f"{where}: unknown op '{op}'")

    if uses_event_present and "event" not in sig.get("required_inputs", []):
        # Without this, an absent event feed silently reads as "no event"
        # instead of routing through the missing-input honest-failure path.
        errors.append(f"{sid}: logic uses event_present but required_inputs does not list 'event'")

    for t in sig.get("required_inputs", []) + sig.get("optional_inputs", []):
        if t not in OBSERVATION_TYPES:
            errors.append(f"{sid}: unknown input type '{t}'")

    # Explanation completeness is enforced at load time (prime directive 3).
    import re as _re
    template_vars = set(_re.findall(r"\{([a-z_][a-z0-9_]*)\}", sig.get("explanation_template", "")))
    bindings = sig.get("template_bindings", {})
    for var in sorted(template_vars):
        if var not in bindings:
            errors.append(f"{sid}: template variable '{{{var}}}' has no binding")
    for var, b in sorted(bindings.items()):
        if b["condition_id"] not in ids_seen:
            errors.append(f"{sid}: binding '{var}' references unknown condition id '{b['condition_id']}'")


def load_content(package_path: str, schema_dir: str | None = None) -> dict:
    """Load and fully validate a content package. Returns a ContentHandle dict."""
    if schema_dir is None:
        schema_dir = os.path.normpath(os.path.join(package_path, "..", "..", "schema"))
    errors: list[str] = []
    flags: list[str] = []

    manifest_path = os.path.join(package_path, "manifest.json")
    if not os.path.exists(manifest_path):
        raise ContentError(["manifest.json missing from package"])
    manifest = _read_json(manifest_path)
    manifest_schema = _read_json(os.path.join(schema_dir, "manifest.schema.json"))
    errors.extend(f"manifest.json {e}" for e in validate(manifest, manifest_schema))
    if errors:
        raise ContentError(errors)

    if _semver_tuple(manifest["min_engine_version"]) > _semver_tuple(ENGINE_VERSION):
        raise ContentError([
            f"content requires engine >= {manifest['min_engine_version']}, this is {ENGINE_VERSION}"
        ])
    if manifest["signing"]["algorithm"] == "none":
        flags.append("content_unsigned")

    # Hash verification: every listed file must exist and match; every JSON
    # file in the package must be listed (no smuggled content).
    listed = {f["path"]: f["sha256"] for f in manifest["files"]}
    for rel, expected in sorted(listed.items()):
        full = os.path.join(package_path, rel)
        if not os.path.exists(full):
            errors.append(f"manifest lists missing file: {rel}")
            continue
        with open(full, "rb") as fh:
            actual = sha256_hex(fh.read().decode("utf-8"))
        if actual != expected:
            errors.append(f"hash mismatch for {rel}: manifest={expected} actual={actual}")
    on_disk = []
    for root, _dirs, files in os.walk(package_path):
        for name in files:
            if name.endswith(".json") and name != "manifest.json":
                on_disk.append(os.path.relpath(os.path.join(root, name), package_path).replace(os.sep, "/"))
    for rel in sorted(on_disk):
        if rel not in listed:
            errors.append(f"file present but not in manifest: {rel}")
    expected_pkg_hash = sha256_hex(canonical_json(sorted(
        [{"path": p, "sha256": h} for p, h in listed.items()], key=lambda x: x["path"]
    )))
    if expected_pkg_hash != manifest["package_hash"]:
        errors.append("package_hash does not match file list")
    if errors:
        raise ContentError(errors)

    tables_schema = _read_json(os.path.join(schema_dir, "content_tables.schema.json"))
    signature_schema = _read_json(os.path.join(schema_dir, "signature.schema.json"))

    tables: dict = {}
    signatures: list = []
    for rel in sorted(listed):
        doc = _read_json(os.path.join(package_path, rel))
        if rel.startswith("signatures/"):
            errs = validate(doc, signature_schema)
            errors.extend(f"{rel} {e}" for e in errs)
            if not errs:
                signatures.append(doc)
        else:
            ct = doc.get("content_type")
            if ct not in TABLE_TYPES:
                errors.append(f"{rel}: unknown or missing content_type '{ct}'")
                continue
            sub = {"$defs": tables_schema["$defs"], "$ref": f"#/$defs/{ct}"}
            errors.extend(f"{rel} {e}" for e in validate(doc, sub, tables_schema))
            if ct in tables:
                errors.append(f"duplicate content_type '{ct}' ({rel})")
            tables[ct] = doc
    for ct in TABLE_TYPES:
        if ct not in tables:
            errors.append(f"package is missing required table content_type '{ct}'")
    if errors:
        raise ContentError(errors)

    bounds = tables["operational_bounds"]
    known_metrics = set(bounds["bounds"].keys()) | set(bounds["enums"].keys())
    event_ids = {c["event_id"] for c in tables["event_codes"]["codes"]}

    seen_ids = set()
    for sig in signatures:
        if sig["signature_id"] in seen_ids:
            errors.append(f"duplicate signature_id '{sig['signature_id']}'")
        seen_ids.add(sig["signature_id"])
        _check_signature_semantics(sig, known_metrics, event_ids, bounds["enums"], errors)
    if errors:
        raise ContentError(errors)

    signatures.sort(key=lambda s: s["signature_id"])
    return {
        "package_path": package_path,
        "content_version": manifest["package_version"],
        "flags": flags,
        "tables": tables,
        "signatures": signatures,
        "published_signatures": [s for s in signatures if s["status"] == "published"],
    }
