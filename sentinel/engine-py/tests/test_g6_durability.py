"""Durability layer: file audit sink + chain reload, baseline store with
replay determinism, and the silent-unit watchdog.
"""
import json

import pytest

from conftest import CONTEXT, PROFILE, compensated_stress_obs, make_obs

from sentinel import (AuditIntegrityError, Engine, FileAuditSink,
                      FileBaselineStore, InMemoryBaselineStore, canonical_json,
                      check_overdue, load_audit_log)


# ------------------------------------------------------------ audit sink

def test_file_sink_persists_and_reloads_verified_chain(content, tmp_path):
    path = str(tmp_path / "audit.jsonl")
    eng = Engine(content, audit_sink=FileAuditSink(path))
    eng.evaluate(PROFILE, compensated_stress_obs(), CONTEXT)
    eng.record_outcome(eng.audit.records[0]["case_id"], "D4", "operator note")

    loaded = load_audit_log(path)
    assert [r["record_type"] for r in loaded.records] == ["case_input", "case_output", "outcome"]
    assert loaded.chain_head() == eng.audit.chain_head()

    # continuing after reload keeps the chain linked and durable
    sink = FileAuditSink(path)
    cont = Engine(content, audit_sink=sink)
    cont.audit = load_audit_log(path, sink=sink)
    cont.evaluate(PROFILE, [], CONTEXT)
    reloaded = load_audit_log(path)
    assert len(reloaded.records) == 5

    # replay from disk reproduces byte-identical outputs
    outputs = Engine(content).replay(reloaded.records)
    assert len(outputs) == 2


def test_file_sink_tamper_detected_on_load(content, tmp_path):
    path = str(tmp_path / "audit.jsonl")
    eng = Engine(content, audit_sink=FileAuditSink(path))
    eng.evaluate(PROFILE, compensated_stress_obs(), CONTEXT)
    lines = open(path, encoding="utf-8").read().splitlines()
    record = json.loads(lines[0])
    record["payload"]["context"]["deployment"] = "fixed_site"  # tamper on disk
    lines[0] = json.dumps(record, separators=(",", ":"), sort_keys=True)
    open(path, "w", encoding="utf-8").write("\n".join(lines) + "\n")
    with pytest.raises(AuditIntegrityError):
        load_audit_log(path)


# --------------------------------------------------------- baseline store

STORED = {"cycle_rate": {"median": 68, "p10": 60, "p90": 78, "n_obs": 41},
          "pressure_primary": {"median": 128, "p10": 115, "p90": 142, "n_obs": 30}}


def test_store_baselines_used_when_profile_has_none(content):
    store = InMemoryBaselineStore()
    store.put("u-010", STORED)
    eng = Engine(content, baseline_store=store)
    profile = {"unit_id": "u-010", "service_age_years": 72, "class": "M"}
    obs = compensated_stress_obs()
    out = eng.evaluate(profile, obs, CONTEXT)
    assert out["matched_signatures"] == ["compensated_stress_v1"]
    assert any("source=store" in t["detail"] for t in out["reasoning_trace"])
    assert "baseline_ok" in out["flags"]

    # the store snapshot rode along in the audit log -> replay is exact
    # even though this fresh engine has NO store attached
    outputs = Engine(content).replay(eng.audit.records)
    assert canonical_json(outputs[0]) == canonical_json(out)


def test_store_snapshot_beats_later_store_mutation(content):
    """Replay must use the recorded snapshot, not the live store."""
    store = InMemoryBaselineStore()
    store.put("u-010", STORED)
    eng = Engine(content, baseline_store=store)
    profile = {"unit_id": "u-010", "service_age_years": 72, "class": "M"}
    out = eng.evaluate(profile, compensated_stress_obs(), CONTEXT)
    store.put("u-010", {"cycle_rate": {"median": 120, "p10": 100, "p90": 140, "n_obs": 50}})
    outputs = Engine(content, baseline_store=store).replay(eng.audit.records)
    assert canonical_json(outputs[0]) == canonical_json(out)


def test_file_baseline_store_roundtrip(content, tmp_path):
    store = FileBaselineStore(str(tmp_path / "baselines.json"))
    store.put("u-010", STORED)
    assert store.get("u-010")["cycle_rate"]["median"] == 68
    assert store.get("missing") is None


def test_invalid_stored_baselines_fall_through(content):
    """A malformed or under-sampled store entry must not be trusted."""
    store = InMemoryBaselineStore()
    store.put("u-010", {"cycle_rate": {"median": "not-a-number", "p10": 1, "p90": 2, "n_obs": 40},
                        "pressure_primary": {"median": 128, "p10": 115, "p90": 142, "n_obs": 2}})
    eng = Engine(content, baseline_store=store)
    out = eng.evaluate({"unit_id": "u-010", "service_age_years": 72, "class": "M"},
                       compensated_stress_obs(), CONTEXT)
    # falls through to population defaults -> degraded, never a crash
    assert "baseline_population_default" in out["flags"]
    assert out["confidence"] == "degraded"


# -------------------------------------------------------------- watchdog

def test_watchdog_flags_overdue_units_only(content):
    last_seen = {
        "u-quiet": "2026-07-03T06:00:00Z",   # 7h silent
        "u-fresh": "2026-07-03T12:30:00Z",   # 30 min
        "u-mobile": "2026-07-03T11:00:00Z",  # 2h silent, mobile expects 60min
    }
    deployments = {"u-quiet": "field_expedition", "u-mobile": "mobile_platform"}
    reports = check_overdue(content, last_seen, "2026-07-03T13:00:00Z", deployments)
    assert [r["unit_id"] for r in reports] == ["u-mobile", "u-quiet"]
    for r in reports:
        assert r["confidence"] == "insufficient"
        assert r["flags"] == ["unit_silent"]
        assert r["action_tier"] == "D3" and r["severity"] == "S2"
        assert "UNIT SILENT" in r["explanation"]
    assert reports[1]["silent_min"] == 420
    assert reports[0]["expected_interval_min"] == 60


def test_watchdog_unknown_deployment_uses_default_cadence(content):
    reports = check_overdue(content, {"u-x": "2026-07-03T08:00:00Z"},
                            "2026-07-03T13:00:00Z", {"u-x": "constructor"})
    assert len(reports) == 1  # 300 min silent > default 240
    assert reports[0]["deployment"] == "default"


def test_watchdog_is_deterministic(content):
    args = ({"b": "2026-07-03T01:00:00Z", "a": "2026-07-03T02:00:00Z"},
            "2026-07-03T13:00:00Z", {})
    r1 = check_overdue(content, *args)
    r2 = check_overdue(content, *args)
    assert canonical_json(r1) == canonical_json(r2)
    assert [r["unit_id"] for r in r1] == ["a", "b"]
