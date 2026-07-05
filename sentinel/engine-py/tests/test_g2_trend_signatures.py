"""GATE G2 — M4 + M5.

(a) Slope/trend functions match the numpy reference on 50 synthetic series,
    including irregular sampling and n < min_points refusals.
(b) 100% branch coverage over the logic-operator vocabulary.
(c) Misalignment check — monotonicity: perturbing inputs in the content-declared
    worse direction never DECREASES severity or action tier.
(d) Conflict resolution: multi-match fixtures show correct precedence and
    complete suppressed_signatures records.
"""
import copy
import json
import os
import random

import numpy as np
import pytest

from conftest import CONTEXT, DEMO_PKG, PROFILE, SCHEMA_DIR, compensated_stress_obs, make_obs

from sentinel import Engine, load_content
from sentinel.canonical import q6
from sentinel.constants import SEV_ORD, TIER_ORD
from sentinel.m4_trend import Features
from sentinel.stats import ols_slope, percentile


# ------------------------------------------------------- (a) numpy parity

def test_slope_matches_numpy_on_50_series():
    rng = random.Random(7)
    checked_refusals = 0
    for trial in range(50):
        min_points = rng.randint(2, 5)
        # Every 5th series is deliberately too short: the refusal branch is
        # part of the gate, not an accident of the seed.
        n = rng.randint(1, min_points - 1) if trial % 5 == 0 else rng.randint(min_points, 40)
        # Irregular sampling: cumulative random gaps, occasional bursts.
        ts, t = [], 1_780_000_000.0
        for _ in range(n):
            t += rng.choice([5, 30, 60, 600, 3600]) * rng.uniform(0.5, 1.5)
            ts.append(t)
        ys = [rng.uniform(40, 160) + (i * rng.uniform(-0.5, 0.5)) for i in range(n)]
        pts = list(zip(ts, ys))
        ours = ols_slope(pts, min_points)
        if n < min_points or n < 2:
            assert ours is None
            checked_refusals += 1
            continue
        xs = np.array([(x - ts[0]) / 60.0 for x in ts])
        ref = np.polyfit(xs, np.array(ys), 1)[0]
        assert ours == pytest.approx(ref, abs=1e-4), f"trial {trial}"
    assert checked_refusals >= 3


def test_percentile_matches_numpy():
    rng = random.Random(11)
    for _ in range(30):
        vals = [rng.uniform(0, 200) for _ in range(rng.randint(1, 50))]
        for p in (10, 50, 90):
            assert percentile(vals, p) == pytest.approx(float(np.percentile(vals, p)), abs=1e-4)


def test_slope_refuses_on_degenerate_time():
    assert ols_slope([(100.0, 5), (100.0, 9)], 2) is None  # zero time spread


# ---------------------------------------- (b) operator vocabulary coverage

def _features(content, obs_list, ref="2026-07-03T14:00:00Z"):
    from sentinel.m1_ingest import ingest
    from sentinel.timeutil import parse_ts
    flags = set()
    accepted, _, _ = ingest(obs_list, content, flags)
    for o in accepted:
        o["quality"] = "valid"
        o["mechanism_protected"] = False
    return Features(accepted, content, parse_ts(ref))


def _run_sig(content, sig, obs_list, baselines=None):
    from sentinel.m5_signatures import evaluate_signatures
    handle = dict(content)
    handle["published_signatures"] = [sig]
    f = _features(content, obs_list)
    trace = []
    return evaluate_signatures(handle, f, baselines or {}, set(), set(), trace)


def _sig(logic, required=("cycle_rate",), **extra):
    base = {
        "signature_id": "t_sig_v1", "version": "1.0.0", "status": "published",
        "name": "t", "author": "t", "reviewers": [], "required_inputs": list(required),
        "logic": logic, "severity": "S2",
        "action_tier_by_context": {"default": "D2"},
        "explanation_template": "test",
    }
    base.update(extra)
    return base


