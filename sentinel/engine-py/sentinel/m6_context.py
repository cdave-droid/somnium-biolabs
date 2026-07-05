"""M6 — Context Adapter. Maps matched signatures × context to tiers and
applies global modifier floors. May only RAISE tiers, never lower them —
the safety invariant is structural: everything here contributes floors to a
max() in M7 (DECISIONS.md D10).
"""
from __future__ import annotations

from .constants import SEV_ORD, TIER_ORD


def dotted_get(obj, path):
    node = obj
    for part in path.split("."):
        if not isinstance(node, dict) or part not in node:
            return None
        node = node[part]
    return node


def signature_tier(sig, context, flags, trace):
    tier_map = sig["action_tier_by_context"]
    deployment = (context or {}).get("deployment")
    if not context or deployment is None:
        flags.add("missing_context")
        tier = tier_map["default"]
        trace.append({"stage": "M6", "detail": f"{sig['signature_id']}: no deployment context; default tier {tier}"})
        return tier
    if deployment in tier_map:
        tier = tier_map[deployment]
        trace.append({"stage": "M6", "detail": f"{sig['signature_id']}: {deployment} -> {tier}"})
    else:
        flags.add("context_default_tier")
        tier = tier_map["default"]
        trace.append({"stage": "M6", "detail": f"{sig['signature_id']}: {deployment} not in tier map; default {tier}"})
    return tier


def modifier_floors(case_severity, context, content, trace):
    """Content-defined global context modifiers; each yields a floor tier."""
    floors = []
    if case_severity is None:
        return floors
    for mod in content["tables"]["global_modifiers"]["modifiers"]:
        if SEV_ORD[case_severity] < SEV_ORD[mod["min_severity"]]:
            continue
        actual = dotted_get(context or {}, mod["when"]["field"])
        if actual is None:
            continue
        op, target = mod["when"]["op"], mod["when"]["value"]
        if isinstance(target, (int, float)) and not isinstance(actual, (int, float)):
            continue
        hit = (
            (op == "gt" and actual > target)
            or (op == "gte" and actual >= target)
            or (op == "lt" and actual < target)
            or (op == "lte" and actual <= target)
            or (op == "eq" and actual == target)
        )
        if hit:
            floors.append(mod["floor_tier"])
            trace.append({"stage": "M6", "detail": f"modifier {mod['id']} raises floor to {mod['floor_tier']}"})
    return floors
