#!/usr/bin/env python3
"""Differential parity fuzzer: generates seeded random scenarios (including
hostile ones — bad units, artifacts, duplicates, extremes, unknown events,
missing context) and byte-compares Python vs TypeScript EngineOutputs.

Usage: python tools/fuzz_parity.py [n_cases] [seed]
Requires engine-ts to be built (npm run build --prefix engine-ts).
"""
from __future__ import annotations

import json
import os
import random
import subprocess
import sys
import tempfile

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(ROOT, "engine-py"))
from sentinel import Engine, load_content  # noqa: E402
from sentinel.canonical import canonical_json  # noqa: E402

PKG = os.path.join(ROOT, "content", "packages", "demo-2026.07.0")

METRICS = ["cycle_rate", "flow_rate", "saturation_pct", "pressure_primary",
           "pressure_secondary", "temperature_c", "strain_0_10", "mass_kg", "reserve_level"]
SOURCES = ["wearable_sensor", "inline_gauge", "manual_entry", "fixed_monitor"]
DEPLOYMENTS = ["fixed_site", "mobile_platform", "field_expedition", "remote_station", "edge_site"]
EVENTS = ["EV_POWER_LOSS", "EV_IMPACT", "EV_LEAK", "EV_MYSTERY_CODE"]


def random_case(rng: random.Random) -> dict:
    profile = {"unit_id": f"u-{rng.randint(1, 5)}"}
    if rng.random() < 0.8:
        profile["service_age_years"] = rng.randint(1, 99)
    if rng.random() < 0.8:
        profile["class"] = rng.choice(["M", "F", "X"])
    if rng.random() < 0.4:
        profile["known_conditions"] = rng.sample(
            ["reduced_capacity", "intermittent_cycling", "throttled_mode", "other_condition",
             "constructor", "__proto__"], rng.randint(1, 2))
    if rng.random() < 0.08:  # malformed shapes must normalize identically
        profile["known_conditions"] = rng.choice([None, "reduced_capacity", 42, [1, "ok"]])
    if rng.random() < 0.08:
        profile["service_age_years"] = rng.choice(["old", None, True])
    if rng.random() < 0.5:
        profile["baselines"] = {
            "cycle_rate": {"median": rng.randint(55, 95), "p10": 50, "p90": 100,
                           "window_days": 14, "n_obs": rng.choice([2, 8, 40, 40.0])},
        }

    n_obs = rng.randint(0, 30)
    base_min = 0
    observations = []
    for i in range(n_obs):
        base_min += rng.choice([0, 1, 5, 30, 90])
        hh, mm = divmod(base_min % 1440, 60)
        ts = f"2026-07-03T{hh:02d}:{mm:02d}:{rng.choice([0, 15, 30]):02d}Z"
        kind = rng.random()
        if kind < 0.75:
            metric = rng.choice(METRICS)
            spans = {"cycle_rate": (10, 350), "flow_rate": (-5, 130), "saturation_pct": (-10, 110),
                     "pressure_primary": (10, 340), "pressure_secondary": (5, 240),
                     "temperature_c": (15, 50), "strain_0_10": (-1, 12), "mass_kg": (0.1, 750),
                     "reserve_level": (-20, 120)}
            lo, hi = spans[metric]
            value = round(rng.uniform(lo, hi), rng.choice([0, 1, 3]))
            obs = {"obs_id": f"o{i:03d}", "unit_id": profile["unit_id"], "timestamp": ts,
                   "type": metric, "value": value, "source": rng.choice(SOURCES)}
            if rng.random() < 0.1:
                obs["unit"] = rng.choice(["f", "lb", "kpa", "bogus_unit"])
            if rng.random() < 0.15:
                obs["quality_meta"] = {"noise_flag": rng.random() < 0.5}
        elif kind < 0.85:
            obs = {"obs_id": f"o{i:03d}", "unit_id": profile["unit_id"], "timestamp": ts,
                   "type": "responsiveness",
                   "value": rng.choice(["R0", "R1", "R2", "R3", "R9", 3.0, 2]),
                   "source": "manual_entry"}
        elif kind < 0.93:
            obs = {"obs_id": f"o{i:03d}", "unit_id": profile["unit_id"], "timestamp": ts,
                   "type": "event", "event_id": rng.choice(EVENTS), "source": "event_report"}
        else:
            text = "note ~ " + "x" * rng.randint(0, 10)
            if rng.random() < 0.2:
                text += " \ud800"  # lone surrogate -> U+FFFD in both runtimes
            obs = {"obs_id": f"o{i:03d}", "unit_id": profile["unit_id"], "timestamp": ts,
                   "type": "free_text_note", "text": text, "source": "manual_entry"}
        if rng.random() < 0.05 and observations:
            obs["obs_id"] = observations[rng.randrange(len(observations))]["obs_id"]  # duplicate
        if rng.random() < 0.03:
            obs["timestamp"] = "not-a-timestamp"
        observations.append(obs)

    context = None
    if rng.random() < 0.05:
        return {"unit_profile": profile, "observations": observations,
                "context": rng.choice(["yesterday", 42, ["fixed_site"]]),
                "reference_time": None}
    if rng.random() < 0.9:
        context = {}
        if rng.random() < 0.9:
            # 10% hostile: prototype-chain key names must be inert (see
            # test_review_regressions.py) and byte-identical across runtimes.
            if rng.random() < 0.1:
                context["deployment"] = rng.choice(
                    ["constructor", "toString", "__proto__", "hasOwnProperty", "valueOf"])
            else:
                context["deployment"] = rng.choice(DEPLOYMENTS)
        if rng.random() < 0.7:
            context["operator_skill"] = rng.choice(["untrained", "basic", "technician", "engineer"])
        if rng.random() < 0.8:
            context["time_to_service_min"] = {"self_service": rng.randint(0, 120),
                                              "on_site": rng.randint(0, 400),
                                              "recovery": rng.randint(0, 4000)}
    return {"unit_profile": profile, "observations": observations, "context": context,
            "reference_time": None}


def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 200
    seed = int(sys.argv[2]) if len(sys.argv) > 2 else 20260705
    rng = random.Random(seed)
    content = load_content(PKG)
    run_case_js = os.path.join(ROOT, "engine-ts", "dist", "bin", "run_case.js")

    divergent = 0
    for i in range(n):
        case = random_case(rng)
        py_out = canonical_json(Engine(content).evaluate(
            case["unit_profile"], case["observations"], case["context"], case["reference_time"]))
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as fh:
            json.dump(case, fh)
            path = fh.name
        try:
            ts_out = subprocess.run(["node", run_case_js, PKG, path],
                                    capture_output=True, text=True, check=True).stdout.strip()
        finally:
            os.unlink(path)
        if py_out != ts_out:
            divergent += 1
            print(f"DIVERGE case {i} (seed {seed}):")
            print("  input:", json.dumps(case)[:400])
            for j, (a, b) in enumerate(zip(py_out, ts_out)):
                if a != b:
                    print(f"  first diff at byte {j}: py …{py_out[max(0, j-60):j+60]}…")
                    print(f"                          ts …{ts_out[max(0, j-60):j+60]}…")
                    break
            if divergent >= 3:
                print("stopping after 3 divergences")
                break
    print(f"fuzz parity: {n - divergent}/{n} byte-identical (seed {seed})")
    sys.exit(1 if divergent else 0)


if __name__ == "__main__":
    main()
