"""M5 — Signature Evaluator. Three-valued logic (DECISIONS.md D6): a leaf
that lacks the data to answer is `unknown`, which makes the signature
not_evaluable rather than silently unmatched. All matches recorded; conflicts
resolved by explicit precedence with losers logged (never silently dropped).
"""
from __future__ import annotations

from .canonical import fmt_val, q6
from .constants import SEV_ORD

TRUE, FALSE, UNKNOWN = "true", "false", "unknown"


class _EvalCtx:
    def __init__(self, features, baselines, sig_flags, case_flags):
        self.features = features
        self.baselines = baselines
        self.sig_flags = sig_flags        # flags scoped to this signature's inputs
        self.case_flags = case_flags
        self.computed = {}                # condition_id -> computed values
        self.unknown_reasons = []


def _compare(result, cond):
    if "gte" in cond:
        return TRUE if result >= cond["gte"] else FALSE
    if "lte" in cond:
        return TRUE if result <= cond["lte"] else FALSE
    if "eq" in cond:
        return TRUE if result == cond["eq"] else FALSE
    return FALSE


def _store(ctx, cond, values):
    cid = cond.get("id")
    if cid:
        out = dict(values)
        if "window_min" in cond:
            out["window_min"] = cond["window_min"]
            out["window_h"] = q6(cond["window_min"] / 60.0)
        if "threshold" in cond:
            out["threshold"] = cond["threshold"]
        ctx.computed[cid] = out


def _eval_leaf(cond, ctx):
    f = ctx.features
    if "flag" in cond:
        return TRUE if cond["flag"] in ctx.sig_flags or cond["flag"] in ctx.case_flags else FALSE
    if "baseline_status" in cond and "op" not in cond:
        b = ctx.baselines.get(cond["metric"])
        status = b["status"] if b else "unavailable"
        return TRUE if status == cond["baseline_status"] else FALSE

    op = cond["op"]
    metric = cond.get("metric")

    if op == "event_present":
        present = f.event_present(cond["event_id"], cond["window_min"])
        _store(ctx, cond, {"value": 1 if present else 0})
        return TRUE if present else FALSE

    if op in ("gte", "lte", "eq"):
        latest = f.latest(metric, cond["window_min"])
        if latest is None:
            ctx.unknown_reasons.append(f"no_data:{metric}")
            return UNKNOWN
        raw, display = latest[1], latest[2] if latest[2] is not None else latest[1]
        target = cond["value"]
        if metric in f.enums:
            target = f.ordinal_index(metric, target)
            if target is None:
                ctx.unknown_reasons.append(f"bad_ordinal_target:{metric}")
                return UNKNOWN
        _store(ctx, cond, {"value": display})
        faux = {"gte": {"gte": target}, "lte": {"lte": target}, "eq": {"eq": target}}[op]
        return _compare(raw, faux)

    if op in ("delta_from_baseline_abs", "delta_from_baseline_pct"):
        b = ctx.baselines.get(metric)
        if b is None or b["status"] == "unavailable":
            ctx.unknown_reasons.append(f"no_baseline:{metric}")
            return UNKNOWN
        med = f.window_median(metric, cond["window_min"], cond.get("min_points", 1))
        if med is None:
            ctx.unknown_reasons.append(f"insufficient_points:{metric}")
            return UNKNOWN
        delta_abs = q6(med - b["median"])
        values = {"value": med, "delta_abs": delta_abs, "baseline_median": b["median"]}
        if op == "delta_from_baseline_pct":
            if b["median"] == 0:
                ctx.case_flags.add("baseline_zero_division")
                ctx.unknown_reasons.append(f"baseline_zero:{metric}")
                return UNKNOWN
            values["delta_pct"] = q6((med - b["median"]) / b["median"] * 100.0)
            result = values["delta_pct"]
        else:
            result = delta_abs
        _store(ctx, cond, values)
        return _compare(result, cond)

    if op == "trend_slope":
        s = f.slope(metric, cond["window_min"], cond["min_points"])
        if s is None:
            ctx.unknown_reasons.append(f"insufficient_points:{metric}")
            return UNKNOWN
        _store(ctx, cond, {"slope": s, "value": s})
        return _compare(s, cond)

    if op == "crossed_threshold_count":
        c = f.crossings(metric, cond["window_min"], cond["threshold"], cond["direction"])
        if c is None:
            ctx.unknown_reasons.append(f"insufficient_points:{metric}")
            return UNKNOWN
        _store(ctx, cond, {"count": c, "value": c})
        return _compare(c, cond)

    if op == "sustained_for_min":
        s = f.sustained_min(metric, cond["window_min"], cond["threshold"], cond["direction"])
        if s is None:
            ctx.unknown_reasons.append(f"no_data:{metric}")
            return UNKNOWN
        _store(ctx, cond, {"sustained_min": s, "value": s})
        return _compare(s, cond)

    raise ValueError(f"unknown op {op}")  # unreachable: content validation rejects