OPS_MATRIX = [
    # (logic, observations, expect_state)
    ({"all_of": [{"metric": "cycle_rate", "op": "gte", "value": 100, "window_min": 240}]},
     [make_obs(0, "cycle_rate", 120, 13)], "matched"),
    ({"all_of": [{"metric": "cycle_rate", "op": "lte", "value": 100, "window_min": 240}]},
     [make_obs(0, "cycle_rate", 80, 13)], "matched"),
    ({"all_of": [{"metric": "responsiveness", "op": "eq", "value": "R1", "window_min": 240}]},
     [make_obs(0, "responsiveness", "R1", 13)], "matched"),
    ({"all_of": [{"metric": "responsiveness", "op": "gte", "value": "R2", "window_min": 240}]},
     [make_obs(0, "responsiveness", "R3", 13)], "matched"),
    ({"all_of": [{"metric": "cycle_rate", "op": "trend_slope", "gte": 0.1, "window_min": 240, "min_points": 3}]},
     [make_obs(i, "cycle_rate", 80 + i * 20, 11 + i) for i in range(3)], "matched"),
    ({"all_of": [{"metric": "cycle_rate", "op": "trend_slope", "gte": 0.1, "window_min": 240, "min_points": 3}]},
     [make_obs(0, "cycle_rate", 80, 13)], "not_evaluable"),
    ({"all_of": [{"metric": "cycle_rate", "op": "sustained_for_min", "threshold": 130, "direction": "above",
                  "gte": 30, "window_min": 240}]},
     [make_obs(0, "cycle_rate", 140, 12, 0), make_obs(1, "cycle_rate", 150, 13, 0)], "matched"),
    ({"all_of": [{"metric": "cycle_rate", "op": "sustained_for_min", "threshold": 130, "direction": "above",
                  "gte": 30, "window_min": 240}]},
     [make_obs(0, "cycle_rate", 140, 12, 0), make_obs(1, "cycle_rate", 100, 13, 0)], "not_matched"),
    ({"all_of": [{"metric": "cycle_rate", "op": "crossed_threshold_count", "threshold": 130, "direction": "above",
                  "gte": 2, "window_min": 240}]},
     [make_obs(i, "cycle_rate", v, 10 + i) for i, v in enumerate([120, 140, 120, 145])], "matched"),
    ({"all_of": [{"op": "event_present", "event_id": "EV_POWER_LOSS", "window_min": 240},
                 {"metric": "cycle_rate", "op": "gte", "value": 0, "window_min": 240}]},
     [make_obs(0, "event", "EV_POWER_LOSS", 13), make_obs(1, "cycle_rate", 80, 13)], "matched"),
    ({"any_of": [{"metric": "cycle_rate", "op": "gte", "value": 500, "window_min": 240},
                 {"metric": "cycle_rate", "op": "gte", "value": 100, "window_min": 240}]},
     [make_obs(0, "cycle_rate", 120, 13)], "matched"),
    ({"none_of": [{"metric": "cycle_rate", "op": "gte", "value": 200, "window_min": 240}]},
     [make_obs(0, "cycle_rate", 120, 13)], "matched"),
    ({"at_least_n_of": {"n": 2, "of": [
        {"metric": "cycle_rate", "op": "gte", "value": 100, "window_min": 240},
        {"metric": "cycle_rate", "op": "lte", "value": 300, "window_min": 240},
        {"metric": "cycle_rate", "op": "gte", "value": 500, "window_min": 240}]}},
     [make_obs(0, "cycle_rate", 120, 13)], "matched"),
    ({"at_least_n_of": {"n": 2, "of": [
        {"metric": "cycle_rate", "op": "gte", "value": 100, "window_min": 240},
        {"metric": "saturation_pct", "op": "lte", "value": 90, "window_min": 240}]}},
     [make_obs(0, "cycle_rate", 120, 13)], "not_evaluable"),  # unknown leaf can still reach n
]


