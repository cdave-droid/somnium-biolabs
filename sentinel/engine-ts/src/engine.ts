/** SENTINEL engine orchestrator: fixed pipeline M1→M7 with M8 interception
 * and M9 recording (§1). Deterministic, escalation-biased, fully explained.
 * Faithful port of engine-py/sentinel/engine.py — every output string is
 * byte-identical.
 */
import { canonicalJson, deterministicUuid, fmtNum, own, ownGet, pyTruthy } from "./canonical.js";
import { ENGINE_VERSION, FLAG_TEXTS, SEV_ORD, TIER_ORD, TRAJ_ORD } from "./constants.js";
import type { ContentHandle } from "./content.js";
import { walkConditions } from "./content.js";
import { AuditIntegrityError } from "./errors.js";
import { ingest, type NormalizedObs, type Quarantined } from "./m1_ingest.js";
import { assess } from "./m2_quality.js";
import { computeBaselines, type Baseline } from "./m3_state.js";
import { classifyTrajectory, Features } from "./m4_trend.js";
import { evaluateSignatures, type SigResult } from "./m5_signatures.js";
import { modifierFloors, signatureTier } from "./m6_context.js";
import { AuditLog, verifyChain, type AuditRecord } from "./m9_audit.js";
import { fmtTs, parseTs } from "./timeutil.js";

const M8_PHRASES: Record<string, string> = {
  no_observations: "no usable observations were provided",
  all_inputs_artifact_likely: "every reading was flagged as a likely sensor artifact",
  all_signatures_not_evaluable: "no signature could be evaluated with the available inputs",
  no_published_signatures: "the loaded content package contains no published signatures",
  unknown_event_code: "an event report used a code outside the controlled vocabulary",
  never_ignore_breach: "a reading breached a never-ignore absolute bound that no matched signature covers",
  never_ignore_breach_on_artifact:
    "a reading breached a never-ignore absolute bound but has the shape of a sensor artifact — it must not be dismissed without re-measurement",
  never_ignore_breach_on_rejected:
    "a physically-impossible reading also breached a never-ignore bound — it may be a real extreme value or sensor garbage; re-measure immediately",
  internal_error: "an internal error occurred during evaluation",
};

interface TraceEntry {
  stage: string;
  detail: string;
}

export interface EngineOutput {
  case_id: string;
  engine_version: string;
  content_version: string;
  reference_time: string | null;
  severity: string;
  trajectory: string;
  action_tier: string;
  matched_signatures: string[];
  suppressed_signatures: Array<{ id: string; reason: string }>;
  not_evaluable_signatures: Array<{ id: string; reason: string }>;
  confidence: string;
  flags: string[];
  explanation: string;
  reasoning_trace: TraceEntry[];
  recommended_recheck_min: number;
}

function roundTo(x: unknown, digits: number): unknown {
  if (typeof x !== "number") {
    return x;
  }
  const sign = x < 0 ? -1.0 : 1.0;
  const scale = Math.pow(10.0, digits);
  return (sign * Math.floor(Math.abs(x) * scale + 0.5)) / scale;
}

function renderTemplate(sig: any, computed: Record<string, Record<string, unknown>>): string {
  let text: string = sig.explanation_template;
  const bindings = sig.template_bindings ?? {};
  for (const variable of Object.keys(bindings).sort()) {
    const binding = bindings[variable];
    const vals = computed[binding.condition_id] ?? {};
    let value: unknown = binding.field in vals ? vals[binding.field] : "n/a";
    let rendered: string;
    if (typeof value === "number") {
      if ("round" in binding) {
        value = roundTo(value, binding.round);
      }
      rendered = fmtNum(value as number);
    } else {
      rendered = String(value);
    }
    text = text.split("{" + variable + "}").join(rendered);
  }
  return text;
}

function maxTier(tiers: string[]): string {
  let best = "D0";
  for (const t of tiers) {
    if (TIER_ORD[t] > TIER_ORD[best]) {
      best = t;
    }
  }
  return best;
}

