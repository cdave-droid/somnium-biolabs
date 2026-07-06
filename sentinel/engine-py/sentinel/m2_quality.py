"""M2 — Signal-Quality Assessor. Deterministic artifact heuristics from
content files. Never deletes data — annotates quality and lets downstream
modules weight it (DECISIONS.md D7).

Screening is PER STREAM first (DECISIONS.md D19): every (metric, stream) pair
is screened on its own — waveform-shape rules never compare readings from
different devices, a stream with too many artifacts is distrusted wholesale,
and only then are streams reconciled against each other (disagreement) and
against other metrics (cross-signal contradiction).
"""
from __future__ import annotations

from .canonical import fmt_val
from .constants import NUMERIC_TYPES

_QUALITY_ORD = {"valid": 0, "suspect": 1, "artifact_likely": 2}

# Lookback for cross-signal-contradiction corroborating readings (minutes).
CROSS_RULE_LOOKBACK_MIN = 60


def _mark(obs, level, rule_id):
    if _QUALITY_ORD[level] > _QUALITY_ORD[obs["quality"]]:
        obs["quality"] = level
    if rule_id not in obs["rules_fired"]:
        obs["rules_fired"].append(rule_id)


def _series(accepted, metric):
    return [o for o in accepted if o["type"] == metric]


def _series_by_stream(accepted, metric):
    """(metric, stream) grouping in deterministic stream order — the unit of
    individual screening. Observations arrive already (ts, obs_id)-sorted."""
    groups: dict = {}
    for o in accepted:
        if o["type"] == metric:
            groups.setdefault(o["stream"], []).append(o)
    return [(stream, groups[stream]) for stream in sorted(groups)]


def _source_priority(screening, source):
    order = screening["source_priority"]
    return order.index(source) if source in order else len(order)


def _latest_plausible_at(accepted, metric, at_ts, enums):
    best = None
    for o in accepted:
        if o["type"] != metric or o["quality"] == "artifact_likely":
            continue
        if o["ts"] <= at_ts and at_ts - o["ts"] <= CROSS_RULE_LOOKBACK_MIN * 60:
            best = o
    return best


def _req_holds(req, value, enums):
    if req["op"] == "between":
        return isinstance(value, (int, float)) and req["min"] <= value <= req["max"]
    if req["metric"] in enums:
        order = enums[req["metric"]]
        if value not in order or req.get("value") not in order:
            return False
        a, b = order.index(value), order.index(req["value"])
    else:
        if not isinstance(value, (int, float)):
            return False
        a, b = value, req["value"]
    if req["op"] == "eq":
        return a == b
    if req["op"] == "gte":
        return a >= b
    if req["op"] == "lte":
        return a <= b
    return False


