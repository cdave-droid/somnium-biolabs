"""GATE G1 — M1 + M2 + M3.

(a) Property test: no physically impossible value ever reaches M3/M4/M5.
(b) Artifact heuristics reproduce expected quality labels on labeled fixtures.
(c) Baseline computation matches hand-calculated values to 4 decimal places.
(d) Determinism: 1,000 repeated runs on identical input, byte-identical output.
"""
import random

from conftest import CONTEXT, PROFILE, compensated_stress_obs, make_obs

from sentinel import Engine, canonical_json
from sentinel.m1_ingest import ingest
from sentinel.m2_quality import assess
from sentinel.m3_state import compute_baselines
from sentinel.timeutil import parse_ts


# ------------------------------------------------------------- (a) property

def test_property_impossible_values_never_reach_logic(content):
    rng = random.Random(42)
    bounds = content["tables"]["operational_bounds"]["bounds"]
    metrics = sorted(bounds)
    for trial in range(300):
        obs, expect_rejected = [], set()
        for i in range(rng.randint(1, 25)):
            metric = rng.choice(metrics)
            lo, hi = bounds[metric]["min"], bounds[metric]["max"]
            if rng.random() < 0.4:  # impossible value
                value = hi + rng.uniform(1, 1e6) if rng.random() < 0.5 else lo - rng.uniform(1, 1e6)
                expect_rejected.add(f"o{i:03d}")
            else:
                value = rng.uniform(lo, hi)
            obs.append(make_obs(i, metric, value, hh=rng.randint(0, 23), mm=rng.randint(0, 59)))
        flags = set()
        accepted, quarantined, _ = ingest(obs, content, flags)
        accepted_ids = {o["obs_id"] for o in accepted}
        assert not (expect_rejected & accepted_ids), f"trial {trial}: impossible value accepted"
        assert expect_rejected <= {q["obs_id"] for q in quarantined}
        for o in accepted:
            b = bounds[o["type"]]
            assert b["min"] <= o["value"] <= b["max"]
        if expect_rejected:
            assert "data_rejected" in flags


def test_unit_conversion_and_unknown_unit(content):
    flags = set()
    accepted, quarantined, _ = ingest(
        [make_obs(0, "temperature_c", 98.6, 10, unit="f"),
         make_obs(1, "temperature_c", 37.0, 10, unit="furlongs")],
        content, flags)
    assert len(accepted) == 1 and abs(accepted[0]["value"] - 37.0) < 0.01
    assert quarantined[0]["reason"] == "unknown_unit:furlongs"


def test_duplicate_obs_id_quarantined(content):
    flags = set()
    accepted, quarantined, _ = ingest(
        [make_obs(0, "cycle_rate", 80, 10), make_obs(0, "cycle_rate", 90, 11)],
        content, flags)
    assert len(accepted) == 1 and accepted[0]["value"] == 80
    assert quarantined[0]["reason"] == "duplicate_obs_id"
    assert "duplicate_obs_id" in flags


def test_free_text_never_parsed_for_logic(content, engine):
    out = engine.evaluate(PROFILE, [make_obs(0, "free_text_note", "unit seems fine, saturation 60", 10)], CONTEXT)
    # A note alone gives the engine nothing to evaluate — honest failure.
    assert out["confidence"] == "insufficient"


# --------------------------------------------------------- (b) M2 heuristics

def _assess(content, obs_list, profile=None):
    flags = set()
    trace = []
    accepted, _, _ = ingest(obs_list, content, flags)
    assess(accepted, profile or {}, content, flags, trace)
    return {o["obs_id"]: o for o in accepted}, flags


def test_impossible_jump_flagged(content):
    lab, _ = _assess(content, [
        make_obs(0, "saturation_pct", 96, 10, 0),
        # 96 -> 55 in 5 seconds = 8.2/s > content limit 5/s
        {**make_obs(1, "saturation_pct", 55, 10, 0), "timestamp": "2026-07-03T10:00:05Z"},
    ])
    assert lab["o001"]["quality"] == "artifact_likely"
    assert any(r.startswith("aj_saturation") for r in lab["o001"]["rules_fired"])
    assert lab["o000"]["quality"] == "valid"


def test_spike_and_recover_flagged(content):
    lab, _ = _assess(content, [
        make_obs(0, "saturation_pct", 97, 10, 0),
        {**make_obs(1, "saturation_pct", 60, 10, 0), "timestamp": "2026-07-03T10:00:30Z"},
        {**make_obs(2, "saturation_pct", 96, 10, 1), "timestamp": "2026-07-03T10:01:00Z"},
    ])
    assert lab["o001"]["quality"] == "artifact_likely"
    assert "sr_saturation" in lab["o001"]["rules_fired"]