function maxSeverity(severities: Array<string | null>): string | null {
  let best: string | null = null;
  for (const s of severities) {
    if (s !== null && (best === null || SEV_ORD[s] > SEV_ORD[best])) {
      best = s;
    }
  }
  return best;
}

function maxByTraj(trajectories: string[]): string {
  let best = trajectories[0];
  for (const t of trajectories) {
    if (TRAJ_ORD[t] > TRAJ_ORD[best]) {
      best = t;
    }
  }
  return best;
}

function isNum(v: unknown): boolean {
  return typeof v === "number";
}

function strList(v: unknown): string[] | null {
  if (!Array.isArray(v)) {
    return null;
  }
  return v.filter((x) => typeof x === "string");
}

/** Coerce a malformed unit profile to a safe shape (DECISIONS D12/GAPS A5
 * class). Dropped fields are flagged — never trusted, never crashed on. */
function normalizeProfile(profile: any, flags: Set<string>): any {
  if (profile === null || typeof profile !== "object" || Array.isArray(profile)) {
    flags.add("invalid_profile_fields");
    return {};
  }
  const out: Record<string, unknown> = {};
  let dropped = false;
  for (const [key, value] of Object.entries(profile)) {
    if (key === "known_conditions" || key === "active_mitigations" || key === "incompatibilities") {
      const cleaned = strList(value);
      if (cleaned === null) {
        dropped = true;
        continue;
      }
      if (cleaned.length !== (value as unknown[]).length) {
        dropped = true;
      }
      out[key] = cleaned;
    } else if (key === "service_age_years" || key === "mass_kg") {
      if (isNum(value)) {
        out[key] = value;
      } else {
        dropped = true;
      }
    } else if (key === "baselines") {
      if (value === null || typeof value !== "object" || Array.isArray(value)) {
        dropped = true;
        continue;
      }
      const cleanedB: Record<string, unknown> = {};
      for (const [metric, b] of Object.entries(value as Record<string, any>)) {
        if (
          b !== null && typeof b === "object" && !Array.isArray(b) &&
          ["median", "p10", "p90", "n_obs"].every((f) => isNum(b[f]))
        ) {
          cleanedB[metric] = b;
        } else {
          dropped = true;
        }
      }
      out[key] = cleanedB;
    } else if (key === "unit_id" || key === "class") {
      if (typeof value === "string") {
        out[key] = value;
      } else {
        dropped = true;
      }
    } else {
      out[key] = value;
    }
  }
  if (dropped) {
    flags.add("invalid_profile_fields");
  }
  return out;
}

function normalizeContext(context: any, flags: Set<string>): any {
  if (context === null || context === undefined) {
    return null;
  }
  if (typeof context !== "object" || Array.isArray(context)) {
    flags.add("invalid_context_fields");
    return null;
  }
  const out: Record<string, unknown> = {};
  let dropped = false;
  for (const [key, value] of Object.entries(context)) {
    if (key === "deployment" || key === "operator_skill" || key === "connectivity") {
      if (typeof value === "string") {
        out[key] = value;
      } else {
        dropped = true;
      }
    } else if (key === "time_to_service_min") {
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        const entries = Object.entries(value as Record<string, unknown>);
        const cleaned: Record<string, unknown> = {};
        for (const [k, v] of entries) {
          if (isNum(v)) {
            cleaned[k] = v;
          }
        }
        if (Object.keys(cleaned).length !== entries.length) {
          dropped = true;
        }
        out[key] = cleaned;
      } else {
        dropped = true;
      }
    } else if (key === "resources") {
      const cleaned = strList(value);
      if (cleaned === null) {
        dropped = true;
      } else {
        if (cleaned.length !== (value as unknown[]).length) {
          dropped = true;
        }
        out[key] = cleaned;
      }
    } else {
      out[key] = value;
    }
  }
  if (dropped) {
    flags.add("invalid_context_fields");
  }
  return out;
}