def assess(accepted, unit_profile, content, flags, trace):
    """Annotates accepted observations in place with quality/rules_fired/
    mechanism_protected. Returns (artifact_metrics, protected_metrics)."""
    rules = content["tables"]["artifact_rules"]
    screening = content["tables"]["stream_screening"]
    enums = content["tables"]["operational_bounds"]["enums"]

    for o in accepted:
        o["quality"] = "valid"
        o["rules_fired"] = []
        o["mechanism_protected"] = False

    numeric_metrics = sorted({o["type"] for o in accepted if o["type"] in NUMERIC_TYPES})
    screenable_metrics = sorted({o["type"] for o in accepted
                                 if o["type"] in NUMERIC_TYPES or o["type"] in enums})

    # Rule order is fixed for determinism: source_prior, per-stream
    # impossible_jump, per-stream spike_and_recover, per-stream distrust,
    # cross-stream disagreement, cross-signal contradiction.
    for rule in rules["source_prior"]:
        for o in accepted:
            if o["source"] == rule["source"] and bool(o["quality_meta"].get("noise_flag")) == rule["when_noise_flag"]:
                _mark(o, rule["mark"], rule["id"])

    # Waveform-shape rules run WITHIN one stream only: readings from two
    # devices are different signals, and comparing them manufactures
    # artifacts out of ordinary inter-device offsets.
    for rule in rules["impossible_jump"]:
        for _stream, series in _series_by_stream(accepted, rule["metric"]):
            for i in range(1, len(series)):
                prev, cur = series[i - 1], series[i]
                dt = cur["ts"] - prev["ts"]
                if dt <= 0:
                    if cur["value"] != prev["value"]:
                        _mark(prev, "artifact_likely", rule["id"] + ":simultaneous_conflict")
                        _mark(cur, "artifact_likely", rule["id"] + ":simultaneous_conflict")
                    continue
                if abs(cur["value"] - prev["value"]) / dt > rule["max_change_per_s"]:
                    _mark(cur, "artifact_likely", rule["id"])

    for rule in rules["spike_and_recover"]:
        for _stream, series in _series_by_stream(accepted, rule["metric"]):
            for i in range(1, len(series) - 1):
                a, b, c = series[i - 1], series[i], series[i + 1]
                if c["ts"] - a["ts"] > rule["window_s"]:
                    continue
                if a["value"] <= 0:
                    continue
                dropped = b["value"] <= a["value"] * (1 - rule["drop_pct"] / 100.0)
                recovered = c["value"] >= a["value"] * (rule["recovery_pct"] / 100.0)
                if dropped and recovered:
                    _mark(b, "artifact_likely", rule["id"])

    # Per-stream trust verdict: a stream whose recent readings are dominated
    # by artifact shapes is not a signal to be believed selectively — its
    # remaining readings are downgraded wholesale until it is re-verified.
    for metric in screenable_metrics:
        for stream, series in _series_by_stream(accepted, metric):
            n = len(series)
            if n < screening["min_points_for_distrust"]:
                continue
            artifact_n = sum(1 for o in series if o["quality"] == "artifact_likely")
            source = series[-1]["source"]
            max_frac = screening["max_artifact_fraction"].get(
                source, screening["max_artifact_fraction"]["default"])
            if artifact_n / n >= max_frac and artifact_n > 0:
                for o in series:
                    _mark(o, "artifact_likely", "stream_untrusted")
                flags.add("stream_untrusted")
                trace.append({"stage": "M2", "detail":
                              f"stream {stream}/{metric} distrusted ({artifact_n}/{n} readings artifact-flagged); all its readings excluded pending re-verification"})

    # Cross-stream reconciliation: near-simultaneous usable readings of the
    # SAME metric from different streams that disagree beyond tolerance. The
    # lower-trust reading becomes suspect; the disagreement is always flagged.
    disagreement = screening["disagreement"]
    for metric in numeric_metrics:
        streams = []
        for stream, series in _series_by_stream(accepted, metric):
            usable = [o for o in series if o["quality"] != "artifact_likely"]
            if usable:
                latest = usable[-1]
                streams.append((_source_priority(screening, latest["source"]), stream, latest))
        if len(streams) < 2:
            continue
        streams.sort(key=lambda s: (s[0], s[1]))
        _prio, _stream, anchor = streams[0]
        tol_abs = disagreement.get("tolerance_abs", {}).get(metric)
        for _p, _s, other in streams[1:]:
            if abs(other["ts"] - anchor["ts"]) > disagreement["window_s"]:
                continue
            if tol_abs is not None:
                tolerance = tol_abs
            else:
                pct = disagreement["tolerance_pct"].get(metric, disagreement["tolerance_pct"]["default"])
                tolerance = abs(anchor["value"]) * pct / 100.0
            if abs(other["value"] - anchor["value"]) > tolerance:
                _mark(other, "suspect", "stream_disagreement")
                flags.add("stream_disagreement")
                trace.append({"stage": "M2", "detail":
                              f"stream disagreement on {metric}: {anchor['stream']}={fmt_val(anchor['value'])} vs {other['stream']}={fmt_val(other['value'])} within {fmt_val(disagreement['window_s'])}s; higher-trust source preferred — re-measure to resolve"})

    for rule in rules["cross_contradiction"]:
        for o in _series(accepted, rule["metric"]):
            v = o["value"]
            hit = (rule["op"] == "lte" and v <= rule["value"]) or (rule["op"] == "gte" and v >= rule["value"])
            if not hit:
                continue
            corroborated = True
            for req in rule["requires_all"]:
                latest = _latest_plausible_at(accepted, req["metric"], o["ts"], enums)
                if latest is None or not _req_holds(req, latest["value"], enums):
                    corroborated = False
                    break
            if corroborated:
                _mark(o, rule["mark"], rule["id"])

    # Mechanism protection: an artifact-shaped reading in a unit whose profile
    # contains a plausible mechanism for that abnormality must not be
    # dismissed (§3 M2 critical rule). M7 floors the tier via content.
    mechanisms = set(unit_profile.get("known_conditions", [])) | set(unit_profile.get("active_mitigations", []))
    protected_by = {}
    for mech in sorted(mechanisms):
        for metric in rules["mechanism_map"].get(mech, []):
            protected_by.setdefault(metric, mech)

    artifact_metrics, protected_metrics = set(), set()
    for o in accepted:
        if o["type"] not in NUMERIC_TYPES and o["type"] not in enums:
            continue
        if o["quality"] == "artifact_likely":
            if o["type"] in protected_by:
                o["mechanism_protected"] = True
                protected_metrics.add(o["type"])
                flags.add("artifact_with_mechanism")
            else:
                artifact_metrics.add(o["type"])
                flags.add("artifact_suspected_any_input")
        elif o["quality"] == "suspect":
            flags.add("suspect_inputs_present")
        if o["rules_fired"]:
            detail = f"obs {o['obs_id']} ({o['type']}) flagged {o['quality']} by {','.join(o['rules_fired'])}"
            if o["mechanism_protected"]:
                detail += f" — mechanism-protected via '{protected_by[o['type']]}'"
            trace.append({"stage": "M2", "detail": detail})

    return artifact_metrics, protected_metrics
