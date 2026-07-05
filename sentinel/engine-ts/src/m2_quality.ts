/** M2 — Signal-Quality Assessor. Deterministic artifact heuristics from
 * content files. Never deletes data — annotates quality and lets downstream
 * modules weight it (DECISIONS.md D7).
 */
import { pyTruthy } from "./canonical.js";
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
  if (req.metric in enums) {
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
  const enums = content.tables["operational_bounds"].enums;

  for (const o of accepted) {
    o.quality = "valid";
    o.rules_fired = [];
    o.mechanism_protected = false;
  }

  // Rule order is fixed for determinism: source_prior, impossible_jump,
  // spike_and_recover, cross_contradiction.
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

  for (const rule of rules.impossible_jump) {
    const s = series(accepted, rule.metric);
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

  for (const rule of rules.spike_and_recover) {
    const s = series(accepted, rule.metric);
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
    for (const metric of (rules.mechanism_map[mech] ?? []) as string[]) {
      if (!(metric in protectedBy)) {
        protectedBy[metric] = mech;
      }
    }
  }

  const artifactMetrics = new Set<string>();
  const protectedMetrics = new Set<string>();
  for (const o of accepted) {
    if (!NUMERIC_TYPES.includes(o.type) && !(o.type in enums)) {
      continue;
    }
    if (o.quality === "artifact_likely") {
      if (o.type in protectedBy) {
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
