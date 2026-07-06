/** M2 — Signal-Quality Assessor. Deterministic artifact heuristics from
 * content files. Never deletes data — annotates quality and lets downstream
 * modules weight it (DECISIONS.md D7).
 *
 * Screening is PER STREAM first (DECISIONS.md D19): every (metric, stream)
 * pair is screened on its own — waveform-shape rules never compare readings
 * from different devices, a stream with too many artifacts is distrusted
 * wholesale, and only then are streams reconciled against each other
 * (disagreement) and against other metrics (cross-signal contradiction).
 */
import { fmtVal, own, pyTruthy } from "./canonical.js";
import { NUMERIC_TYPES } from "./constants.js";
import type { ContentHandle } from "./content.js";
import type { NormalizedObs } from "./m1_ingest.js";

const QUALITY_ORD: Record<string, number> = { valid: 0, suspect: 1, artifact_likely: 2 };

// Lookback for cross-signal-contradiction corroborating readings (minutes).
export const CROSS_RULE_LOOKBACK_MIN = 60;

function mark(obs: NormalizedObs, level: string, ruleId: string): void {
  if (QUALITY_ORD[level] > QUALITY_ORD[obs.quality as string]) {
    obs.quality = level;
  }
  if (!(obs.rules_fired as string[]).includes(ruleId)) {
    (obs.rules_fired as string[]).push(ruleId);
  }
}

function series(accepted: NormalizedObs[], metric: string): NormalizedObs[] {
  return accepted.filter((o) => o.type === metric);
}

/** (metric, stream) grouping in deterministic stream order — the unit of
 * individual screening. Observations arrive already (ts, obs_id)-sorted. */
function seriesByStream(accepted: NormalizedObs[], metric: string): Array<[string, NormalizedObs[]]> {
  const groups = new Map<string, NormalizedObs[]>();
  for (const o of accepted) {
    if (o.type === metric) {
      const arr = groups.get(o.stream);
      if (arr === undefined) {
        groups.set(o.stream, [o]);
      } else {
        arr.push(o);
      }
    }
  }
  return Array.from(groups.keys()).sort().map((stream) => [stream, groups.get(stream)!] as [string, NormalizedObs[]]);
}

function sourcePriority(screening: any, source: string): number {
  const order: string[] = screening.source_priority;
  const idx = order.indexOf(source);
  return idx >= 0 ? idx : order.length;
}

function latestPlausibleAt(
  accepted: NormalizedObs[],
  metric: string,
  atTs: number,
  _enums: any,
): NormalizedObs | null {
  let best: NormalizedObs | null = null;
  for (const o of accepted) {
    if (o.type !== metric || o.quality === "artifact_likely") {
      continue;
    }
    if (o.ts <= atTs && atTs - o.ts <= CROSS_RULE_LOOKBACK_MIN * 60) {
      best = o;
    }
  }
  return best;
}

function reqHolds(req: any, value: any, enums: any): boolean {
  if (req.op === "between") {
    return typeof value === "number" && req.min <= value && value <= req.max;
  }
  let a: any;
  let b: any;
  if (own(enums, req.metric)) {
    const order: any[] = enums[req.metric];
    if (!order.includes(value) || !order.includes(req.value)) {
      return false;
    }
    a = order.indexOf(value);
    b = order.indexOf(req.value);
  } else {
    if (typeof value !== "number") {
      return false;
    }
    a = value;
    b = req.value;
  }
  if (req.op === "eq") {
    return a === b;
  }
  if (req.op === "gte") {
    return a >= b;
  }
  if (req.op === "lte") {
    return a <= b;
  }
  return false;
}

/** Python `bool(x) == when_noise_flag` (when may be bool or, defensively, a number). */
function noiseFlagMatches(noise: unknown, want: unknown): boolean {
  const truth = pyTruthy(noise);
  if (typeof want === "boolean") {
    return truth === want;
  }
  if (typeof want === "number") {
    return (truth ? 1 : 0) === want;
  }
  return false;
}

/** Annotates accepted observations in place with quality/rules_fired/
 * mechanism_protected. Returns [artifact_metrics, protected_metrics]. */
