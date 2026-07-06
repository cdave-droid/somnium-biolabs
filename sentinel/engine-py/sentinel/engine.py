"""SENTINEL engine orchestrator: fixed pipeline M1→M7 with M8 interception
and M9 recording (§1). Deterministic, escalation-biased, fully explained.
"""
from __future__ import annotations

import math

from . import m1_ingest, m2_quality, m3_state, m5_signatures, m6_context
from .canonical import canonical_json, deterministic_uuid, fmt_num, q6
from .constants import (CONFIDENCES, ENGINE_VERSION, FLAG_TEXTS, SEV_ORD,
                        SEVERITIES, TIER_ORD, TIERS, TRAJ_ORD)
from .content import load_content  # re-exported API
from .errors import AuditIntegrityError, ContentError
from .m4_trend import Features, classify_trajectory
from .m9_audit import AuditLog, verify_chain
from .timeutil import fmt_ts, parse_ts

_M8_PHRASES = {
    "no_observations": "no usable observations were provided",
    "all_inputs_artifact_likely": "every reading was flagged as a likely sensor artifact",
    "all_signatures_not_evaluable": "no signature could be evaluated with the available inputs",
    "no_published_signatures": "the loaded content package contains no published signatures",
    "unknown_event_code": "an event report used a code outside the controlled vocabulary",
    "never_ignore_breach": "a reading breached a never-ignore absolute bound that no matched signature covers",
    "never_ignore_breach_on_artifact": "a reading breached a never-ignore absolute bound but has the shape of a sensor artifact — it must not be dismissed without re-measurement",
    "never_ignore_breach_on_rejected": "a physically-impossible reading also breached a never-ignore bound — it may be a real extreme value or sensor garbage; re-measure immediately",
    "internal_error": "an internal error occurred during evaluation",
}


def _round_to(x, digits):
    if not isinstance(x, (int, float)) or isinstance(x, bool):
        return x
    sign = -1.0 if x < 0 else 1.0
    scale = 10.0 ** digits
    return sign * math.floor(abs(x) * scale + 0.5) / scale


def _render_template(sig, computed):
    text = sig["explanation_template"]
    for var, binding in sorted(sig.get("template_bindings", {}).items()):
        vals = computed.get(binding["condition_id"], {})
        value = vals.get(binding["field"], "n/a")
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            if "round" in binding:
                value = _round_to(value, binding["round"])
            rendered = fmt_num(value)
        else:
            rendered = str(value)
        text = text.replace("{" + var + "}", rendered)
    return text


def _max_tier(tiers):
    best = "D0"
    for t in tiers:
        if TIER_ORD[t] > TIER_ORD[best]:
            best = t
    return best


def _max_severity(severities):
    best = None
    for s in severities:
        if s is not None and (best is None or SEV_ORD[s] > SEV_ORD[best]):
            best = s
    return best