function breaches(bound: any, value: unknown, enums: Record<string, string[]>): boolean {
  const metric = bound.metric;
  let v: number;
  let t: number;
  if (own(enums, metric)) {
    if (typeof value !== "string" || !enums[metric].includes(value)) {
      return false;
    }
    v = enums[metric].indexOf(value);
    t = enums[metric].indexOf(bound.value);
  } else {
    if (typeof value !== "number") {
      return false;
    }
    v = value;
    t = bound.value;
  }
  return bound.op === "gte" ? v >= t : v <= t;
}

export interface CaseHandle {
  unit_profile: any;
  context: any;
  observations: any[];
}

export class Engine {
  content: ContentHandle;
  audit: AuditLog = new AuditLog();

  constructor(content: ContentHandle) {
    this.content = content;
  }

  // ------------------------------------------------------------------ API

  evaluate(unitProfile: any, observations: any[], context: any = null, referenceTime: string | null = null): EngineOutput {
    const inputs = {
      unit_profile: unitProfile,
      observations,
      context,
      reference_time: referenceTime,
    };
    let output: EngineOutput;
    try {
      output = this.evaluateInner(
        pyTruthy(unitProfile) ? unitProfile : {},
        pyTruthy(observations) ? observations : [],
        context,
        referenceTime,
      );
    } catch (exc) {
      // prime directive 2: fail toward caution
      output = this.emergencyOutput(inputs, exc);
    }
    // M9 recording must also fail toward caution: raw caller inputs may be
    // unserializable (non-finite numbers passed programmatically) and must
    // not make evaluate() throw after the safe output was already built.
    try {
      this.audit.append("case_input", output.case_id, ENGINE_VERSION, this.content.content_version, inputs);
    } catch {
      this.audit.append("case_input", output.case_id, ENGINE_VERSION, this.content.content_version, {
        unserializable_input: true,
      });
    }
    this.audit.append("case_output", output.case_id, ENGINE_VERSION, this.content.content_version, {
      output,
    });
    return output;
  }

  openCase(unitProfile: any, context: any = null): CaseHandle {
    return { unit_profile: unitProfile, context, observations: [] };
  }

  evaluateStream(caseHandle: CaseHandle, newObservation: any): EngineOutput {
    // Duplicates are handled (quarantined + flagged) by M1, which keeps
    // every output a pure function of the accumulated observation list —
    // required for byte-identical replay.
    caseHandle.observations = [...caseHandle.observations, newObservation];
    return this.evaluate(caseHandle.unit_profile, caseHandle.observations, caseHandle.context);
  }

  recordOutcome(caseId: string, humanActionTier: string, outcomeNote = ""): AuditRecord {
    return this.audit.append("outcome", caseId, ENGINE_VERSION, this.content.content_version, {
      human_action_tier: humanActionTier,
      outcome_note: outcomeNote,
    });
  }

  /** Re-run every logged case; outputs must be byte-identical (§4). */
  replay(records: AuditRecord[]): EngineOutput[] {
    verifyChain(records);
    const pending = new Map<string, AuditRecord>();
    const outputs: EngineOutput[] = [];
    for (const record of records) {
      if (record.record_type === "case_input") {
        pending.set(record.case_id, record);
      } else if (record.record_type === "case_output") {
        const inp = pending.get(record.case_id);
        if (inp === undefined) {
          throw new AuditIntegrityError(`case_output without case_input: ${record.case_id}`);
        }
        if (inp.content_version !== this.content.content_version) {
          throw new AuditIntegrityError(
            `replay requires content ${inp.content_version}, loaded ${this.content.content_version}`,
          );
        }
        if ((inp.payload as any).unserializable_input) {
          // Inputs could not be recorded canonically, so the case cannot be
          // re-executed; the chained output record itself remains
          // tamper-evident. Skipped, never silently mutated.
          continue;
        }
        const p = inp.payload as any;
        const fresh = new Engine(this.content).evaluate(
          p.unit_profile,
          p.observations,
          p.context,
          p.reference_time,
        );
        if (canonicalJson(fresh) !== canonicalJson((record.payload as any).output)) {
          throw new AuditIntegrityError(`replay mismatch for case ${record.case_id}`);
        }
        outputs.push(fresh);
      }
    }
    return outputs;
  }