@pytest.mark.parametrize("logic,obs,expect", OPS_MATRIX)
def test_operator_vocabulary(content, logic, obs, expect):
    from sentinel.content import _walk_conditions
    leaves = []
    _walk_conditions(logic, leaves)
    required = sorted({c["metric"] for c in leaves if "metric" in c}) or ["cycle_rate"]
    res = _run_sig(content, _sig(logic, required), obs)
    if expect == "matched":
        assert [m["sig"]["signature_id"] for m in res["matched"]] == ["t_sig_v1"]
    elif expect == "not_matched":
        assert res["not_matched"] == ["t_sig_v1"]
    else:
        assert [ne["id"] for ne in res["not_evaluable"]] == ["t_sig_v1"]


def test_delta_ops_and_baseline_conditions(content):
    baselines = {"cycle_rate": {"median": 80, "p10": 70, "p90": 90, "n_obs": 20, "status": "personalized", "source": "profile"}}
    logic = {"all_of": [
        {"id": "c1", "metric": "cycle_rate", "op": "delta_from_baseline_pct", "gte": 20, "window_min": 240, "min_points": 1},
        {"id": "c2", "metric": "cycle_rate", "op": "delta_from_baseline_abs", "gte": 15, "window_min": 240, "min_points": 1},
        {"metric": "cycle_rate", "baseline_status": "personalized"},
    ]}
    res = _run_sig(content, _sig(logic), [make_obs(0, "cycle_rate", 100, 13)], baselines)
    assert len(res["matched"]) == 1
    computed = res["matched"][0]["computed"]
    assert computed["c1"]["delta_pct"] == 25
    assert computed["c2"]["delta_abs"] == 20

    # zero-baseline division refuses instead of crashing or matching
    zero = {"cycle_rate": {"median": 0, "p10": 0, "p90": 0, "n_obs": 20, "status": "personalized", "source": "profile"}}
    res = _run_sig(content, _sig({"all_of": [logic["all_of"][0]]}), [make_obs(0, "cycle_rate", 100, 13)], zero)
    assert [ne["id"] for ne in res["not_evaluable"]] == ["t_sig_v1"]


def test_flag_condition_scoped_to_signature_inputs(content):
    """An artifact on an UNRELATED metric must not veto a signature that
    excludes artifact_suspected_any_input — even when the case-level flag set
    already carries the flag (which M2 sets globally in the real pipeline)."""
    from sentinel.m5_signatures import evaluate_signatures
    sig = _sig({"all_of": [
        {"metric": "cycle_rate", "op": "gte", "value": 100, "window_min": 240},
        {"none_of": [{"flag": "artifact_suspected_any_input"}]}]})
    handle = dict(content)
    handle["published_signatures"] = [sig]
    f = _features(content, [make_obs(0, "cycle_rate", 120, 13)])
    case_flags = {"artifact_suspected_any_input"}  # as M2 sets it globally
    res = evaluate_signatures(handle, f, {}, {"saturation_pct"}, case_flags, [])
    assert len(res["matched"]) == 1
    res = evaluate_signatures(handle, f, {}, {"cycle_rate"}, case_flags, [])
    assert res["not_matched"] == ["t_sig_v1"]


# ------------------------------------------------- (c) monotonicity property

def _perturb(obs_list, metric, direction, delta, enums):
    out = []
    for o in obs_list:
        o = copy.deepcopy(o)
        if o["type"] == metric:
            if metric in enums:
                order = enums[metric]
                idx = order.index(o["value"])
                idx = min(len(order) - 1, idx + 1) if direction == "up" else max(0, idx - 1)
                o["value"] = order[idx]
            else:
                o["value"] = o["value"] + delta if direction == "up" else o["value"] - delta
        out.append(o)
    return out


