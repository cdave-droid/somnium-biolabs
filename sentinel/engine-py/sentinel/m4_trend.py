"""M4 — Trend & Trajectory Engine. Windowed feature computations consumed by
M5, plus content-rule trajectory classification. Refuses to emit a slope from
fewer than min_points (§3 M4).
"""
from __future__ import annotations

from .canonical import fmt_val, q6
from .stats import median, ols_slope


class Features:
    """Deterministic windowed views over usable observations.

    Usable = valid | suspect | mechanism-protected artifact (DECISIONS.md D7).
    Ordinal metrics (from content enums) are held as (index, label) pairs.
    """

    def __init__(self, accepted, content, reference_time):
        self.ref = reference_time
        self.enums = content["tables"]["operational_bounds"]["enums"]
        self.by_metric: dict = {}
        self.events: list = []
        for o in accepted:  # already sorted by (ts, obs_id)
            usable = o["quality"] != "artifact_likely" or o.get("mechanism_protected")
            if o["type"] == "event":
                self.events.append(o)
                continue
            if not usable or "value" not in o:
                continue
            if o["type"] in self.enums:
                idx = self.enums[o["type"]].index(o["value"])
                self.by_metric.setdefault(o["type"], []).append((o["ts"], idx, o["value"]))
            else:
                self.by_metric.setdefault(o["type"], []).append((o["ts"], o["value"], None))

    def ordinal_index(self, metric, label):
        order = self.enums.get(metric)
        if order is None or label not in order:
            return None
        return order.index(label)

    def in_window(self, metric, window_min):
        lo = self.ref - window_min * 60
        return [p for p in self.by_metric.get(metric, []) if lo <= p[0] <= self.ref]

    def latest(self, metric, window_min):
        pts = self.in_window(metric, window_min)
        return pts[-1] if pts else None

    def window_median(self, metric, window_min, min_points):
        pts = self.in_window(metric, window_min)
        if len(pts) < min_points:
            return None
        return median([p[1] for p in pts])

    def slope(self, metric, window_min, min_points):
        pts = self.in_window(metric, window_min)
        return ols_slope([(p[0], p[1]) for p in pts], min_points)

    def sustained_min(self, metric, window_min, threshold, direction):
        pts = self.in_window(metric, window_min)
        if not pts:
            return None
        def beyond(v):
            return v > threshold if direction == "above" else v < threshold
        if not beyond(pts[-1][1]):
            return 0.0
        start = len(pts) - 1
        while start > 0 and beyond(pts[start - 1][1]):
            start -= 1
        return q6((pts[-1][0] - pts[start][0]) / 60.0)

    def crossings(self, metric, window_min, threshold, direction):
        pts = self.in_window(metric, window_min)
        if len(pts) < 2:
            return None
        count = 0
        for i in range(1, len(pts)):
            prev_v, cur_v = pts[i - 1][1], pts[i][1]
            if direction == "above" and prev_v <= threshold < cur_v:
                count += 1
            elif direction == "below" and prev_v >= threshold > cur_v:
                count += 1
        return count

    def event_present(self, event_id, window_min):
        lo = self.ref - window_min * 60
        return any(e["event_id"] == event_id and lo <= e["ts"] <= self.ref for e in self.events)


def classify_trajectory(features, content, trace):
    rules = content["tables"]["trajectory_rules"]
    worse = improving = evaluated = 0
    details = []
    for m in rules["metrics"]:
        s = features.slope(m["metric"], rules["window_min"], rules["min_points"])
        if s is None:
            continue
        evaluated += 1
        thr = m["slope_per_min"]
        if m["worse_direction"] == "up":
            if s >= thr:
                worse += 1
                details.append(f"{m['metric']} worsening (slope {fmt_val(s)}/min)")
            elif s <= -thr:
                improving += 1
        else:
            if s <= -thr:
                worse += 1
                details.append(f"{m['metric']} worsening (slope {fmt_val(s)}/min)")
            elif s >= thr:
                improving += 1
    if evaluated == 0:
        result = "unknown"
    elif worse >= rules["worsening_min_signals"]:
        result = "worsening"
    elif improving >= rules["improving_min_signals"] and worse == 0:
        result = "improving"
    else:
        result = "stable"
    detail = f"trajectory {result} (worse_signals={worse}, improving_signals={improving}, metrics_evaluated={evaluated})"
    if details:
        detail += ": " + "; ".join(details)
    trace.append({"stage": "M4", "detail": detail})
    return result
