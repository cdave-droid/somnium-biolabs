"""GATE G3 — M6 + M7 + M8.

(a) Context adapter can only RAISE tiers (property test across random contexts).
(b) Explanation completeness: every matched signature and active flag is
    referenced by the rendered explanation (automated lint vs the trace).
(c) Honest-failure battery: 40 degenerate cases ALL route through M8 with
    confidence: insufficient and context-floor (or higher) action tiers.
(d) Crash safety: injected exceptions in each module still yield an M8-safe
    output (fault injection).
"""
import random

import pytest

from conftest import CONTEXT, PROFILE, compensated_stress_obs, make_obs

from sentinel import Engine
from sentinel.constants import FLAG_TEXTS, TIER_ORD


# --------------------------------------------------------- (a) raise-only

def _random_context(rng):
    if rng.random() < 0.1:
        return None
    ctx = {}
    if rng.random() < 0.9:
        ctx["deployment"] = rng.choice(
            ["fixed_site", "mobile_platform", "field_expedition", "remote_station", "edge_site"])
    if rng.random() < 0.7:
        ctx["operator_skill"] = rng.choice(["untrained", "basic", "technician", "engineer"])
    if rng.random() < 0.8:
        ctx["time_to_service_min"] = {
            "self_service": rng.randint(0, 120), "on_site": rng.randint(0, 300),
            "recovery": rng.randint(0, 4000)}
    if rng.random() < 0.5:
        ctx["connectivity"] = rng.choice(["online", "intermittent", "offline"])
    return ctx


def test_property_context_can_only_raise_tier(content):
    """For every matched signature, the final tier is >= the signature's own
    context-mapped tier: no context, modifier, or floor may lower it."""
    rng = random.Random(1234)
    obs = compensated_stress_obs()
    for _ in range(200):
        ctx = _random_context(rng)
        out = Engine(content).evaluate(PROFILE, obs, ctx)
        assert out["matched_signatures"], "scenario must match for this property"
        for sid in out["matched_signatures"]:
            sig = next(s for s in content["published_signatures"] if s["signature_id"] == sid)
            tier_map = sig["action_tier_by_context"]
            deployment = (ctx or {}).get("deployment")
            base_tier = tier_map.get(deployment, tier_map["default"]) if deployment else tier_map["default"]
            assert TIER_ORD[out["action_tier"]] >= TIER_ORD[base_tier], (ctx, out["action_tier"], base_tier)


def test_modifier_promotes_remote_recovery(content):
    obs = compensated_stress_obs()
    near = dict(CONTEXT, deployment="fixed_site", time_to_service_min={"recovery": 60})
    far = dict(CONTEXT, deployment="fixed_site", time_to_service_min={"recovery": 1440})
    assert Engine(content).evaluate(PROFILE, obs, near)["action_tier"] == "D4"
    assert Engine(content).evaluate(PROFILE, obs, far)["action_tier"] == "D5"


# ----------------------------------------- (b) explanation completeness lint

def _lint_explanation(out):
    """Every matched signature must contribute its rendered template; every
    active flag must be narrated; no unresolved {placeholders}."""
    text = out["explanation"]
    assert "{" not in text and "}" not in text, f"unrendered placeholder in: {text}"
    for flag in out["flags"]:
        if flag == "engine_could_not_fully_evaluate":
            assert "ENGINE COULD NOT FULLY EVALUATE" in text
        else:
            assert FLAG_TEXTS[flag] in text, f"flag {flag} not narrated"
    if out["confidence"] == "insufficient":
        assert "ENGINE COULD NOT FULLY EVALUATE" in text
        assert "Most valuable next input" in text


def test_explanation_completeness_across_output_paths(content):
    scenarios = [
        (PROFILE, compensated_stress_obs(), CONTEXT),                       # matched
        (PROFILE, [make_obs(0, "cycle_rate", 72, 10)], CONTEXT),            # healthy
        (PROFILE, [], CONTEXT),                                             # empty -> M8
        (PROFILE, [make_obs(0, "temperature_c", 99, 10)], CONTEXT),         # rejected -> M8
        ({"unit_id": "u", "known_conditions": ["reduced_capacity"]},
         [make_obs(0, "cycle_rate", 72, 10), make_obs(1, "responsiveness", "R0", 10, 1),
          make_obs(2, "saturation_pct", 60, 10, 5)], CONTEXT),              # mechanism floor
        (PROFILE, compensated_stress_obs(), None),                          # missing context
    ]
    for profile, obs, ctx in scenarios:
        out = Engine(content).evaluate(profile, obs, ctx)
        _lint_explanation(out)
        for sid in out["matched_signatures"]:
            sig = next(s for s in content["published_signatures"] if s["signature_id"] == sid)
            anchor = sig["explanation_template"].split("{")[0].strip()
            assert anchor[:25] in out["explanation"], f"{sid} template missing from explanation"


