/** Engine-level constants. Mirrors engine-py/sentinel/constants.py exactly.
 *
 * These are structural facts of the SENTINEL spec (scale orderings, flag
 * vocabulary, plain-language flag texts) — NOT domain knowledge, which lives
 * exclusively in content packages (prime directive 4).
 */

export const ENGINE_VERSION = "1.0.0";

export const SEVERITIES = ["S1", "S2", "S3", "S4"];
export const TIERS = ["D0", "D1", "D2", "D3", "D4", "D5"];
export const CONFIDENCES = ["insufficient", "degraded", "high"];
export const TRAJECTORIES = ["improving", "stable", "unknown", "worsening"]; // escalation order

function ordinalMap(items: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  items.forEach((s, i) => {
    out[s] = i;
  });
  return out;
}

export const SEV_ORD = ordinalMap(SEVERITIES);
export const TIER_ORD = ordinalMap(TIERS);
export const TRAJ_ORD = ordinalMap(TRAJECTORIES);

export const OBSERVATION_TYPES = [
  "cycle_rate", "flow_rate", "saturation_pct", "pressure_primary",
  "pressure_secondary", "temperature_c", "responsiveness", "strain_0_10",
  "mass_kg", "reserve_level", "event", "free_text_note",
];

export const NUMERIC_TYPES = [
  "cycle_rate", "flow_rate", "saturation_pct", "pressure_primary",
  "pressure_secondary", "temperature_c", "strain_0_10", "mass_kg",
  "reserve_level",
];

// Flags a signature's logic may reference (content validation checks this).
export const REFERENCEABLE_FLAGS = [
  "artifact_suspected_any_input",
  "artifact_with_mechanism",
  "baseline_population_default",
  "baseline_unavailable",
  "data_rejected",
  "missing_context",
  "stream_disagreement",
  "stream_untrusted",
  "suspect_inputs_present",
];

export const FLAG_TEXTS: Record<string, string> = {
  "artifact_suspected_any_input": "At least one reading had the shape of a sensor artifact and was excluded from pattern logic.",
  "artifact_with_mechanism": "A reading looked like a sensor artifact, but this unit's profile contains a plausible mechanism for that abnormality, so the engine did not dismiss it and floored the response tier.",
  "baseline_ok": "Personalized baselines were available for all evaluated metrics.",
  "baseline_population_default": "One or more metrics lacked sufficient history; population-default baselines were used, widening uncertainty.",
  "baseline_unavailable": "No baseline (personalized or population) was available for one or more metrics.",
  "baseline_zero_division": "A percent-from-baseline comparison was impossible because the baseline median is zero.",
  "content_unsigned": "The loaded content package is hash-verified but not cryptographically signed.",
  "context_default_tier": "The deployment context was not listed in a matched signature's tier map; its default tier was used.",
  "data_rejected": "One or more readings were physically impossible and were quarantined (logged, excluded from logic).",
  "duplicate_obs_id": "A duplicate observation id was ignored.",
  "engine_could_not_fully_evaluate": "THE ENGINE COULD NOT FULLY EVALUATE THIS CASE — the recommendation below is a cautious floor, not a confident assessment.",
  "internal_error": "An internal error occurred; the engine failed toward caution.",
  "invalid_context_fields": "Some context fields were malformed and were ignored.",
  "invalid_profile_fields": "Some unit-profile fields were malformed and were ignored.",
  "missing_context": "No deployment context was provided; default tiers and the most cautious floors were used.",
  "never_ignore_breach": "A reading breached a never-ignore absolute bound; the response tier was floored accordingly.",
  "never_ignore_breach_on_artifact": "A reading breached a never-ignore absolute bound but looks like a sensor artifact; the engine escalated instead of dismissing it — re-measure immediately.",
  "never_ignore_breach_on_rejected": "A physically-impossible reading also breached a never-ignore bound; it may be a real extreme value or sensor garbage — re-measure immediately.",
  "no_baseline_history": "This unit had insufficient observation history to compute personalized baselines.",
  "pooled_streams": "No single data stream had enough points for a trend; readings from multiple streams were pooled, which can distort trends — treat trend-based findings with caution.",
  "signatures_not_evaluable": "One or more signatures could not be evaluated for this case (missing inputs or insufficient data).",
  "stream_disagreement": "Two data streams disagreed materially on the same metric at the same time; the higher-trust source was preferred — re-measure to resolve the conflict.",
  "stream_untrusted": "A data stream was distrusted because too many of its recent readings were artifact-flagged; its readings were excluded pending re-verification.",
  "suspect_inputs_present": "One or more readings were quality-flagged as suspect but were still used.",
  "unit_silent": "No observation has arrived within this unit's expected reporting cadence; the engine cannot evaluate a unit it cannot hear.",
  "unknown_event_code": "An event report used a code that is not in the controlled vocabulary; the engine cannot interpret it.",
};