  // ------------------------------------------------------------- pipeline

  private evaluateInner(
    unitProfile: any,
    observations: any[],
    context: any,
    referenceTime: string | null,
  ): EngineOutput {
    const content = this.content;
    const flags = new Set<string>(content.flags);
    const trace: TraceEntry[] = [];
    const m8Triggers: string[] = [];

    // Malformed profile/context shapes are normalized identically in both
    // runtimes (flagged, never crashed on, never silently trusted).
    unitProfile = normalizeProfile(unitProfile, flags);
    context = normalizeContext(context, flags);

    // M1 — ingest & validate
    const [accepted, quarantined, notes] = ingest(observations, content, flags);
    trace.push({
      stage: "M1",
      detail: `accepted ${accepted.length} observations; quarantined ${quarantined.length}; notes ${notes.length}`,
    });
    for (const qr of quarantined) {
      trace.push({ stage: "M1", detail: `quarantined ${qr.obs_id}: ${qr.reason}` });
    }
    if (flags.has("unknown_event_code")) {
      m8Triggers.push("unknown_event_code");
    }

    // Reference time (DECISIONS.md D2)
    let ref: number | null;
    if (referenceTime !== null && referenceTime !== undefined) {
      ref = parseTs(referenceTime);
    } else if (accepted.length > 0 || notes.length > 0) {
      ref = Math.max(...accepted.map((o) => o.ts), ...notes.map((o) => o.ts));
    } else {
      ref = null;
    }

    // Never-ignore check against QUARANTINED (physically impossible) values
    // runs regardless of whether anything was accepted — an extreme-but-
    // possibly-real reading must not vanish via quarantine (DECISIONS D13.5).
    const enums = content.tables["operational_bounds"].enums;
    const rejectedFloors: string[] = [];
    for (const bound of content.tables["never_ignore"].bounds) {
      if (
        quarantined.some(
          (q: Quarantined) =>
            q.reason.startsWith("out_of_bounds:") && q.type === bound.metric && breaches(bound, q.value, enums),
        )
      ) {
        m8Triggers.push("never_ignore_breach_on_rejected");
        flags.add("never_ignore_breach_on_rejected");
        rejectedFloors.push(bound.floor_tier);
        trace.push({
          stage: "M8",
          detail: `never-ignore bound ${bound.id} breached by quarantined reading (${bound.metric}); floor ${bound.floor_tier}`,
        });
      }
    }

    if (accepted.length === 0) {
      m8Triggers.push("no_observations");
      return this.compose(unitProfile, observations, context, referenceTime, ref, flags, trace, m8Triggers, {
        matched: [],
        suppressed: [],
        not_evaluable: [],
        not_matched: [],
      }, "unknown", rejectedFloors);
    }

    // M2 — signal quality
    const [artifactMetrics] = assess(accepted, unitProfile, content, flags, trace);
    const logicObs = accepted.filter((o) => o.type !== "event");
    const usable = logicObs.filter((o) => o.quality !== "artifact_likely" || o.mechanism_protected);
    if (logicObs.length > 0 && usable.length === 0) {
      m8Triggers.push("all_inputs_artifact_likely");
    }

    // M3 — baselines for metrics any published signature compares to baseline
    const needed = new Set<string>();
    for (const sig of content.published_signatures) {
      const conds: any[] = [];
      walkConditions(sig.logic, conds);
      for (const c of conds) {
        if ((typeof c.op === "string" && c.op.startsWith("delta_from_baseline")) || ("baseline_status" in c && "metric" in c)) {
          needed.add(c.metric);
        }
      }
    }
    const baselines = computeBaselines(unitProfile, accepted, content, ref as number, needed, flags, trace);

    // M4 — features & trajectory
    const features = new Features(accepted, content, ref as number);
    const trajectoryBase = classifyTrajectory(features, content, trace);

    // M5 — signatures
    const sigres = evaluateSignatures(content, features, baselines, artifactMetrics, flags, trace);
    const published = content.published_signatures;
    if (published.length === 0) {
      m8Triggers.push("no_published_signatures");
    } else if (sigres.not_evaluable.length === published.length) {
      m8Triggers.push("all_signatures_not_evaluable");
    }

    // M8 — never-ignore absolute bounds on accepted readings. Bound FLOORS
    // apply unconditionally (a matched low-tier signature must never shadow
    // an absolute bound); the insufficient-confidence route applies when no
    // matched signature covers the metric or the breaching reading is
    // untrusted (artifact-flagged). Quarantined values were checked above.
    const niFloors = [...rejectedFloors];
    const covered = new Set<string>();
    for (const m of sigres.matched) {
      for (const t of m.sig.required_inputs) {
        covered.add(t);
      }
    }
    for (const bound of content.tables["never_ignore"].bounds) {
      const metric = bound.metric;
      const series = accepted.filter((o) => o.type === metric);
      let latestUsable: NormalizedObs | null = null;
      for (const o of series) {
        if (o.quality !== "artifact_likely" || o.mechanism_protected) {
          latestUsable = o;
        }
      }
      const confidentBreach = latestUsable !== null && breaches(bound, latestUsable.value, enums);
      const artifactBreach = series.some(
        (o) => o.quality === "artifact_likely" && !o.mechanism_protected && breaches(bound, o.value, enums),
      );

      if (confidentBreach) {
        flags.add("never_ignore_breach");
        niFloors.push(bound.floor_tier);
        trace.push({
          stage: "M8",
          detail: `never-ignore bound ${bound.id} breached (${metric}); floor ${bound.floor_tier}`,
        });
        if (!covered.has(metric)) {
          m8Triggers.push("never_ignore_breach");
        }
      } else if (artifactBreach) {
        m8Triggers.push("never_ignore_breach_on_artifact");
        flags.add("never_ignore_breach_on_artifact");
        niFloors.push(bound.floor_tier);
        trace.push({
          stage: "M8",
          detail: `never-ignore bound ${bound.id} breached by artifact-flagged reading (${metric}); floor ${bound.floor_tier}`,
        });
      }
    }

    return this.compose(unitProfile, observations, context, referenceTime, ref, flags, trace, m8Triggers, sigres, trajectoryBase, niFloors);
  }

