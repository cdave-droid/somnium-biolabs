#!/usr/bin/env python3
"""Golden-suite generator. Defines every golden scenario (and its
counterfactual), runs the Python reference engine, and writes:

  golden/cases/<name>/input.json              — the scenario input
  golden/cases/<name>/expected.json           — human-reviewable expected output
  golden/cases/<name>/expected.canonical.json — byte-exact contract consumed by
                                                BOTH runtimes' CI

Regenerating expected outputs is a content-change regression event (§7.3):
the diff must be reviewed case by case before commit.
"""
from __future__ import annotations

import json
import os
import sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(ROOT, "engine-py"))
from sentinel import Engine, load_content  # noqa: E402
from sentinel.canonical import canonical_json  # noqa: E402

PKG = os.path.join(ROOT, "content", "packages", "demo-2026.07.0")
OUT = os.path.join(ROOT, "golden", "cases")

PROFILE = {
    "unit_id": "u-001", "service_age_years": 72, "class": "M", "mass_kg": 82,
    "known_conditions": [], "active_mitigations": [],
    "baselines": {
        "cycle_rate": {"median": 68, "p10": 60, "p90": 78, "window_days": 14, "n_obs": 41},
        "pressure_primary": {"median": 128, "p10": 115, "p90": 142, "window_days": 14, "n_obs": 30},
    },
}
MOBILE = {"deployment": "mobile_platform", "operator_skill": "technician",
          "time_to_service_min": {"self_service": 30, "on_site": 20, "recovery": 1440},
          "connectivity": "intermittent"}
FIXED = {"deployment": "fixed_site", "operator_skill": "engineer",
         "time_to_service_min": {"self_service": 5, "on_site": 5, "recovery": 60},
         "connectivity": "online"}
FIXED_REMOTE = dict(FIXED, time_to_service_min={"self_service": 30, "on_site": 60, "recovery": 1440})
FIELD = {"deployment": "field_expedition", "operator_skill": "basic",
         "time_to_service_min": {"self_service": 60, "on_site": 240, "recovery": 2880},
         "connectivity": "offline"}


def O(i, typ, value, ts, source="fixed_monitor", **extra):
    obs = {"obs_id": f"o{i:03d}", "unit_id": "u-001", "timestamp": ts, "type": typ, "source": source}
    if typ == "event":
        obs["event_id"] = value
    elif typ == "free_text_note":
        obs["text"] = value
    else:
        obs["value"] = value
    obs.update(extra)
    return obs


def rising_stress(start=0):
    obs = []
    for i, (ts, v) in enumerate([("2026-07-03T10:00:00Z", 88), ("2026-07-03T11:30:00Z", 95),
                                 ("2026-07-03T12:30:00Z", 104), ("2026-07-03T13:30:00Z", 118)], start):
        obs.append(O(i, "cycle_rate", v, ts))
    for i, (ts, v) in enumerate([("2026-07-03T10:00:00Z", 131), ("2026-07-03T11:30:00Z", 126),
                                 ("2026-07-03T12:30:00Z", 120), ("2026-07-03T13:30:00Z", 116)], start + 4):
        obs.append(O(i, "pressure_primary", v, ts))
    return obs