class Engine:
    def __init__(self, content, audit_sink=None, baseline_store=None):
        self.content = content
        self.audit = AuditLog(sink=audit_sink)
        self.baseline_store = baseline_store

    # ------------------------------------------------------------------ API

    def evaluate(self, unit_profile, observations, context=None, reference_time=None,
                 stored_baselines=None):
        # Stored baselines are an INPUT: fetched once, recorded in the audit
        # log, and replayed verbatim — the store itself is never consulted
        # during replay (determinism, D2/D8).
        if stored_baselines is None and self.baseline_store is not None and isinstance(unit_profile, dict):
            unit_id = unit_profile.get("unit_id")
            if isinstance(unit_id, str):
                stored_baselines = self.baseline_store.get(unit_id)
        inputs = {
            "unit_profile": unit_profile,
            "observations": observations,
            "context": context,
            "reference_time": reference_time,
            "stored_baselines": stored_baselines,
        }
        try:
            output = self._evaluate_inner(unit_profile or {}, observations or [], context,
                                          reference_time, stored_baselines)
        except Exception as exc:  # prime directive 2: fail toward caution
            output = self._emergency_output(inputs, exc)
        # M9 recording must also fail toward caution: raw caller inputs may be
        # unserializable (non-finite floats survive json parsing) and must not
        # make evaluate() throw after the safe output was already built.
        try:
            self.audit.append("case_input", output["case_id"], ENGINE_VERSION,
                              self.content["content_version"], inputs)
        except (TypeError, ValueError):
            self.audit.append("case_input", output["case_id"], ENGINE_VERSION,
                              self.content["content_version"],
                              {"unserializable_input": True})
        self.audit.append("case_output", output["case_id"], ENGINE_VERSION,
                          self.content["content_version"], {"output": output})
        return output

    def open_case(self, unit_profile, context=None):
        return {"unit_profile": unit_profile, "context": context, "observations": []}

    def evaluate_stream(self, case, new_observation):
        # Duplicates are handled (quarantined + flagged) by M1, which keeps
        # every output a pure function of the accumulated observation list —
        # required for byte-identical replay.
        case["observations"] = case["observations"] + [new_observation]
        return self.evaluate(case["unit_profile"], case["observations"], case["context"])

    def record_outcome(self, case_id, human_action_tier, outcome_note="", outcome_label=None):
        """outcome_label (ground truth for §7.2 back-testing):
        'deterioration_confirmed' | 'no_deterioration' | 'indeterminate' | None."""
        return self.audit.append("outcome", case_id, ENGINE_VERSION,
                                 self.content["content_version"],
                                 {"human_action_tier": human_action_tier,
                                  "outcome_note": outcome_note,
                                  "outcome_label": outcome_label})

    def replay(self, records):
        """Re-run every logged case; outputs must be byte-identical (§4)."""
        verify_chain(records)
        pending = {}
        outputs = []
        for record in records:
            if record["record_type"] == "case_input":
                pending[record["case_id"]] = record
            elif record["record_type"] == "case_output":
                inp = pending.get(record["case_id"])
                if inp is None:
                    raise AuditIntegrityError(f"case_output without case_input: {record['case_id']}")
                if inp["payload"].get("unserializable_input"):
                    # Inputs could not be recorded canonically, so the case
                    # cannot be re-executed; the chained output record itself
                    # remains tamper-evident. Skipped, never silently mutated.
                    continue
                if inp["content_version"] != self.content["content_version"]:
                    raise AuditIntegrityError(
                        f"replay requires content {inp['content_version']}, loaded {self.content['content_version']}")
                p = inp["payload"]
                fresh = Engine(self.content).evaluate(
                    p["unit_profile"], p["observations"], p["context"], p["reference_time"],
                    stored_baselines=p.get("stored_baselines"))
                if canonical_json(fresh) != canonical_json(record["payload"]["output"]):
                    raise AuditIntegrityError(f"replay mismatch for case {record['case_id']}")
                outputs.append(fresh)
        return outputs

    # ------------------------------------------------------------- pipeline

    def _evaluate_inner(self, unit_profile, observations, context, reference_time,
                        stored_baselines=None):
        content = self.content
        flags = set(content["flags"])
        trace = []
        m8_triggers = []

        # Malformed profile/context shapes are normalized identically in both
        # runtimes (flagged, never crashed on, never silently trusted).
        unit_profile = _normalize_profile(unit_profile, flags)
        context = _normalize_context(context, flags)

        # M1 — ingest & validate
        accepted, quarantined, notes = m1_ingest.ingest(observations, content, flags)
        trace.append({"stage": "M1", "detail": f"accepted {len(accepted)} observations; quarantined {len(quarantined)}; notes {len(notes)}"})
        for qr in quarantined:
            trace.append({"stage": "M1", "detail": f"quarantined {qr['obs_id']}: {qr['reason']}"})
        if "unknown_event_code" in flags:
            m8_triggers.append("unknown_event_code")

        # Reference time (DECISIONS.md D2)
        if reference_time is not None:
            ref = parse_ts(reference_time)
        elif accepted or notes:
            ref = max(o["ts"] for o in accepted + notes)
        else:
            ref = None

        # Never-ignore check against QUARANTINED (physically impossible) values
        # runs regardless of whether anything was accepted — an extreme-but-
        # possibly-real reading must not vanish via quarantine (DECISIONS D13.5).
        enums = content["tables"]["operational_bounds"]["enums"]
        rejected_floors = []
        for bound in content["tables"]["never_ignore"]["bounds"]:
            if any(q.get("type") == bound["metric"] and _breaches(bound, q.get("value"), enums)
                   for q in quarantined if q["reason"].startswith("out_of_bounds:")):
                m8_triggers.append("never_ignore_breach_on_rejected")
                flags.add("never_ignore_breach_on_rejected")
                rejected_floors.append(bound["floor_tier"])
                trace.append({"stage": "M8", "detail": f"never-ignore bound {bound['id']} breached by quarantined reading ({bound['metric']}); floor {bound['floor_tier']}"})

        if not accepted:
            m8_triggers.append("no_observations")
            return self._compose(unit_profile, observations, context, reference_time, ref,
                                 flags, trace, m8_triggers,
                                 sigres={"matched": [], "suppressed": [], "not_evaluable": [], "not_matched": []},
                                 trajectory_base="unknown", ni_floors=rejected_floors,
                                 stored_baselines=stored_baselines)

        # M2 — signal quality
        artifact_metrics, protected_metrics = m2_quality.assess(accepted, unit_profile, content, flags, trace)
        logic_obs = [o for o in accepted if o["type"] != "event"]
        usable = [o for o in logic_obs if o["quality"] != "artifact_likely" or o["mechanism_protected"]]
        if logic_obs and not usable:
            m8_triggers.append("all_inputs_artifact_likely")

        # M3 — baselines for metrics any published signature compares to baseline
        needed = set()
        for sig in content["published_signatures"]:
            conds = []
            from .content import _walk_conditions
            _walk_conditions(sig["logic"], conds)
            for c in conds:
                if c.get("op", "").startswith("delta_from_baseline") or ("baseline_status" in c and "metric" in c):
                    needed.add(c["metric"])
        baselines = m3_state.compute_baselines(unit_profile, accepted, content, ref, needed, flags, trace,
                                               stored_baselines=stored_baselines)

        # M4 — features & trajectory
        features = Features(accepted, content, ref)
        trajectory_base = classify_trajectory(features, content, trace)

        # M5 — signatures
        sigres = m5_signatures.evaluate_signatures(content, features, baselines, artifact_metrics, flags, trace)
        published = content["published_signatures"]
        if not published:
            m8_triggers.append("no_published_signatures")
        elif len(sigres["not_evaluable"]) == len(published):
            m8_triggers.append("all_signatures_not_evaluable")

        # M8 — never-ignore absolute bounds on accepted readings. Bound FLOORS
        # apply unconditionally (a matched low-tier signature must never shadow
        # an absolute bound); the insufficient-confidence route applies when no
        # matched signature covers the metric or the breaching reading is
        # untrusted (artifact-flagged). Quarantined values were checked above.
        ni_floors = list(rejected_floors)
        covered = set()
        for m in sigres["matched"]:
            covered.update(m["sig"]["required_inputs"])
        # Any usable breach inside the content-defined window floors the tier
        # — a breach must not vanish just because a newer in-range reading
        # arrived afterwards (escalation bias; DECISIONS D13.5).
        ni_window_s = content["tables"]["never_ignore"]["window_min"] * 60
        for bound in content["tables"]["never_ignore"]["bounds"]:
            metric = bound["metric"]
            series = [o for o in accepted if o["type"] == metric
                      and ref is not None and ref - ni_window_s <= o["ts"] <= ref]
            confident_breach = any(
                (o["quality"] != "artifact_likely" or o["mechanism_protected"])
                and _breaches(bound, o["value"], enums)
                for o in series)
            artifact_breach = any(
                o["quality"] == "artifact_likely" and not o["mechanism_protected"]
                and _breaches(bound, o["value"], enums)
                for o in series)

            if confident_breach:
                flags.add("never_ignore_breach")
                ni_floors.append(bound["floor_tier"])
                trace.append({"stage": "M8", "detail": f"never-ignore bound {bound['id']} breached ({metric}); floor {bound['floor_tier']}"})
                if metric not in covered:
                    m8_triggers.append("never_ignore_breach")
            elif artifact_breach:
                m8_triggers.append("never_ignore_breach_on_artifact")
                flags.add("never_ignore_breach_on_artifact")
                ni_floors.append(bound["floor_tier"])
                trace.append({"stage": "M8", "detail": f"never-ignore bound {bound['id']} breached by artifact-flagged reading ({metric}); floor {bound['floor_tier']}"})

        return self._compose(unit_profile, observations, context, reference_time, ref,
                             flags, trace, m8_triggers, sigres, trajectory_base, ni_floors,
                             stored_baselines=stored_baselines)

    # -------------------------------------------------------- M7/M8 compose

    def _compose(self, unit_profile, observations, context, reference_time_arg, ref,
                 flags, trace, m8_triggers, sigres, trajectory_base, ni_floors,
                 stored_baselines=None):
        content = self.content
        matched = sigres["matched"]
        m8_active = bool(m8_triggers)

        floors_table = content["tables"]["floors"]["insufficient_floor_by_deployment"]
        deployment = (context or {}).get("deployment")
        # Central missing-context flag: absent context/deployment must surface
        # on EVERY output path, not only when a signature happened to match.
        if not context or not isinstance(deployment, str) or not deployment:
            flags.add("missing_context")
        floor_entry = floors_table.get(deployment, floors_table["default"]) if deployment else floors_table["default"]

        # Severity: max over matched; floored by content severity floor when M8 fired.
        severity = _max_severity([m["sig"]["severity"] for m in matched])
        if m8_active:
            severity = _max_severity([severity, floor_entry["severity"]])
        if severity is None:
            severity = "S1"

        # Tier lattice (DECISIONS.md D10) — contributions only ever raise.
        tier_candidates = ["D0"]
        for m in matched:
            tier_candidates.append(m6_context.signature_tier(m["sig"], context, flags, trace))
        tier_candidates.extend(m6_context.modifier_floors(severity, context, content, trace))
        if "artifact_with_mechanism" in flags:
            tier_candidates.append(content["tables"]["floors"]["mechanism_floor"])
        tier_candidates.extend(ni_floors)
        if m8_active:
            tier_candidates.append(floor_entry["action_tier"])
            flags.add("engine_could_not_fully_evaluate")
        action_tier = _max_tier(tier_candidates)

        # Trajectory (DECISIONS.md D11): overrides from the top-severity
        # matches win; ties among them resolve by escalation order.
        trajectory = trajectory_base
        overrides = [m["sig"]["trajectory_override"] for m in matched if m["sig"].get("trajectory_override")]
        if overrides:
            top_severity = matched[0]["sig"]["severity"]
            top_overrides = [m["sig"]["trajectory_override"] for m in matched
                             if m["sig"]["severity"] == top_severity and m["sig"].get("trajectory_override")]
            trajectory = _max_by_traj(top_overrides if top_overrides else overrides)

        # Confidence (DECISIONS.md D12). A signature that is not_evaluable
        # because its modality was never observed is normal operation and does
        # not degrade confidence; data-quality reasons do.
        quality_ne = [ne for ne in sigres["not_evaluable"]
                      if not ne["reason"].startswith("missing_required_input:")]
        if m8_active:
            confidence = "insufficient"
        elif flags & {"baseline_population_default", "baseline_unavailable", "suspect_inputs_present",
                      "data_rejected", "missing_context", "artifact_suspected_any_input",
                      "artifact_with_mechanism", "duplicate_obs_id", "baseline_zero_division",
                      "invalid_profile_fields", "invalid_context_fields"} or quality_ne:
            confidence = "degraded"
        else:
            confidence = "high"
        if sigres["not_evaluable"]:
            flags.add("signatures_not_evaluable")

        recheck = content["tables"]["recheck_intervals"]["by_tier"][action_tier]

        # Explanation (prime directive 3)
        parts = []
        if m8_active:
            phrases = []
            for t in m8_triggers:
                p = _M8_PHRASES[t]
                if p not in phrases:
                    phrases.append(p)
            parts.append(
                "ENGINE COULD NOT FULLY EVALUATE THIS CASE: " + "; ".join(phrases)
                + f". Action tier {action_tier} is a cautious floor for this deployment context, not a confident assessment."
                + f" Most valuable next input: {self._most_valuable_input(m8_triggers, sigres)}."
            )
        for m in matched:
            parts.append(_render_template(m["sig"], m["computed"]))
        if not m8_active and not matched:
            parts.append("No configured signature pattern matched and no never-ignore bound was breached. "
                         "Severity S1 with action tier D0 (routine monitoring).")
        for flag in sorted(flags):
            if flag == "engine_could_not_fully_evaluate":
                continue
            parts.append("Note: " + FLAG_TEXTS[flag])
        explanation = " ".join(parts)

        trace.append({"stage": "M7", "detail": f"final severity {severity}, action tier {action_tier}, confidence {confidence}"})
        if m8_active:
            trace.append({"stage": "M8", "detail": "triggers: " + ",".join(sorted(set(m8_triggers)))})

        try:
            case_id = deterministic_uuid({
                "unit_profile": unit_profile, "observations": observations, "context": context,
                "reference_time": reference_time_arg, "stored_baselines": stored_baselines,
                "engine_version": ENGINE_VERSION,
                "content_version": content["content_version"],
            })
        except (TypeError, ValueError):
            trace.append({"stage": "M9", "detail": "case_id derived from sanitized inputs (raw inputs not canonically serializable)"})
            case_id = deterministic_uuid({"unserializable_input": True,
                                          "observation_count": len(observations),
                                          "engine_version": ENGINE_VERSION,
                                          "content_version": content["content_version"]})
        return {
            "case_id": case_id,
            "engine_version": ENGINE_VERSION,
            "content_version": content["content_version"],
            "reference_time": fmt_ts(ref) if ref is not None else None,
            "severity": severity,
            "trajectory": trajectory,
            "action_tier": action_tier,
            "matched_signatures": [m["sig"]["signature_id"] for m in matched],
            "suppressed_signatures": sigres["suppressed"],
            "not_evaluable_signatures": sigres["not_evaluable"],
            "confidence": confidence,
            "flags": sorted(flags),
            "explanation": explanation,
            "reasoning_trace": trace,
            "recommended_recheck_min": recheck,
        }

    def _most_valuable_input(self, m8_triggers, sigres):
        missing_counts = {}
        for ne in sigres["not_evaluable"]:
            reason = ne["reason"]
            if reason.startswith("missing_required_input:"):
                for t in reason.split(":", 1)[1].split(","):
                    missing_counts[t] = missing_counts.get(t, 0) + 1
        if missing_counts:
            best = sorted(missing_counts.items(), key=lambda kv: (-kv[1], kv[0]))[0][0]
            return f"a current {best} observation"
        if "never_ignore_breach_on_artifact" in m8_triggers or "all_inputs_artifact_likely" in m8_triggers:
            return "an immediate re-measurement of the artifact-flagged metric with a different source"
        if "unknown_event_code" in m8_triggers:
            return "the event re-reported with a valid code from the controlled vocabulary"
        if "no_observations" in m8_triggers:
            return "any current observation for this unit"
        return "any additional valid observation"

    def _emergency_output(self, inputs, exc):
        content = self.content
        floors_table = content["tables"]["floors"]["insufficient_floor_by_deployment"]
        tier = _max_tier([f["action_tier"] for f in floors_table.values()])
        severity = _max_severity([f["severity"] for f in floors_table.values()])
        flags = sorted(set(content["flags"]) | {"internal_error", "engine_could_not_fully_evaluate"})
        try:
            case_id = deterministic_uuid({**inputs, "engine_version": ENGINE_VERSION,
                                          "content_version": content["content_version"]})
        except Exception:
            case_id = deterministic_uuid({"unserializable_input": True})
        recheck = content["tables"]["recheck_intervals"]["by_tier"][tier]
        # Exception class names are runtime-specific; the deterministic output
        # carries a stable fault marker only (details belong in ops logs).
        explanation = (
            "ENGINE COULD NOT FULLY EVALUATE THIS CASE: an internal error occurred during evaluation."
            f" Action tier {tier} is the maximum configured safe floor,"
            " not a confident assessment. Most valuable next input: none — this is an engine fault;"
            " escalate per the floor tier and report the fault."
        )
        for flag in flags:
            if flag != "engine_could_not_fully_evaluate":
                explanation += " Note: " + FLAG_TEXTS[flag]
        return {
            "case_id": case_id,
            "engine_version": ENGINE_VERSION,
            "content_version": content["content_version"],
            "reference_time": None,
            "severity": severity,
            "trajectory": "unknown",
            "action_tier": tier,
            "matched_signatures": [],
            "suppressed_signatures": [],
            "not_evaluable_signatures": [],
            "confidence": "insufficient",
            "flags": flags,
            "explanation": explanation,
            "reasoning_trace": [{"stage": "M8", "detail": "internal_error"}],
            "recommended_recheck_min": recheck,
        }


