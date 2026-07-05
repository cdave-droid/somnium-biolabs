"""Regression tests for confirmed adversarial-review findings. Each test is
named for the finding it pins; if one fails, the corresponding under-triage
or crash bug has been reintroduced.
"""
from conftest import make_obs

from sentinel import Engine


def _low_sat_with_unrelated_artifact_obs():
    """Valid low-ish saturation readings + an impossible-jump artifact on
    mass_kg (70 -> 80 kg in 60 s, > 0.05 kg/s content limit)."""
    return [
        make_obs(0, "saturation_pct", 82, 13, 0),
        make_obs(1, "saturation_pct", 82, 13, 30),
        make_obs(2, "mass_kg", 70, 13, 0),
        {**make_obs(3, "mass_kg", 80, 13, 1)},
    ]


def test_artifact_on_unrelated_metric_cannot_veto_critical_signature(content):
    """Finding: the case-level artifact flag leaked into per-signature flag
    conditions, so a mass-sensor glitch suppressed the low-saturation S4
    signature (S1/D0 instead of S4/D5)."""
    out = Engine(content).evaluate(
        {"unit_id": "u-1"}, _low_sat_with_unrelated_artifact_obs(), {"deployment": "fixed_site"})
    assert out["matched_signatures"] == ["low_saturation_critical_v1"]
    assert out["severity"] == "S4"
    assert out["action_tier"] == "D5"
    # the unrelated artifact still shows up honestly in flags/confidence
    assert "artifact_suspected_any_input" in out["flags"]
    assert out["confidence"] == "degraded"


def test_artifact_on_own_input_still_vetoes(content):
    """Control: an artifact on the signature's OWN required input must still
    trip the none_of guard (and then escalate via the never-ignore-on-artifact
    path rather than matching confidently)."""
    obs = [
        make_obs(0, "cycle_rate", 72, 10, 0),
        make_obs(1, "responsiveness", "R0", 10, 1),
        make_obs(2, "saturation_pct", 60, 10, 5),
    ]
    out = Engine(content).evaluate({"unit_id": "u-1"}, obs, {"deployment": "fixed_site"})
    assert out["matched_signatures"] == []
    assert out["confidence"] == "insufficient"
    assert out["action_tier"] == "D5"  # bound floor via artifact breach


def test_hostile_deployment_string_uses_default_tier(content):
    """Finding (TS): 'constructor' as deployment resolved through the
    prototype chain. Both runtimes must treat any unknown deployment as the
    default tier map entry + context_default_tier flag."""
    obs = [make_obs(0, "responsiveness", "R3", 13)]
    for deployment in ("constructor", "toString", "__proto__", "hasOwnProperty", "made_up_site"):
        out = Engine(content).evaluate({"unit_id": "u-1"}, obs, {"deployment": deployment})
        assert out["matched_signatures"] == ["unresponsive_unit_v1"], deployment
        assert out["action_tier"] == "D5", deployment
        assert "context_default_tier" in out["flags"], deployment


def test_hostile_deployment_on_m8_floor_path(content):
    """M8 empty-input with a hostile deployment must return the default floor,
    not crash."""
    for deployment in ("constructor", "__proto__"):
        out = Engine(content).evaluate({"unit_id": "u-1"}, [], {"deployment": deployment})
        assert out["confidence"] == "insufficient"
        assert out["action_tier"] == "D3"


def test_hostile_known_conditions_do_not_crash(content):
    """Finding (TS): mechanism_map['constructor'] resolved to a function and
    threw. Hostile profile strings must be inert."""
    profile = {"unit_id": "u-1", "known_conditions": ["constructor", "__proto__", "valueOf"],
               "active_mitigations": ["toString"]}
    obs = [
        make_obs(0, "saturation_pct", 97, 10, 0),
        {**make_obs(1, "saturation_pct", 60, 10, 0), "timestamp": "2026-07-03T10:00:30Z"},
        {**make_obs(2, "saturation_pct", 96, 10, 1), "timestamp": "2026-07-03T10:01:00Z"},
    ]
    out = Engine(content).evaluate(profile, obs, {"deployment": "fixed_site"})
    # spike artifact must NOT be mechanism-protected by a hostile key
    assert "artifact_with_mechanism" not in out["flags"]
    assert "internal_error" not in out["flags"]