CASES = {
    # -- matched-signature scenarios ------------------------------------
    "compensated_stress_fixed_site": {
        "input": {"unit_profile": PROFILE, "observations": rising_stress(), "context": FIXED, "reference_time": None},
        "assert": {"severity": "S3", "action_tier": "D4", "matched_signatures": ["compensated_stress_v1"],
                   "trajectory": "worsening"},
    },
    "compensated_stress_mobile": {
        "input": {"unit_profile": PROFILE, "observations": rising_stress(), "context": MOBILE, "reference_time": None},
        "assert": {"severity": "S3", "action_tier": "D5"},
    },
    "compensated_stress_remote_recovery_promotion": {
        "input": {"unit_profile": PROFILE, "observations": rising_stress(), "context": FIXED_REMOTE, "reference_time": None},
        "assert": {"action_tier": "D5"},  # modifier floor beats fixed_site D4
    },
    "suppression_high_rate_superseded": {
        "input": {"unit_profile": PROFILE,
                  "observations": [O(i, "cycle_rate", v, ts) for i, (ts, v) in enumerate(
                      [("2026-07-03T10:00:00Z", 132), ("2026-07-03T11:30:00Z", 135),
                       ("2026-07-03T12:30:00Z", 139), ("2026-07-03T13:30:00Z", 144)])] +
                  [O(i, "pressure_primary", v, ts) for i, (ts, v) in enumerate(
                      [("2026-07-03T10:00:00Z", 131), ("2026-07-03T11:30:00Z", 126),
                       ("2026-07-03T12:30:00Z", 120), ("2026-07-03T13:30:00Z", 116)], 4)],
                  "context": FIXED, "reference_time": None},
        "assert": {"matched_signatures": ["compensated_stress_v1"],
                   "suppressed_signatures": [{"id": "high_cycle_rate_simple_v1",
                                              "reason": "superseded_by_higher_severity"}]},
    },
    "sustained_high_rate_only": {
        "input": {"unit_profile": PROFILE,
                  "observations": [O(i, "cycle_rate", v, ts) for i, (ts, v) in enumerate(
                      [("2026-07-03T12:00:00Z", 134), ("2026-07-03T12:30:00Z", 136),
                       ("2026-07-03T13:00:00Z", 133), ("2026-07-03T13:30:00Z", 138)])],
                  "context": FIXED, "reference_time": None},
        "assert": {"severity": "S2", "action_tier": "D2", "matched_signatures": ["high_cycle_rate_simple_v1"]},
    },
    "unresponsive_unit": {
        "input": {"unit_profile": PROFILE,
                  "observations": [O(0, "responsiveness", "R3", "2026-07-03T13:00:00Z", source="manual_entry")],
                  "context": FIELD, "reference_time": None},
        "assert": {"severity": "S4", "action_tier": "D5", "matched_signatures": ["unresponsive_unit_v1"]},
    },
    "reserve_depletion_field": {
        "input": {"unit_profile": PROFILE,
                  "observations": [O(i, "reserve_level", v, ts, source="inline_gauge") for i, (ts, v) in enumerate(
                      [("2026-07-03T02:00:00Z", 42), ("2026-07-03T05:00:00Z", 36),
                       ("2026-07-03T08:00:00Z", 31), ("2026-07-03T11:00:00Z", 26),
                       ("2026-07-03T13:00:00Z", 22)])],
                  "context": FIELD, "reference_time": None},
        "assert": {"severity": "S3", "action_tier": "D5", "matched_signatures": ["reserve_depletion_v1"],
                   "trajectory": "worsening"},  # D4 context tier promoted to D5 by remote-recovery modifier (2880 min)
    },
    "reserve_depletion_fixed_site": {
        "input": {"unit_profile": PROFILE,
                  "observations": [O(i, "reserve_level", v, ts, source="inline_gauge") for i, (ts, v) in enumerate(
                      [("2026-07-03T02:00:00Z", 40), ("2026-07-03T05:00:00Z", 34),
                       ("2026-07-03T08:00:00Z", 30), ("2026-07-03T11:00:00Z", 25),
                       ("2026-07-03T13:00:00Z", 21)])],
                  "context": FIXED, "reference_time": None},
        "assert": {"severity": "S3", "action_tier": "D3", "matched_signatures": ["reserve_depletion_v1"]},
    },
    "population_baseline_degraded": {
        "input": {"unit_profile": {"unit_id": "u-002", "service_age_years": 72, "class": "M"},
                  "observations": [O(i, "cycle_rate", v, ts) for i, (ts, v) in enumerate(
                      [("2026-07-03T10:00:00Z", 100), ("2026-07-03T11:30:00Z", 104),
                       ("2026-07-03T13:00:00Z", 110)])] +
                  [O(i, "pressure_primary", v, ts) for i, (ts, v) in enumerate(
                      [("2026-07-03T10:00:00Z", 128), ("2026-07-03T11:30:00Z", 121),
                       ("2026-07-03T13:00:00Z", 114)], 3)],
                  "context": MOBILE, "reference_time": None},
        "assert": {"matched_signatures": ["compensated_stress_v1"], "confidence": "degraded"},
    },
    "mechanism_protected_low_saturation": {
        "input": {"unit_profile": {"unit_id": "u-003", "service_age_years": 70, "class": "F",
                                   "known_conditions": ["reduced_capacity"]},
                  "observations": [O(0, "cycle_rate", 72, "2026-07-03T10:00:00Z"),
                                   O(1, "responsiveness", "R0", "2026-07-03T10:01:00Z", source="manual_entry"),
                                   O(2, "saturation_pct", 60, "2026-07-03T10:05:00Z", source="wearable_sensor")],
                  "context": FIXED, "reference_time": None},
        "assert": {"severity": "S4", "action_tier": "D5",
                   "matched_signatures": ["low_saturation_critical_v1"]},
    },
    "artifact_on_unrelated_metric": {
        "input": {"unit_profile": {"unit_id": "u-004"},
                  "observations": [O(0, "saturation_pct", 82, "2026-07-03T13:00:00Z"),
                                   O(1, "saturation_pct", 82, "2026-07-03T13:30:00Z"),
                                   O(2, "mass_kg", 70, "2026-07-03T13:00:00Z"),
                                   O(3, "mass_kg", 80, "2026-07-03T13:01:00Z")],
                  "context": FIXED, "reference_time": None},
        "assert": {"severity": "S4", "action_tier": "D5",
                   "matched_signatures": ["low_saturation_critical_v1"],
                   "confidence": "degraded"},  # mass artifact must not veto the sat match
    },
    "hostile_deployment_defaults": {
        "input": {"unit_profile": {"unit_id": "u-005"},
                  "observations": [O(0, "responsiveness", "R3", "2026-07-03T13:00:00Z", source="manual_entry")],
                  "context": {"deployment": "constructor"}, "reference_time": None},
        "assert": {"severity": "S4", "action_tier": "D5",
                   "matched_signatures": ["unresponsive_unit_v1"]},  # default tier, prototype keys inert
    },
    # -- healthy path ----------------------------------------------------
    "healthy_stable": {
        "input": {"unit_profile": PROFILE,
                  "observations": [O(0, "cycle_rate", 70, "2026-07-03T09:00:00Z"),
                                   O(1, "cycle_rate", 72, "2026-07-03T11:00:00Z"),
                                   O(2, "cycle_rate", 69, "2026-07-03T13:00:00Z"),
                                   O(3, "pressure_primary", 129, "2026-07-03T13:00:00Z"),
                                   O(4, "saturation_pct", 97, "2026-07-03T13:05:00Z")],
                  "context": FIXED, "reference_time": None},
        "assert": {"severity": "S1", "action_tier": "D0", "confidence": "high", "matched_signatures": []},
    },
    # -- honest-failure scenarios ----------------------------------------
    "m8_empty_input_mobile": {
        "input": {"unit_profile": PROFILE, "observations": [], "context": MOBILE, "reference_time": None},
        "assert": {"confidence": "insufficient", "action_tier": "D3", "severity": "S2"},
    },
    "m8_contradiction_artifact_saturation": {
        "input": {"unit_profile": PROFILE,
                  "observations": [O(0, "cycle_rate", 72, "2026-07-03T10:00:00Z"),
                                   O(1, "responsiveness", "R0", "2026-07-03T10:01:00Z", source="manual_entry"),
                                   O(2, "saturation_pct", 60, "2026-07-03T10:05:00Z", source="wearable_sensor")],
                  "context": FIXED, "reference_time": None},
        "assert": {"confidence": "insufficient", "action_tier": "D5"},  # bound floor via artifact breach
    },
    "m8_unknown_event_code": {
        "input": {"unit_profile": PROFILE,
                  "observations": [O(0, "event", "EV_MYSTERY", "2026-07-03T10:00:00Z", source="event_report"),
                                   O(1, "cycle_rate", 74, "2026-07-03T10:00:00Z")],
                  "context": FIXED, "reference_time": None},
        "assert": {"confidence": "insufficient"},
    },
    "m8_rejected_extreme_breaches_bound": {
        "input": {"unit_profile": PROFILE,
                  "observations": [O(0, "cycle_rate", 12, "2026-07-03T10:00:00Z", source="manual_entry")],
                  "context": MOBILE, "reference_time": None},
        "assert": {"confidence": "insufficient", "action_tier": "D5"},  # ni_cycle_low floor
    },
    # -- counterfactuals (each asserts the CHANGED outcome) ---------------
    "ct_compstress_01_delta_below_threshold": {
        "refutes": "compensated_stress_v1",
        "input": {"unit_profile": PROFILE,
                  "observations": [O(i, "cycle_rate", v, ts) for i, (ts, v) in enumerate(
                      [("2026-07-03T10:00:00Z", 70), ("2026-07-03T11:30:00Z", 72),
                       ("2026-07-03T12:30:00Z", 74), ("2026-07-03T13:30:00Z", 76)])] +
                  [O(i, "pressure_primary", v, ts) for i, (ts, v) in enumerate(
                      [("2026-07-03T10:00:00Z", 131), ("2026-07-03T11:30:00Z", 126),
                       ("2026-07-03T12:30:00Z", 120), ("2026-07-03T13:30:00Z", 116)], 4)],
                  "context": FIXED, "reference_time": None},
        "assert": {"matched_signatures": [], "severity": "S1", "action_tier": "D0"},
    },
    "ct_compstress_02_pressure_flat": {
        "refutes": "compensated_stress_v1",
        "input": {"unit_profile": PROFILE,
                  "observations": [O(i, "cycle_rate", v, ts) for i, (ts, v) in enumerate(
                      [("2026-07-03T10:00:00Z", 88), ("2026-07-03T11:30:00Z", 95),
                       ("2026-07-03T12:30:00Z", 104), ("2026-07-03T13:30:00Z", 118)])] +
                  [O(i, "pressure_primary", v, ts) for i, (ts, v) in enumerate(
                      [("2026-07-03T10:00:00Z", 128), ("2026-07-03T11:30:00Z", 129),
                       ("2026-07-03T12:30:00Z", 127), ("2026-07-03T13:30:00Z", 128)], 4)],
                  "context": FIXED, "reference_time": None},
        "assert": {"matched_signatures": []},
    },
    "ct_highrate_01_not_sustained": {
        "refutes": "high_cycle_rate_simple_v1",
        "input": {"unit_profile": PROFILE,
                  "observations": [O(i, "cycle_rate", v, ts) for i, (ts, v) in enumerate(
                      [("2026-07-03T12:00:00Z", 134), ("2026-07-03T12:30:00Z", 120),
                       ("2026-07-03T13:00:00Z", 136), ("2026-07-03T13:30:00Z", 118)])],
                  "context": FIXED, "reference_time": None},
        "assert": {"matched_signatures": []},
    },
    "ct_lowsat_01_above_threshold": {
        "refutes": "low_saturation_critical_v1",
        "input": {"unit_profile": {"unit_id": "u-003", "service_age_years": 70, "class": "F",
                                   "known_conditions": ["reduced_capacity"]},
                  "observations": [O(0, "saturation_pct", 91, "2026-07-03T10:05:00Z")],
                  "context": FIXED, "reference_time": None},
        "assert": {"matched_signatures": [], "severity": "S1"},
    },
    "ct_reserve_01_stable_level": {
        "refutes": "reserve_depletion_v1",
        "input": {"unit_profile": PROFILE,
                  "observations": [O(i, "reserve_level", v, ts, source="inline_gauge") for i, (ts, v) in enumerate(
                      [("2026-07-03T02:00:00Z", 28), ("2026-07-03T05:00:00Z", 29),
                       ("2026-07-03T08:00:00Z", 28), ("2026-07-03T11:00:00Z", 29),
                       ("2026-07-03T13:00:00Z", 28)])],
                  "context": FIELD, "reference_time": None},
        "assert": {"matched_signatures": []},
    },
    "ct_unresponsive_01_alert": {
        "refutes": "unresponsive_unit_v1",
        "input": {"unit_profile": PROFILE,
                  "observations": [O(0, "responsiveness", "R1", "2026-07-03T13:00:00Z", source="manual_entry")],
                  "context": FIELD, "reference_time": None},
        "assert": {"matched_signatures": []},
    },
}