  // -------------------------------------------------------- M7/M8 compose

  private compose(
    unitProfile: any,
    observations: any[],
    context: any,
    referenceTimeArg: string | null,
    ref: number | null,
    flags: Set<string>,
    trace: TraceEntry[],
    m8Triggers: string[],
    sigres: SigResult,
    trajectoryBase: string,
    niFloors: string[],
  ): EngineOutput {
    const content = this.content;
    const matched = sigres.matched;
    const m8Active = m8Triggers.length > 0;

    const floorsTable = content.tables["floors"].insufficient_floor_by_deployment;
    const deployment = context?.deployment ?? null;
    // Central missing-context flag: absent context/deployment must surface
    // on EVERY output path, not only when a signature happened to match.
    if (!pyTruthy(context) || typeof deployment !== "string" || deployment === "") {
      flags.add("missing_context");
    }
    const floorEntry = pyTruthy(deployment)
      ? (ownGet(floorsTable, deployment) ?? floorsTable.default)
      : floorsTable.default;

    // Severity: max over matched; floored by content severity floor when M8 fired.
    let severity = maxSeverity(matched.map((m) => m.sig.severity));
    if (m8Active) {
      severity = maxSeverity([severity, floorEntry.severity]);
    }
    if (severity === null) {
      severity = "S1";
    }

    // Tier lattice (DECISIONS.md D10) — contributions only ever raise.
    const tierCandidates = ["D0"];
    for (const m of matched) {
      tierCandidates.push(signatureTier(m.sig, context, flags, trace));
    }
    tierCandidates.push(...modifierFloors(severity, context, content, trace));
    if (flags.has("artifact_with_mechanism")) {
      tierCandidates.push(content.tables["floors"].mechanism_floor);
    }
    tierCandidates.push(...niFloors);
    if (m8Active) {
      tierCandidates.push(floorEntry.action_tier);
      flags.add("engine_could_not_fully_evaluate");
    }
    const actionTier = maxTier(tierCandidates);

    // Trajectory (DECISIONS.md D11)
    let trajectory = trajectoryBase;
    const overrides = matched
      .filter((m) => pyTruthy(m.sig.trajectory_override))
      .map((m) => m.sig.trajectory_override as string);
    if (overrides.length > 0) {
      const top = matched[0]; // highest severity first (sorted in M5)
      trajectory = pyTruthy(top.sig.trajectory_override)
        ? (top.sig.trajectory_override as string)
        : maxByTraj(overrides);
    }

    // Confidence (DECISIONS.md D12). A signature that is not_evaluable
    // because its modality was never observed is normal operation and does
    // not degrade confidence; data-quality reasons do.
    const qualityNe = sigres.not_evaluable.filter((ne) => !ne.reason.startsWith("missing_required_input:"));
    const degradedFlags = [
      "baseline_population_default",
      "baseline_unavailable",
      "suspect_inputs_present",
      "data_rejected",
      "missing_context",
      "artifact_suspected_any_input",
      "artifact_with_mechanism",
      "duplicate_obs_id",
      "baseline_zero_division",
      "invalid_profile_fields",
      "invalid_context_fields",
    ];
    let confidence: string;
    if (m8Active) {
      confidence = "insufficient";
    } else if (degradedFlags.some((f) => flags.has(f)) || qualityNe.length > 0) {
      confidence = "degraded";
    } else {
      confidence = "high";
    }
    if (sigres.not_evaluable.length > 0) {
      flags.add("signatures_not_evaluable");
    }

    const recheck = content.tables["recheck_intervals"].by_tier[actionTier];

    // Explanation (prime directive 3)
    const parts: string[] = [];
    if (m8Active) {
      const phrases: string[] = [];
      for (const t of m8Triggers) {
        const p = M8_PHRASES[t];
        if (!phrases.includes(p)) {
          phrases.push(p);
        }
      }
      parts.push(
        "ENGINE COULD NOT FULLY EVALUATE THIS CASE: " +
          phrases.join("; ") +
          `. Action tier ${actionTier} is a cautious floor for this deployment context, not a confident assessment.` +
          ` Most valuable next input: ${this.mostValuableInput(m8Triggers, sigres)}.`,
      );
    }
    for (const m of matched) {
      parts.push(renderTemplate(m.sig, m.computed));
    }
    if (!m8Active && matched.length === 0) {
      parts.push(
        "No configured signature pattern matched and no never-ignore bound was breached. " +
          "Severity S1 with action tier D0 (routine monitoring).",
      );
    }
    for (const flag of Array.from(flags).sort()) {
      if (flag === "engine_could_not_fully_evaluate") {
        continue;
      }
      parts.push("Note: " + FLAG_TEXTS[flag]);
    }
    const explanation = parts.join(" ");

    trace.push({
      stage: "M7",
      detail: `final severity ${severity}, action tier ${actionTier}, confidence ${confidence}`,
    });
    if (m8Active) {
      trace.push({ stage: "M8", detail: "triggers: " + Array.from(new Set(m8Triggers)).sort().join(",") });
    }

    let caseId: string;
    try {
      caseId = deterministicUuid({
        unit_profile: unitProfile,
        observations,
        context,
        reference_time: referenceTimeArg,
        engine_version: ENGINE_VERSION,
        content_version: content.content_version,
      });
    } catch {
      trace.push({ stage: "M9", detail: "case_id derived from sanitized inputs (raw inputs not canonically serializable)" });
      caseId = deterministicUuid({
        unserializable_input: true,
        observation_count: observations.length,
        engine_version: ENGINE_VERSION,
        content_version: content.content_version,
      });
    }
    return {
      case_id: caseId,
      engine_version: ENGINE_VERSION,
      content_version: content.content_version,
      reference_time: ref !== null ? fmtTs(ref) : null,
      severity,
      trajectory,
      action_tier: actionTier,
      matched_signatures: matched.map((m) => m.sig.signature_id),
      suppressed_signatures: sigres.suppressed,
      not_evaluable_signatures: sigres.not_evaluable,
      confidence,
      flags: Array.from(flags).sort(),
      explanation,
      reasoning_trace: trace,
      recommended_recheck_min: recheck,
    };
  }