# ------------------------------------------- (c) honest-failure battery (40)

def _battery_cases():
    """40 degenerate cases. Each must produce confidence=insufficient and an
    action tier at or above the context floor. Groups of parametrized
    variants keep each case distinct and labeled."""
    cases = {}
    deployments = ["fixed_site", "mobile_platform", "field_expedition", "remote_station", "edge_site"]

    # 1-6: empty inputs across deployments + no context at all
    for d in deployments:
        cases[f"empty_{d}"] = (PROFILE, [], {"deployment": d})
    cases["empty_no_context"] = (PROFILE, [], None)

    # 7-8: notes only / events only give logic nothing to evaluate
    cases["notes_only"] = (PROFILE, [make_obs(0, "free_text_note", "looks pale", 10)], CONTEXT)
    cases["unknown_event"] = (PROFILE, [make_obs(0, "event", "EV_NOT_IN_VOCAB", 10),
                                        make_obs(1, "cycle_rate", 80, 10)], CONTEXT)

    # 9-13: all inputs quarantined (physically impossible), per metric
    impossible = {"cycle_rate": 800, "saturation_pct": 140, "temperature_c": 99,
                  "pressure_primary": 900, "reserve_level": -40}
    for i, (metric, v) in enumerate(sorted(impossible.items())):
        cases[f"impossible_{metric}"] = (PROFILE, [make_obs(0, metric, v, 10)], CONTEXT)

    # 14-18: all inputs artifact-flagged (spike-recover triple), no mechanism
    for d in deployments:
        cases[f"all_artifact_{d}"] = (PROFILE, [
            make_obs(0, "saturation_pct", 97, 10, 0),
            {**make_obs(1, "saturation_pct", 60, 10, 0), "timestamp": "2026-07-03T10:00:30Z"},
            {**make_obs(2, "saturation_pct", 96, 10, 1), "timestamp": "2026-07-03T10:01:00Z"},
        ], {"deployment": d})

    # 19-23: contradictory readings (cross-signal contradiction -> artifact ->
    # nothing usable for the sat signature; sat breaches never-ignore)
    for d in deployments:
        cases[f"contradiction_{d}"] = (PROFILE, [
            make_obs(0, "cycle_rate", 72, 10, 0),
            make_obs(1, "responsiveness", "R0", 10, 1),
            make_obs(2, "saturation_pct", 60, 10, 5),
        ], {"deployment": d})

    # 24-28: single unparseable/garbage observations
    cases["bad_timestamp"] = (PROFILE, [{**make_obs(0, "cycle_rate", 80, 10), "timestamp": "yesterday"}], CONTEXT)
    cases["bad_value_type"] = (PROFILE, [{**make_obs(0, "cycle_rate", 80, 10), "value": "eighty"}], CONTEXT)
    cases["unknown_metric_type"] = (PROFILE, [{**make_obs(0, "cycle_rate", 80, 10), "type": "voltage"}], CONTEXT)
    cases["unknown_source"] = (PROFILE, [{**make_obs(0, "cycle_rate", 80, 10), "source": "psychic"}], CONTEXT)
    cases["unknown_unit"] = (PROFILE, [{**make_obs(0, "cycle_rate", 80, 10), "unit": "furlongs"}], CONTEXT)

    # 29-33: quarantined-but-extreme values breaching never-ignore bounds
    cases["rejected_extreme_low_rate"] = (PROFILE, [make_obs(0, "cycle_rate", 12, 10)], CONTEXT)
    cases["rejected_extreme_sat"] = (PROFILE, [make_obs(0, "saturation_pct", -5, 10)], CONTEXT)
    cases["rejected_extreme_pressure"] = (PROFILE, [make_obs(0, "pressure_primary", 10, 10)], CONTEXT)
    cases["rejected_extreme_temp_high"] = (PROFILE, [make_obs(0, "temperature_c", 60, 10)], CONTEXT)
    cases["rejected_mixed_with_valid"] = (PROFILE, [make_obs(0, "cycle_rate", 12, 10),
                                                    make_obs(1, "strain_0_10", 2, 10)], CONTEXT)

    # 34-38: duplicate ids only + malformed structures
    cases["all_duplicates"] = (PROFILE, [make_obs(0, "free_text_note", "a", 10),
                                         make_obs(0, "free_text_note", "b", 11)], CONTEXT)
    cases["non_dict_observation"] = (PROFILE, ["not an observation"], CONTEXT)
    cases["missing_obs_id"] = (PROFILE, [{"unit_id": "u", "timestamp": "2026-07-03T10:00:00Z",
                                          "type": "cycle_rate", "value": 80, "source": "manual_entry"}], CONTEXT)
    cases["event_without_id"] = (PROFILE, [{**make_obs(0, "event", "EV_LEAK", 10)}], CONTEXT)
    cases["event_without_id"][1][0].pop("event_id")
    cases["responsiveness_bad_level"] = (PROFILE, [make_obs(0, "responsiveness", "R9", 10)], CONTEXT)

    # 39-40: empty profile + empty everything
    cases["empty_profile_no_obs"] = ({}, [], CONTEXT)
    cases["everything_empty"] = ({}, [], None)
    return sorted(cases.items())