def _is_num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def _str_list(v):
    if not isinstance(v, list):
        return None
    return [x for x in v if isinstance(x, str)]


def _normalize_profile(profile, flags):
    """Coerce a malformed unit profile to a safe shape (DECISIONS D12/GAPS A5
    class). Dropped fields are flagged — never trusted, never crashed on."""
    if not isinstance(profile, dict):
        flags.add("invalid_profile_fields")
        return {}
    out = {}
    dropped = False
    for key, value in profile.items():
        if not isinstance(key, str):
            dropped = True
            continue
        if key in ("known_conditions", "active_mitigations", "incompatibilities"):
            cleaned = _str_list(value)
            if cleaned is None:
                dropped = True
                continue
            if len(cleaned) != len(value):
                dropped = True
            out[key] = cleaned
        elif key in ("service_age_years", "mass_kg"):
            if _is_num(value):
                out[key] = value
            else:
                dropped = True
        elif key == "baselines":
            if not isinstance(value, dict):
                dropped = True
                continue
            cleaned_b = {}
            for metric, b in value.items():
                if (isinstance(metric, str) and isinstance(b, dict)
                        and all(_is_num(b.get(f)) for f in ("median", "p10", "p90", "n_obs"))):
                    cleaned_b[metric] = b
                else:
                    dropped = True
            out[key] = cleaned_b
        elif key in ("unit_id", "class"):
            if isinstance(value, str):
                out[key] = value
            else:
                dropped = True
        else:
            out[key] = value
    if dropped:
        flags.add("invalid_profile_fields")
    return out


