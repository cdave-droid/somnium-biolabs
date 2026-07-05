import json
import os
import shutil
import sys

import pytest

ENGINE_PY = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SENTINEL_ROOT = os.path.dirname(ENGINE_PY)
sys.path.insert(0, ENGINE_PY)
sys.path.insert(0, os.path.join(SENTINEL_ROOT, "tools"))

DEMO_PKG = os.path.join(SENTINEL_ROOT, "content", "packages", "demo-2026.07.0")
SCHEMA_DIR = os.path.join(SENTINEL_ROOT, "content", "schema")
MALFORMED_DIR = os.path.join(SENTINEL_ROOT, "content", "tests", "malformed")
GOLDEN_DIR = os.path.join(SENTINEL_ROOT, "golden", "cases")

from sentinel import Engine, load_content  # noqa: E402


@pytest.fixture(scope="session")
def content():
    return load_content(DEMO_PKG)


@pytest.fixture()
def engine(content):
    return Engine(content)


@pytest.fixture()
def tmp_package(tmp_path):
    """Copy the demo package into tmp for mutation; returns (path, resign)."""
    dst = tmp_path / "pkg"
    shutil.copytree(DEMO_PKG, dst)

    def resign():
        from sign_content import sign
        sign(str(dst), "2026.07.0-demo", "1.0.0")

    return str(dst), resign


PROFILE = {
    "unit_id": "u-001", "service_age_years": 72, "class": "M", "mass_kg": 82,
    "known_conditions": [], "active_mitigations": [],
    "baselines": {
        "cycle_rate": {"median": 68, "p10": 60, "p90": 78, "window_days": 14, "n_obs": 41},
        "pressure_primary": {"median": 128, "p10": 115, "p90": 142, "window_days": 14, "n_obs": 30},
    },
}

CONTEXT = {
    "deployment": "mobile_platform", "operator_skill": "technician",
    "time_to_service_min": {"self_service": 30, "on_site": 20, "recovery": 1440},
    "resources": [], "connectivity": "intermittent",
}


def make_obs(i, typ, value, hh, mm=0, source="fixed_monitor", day=3, **extra):
    obs = {
        "obs_id": f"o{i:03d}", "unit_id": "u-001",
        "timestamp": f"2026-07-{day:02d}T{hh:02d}:{mm:02d}:00Z",
        "type": typ, "source": source,
    }
    if typ == "event":
        obs["event_id"] = value
    elif typ == "free_text_note":
        obs["text"] = value
    else:
        obs["value"] = value
    obs.update(extra)
    return obs


def compensated_stress_obs():
    """Canonical worked scenario: rising cycle_rate + falling pressure."""
    obs = []
    for i, (hh, mm, v) in enumerate([(10, 0, 88), (11, 30, 95), (12, 30, 104), (13, 30, 118)]):
        obs.append(make_obs(i, "cycle_rate", v, hh, mm))
    for i, (hh, mm, v) in enumerate([(10, 0, 131), (11, 30, 126), (12, 30, 120), (13, 30, 116)], start=4):
        obs.append(make_obs(i, "pressure_primary", v, hh, mm))
    return obs
