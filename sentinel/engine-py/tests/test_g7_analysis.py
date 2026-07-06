"""§7 surveillance jobs + analysis harness, tested against synthetic audit
chains produced by the real engine.
"""
import json
import os
import subprocess
import sys

import pytest

from conftest import CONTEXT, DEMO_PKG, PROFILE, SENTINEL_ROOT, compensated_stress_obs, make_obs

from sentinel import Engine

sys.path.insert(0, os.path.join(SENTINEL_ROOT, "analysis"))
from outcome_backtest import backtest  # noqa: E402
from override_report import build_report  # noqa: E402
from replay_loader import join_cases, load_cases  # noqa: E402


def _graded_engine(content, n_agree=8, n_override_down=4):
    """Build an audit chain: n_agree accepted firings + n_override_down
    down-overridden firings of compensated_stress_v1, plus one healthy case
    with no outcome."""
    eng = Engine(content)
    for i in range(n_agree + n_override_down):
        profile = dict(PROFILE, unit_id=f"u-{i:03d}")  # distinct case ids
        out = eng.evaluate(profile, compensated_stress_obs(), CONTEXT)
        assert out["matched_signatures"] == ["compensated_stress_v1"]
        if i < n_agree:
            eng.record_outcome(out["case_id"], out["action_tier"], "",
                               outcome_label="deterioration_confirmed")
        else:
            eng.record_outcome(out["case_id"], "D1", "operator disagreed",
                               outcome_label="no_deterioration")
    eng.evaluate(PROFILE, [make_obs(0, "cycle_rate", 72, 10)], CONTEXT)  # ungraded
    return eng


def test_override_report_flags_only_with_sample_size(content):
    eng = _graded_engine(content, n_agree=8, n_override_down=4)  # 33% overridden
    rows = join_cases(eng.audit.records)
    report = build_report(rows, threshold=0.2, min_n=10)
    (entry,) = [r for r in report if r["signature"] == "compensated_stress_v1"]
    assert entry["graded_firings"] == 12
    assert entry["overrides"] == 4
    assert entry["dominant_direction"] == "down"
    assert entry["flagged_for_review"] is True

    # same rate, tiny sample -> NOT flagged (the min-n guard)
    small = _graded_engine(content, n_agree=2, n_override_down=1)
    report = build_report(join_cases(small.audit.records), threshold=0.2, min_n=10)
    (entry,) = [r for r in report if r["signature"] == "compensated_stress_v1"]
    assert entry["flagged_for_review"] is False


def test_backtest_ppv_and_recall(content):
    eng = _graded_engine(content, n_agree=6, n_override_down=2)
    # one confirmed deterioration the engine answered only via never-ignore floor
    out = eng.evaluate({"unit_id": "u-miss"}, [make_obs(0, "cycle_rate", 12, 10)], CONTEXT)
    assert out["confidence"] == "insufficient" and out["action_tier"] >= "D3"
    eng.record_outcome(out["case_id"], "D5", "", outcome_label="deterioration_confirmed")

    result = backtest(join_cases(eng.audit.records))
    (sig,) = [s for s in result["signatures"] if s["signature"] == "compensated_stress_v1"]
    assert sig["labeled_firings"] == 8
    assert sig["ppv"] == 0.75
    assert result["confirmed_cases"] == 7
    assert result["engine_recall"] == 1.0  # floor response counts as answered


def test_replay_loader_verifies_and_joins(content, tmp_path):
    from sentinel import FileAuditSink
    path = str(tmp_path / "chain.jsonl")
    eng = Engine(content, audit_sink=FileAuditSink(path))
    out = eng.evaluate(PROFILE, compensated_stress_obs(), CONTEXT)
    eng.record_outcome(out["case_id"], "D3", "note", outcome_label="indeterminate")
    rows = load_cases([path])
    assert len(rows) == 1
    assert rows[0]["outcome"]["outcome_label"] == "indeterminate"

    # single-bit tamper on disk -> loader refuses
    lines = open(path, encoding="utf-8").read().splitlines()
    assert '"u-001"' in lines[0]
    open(path, "w", encoding="utf-8").write(
        lines[0].replace('"u-001"', '"u-999"', 1) + "\n" + "\n".join(lines[1:]) + "\n")
    from sentinel import AuditIntegrityError
    with pytest.raises(AuditIntegrityError):
        load_cases([path])


def test_content_diff_reports_behavioral_changes(content, tmp_package):
    sys.path.insert(0, os.path.join(SENTINEL_ROOT, "analysis"))
    from content_diff import diff_packages
    pkg, resign = tmp_package
    assert diff_packages(DEMO_PKG, DEMO_PKG) == []  # identical -> no changes

    sig_path = os.path.join(pkg, "signatures", "high_cycle_rate_simple_v1.json")
    with open(sig_path, encoding="utf-8") as fh:
        sig = json.load(fh)
    sig["logic"]["all_of"][0]["threshold"] = 100  # was 130 -> now fires inside compensated-stress cases
    with open(sig_path, "w", encoding="utf-8") as fh:
        json.dump(sig, fh, indent=2)
    resign()
    diffs = diff_packages(DEMO_PKG, pkg)
    assert diffs, "threshold change must surface in the golden diff report"
    assert any("suppressed_signatures" in d["changes"] or "matched_signatures" in d["changes"]
               for d in diffs), diffs


def test_redteam_suite_holds(content):
    proc = subprocess.run(
        [sys.executable, os.path.join(SENTINEL_ROOT, "analysis", "run_redteam.py")],
        capture_output=True, text=True)
    assert proc.returncode == 0, proc.stdout + proc.stderr
    # the suite is grow-only; assert full pass without pinning the count
    assert "FAIL" not in proc.stdout
    import re
    m = re.search(r"(\d+)/(\d+) cases hold", proc.stdout)
    assert m and m.group(1) == m.group(2), proc.stdout


def test_local_pipeline_end_to_end(content, tmp_path):
    proc = subprocess.run(
        [sys.executable, os.path.join(SENTINEL_ROOT, "tools", "local_pipeline.py"),
         "--db", str(tmp_path / "p.sqlite")],
        capture_output=True, text=True)
    assert proc.returncode == 0, proc.stdout + proc.stderr
    assert "u-100 final assessment: S3/D5" in proc.stdout
    assert "u-200 silent" in proc.stdout
    assert "records verified" in proc.stdout
    assert "replay from DB: 5 cases byte-identical" in proc.stdout