def _eval_node(node, ctx):
    if "all_of" in node:
        states = [_eval_node(c, ctx) for c in node["all_of"]]
        if FALSE in states:
            return FALSE
        if UNKNOWN in states:
            return UNKNOWN
        return TRUE
    if "any_of" in node:
        states = [_eval_node(c, ctx) for c in node["any_of"]]
        if TRUE in states:
            return TRUE
        if UNKNOWN in states:
            return UNKNOWN
        return FALSE
    if "none_of" in node:
        states = [_eval_node(c, ctx) for c in node["none_of"]]
        if TRUE in states:
            return FALSE
        if UNKNOWN in states:
            return UNKNOWN
        return TRUE
    if "at_least_n_of" in node:
        spec = node["at_least_n_of"]
        states = [_eval_node(c, ctx) for c in spec["of"]]
        trues = states.count(TRUE)
        unknowns = states.count(UNKNOWN)
        if trues >= spec["n"]:
            return TRUE
        if trues + unknowns < spec["n"]:
            return FALSE
        return UNKNOWN
    return _eval_leaf(node, ctx)


def _has_input(features, itype):
    if itype == "event":
        return len(features.events) > 0
    if itype == "free_text_note":
        return True  # notes are never logic inputs
    return len(features.by_metric.get(itype, [])) > 0


def evaluate_signatures(content, features, baselines, artifact_metrics, case_flags, trace):
    """Returns dict with matched / suppressed / not_evaluable / not_matched lists.

    `matched` entries: {sig, computed}. Deterministic order everywhere.
    """
    matched, not_evaluable, not_matched = [], [], []

    for sig in content["published_signatures"]:
        sid = sig["signature_id"]
        # artifact_suspected_any_input is scoped to THIS signature's required
        # inputs so an artifact on an unrelated metric cannot veto it.
        sig_flags = set()
        if any(m in artifact_metrics for m in sig["required_inputs"]):
            sig_flags.add("artifact_suspected_any_input")

        missing = [t for t in sig["required_inputs"] if not _has_input(features, t)]
        if missing:
            reason = "missing_required_input:" + ",".join(sorted(missing))
            not_evaluable.append({"id": sid, "reason": reason})
            trace.append({"stage": "M5", "detail": f"{sid} not_evaluable ({reason})"})
            continue

        if sig.get("requires_personalized_baseline"):
            degraded = [
                m for m in sig["required_inputs"]
                if m in baselines and baselines[m]["status"] != "personalized"
            ]
            if degraded:
                reason = "personalized_baseline_required:" + ",".join(sorted(degraded))
                not_evaluable.append({"id": sid, "reason": reason})
                trace.append({"stage": "M5", "detail": f"{sid} not_evaluable ({reason})"})
                continue

        ctx = _EvalCtx(features, baselines, sig_flags, case_flags)
        state = _eval_node(sig["logic"], ctx)
        if state == TRUE:
            matched.append({"sig": sig, "computed": ctx.computed})
            detail = f"{sid} matched"
            parts = []
            for cid in sorted(ctx.computed):
                vals = ctx.computed[cid]
                for key in ("delta_pct", "slope", "sustained_min", "count", "value"):
                    if key in vals:
                        parts.append(f"{cid}.{key}={fmt_val(vals[key])}")
                        break
            if parts:
                detail += ": " + "; ".join(parts)
            trace.append({"stage": "M5", "detail": detail})
        elif state == UNKNOWN:
            reason = "insufficient_data:" + (ctx.unknown_reasons[0] if ctx.unknown_reasons else "unknown")
            not_evaluable.append({"id": sid, "reason": reason})
            trace.append({"stage": "M5", "detail": f"{sid} not_evaluable ({reason})"})
        else:
            not_matched.append(sid)

    # Conflict resolution (DECISIONS.md D9): within a conflict_group only the
    # highest (severity, priority, id) match survives; losers are recorded.
    groups: dict = {}
    for m in matched:
        group = m["sig"].get("conflict_group")
        if group:
            groups.setdefault(group, []).append(m)
    suppressed = []
    survivors = []
    losers = set()
    for group in sorted(groups):
        members = groups[group]
        members.sort(key=lambda m: (-SEV_ORD[m["sig"]["severity"]], -m["sig"].get("priority", 0), m["sig"]["signature_id"]))
        winner = members[0]
        for loser in members[1:]:
            if SEV_ORD[loser["sig"]["severity"]] < SEV_ORD[winner["sig"]["severity"]]:
                reason = "superseded_by_higher_severity"
            else:
                reason = "superseded_by_priority"
            suppressed.append({"id": loser["sig"]["signature_id"], "reason": reason})
            losers.add(loser["sig"]["signature_id"])
            trace.append({"stage": "M5", "detail": f"{loser['sig']['signature_id']} suppressed ({reason} by {winner['sig']['signature_id']})"})
    for m in matched:
        if m["sig"]["signature_id"] not in losers:
            survivors.append(m)

    survivors.sort(key=lambda m: (-SEV_ORD[m["sig"]["severity"]], m["sig"]["signature_id"]))
    suppressed.sort(key=lambda s: s["id"])
    not_evaluable.sort(key=lambda s: s["id"])
    return {
        "matched": survivors,
        "suppressed": suppressed,
        "not_evaluable": not_evaluable,
        "not_matched": sorted(not_matched),
    }