@pytest.mark.parametrize("name,case", _battery_cases())
def test_honest_failure_battery(content, name, case):
    profile, obs, ctx = case
    out = Engine(content).evaluate(profile, obs, ctx)
    assert out["confidence"] == "insufficient", f"{name}: expected insufficient, got {out['confidence']}"
    assert "engine_could_not_fully_evaluate" in out["flags"]
    floors = content["tables"]["floors"]["insufficient_floor_by_deployment"]
    deployment = (ctx or {}).get("deployment")
    floor = floors.get(deployment, floors["default"]) if deployment else floors["default"]
    assert TIER_ORD[out["action_tier"]] >= TIER_ORD[floor["action_tier"]], name
    assert "ENGINE COULD NOT FULLY EVALUATE" in out["explanation"], name


def test_battery_size_is_40():
    assert len(_battery_cases()) == 40


def test_negative_control_confident_case_does_not_route_to_m8(content):
    """Control: a clean matched case must NOT be insufficient (guards against
    an implementation that routes everything through M8 to pass the battery)."""
    out = Engine(content).evaluate(PROFILE, compensated_stress_obs(), CONTEXT)
    assert out["confidence"] != "insufficient"
    assert out["matched_signatures"] == ["compensated_stress_v1"]


# ------------------------------------------------------ (d) fault injection

MODULE_FAULTS = [
    ("sentinel.engine.m1_ingest", "ingest"),
    ("sentinel.engine.m2_quality", "assess"),
    ("sentinel.engine.m3_state", "compute_baselines"),
    ("sentinel.engine", "classify_trajectory"),
    ("sentinel.engine.m5_signatures", "evaluate_signatures"),
    ("sentinel.engine.m6_context", "signature_tier"),
]


@pytest.mark.parametrize("target,attr", MODULE_FAULTS)
def test_fault_injection_yields_safe_output(content, monkeypatch, target, attr):
    import sentinel.engine as eng_mod

    def boom(*_args, **_kwargs):
        raise RuntimeError("injected fault")

    if target == "sentinel.engine":
        monkeypatch.setattr(eng_mod, attr, boom)
    else:
        mod = getattr(eng_mod, target.rsplit(".", 1)[1])
        monkeypatch.setattr(mod, attr, boom)

    out = Engine(content).evaluate(PROFILE, compensated_stress_obs(), CONTEXT)
    assert out["confidence"] == "insufficient"
    assert "internal_error" in out["flags"]
    # Emergency floor is the MAXIMUM configured context floor.
    floors = content["tables"]["floors"]["insufficient_floor_by_deployment"]
    max_floor = max(f["action_tier"] for f in floors.values())
    assert TIER_ORD[out["action_tier"]] >= TIER_ORD[max_floor]
    _lint_explanation(out)
