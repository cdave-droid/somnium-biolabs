"""Silent-unit watchdog (GAPS.md B3): nothing else owns data ABSENCE — a unit
that stops reporting never triggers the engine, and in remote monitoring that
is the highest-risk event.

`check_overdue` is a pure, deterministic function (caller supplies `now`);
scheduling it (cron, queue worker) is deployment wiring, documented in
INTEGRATION.md. Expected cadences and the overdue floor are content, not code.
"""
from __future__ import annotations

from .canonical import q6
from .timeutil import parse_ts


def check_overdue(content, last_seen, now, deployment_by_unit=None):
    """last_seen: {unit_id: ISO-8601 UTC of the most recent observation}.
    Returns a sorted list of overdue reports (empty = all units current)."""
    cadence = content["tables"]["cadence"]
    intervals = cadence["expected_interval_min_by_deployment"]
    floor = cadence["overdue_floor"]
    now_s = parse_ts(now)

    reports = []
    for unit_id in sorted(last_seen):
        last_s = parse_ts(last_seen[unit_id])
        deployment = (deployment_by_unit or {}).get(unit_id)
        interval = intervals.get(deployment, intervals["default"])
        silent_min = q6((now_s - last_s) / 60.0)
        if silent_min <= interval:
            continue
        reports.append({
            "unit_id": unit_id,
            "deployment": deployment if deployment in intervals else "default",
            "last_seen": last_seen[unit_id],
            "silent_min": silent_min,
            "expected_interval_min": interval,
            "action_tier": floor["action_tier"],
            "severity": floor["severity"],
            "confidence": "insufficient",
            "flags": ["unit_silent"],
            "explanation": (
                f"UNIT SILENT: no observation for {silent_min} minutes "
                f"(expected at least every {interval}). The engine cannot evaluate a unit "
                f"it cannot hear; treat this with the configured overdue floor "
                f"({floor['severity']}/{floor['action_tier']}) until contact is re-established."
            ),
        })
    return reports