  private mostValuableInput(m8Triggers: string[], sigres: SigResult): string {
    const missingCounts = new Map<string, number>();
    for (const ne of sigres.not_evaluable) {
      const reason = ne.reason;
      if (reason.startsWith("missing_required_input:")) {
        for (const t of reason.split(":").slice(1).join(":").split(",")) {
          missingCounts.set(t, (missingCounts.get(t) ?? 0) + 1);
        }
      }
    }
    if (missingCounts.size > 0) {
      const best = Array.from(missingCounts.entries()).sort(
        (a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0),
      )[0][0];
      return `a current ${best} observation`;
    }
    if (m8Triggers.includes("never_ignore_breach_on_artifact") || m8Triggers.includes("all_inputs_artifact_likely")) {
      return "an immediate re-measurement of the artifact-flagged metric with a different source";
    }
    if (m8Triggers.includes("unknown_event_code")) {
      return "the event re-reported with a valid code from the controlled vocabulary";
    }
    if (m8Triggers.includes("no_observations")) {
      return "any current observation for this unit";
    }
    return "any additional valid observation";
  }

  private emergencyOutput(inputs: any, exc: unknown): EngineOutput {
    const content = this.content;
    const floorsTable = content.tables["floors"].insufficient_floor_by_deployment;
    const entries = Object.values(floorsTable) as Array<{ action_tier: string; severity: string }>;
    const tier = maxTier(entries.map((f) => f.action_tier));
    const severity = maxSeverity(entries.map((f) => f.severity)) as string;
    const flags = Array.from(
      new Set<string>([...content.flags, "internal_error", "engine_could_not_fully_evaluate"]),
    ).sort();
    let caseId: string;
    try {
      caseId = deterministicUuid({
        ...inputs,
        engine_version: ENGINE_VERSION,
        content_version: content.content_version,
      });
    } catch {
      caseId = deterministicUuid({ unserializable_input: true });
    }
    const recheck = content.tables["recheck_intervals"].by_tier[tier];
    // Exception class names are runtime-specific; the deterministic output
    // carries a stable fault marker only (details belong in ops logs).
    let explanation =
      "ENGINE COULD NOT FULLY EVALUATE THIS CASE: an internal error occurred during evaluation." +
      ` Action tier ${tier} is the maximum configured safe floor,` +
      " not a confident assessment. Most valuable next input: none — this is an engine fault;" +
      " escalate per the floor tier and report the fault.";
    for (const flag of flags) {
      if (flag !== "engine_could_not_fully_evaluate") {
        explanation += " Note: " + FLAG_TEXTS[flag];
      }
    }
    return {
      case_id: caseId,
      engine_version: ENGINE_VERSION,
      content_version: content.content_version,
      reference_time: null,
      severity,
      trajectory: "unknown",
      action_tier: tier,
      matched_signatures: [],
      suppressed_signatures: [],
      not_evaluable_signatures: [],
      confidence: "insufficient",
      flags,
      explanation,
      reasoning_trace: [{ stage: "M8", detail: "internal_error" }],
      recommended_recheck_min: recheck,
    };
  }
}

export function explain(engineOutput: EngineOutput, audience: string = "operator"): string {
  if (audience === "specialist") {
    const lines = [engineOutput.explanation, "", "Reasoning trace:"];
    for (const t of engineOutput.reasoning_trace) {
      lines.push(`  [${t.stage}] ${t.detail}`);
    }
    lines.push(
      `Engine ${engineOutput.engine_version}, content ${engineOutput.content_version}, ` +
        `case ${engineOutput.case_id}, confidence ${engineOutput.confidence}.`,
    );
    return lines.join("\n");
  }
  return engineOutput.explanation;
}