def main(check_only=False):
    content = load_content(PKG)
    failures = []
    for name, case in sorted(CASES.items()):
        inp = case["input"]
        out = Engine(content).evaluate(inp["unit_profile"], inp["observations"],
                                       inp["context"], inp["reference_time"])
        for key, expected in case["assert"].items():
            actual = out[key]
            if actual != expected:
                failures.append(f"{name}: {key} expected {expected!r}, got {actual!r}")
        refuted = case.get("refutes")
        if refuted:
            # A counterfactual must show the signature genuinely evaluated to
            # false — landing in not_evaluable would satisfy matched==[] while
            # proving nothing (adversarial-review finding).
            if refuted in out["matched_signatures"]:
                failures.append(f"{name}: refuted signature {refuted} still matched")
            if refuted in [ne["id"] for ne in out["not_evaluable_signatures"]]:
                failures.append(f"{name}: refuted signature {refuted} was not_evaluable, not refuted")
        if check_only:
            continue
        case_dir = os.path.join(OUT, name)
        os.makedirs(case_dir, exist_ok=True)
        with open(os.path.join(case_dir, "input.json"), "w", encoding="utf-8") as fh:
            json.dump(inp, fh, indent=2)
            fh.write("\n")
        with open(os.path.join(case_dir, "expected.json"), "w", encoding="utf-8") as fh:
            json.dump(out, fh, indent=2, ensure_ascii=False)
            fh.write("\n")
        with open(os.path.join(case_dir, "expected.canonical.json"), "w", encoding="utf-8") as fh:
            fh.write(canonical_json(out))
    if failures:
        print("INTENT ASSERTIONS FAILED:")
        for f in failures:
            print("  -", f)
        sys.exit(1)
    print(f"{'checked' if check_only else 'wrote'} {len(CASES)} golden cases; all intent assertions hold")


if __name__ == "__main__":
    main(check_only="--check" in sys.argv)
