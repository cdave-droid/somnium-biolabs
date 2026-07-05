"""GATE G4 — M9 + API.

(a) Hash-chain verification detects single-bit tampering in a 10,000-event log.
(b) replay reproduces byte-identical outputs.
(c) Canonical primitives (shared with engine-ts): number formatting, escaping,
    hashing, deterministic UUIDs, strict timestamps. These vectors are the
    cross-runtime contract; engine-ts asserts the same values.
"""
import copy
import json

import pytest

from conftest import CONTEXT, PROFILE, compensated_stress_obs, make_obs

from sentinel import (AuditIntegrityError, Engine, canonical_json,
                      deterministic_uuid, q6, sha256_hex, verify_chain)
from sentinel.m9_audit import AuditLog
from sentinel.timeutil import fmt_ts, parse_ts


# ------------------------------------------------------------ (a) hash chain

def test_hash_chain_detects_single_bit_tamper_in_10k_events(content):
    log = AuditLog()
    for i in range(10_000):
        log.append("stage", f"case-{i % 7}", "1.0.0", "test", {"i": i, "v": i * 3.5})
    verify_chain(log.records)

    tampered = copy.deepcopy(log.records)
    tampered[4321]["payload"]["v"] += 1e-6  # single least-significant change
    with pytest.raises(AuditIntegrityError):
        verify_chain(tampered)

    truncated_middle = copy.deepcopy(log.records)
    del truncated_middle[5000]
    with pytest.raises(AuditIntegrityError):
        verify_chain(truncated_middle)

    relinked = copy.deepcopy(log.records)
    relinked[7777]["prev_hash"] = "f" * 64
    with pytest.raises(AuditIntegrityError):
        verify_chain(relinked)


def test_evaluate_appends_input_and_output_records(content):
    eng = Engine(content)
    eng.evaluate(PROFILE, compensated_stress_obs(), CONTEXT)
    kinds = [r["record_type"] for r in eng.audit.records]
    assert kinds == ["case_input", "case_output"]
    eng.record_outcome(eng.audit.records[0]["case_id"], "D3", "operator chose lower tier")
    verify_chain(eng.audit.records)


# ---------------------------------------------------------------- (b) replay

def test_replay_reproduces_byte_identical_outputs(content):
    eng = Engine(content)
    eng.evaluate(PROFILE, compensated_stress_obs(), CONTEXT)
    eng.evaluate(PROFILE, [], CONTEXT)                        # honest-failure case
    eng.evaluate(PROFILE, [make_obs(0, "cycle_rate", 72, 10)], CONTEXT)  # healthy
    outputs = Engine(content).replay(eng.audit.records)
    assert len(outputs) == 3
    originals = [r["payload"]["output"] for r in eng.audit.records if r["record_type"] == "case_output"]
    for fresh, orig in zip(outputs, originals):
        assert canonical_json(fresh) == canonical_json(orig)


def test_replay_fails_on_tampered_output(content):
    eng = Engine(content)
    eng.evaluate(PROFILE, compensated_stress_obs(), CONTEXT)
    records = copy.deepcopy(eng.audit.records)
    records[1]["payload"]["output"]["action_tier"] = "D0"  # tamper
    with pytest.raises(AuditIntegrityError):
        Engine(content).replay(records)


def test_evaluate_stream_equals_batch(content):
    eng = Engine(content)
    case = eng.open_case(PROFILE, CONTEXT)
    obs = compensated_stress_obs()
    last = None
    for o in obs:
        last = eng.evaluate_stream(case, o)
    batch = Engine(content).evaluate(PROFILE, obs, CONTEXT)
    assert canonical_json(last) == canonical_json(batch)

    dup = eng.evaluate_stream(case, obs[0])  # duplicate obs_id
    assert "duplicate_obs_id" in dup["flags"]
    assert dup["matched_signatures"] == batch["matched_signatures"]


# ----------------------------------------- (c) cross-runtime contract vectors

def test_canonical_number_formatting():
    cases = {
        0: "0", 1: "1", -1: "-1", 2.0: "2", 1e15 - 1: "999999999999999",
        0.1: "0.1", -0.25: "-0.25", 118: "118",
        1 / 3: "0.333333", 2 / 3: "0.666667", -2 / 3: "-0.666667",
        0.0000004: "0", 0.0000005: "0.000001", -0.000001: "-0.000001",
        123456.789: "123456.789", 68.0: "68",
    }
    for value, expected in cases.items():
        assert canonical_json(value) == expected, value


def test_canonical_object_and_string_rules():
    assert canonical_json({"b": 1, "a": [True, False, None]}) == '{"a":[true,false,null],"b":1}'
    assert canonical_json({"Z": 1, "a": 2}) == '{"Z":1,"a":2}'  # code-unit order
    assert canonical_json("a\"b\\c\nd\te") == '"a\\"b\\\\c\\nd\\te\\u0001"'
    assert canonical_json("émoji ✓") == '"émoji ✓"'  # non-ASCII passes through


def test_sha256_known_vectors():
    assert sha256_hex("") == "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    assert sha256_hex("abc") == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"


def test_deterministic_uuid_shape_and_stability():
    u1 = deterministic_uuid({"a": 1})
    u2 = deterministic_uuid({"a": 1})
    u3 = deterministic_uuid({"a": 2})
    assert u1 == u2 != u3
    assert u1[14] == "5" and u1[19] in "89ab"


def test_timestamp_strictness_and_roundtrip():
    assert parse_ts("1970-01-01T00:00:00Z") == 0
    assert parse_ts("2026-07-03T14:32:00Z") == 1783089120  # matches calendar.timegm
    for ts in ("2026-07-03T14:32:00Z", "2028-02-29T00:00:00.500Z", "1999-12-31T23:59:59Z"):
        assert fmt_ts(parse_ts(ts)) == ts
    for bad in ("2026-07-03 14:32:00", "2026-07-03T14:32:00", "2026-13-01T00:00:00Z",
                "2026-02-30T00:00:00Z", "2026-07-03T24:00:00Z", "2027-02-29T00:00:00Z", 42):
        with pytest.raises(ValueError):
            parse_ts(bad)


def test_q6_half_away_from_zero():
    # The contract: both runtimes compute floor(|x|*1e6 + 0.5) on the SAME
    # IEEE double, so these exact values are the cross-runtime fixture.
    assert q6(1.0000005) == 1.000001     # 1.0000005*1e6 -> 1000000.5000000001
    assert q6(0.1234565) == 0.123457     # 0.1234565*1e6 -> 123456.5 exactly
    assert q6(0.12345650000001) == 0.123457
    assert q6(2.5e-7) == 0.0
    assert q6(-1.5e-6) == -2e-6          # half away from zero, negative side


def test_explain_audiences(content):
    out = Engine(content).evaluate(PROFILE, compensated_stress_obs(), CONTEXT)
    from sentinel import explain
    op = explain(out, "operator")
    sp = explain(out, "specialist")
    assert op == out["explanation"]
    assert "Reasoning trace:" in sp and out["case_id"] in sp