def _normalize_context(context, flags):
    if context is None:
        return None
    if not isinstance(context, dict):
        flags.add("invalid_context_fields")
        return None
    out = {}
    dropped = False
    for key, value in context.items():
        if key in ("deployment", "operator_skill", "connectivity"):
            if isinstance(value, str):
                out[key] = value
            else:
                dropped = True
        elif key == "time_to_service_min":
            if isinstance(value, dict):
                cleaned = {k: v for k, v in value.items() if isinstance(k, str) and _is_num(v)}
                if len(cleaned) != len(value):
                    dropped = True
                out[key] = cleaned
            else:
                dropped = True
        elif key == "resources":
            cleaned = _str_list(value)
            if cleaned is None:
                dropped = True
            else:
                if len(cleaned) != len(value):
                    dropped = True
                out[key] = cleaned
        else:
            out[key] = value
    if dropped:
        flags.add("invalid_context_fields")
    return out


def _breaches(bound, value, enums):
    metric = bound["metric"]
    if metric in enums:
        if value not in enums[metric]:
            return False
        v = enums[metric].index(value)
        t = enums[metric].index(bound["value"])
    else:
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            return False
        v, t = value, bound["value"]
    return v >= t if bound["op"] == "gte" else v <= t


def _max_by_traj(trajectories):
    best = trajectories[0]
    for t in trajectories:
        if TRAJ_ORD[t] > TRAJ_ORD[best]:
            best = t
    return best


def explain(engine_output, audience="operator"):
    if audience == "specialist":
        lines = [engine_output["explanation"], "", "Reasoning trace:"]
        lines.extend(f"  [{t['stage']}] {t['detail']}" for t in engine_output["reasoning_trace"])
        lines.append(
            f"Engine {engine_output['engine_version']}, content {engine_output['content_version']}, "
            f"case {engine_output['case_id']}, confidence {engine_output['confidence']}."
        )
        return "\n".join(lines)
    return engine_output["explanation"]
