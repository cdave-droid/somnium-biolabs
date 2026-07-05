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


def test_non_finite_values_quarantined_and_evaluate_never_throws(content):
    """Findings: NaN passed M1 bounds comparisons, and Infinity in the raw
    inputs made audit.append throw OUT of evaluate() after the safe output
    was built."""
    from sentinel import Engine as E
    eng = E(content)
    obs = [
        {**make_obs(0, "cycle_rate", 80, 10)},
        {**make_obs(1, "cycle_rate", float("nan"), 11)},
        {**make_obs(2, "temperature_c", float("inf"), 11)},
    ]
    out = eng.evaluate({"unit_id": "u-1"}, obs, {"deployment": "fixed_site"})
    assert "internal_error" not in out["flags"]
    assert "data_rejected" in out["flags"]
    reasons = [t["detail"] for t in out["reasoning_trace"] if "not_finite" in t["detail"]]
    assert len(reasons) == 2
    # audit recorded despite unserializable raw inputs; chain verifies
    from sentinel import verify_chain
    verify_chain(eng.audit.records)
    assert eng.audit.records[0]["payload"] == {"unserializable_input": True}
    # replay skips the unreproducible case rather than crashing
    assert E(content).replay(eng.audit.records) == []


def test_non_ascii_obs_id_quarantined(content):
    out = Engine(content).evaluate(
        {"unit_id": "u-1"},
        [{**make_obs(0, "cycle_rate", 80, 10), "obs_id": "obs-\U0001f600"},
         make_obs(1, "cycle_rate", 82, 10, 30)],
        {"deployment": "fixed_site"})
    assert any("obs_id_not_ascii" in t["detail"] for t in out["reasoning_trace"])
    assert "internal_error" not in out["flags"]


def test_malformed_profile_and_context_are_normalized_not_fatal(content):
    """Finding: null known_conditions crashed Python (emergency output) while
    TS silently continued — a cross-runtime divergence AND an availability
    hole. Both now normalize identically with flags."""
    profile = {"unit_id": "u-1", "known_conditions": None, "service_age_years": "old",
               "baselines": "not-a-dict"}
    out = Engine(content).evaluate(profile, [make_obs(0, "cycle_rate", 80, 10)], "not-a-context")
    assert "internal_error" not in out["flags"]
    assert "invalid_profile_fields" in out["flags"]
    assert "invalid_context_fields" in out["flags"]
    assert "missing_context" in out["flags"]
    assert out["confidence"] == "degraded"


def test_missing_context_flagged_on_no_match_path(content):
    """Finding: missing_context was only set for MATCHED signatures, so a
    healthy no-match case with no context reported confidence 'high'."""
    out = Engine(content).evaluate({"unit_id": "u-1"}, [make_obs(0, "cycle_rate", 72, 10)], None)
    assert out["matched_signatures"] == []
    assert "missing_context" in out["flags"]
    assert out["confidence"] == "degraded"


def test_lone_surrogate_in_note_does_not_crash(content):
    obs = [make_obs(0, "cycle_rate", 80, 10),
           make_obs(1, "free_text_note", "bad \udc80 char", 10, 5)]
    eng = Engine(content)
    out = eng.evaluate({"unit_id": "u-1"}, obs, {"deployment": "fixed_site"})
    assert "internal_error" not in out["flags"]
    from sentinel import verify_chain
    verify_chain(eng.audit.records)


def test_emergency_output_carries_no_runtime_specific_names(content, monkeypatch):
    """Finding: the emergency output embedded Python/JS exception class names,
    breaking cross-runtime byte parity of the fault path."""
    import sentinel.engine as eng_mod

    def boom(*_a, **_k):
        raise ValueError("injected")

    monkeypatch.setattr(eng_mod.m5_signatures, "evaluate_signatures", boom)
    out = Engine(content).evaluate({"unit_id": "u-1"},
                                   [make_obs(0, "cycle_rate", 80, 10)],
                                   {"deployment": "fixed_site"})
    assert out["confidence"] == "insufficient"
    assert "ValueError" not in out["explanation"]
    assert out["reasoning_trace"] == [{"stage": "M8", "detail": "internal_error"}]


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