def test_cross_contradiction_worked_example(content):
    """The spec's worked example: saturation 60% alongside normal cycle_rate
    and a fully responsive unit -> the saturation reading is artifact-suspect."""
    lab, flags = _assess(content, [
        make_obs(0, "cycle_rate", 72, 10, 0),
        make_obs(1, "responsiveness", "R0", 10, 1),
        make_obs(2, "saturation_pct", 60, 10, 5),
    ])
    assert lab["o002"]["quality"] == "artifact_likely"
    assert "xc_sat_normal_vitals" in lab["o002"]["rules_fired"]
    assert "artifact_suspected_any_input" in flags


def test_wearable_noise_prior(content):
    lab, flags = _assess(content, [
        make_obs(0, "cycle_rate", 140, 10, source="wearable_sensor",
                 quality_meta={"noise_flag": True}),
    ])
    assert lab["o000"]["quality"] == "suspect"
    assert "suspect_inputs_present" in flags


def test_mechanism_protection(content):
    """artifact-shaped reading + plausible mechanism => protected, flagged."""
    profile = {"unit_id": "u-001", "known_conditions": ["reduced_capacity"]}
    lab, flags = _assess(content, [
        make_obs(0, "cycle_rate", 72, 10, 0),
        make_obs(1, "responsiveness", "R0", 10, 1),
        make_obs(2, "saturation_pct", 60, 10, 5),
    ], profile)
    assert lab["o002"]["quality"] == "artifact_likely"
    assert lab["o002"]["mechanism_protected"] is True
    assert "artifact_with_mechanism" in flags
    assert "artifact_suspected_any_input" not in flags


def test_mechanism_floor_enforced_end_to_end(content):
    """Spec M2 critical rule: mechanism-protected artifact must not end below
    the content mechanism floor (D3) in M7's final tier."""
    profile = {"unit_id": "u-001", "known_conditions": ["reduced_capacity"]}
    obs = [
        make_obs(0, "cycle_rate", 72, 10, 0),
        make_obs(1, "responsiveness", "R0", 10, 1),
        make_obs(2, "saturation_pct", 60, 10, 5),
    ]
    out = Engine(content).evaluate(profile, obs, {"deployment": "fixed_site"})
    assert "artifact_with_mechanism" in out["flags"]
    assert out["action_tier"] >= "D3"


# ------------------------------------------------------- (c) baseline maths

def test_baseline_matches_hand_calculation(content):
    # Hand-calculated: values 60..69 (n=10).
    # median = 64.5; p10: rank=0.9 -> 60 + 0.9*(61-60) = 60.9; p90: 68.1
    obs = [make_obs(i, "cycle_rate", 60 + i, hh=9, mm=i, day=2) for i in range(10)]
    flags, trace = set(), []
    accepted, _, _ = ingest(obs, content, flags)
    for o in accepted:
        o["quality"] = "valid"
        o["mechanism_protected"] = False
    ref = parse_ts("2026-07-03T00:00:00Z")
    b = compute_baselines({"unit_id": "x"}, accepted, content, ref, {"cycle_rate"}, flags, trace)["cycle_rate"]
    assert b["status"] == "personalized"
    assert abs(b["median"] - 64.5) < 1e-4
    assert abs(b["p10"] - 60.9) < 1e-4
    assert abs(b["p90"] - 68.1) < 1e-4
    assert b["n_obs"] == 10


def test_baseline_population_fallback_stratified(content):
    flags, trace = set(), []
    obs = [make_obs(0, "cycle_rate", 100, 10)]  # 1 obs < min_n_obs=8
    accepted, _, _ = ingest(obs, content, flags)
    for o in accepted:
        o["quality"] = "valid"
        o["mechanism_protected"] = False
    ref = parse_ts("2026-07-03T12:00:00Z")
    profile = {"unit_id": "x", "service_age_years": 72, "class": "M"}
    b = compute_baselines(profile, accepted, content, ref, {"cycle_rate"}, flags, trace)["cycle_rate"]
    assert b["status"] == "population_default"
    assert b["median"] == 72  # M / 65+ stratum from content
    assert "baseline_population_default" in flags


def test_baseline_unavailable_when_no_stratum(content):
    flags, trace = set(), []
    ref = parse_ts("2026-07-03T12:00:00Z")
    b = compute_baselines({"unit_id": "x"}, [], content, ref, {"strain_0_10"}, flags, trace)["strain_0_10"]
    assert b["status"] == "unavailable"
    assert "baseline_unavailable" in flags


# --------------------------------------------------------- (d) determinism

def test_determinism_1000_runs(content):
    obs = compensated_stress_obs()
    reference = canonical_json(Engine(content).evaluate(PROFILE, obs, CONTEXT))
    for _ in range(999):
        assert canonical_json(Engine(content).evaluate(PROFILE, obs, CONTEXT)) == reference


def test_input_order_invariance(content):
    """Observation list order must not affect the output (sorting is internal)."""
    obs = compensated_stress_obs()
    out1 = Engine(content).evaluate(PROFILE, obs, CONTEXT)
    shuffled = list(reversed(obs))
    out2 = Engine(content).evaluate(PROFILE, shuffled, CONTEXT)
    for key in ("severity", "action_tier", "matched_signatures", "explanation", "confidence"):
        assert out1[key] == out2[key]