def test_monotonicity_worse_inputs_never_decrease_response(content):
    """G2(c): for every published signature, perturb each of its input metrics
    in the content-declared worse direction; (severity, action_tier) must never
    decrease. Uniform shifts preserve inter-reading deltas so M2 relabeling
    cannot flip quality classes spuriously."""
    directions = content["tables"]["worse_direction"]["directions"]
    enums = content["tables"]["operational_bounds"]["enums"]
    bounds = content["tables"]["operational_bounds"]["bounds"]
    rng = random.Random(99)

    scenarios = {
        "compensated_stress": (PROFILE, compensated_stress_obs()),
        "high_rate": (PROFILE, [make_obs(i, "cycle_rate", 134 + i, 12, i * 10) for i in range(5)]),
        "reserve": (PROFILE, [make_obs(i, "reserve_level", 40 - i * 6, 8 + i) for i in range(6)]),
        "mixed": (PROFILE, compensated_stress_obs() + [make_obs(20, "reserve_level", 55, 12), make_obs(21, "saturation_pct", 93, 13)]),
    }

    violations = []
    for name, (profile, obs) in sorted(scenarios.items()):
        base = Engine(content).evaluate(profile, obs, CONTEXT)
        base_key = (SEV_ORD[base["severity"]], TIER_ORD[base["action_tier"]])
        metrics = sorted({o["type"] for o in obs if o["type"] not in ("event", "free_text_note")})
        for metric in metrics:
            direction = directions.get(metric, "none")
            if direction == "none":
                continue
            for _ in range(6):
                if metric in enums:
                    delta = 1
                else:
                    span = bounds[metric]["max"] - bounds[metric]["min"]
                    delta = rng.uniform(0.01, 0.25) * span
                worse_obs = _perturb(obs, metric, direction, delta, enums)
                out = Engine(content).evaluate(profile, worse_obs, CONTEXT)
                key = (SEV_ORD[out["severity"]], TIER_ORD[out["action_tier"]])
                if key < base_key:
                    violations.append((name, metric, delta, base_key, key, out["flags"]))
    assert not violations, f"monotonicity violations: {violations}"


# ---------------------------------------------- (d) conflict resolution

def test_conflict_precedence_and_suppression_record(content):
    """Both cycle-rate signatures match; the S3 must win and the S2 must be
    recorded as suppressed with a reason — never silently dropped."""
    obs = []
    for i, (hh, mm, v) in enumerate([(10, 0, 132), (11, 30, 135), (12, 30, 139), (13, 30, 144)]):
        obs.append(make_obs(i, "cycle_rate", v, hh, mm))
    for i, (hh, mm, v) in enumerate([(10, 0, 131), (11, 30, 126), (12, 30, 120), (13, 30, 116)], start=4):
        obs.append(make_obs(i, "pressure_primary", v, hh, mm))
    out = Engine(content).evaluate(PROFILE, obs, {"deployment": "fixed_site"})
    assert "compensated_stress_v1" in out["matched_signatures"]
    assert out["suppressed_signatures"] == [
        {"id": "high_cycle_rate_simple_v1", "reason": "superseded_by_higher_severity"}]
    assert out["severity"] == "S3"


def test_priority_tiebreak_within_group(content, tmp_package):
    pkg, resign = tmp_package
    with open(os.path.join(DEMO_PKG, "signatures/high_cycle_rate_simple_v1.json"), encoding="utf-8") as fh:
        rival = json.load(fh)
    rival["signature_id"] = "high_cycle_rate_rival_v1"
    rival["priority"] = 7  # beats the original's 5, same severity S2
    with open(os.path.join(pkg, "signatures", "high_cycle_rate_rival_v1.json"), "w", encoding="utf-8") as fh:
        json.dump(rival, fh, indent=2)
    resign()
    handle = load_content(pkg, SCHEMA_DIR)
    obs = [make_obs(i, "cycle_rate", 140 + i, 12, i * 15) for i in range(4)]
    out = Engine(handle).evaluate(PROFILE, obs, {"deployment": "fixed_site"})
    assert out["matched_signatures"] == ["high_cycle_rate_rival_v1"]
    assert out["suppressed_signatures"] == [
        {"id": "high_cycle_rate_simple_v1", "reason": "superseded_by_priority"}]