export function assess(
  accepted: NormalizedObs[],
  unitProfile: any,
  content: ContentHandle,
  flags: Set<string>,
  trace: Array<{ stage: string; detail: string }>,
): [Set<string>, Set<string>] {
  const rules = content.tables["artifact_rules"];
  const screening = content.tables["stream_screening"];
  const enums = content.tables["operational_bounds"].enums;

  for (const o of accepted) {
    o.quality = "valid";
    o.rules_fired = [];
    o.mechanism_protected = false;
  }

  const numericMetrics = Array.from(
    new Set(accepted.filter((o) => NUMERIC_TYPES.includes(o.type)).map((o) => o.type)),
  ).sort();
  const screenableMetrics = Array.from(
    new Set(accepted.filter((o) => NUMERIC_TYPES.includes(o.type) || own(enums, o.type)).map((o) => o.type)),
  ).sort();

  // Rule order is fixed for determinism: source_prior, per-stream
  // impossible_jump, per-stream spike_and_recover, per-stream distrust,
  // cross-stream disagreement, cross-signal contradiction.
  for (const rule of rules.source_prior) {
    for (const o of accepted) {
      const qm = o.quality_meta;
      if (qm === null || typeof qm !== "object" || Array.isArray(qm)) {
        // Python would raise AttributeError on a non-dict quality_meta.
        throw new TypeError("quality_meta is not a mapping");
      }
      if (o.source === rule.source && noiseFlagMatches(qm.noise_flag, rule.when_noise_flag)) {
        mark(o, rule.mark, rule.id);
      }
    }
  }

  // Waveform-shape rules run WITHIN one stream only: readings from two
  // devices are different signals, and comparing them manufactures
  // artifacts out of ordinary inter-device offsets.
  for (const rule of rules.impossible_jump) {
    for (const [, s] of seriesByStream(accepted, rule.metric)) {
      for (let i = 1; i < s.length; i++) {
        const prev = s[i - 1];
        const cur = s[i];
        const dt = cur.ts - prev.ts;
        if (dt <= 0) {
          if (cur.value !== prev.value) {
            mark(prev, "artifact_likely", rule.id + ":simultaneous_conflict");
            mark(cur, "artifact_likely", rule.id + ":simultaneous_conflict");
          }
          continue;
        }
        if (Math.abs(cur.value - prev.value) / dt > rule.max_change_per_s) {
          mark(cur, "artifact_likely", rule.id);
        }
      }
    }
  }

  for (const rule of rules.spike_and_recover) {
    for (const [, s] of seriesByStream(accepted, rule.metric)) {
      for (let i = 1; i < s.length - 1; i++) {
        const a = s[i - 1];
        const b = s[i];
        const c = s[i + 1];
        if (c.ts - a.ts > rule.window_s) {
          continue;
        }
        if (a.value <= 0) {
          continue;
        }
        const dropped = b.value <= a.value * (1 - rule.drop_pct / 100.0);
        const recovered = c.value >= a.value * (rule.recovery_pct / 100.0);
        if (dropped && recovered) {
          mark(b, "artifact_likely", rule.id);
        }
      }
    }
  }

  // Per-stream trust verdict: a stream whose recent readings are dominated
  // by artifact shapes is not a signal to be believed selectively — its
  // remaining readings are downgraded wholesale until it is re-verified.
  for (const metric of screenableMetrics) {
    for (const [stream, s] of seriesByStream(accepted, metric)) {
      const n = s.length;
      if (n < screening.min_points_for_distrust) {
        continue;
      }
      const artifactN = s.filter((o) => o.quality === "artifact_likely").length;
      const source = s[s.length - 1].source;
      const maxFrac = own(screening.max_artifact_fraction, source)
        ? screening.max_artifact_fraction[source]
        : screening.max_artifact_fraction.default;
      if (artifactN / n >= maxFrac && artifactN > 0) {
        for (const o of s) {
          mark(o, "artifact_likely", "stream_untrusted");
        }
        flags.add("stream_untrusted");
        trace.push({
          stage: "M2",
          detail: `stream ${stream}/${metric} distrusted (${artifactN}/${n} readings artifact-flagged); all its readings excluded pending re-verification`,
        });
      }
    }
  }

  // Cross-stream reconciliation: near-simultaneous usable readings of the
  // SAME metric from different streams that disagree beyond tolerance. The
  // lower-trust reading becomes suspect; the disagreement is always flagged.
  const disagreement = screening.disagreement;
  for (const metric of numericMetrics) {
    const streams: Array<[number, string, NormalizedObs]> = [];
    for (const [stream, s] of seriesByStream(accepted, metric)) {
      const usable = s.filter((o) => o.quality !== "artifact_likely");
      if (usable.length > 0) {
        const latest = usable[usable.length - 1];
        streams.push([sourcePriority(screening, latest.source), stream, latest]);
      }
    }
    if (streams.length < 2) {
      continue;
    }
    streams.sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
    const anchor = streams[0][2];
    const tolAbs = own(disagreement.tolerance_abs ?? {}, metric) ? disagreement.tolerance_abs[metric] : null;
    for (const [, , other] of streams.slice(1)) {
      if (Math.abs(other.ts - anchor.ts) > disagreement.window_s) {
        continue;
      }
      let tolerance: number;
      if (tolAbs !== null) {
        tolerance = tolAbs;
      } else {
        const pct = own(disagreement.tolerance_pct, metric)
          ? disagreement.tolerance_pct[metric]
          : disagreement.tolerance_pct.default;
        tolerance = (Math.abs(anchor.value) * pct) / 100.0;
      }
      if (Math.abs(other.value - anchor.value) > tolerance) {
        mark(other, "suspect", "stream_disagreement");
        flags.add("stream_disagreement");
        trace.push({
          stage: "M2",
          detail: `stream disagreement on ${metric}: ${anchor.stream}=${fmtVal(anchor.value)} vs ${other.stream}=${fmtVal(other.value)} within ${fmtVal(disagreement.window_s)}s; higher-trust source preferred — re-measure to resolve`,
        });
      }
    }
  }

  for (const rule of rules.cross_contradiction) {
    for (const o of series(accepted, rule.metric)) {
      const v = o.value;
      const hit = (rule.op === "lte" && v <= rule.value) || (rule.op === "gte" && v >= rule.value);
      if (!hit) {
        continue;
      }
      let corroborated = true;
      for (const req of rule.requires_all) {
        const latest = latestPlausibleAt(accepted, req.metric, o.ts, enums);
        if (latest === null || !reqHolds(req, latest.value, enums)) {
          corroborated = false;
          break;
        }
      }
      if (corroborated) {
        mark(o, rule.mark, rule.id);
      }
    }
  }

  // Mechanism protection: an artifact-shaped reading in a unit whose profile
  // contains a plausible mechanism for that abnormality must not be
  // dismissed (§3 M2 critical rule). M7 floors the tier via content.
  const mechanisms = new Set<string>([
    ...((unitProfile?.known_conditions ?? []) as string[]),
    ...((unitProfile?.active_mitigations ?? []) as string[]),
  ]);
  const protectedBy: Record<string, string> = {};
  for (const mech of Array.from(mechanisms).sort()) {
    const mapped = own(rules.mechanism_map, mech) ? (rules.mechanism_map[mech] as string[]) : [];
    for (const metric of mapped) {
      if (!own(protectedBy, metric)) {
        protectedBy[metric] = mech;
      }
    }
  }

  const artifactMetrics = new Set<string>();
  const protectedMetrics = new Set<string>();
  for (const o of accepted) {
    if (!NUMERIC_TYPES.includes(o.type) && !own(enums, o.type)) {
      continue;
    }
    if (o.quality === "artifact_likely") {
      if (own(protectedBy, o.type)) {
        o.mechanism_protected = true;
        protectedMetrics.add(o.type);
        flags.add("artifact_with_mechanism");
      } else {
        artifactMetrics.add(o.type);
        flags.add("artifact_suspected_any_input");
      }
    } else if (o.quality === "suspect") {
      flags.add("suspect_inputs_present");
    }
    if ((o.rules_fired as string[]).length > 0) {
      let detail = `obs ${o.obs_id} (${o.type}) flagged ${o.quality} by ${(o.rules_fired as string[]).join(",")}`;
      if (o.mechanism_protected) {
        detail += ` — mechanism-protected via '${protectedBy[o.type]}'`;
      }
      trace.push({ stage: "M2", detail });
    }
  }

  return [artifactMetrics, protectedMetrics];
}
