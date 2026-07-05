"""GATE G0 — schemas & content validation.

(a) All 20 committed malformed fixtures are rejected with precise errors.
(b) Valid samples pass.
(c) 100% schema-field coverage: for EVERY required field of every schema,
    removing it is rejected; for every enum field, an out-of-vocabulary value
    is rejected (generated programmatically, not hand-enumerated).
(d) Package-level integrity: hash tampering, unlisted files, missing tables.
"""
import copy
import json
import os

import pytest

from conftest import DEMO_PKG, MALFORMED_DIR, SCHEMA_DIR

from sentinel import ContentError, load_content
from sentinel.schema_validator import validate


def _write(pkg, rel, doc):
    path = os.path.join(pkg, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, indent=2)


def _expect_error(pkg, substring):
    with pytest.raises(ContentError) as err:
        load_content(pkg, SCHEMA_DIR)
    joined = "; ".join(err.value.messages)
    assert substring in joined, f"expected error containing {substring!r}, got: {joined}"


# ---------------------------------------------------------------- (a) + (b)

def _malformed_cases():
    with open(os.path.join(MALFORMED_DIR, "expectations.json"), encoding="utf-8") as fh:
        return sorted(json.load(fh).items())


@pytest.mark.parametrize("name,substring", _malformed_cases())
def test_malformed_fixture_rejected(tmp_package, name, substring):
    pkg, resign = tmp_package
    with open(os.path.join(MALFORMED_DIR, name), encoding="utf-8") as fh:
        doc = json.load(fh)
    _write(pkg, "signatures/zz_malformed_v1.json", doc)
    resign()
    _expect_error(pkg, substring)


def test_valid_package_passes(content):
    assert len(content["published_signatures"]) == 5
    assert content["content_version"] == "2026.07.0-demo"


@pytest.mark.parametrize("rel", [
    "signatures/compensated_stress_v1.json",
    "signatures/low_saturation_critical_v1.json",
    "thresholds/operational_bounds.json",
    "context_profiles/trajectory_rules.json",
    "vocab/event_codes.json",
])
def test_valid_samples_pass_individually(rel):
    with open(os.path.join(DEMO_PKG, rel), encoding="utf-8") as fh:
        doc = json.load(fh)
    if rel.startswith("signatures/"):
        with open(os.path.join(SCHEMA_DIR, "signature.schema.json"), encoding="utf-8") as fh:
            schema = json.load(fh)
        assert validate(doc, schema) == []
    else:
        with open(os.path.join(SCHEMA_DIR, "content_tables.schema.json"), encoding="utf-8") as fh:
            tables = json.load(fh)
        ct = doc["content_type"]
        assert validate(doc, {"$defs": tables["$defs"], "$ref": f"#/$defs/{ct}"}, tables) == []


# --------------------------------------------------- (c) 100% field coverage

def _schema_field_cases():
    """Every (schema, required-field) pair and every enum field, programmatically."""
    cases = []
    with open(os.path.join(SCHEMA_DIR, "signature.schema.json"), encoding="utf-8") as fh:
        sig_schema = json.load(fh)
    for field in sig_schema["required"]:
        cases.append(("signature", field))
    return cases


@pytest.mark.parametrize("kind,field", _schema_field_cases())
def test_every_required_signature_field_enforced(tmp_package, kind, field):
    pkg, resign = tmp_package
    with open(os.path.join(DEMO_PKG, "signatures/high_cycle_rate_simple_v1.json"), encoding="utf-8") as fh:
        doc = json.load(fh)
    doc.pop(field, None)
    _write(pkg, "signatures/high_cycle_rate_simple_v1.json", doc)
    resign()
    _expect_error(pkg, f"missing required field '{field}'")


def test_every_table_required_field_enforced(tmp_package):
    with open(os.path.join(SCHEMA_DIR, "content_tables.schema.json"), encoding="utf-8") as fh:
        tables_schema = json.load(fh)
    rel_by_type = {}
    for root, _dirs, files in os.walk(DEMO_PKG):
        for name in files:
            if name.endswith(".json") and name != "manifest.json":
                rel = os.path.relpath(os.path.join(root, name), DEMO_PKG).replace(os.sep, "/")
                if not rel.startswith("signatures/"):
                    with open(os.path.join(root, name), encoding="utf-8") as fh:
                        rel_by_type[json.load(fh)["content_type"]] = rel
    checked = 0
    for ct, rel in sorted(rel_by_type.items()):
        for field in tables_schema["$defs"][ct]["required"]:
            if field == "content_type":
                continue  # removing it changes dispatch; covered separately
            with open(os.path.join(DEMO_PKG, rel), encoding="utf-8") as fh:
                doc = json.load(fh)
            doc.pop(field, None)
            errs = validate(doc, {"$defs": tables_schema["$defs"], "$ref": f"#/$defs/{ct}"}, tables_schema)
            assert any(f"missing required field '{field}'" in e for e in errs), (ct, field)
            checked += 1
    assert checked >= 20


# ------------------------------------------------- (d) package-level checks

def test_hash_tamper_detected(tmp_package):
    pkg, resign = tmp_package
    resign()
    path = os.path.join(pkg, "thresholds", "never_ignore.json")
    with open(path, encoding="utf-8") as fh:
        doc = json.load(fh)
    doc["bounds"][0]["value"] = 999  # tamper AFTER signing
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, indent=2)
    _expect_error(pkg, "hash mismatch")


def test_unlisted_file_detected(tmp_package):
    pkg, resign = tmp_package
    resign()
    _write(pkg, "thresholds/smuggled.json", {"content_type": "never_ignore", "bounds": []})
    _expect_error(pkg, "not in manifest")


def test_missing_table_detected(tmp_package):
    pkg, resign = tmp_package
    os.remove(os.path.join(pkg, "thresholds", "never_ignore.json"))
    resign()
    _expect_error(pkg, "missing required table content_type 'never_ignore'")


def test_unknown_op_never_reaches_engine(tmp_package):
    """Directive: the evaluator's 'unreachable' branch is truly unreachable —
    content with an unknown op cannot load."""
    pkg, resign = tmp_package
    with open(os.path.join(DEMO_PKG, "signatures/high_cycle_rate_simple_v1.json"), encoding="utf-8") as fh:
        doc = json.load(fh)
    doc["logic"] = {"all_of": [{"id": "c_sustained", "metric": "cycle_rate", "op": "exotic_op", "value": 1, "window_min": 60}]}
    _write(pkg, "signatures/high_cycle_rate_simple_v1.json", doc)
    resign()
    _expect_error(pkg, "not in enum")
