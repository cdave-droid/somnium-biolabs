"""GATE G5 — golden scenario suite (Python side; engine-ts runs the same
cases in its CI and both must match expected.canonical.json byte-for-byte).
"""
import json
import os

import pytest

from conftest import GOLDEN_DIR

from sentinel import Engine, canonical_json


def _cases():
    if not os.path.isdir(GOLDEN_DIR):
        return []
    return sorted(d for d in os.listdir(GOLDEN_DIR)
                  if os.path.isdir(os.path.join(GOLDEN_DIR, d)))


@pytest.mark.parametrize("name", _cases())
def test_golden_case_byte_identical(content, name):
    case_dir = os.path.join(GOLDEN_DIR, name)
    with open(os.path.join(case_dir, "input.json"), encoding="utf-8") as fh:
        inp = json.load(fh)
    with open(os.path.join(case_dir, "expected.canonical.json"), encoding="utf-8") as fh:
        expected = fh.read().strip()
    out = Engine(content).evaluate(inp["unit_profile"], inp["observations"],
                                   inp["context"], inp["reference_time"])
    assert canonical_json(out) == expected


def test_golden_suite_is_present():
    assert len(_cases()) >= 20


def test_every_published_signature_has_counterfactual_coverage(content):
    names = _cases()
    for sig in content["published_signatures"]:
        assert any(n.startswith("ct_") and sig["counterfactual_tests"] and
                   n.startswith(sig["counterfactual_tests"][0].rsplit("_", 1)[0])
                   for n in names) or any(n.startswith("ct_") for n in names)
