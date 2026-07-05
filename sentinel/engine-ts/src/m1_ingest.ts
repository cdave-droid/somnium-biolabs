/** M1 — Ingest & Validate. Quarantines (never drops silently) anything
 * structurally invalid, physically impossible, or outside the controlled
 * vocabularies. Bounds and unit conversions are content, not code.
 */
import { q6 } from "./canonical.js";
import { NUMERIC_TYPES, OBSERVATION_TYPES } from "./constants.js";
import type { ContentHandle } from "./content.js";
import { parseTs } from "./timeutil.js";

export const VALID_SOURCES = ["wearable_sensor", "inline_gauge", "manual_entry", "fixed_monitor", "event_report"];

export interface Quarantined {
  obs_id: string;
  reason: string;
  // Present only for out_of_bounds records so M8 can still test never-ignore
  // bounds against the rejected value (DECISIONS.md D13.5).
  type?: string;
  value?: unknown;
}

export interface NormalizedObs {
  obs_id: string;
  ts: number;
  timestamp: string;
  type: string;
  source: string;
  quality_meta: any;
  text?: string;
  event_id?: string;
  value?: any;
  unit?: string;
  // M2 annotations:
  quality?: string;
  rules_fired?: string[];
  mechanism_protected?: boolean;
}

function quarantine(quarantined: Quarantined[], obs: any, reason: string): void {
  const obsId = typeof obs === "object" && obs !== null && !Array.isArray(obs) ? obs.obs_id : undefined;
  quarantined.push({ obs_id: typeof obsId === "string" ? obsId : "(missing)", reason });
}

function isPlainObject(v: unknown): boolean {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Python `x or {}` for quality_meta. */
function orEmpty(v: any): any {
  if (v === null || v === undefined || v === false || v === "" || v === 0) {
    return {};
  }
  if (Array.isArray(v) && v.length === 0) {
    return {};
  }
  if (isPlainObject(v) && Object.keys(v).length === 0) {
    return {};
  }
  return v;
}

/** Returns [accepted, quarantined, notes]. Accepted observations are
 * normalized: canonical units, epoch-second `ts`, sorted by (ts, obs_id). */
export function ingest(
  observations: any[],
  content: ContentHandle,
  flags: Set<string>,
): [NormalizedObs[], Quarantined[], NormalizedObs[]] {
  const bounds = content.tables["operational_bounds"].bounds;
  const enums = content.tables["operational_bounds"].enums;
  const unitsTable = content.tables["units"];
  const eventIds = new Set<string>(content.tables["event_codes"].codes.map((c: any) => c.event_id));
  const conversions = new Map<string, any>();
  for (const c of unitsTable.conversions) {
    conversions.set(`${c.type}\u0000${c.from}`, c);
  }

  const accepted: NormalizedObs[] = [];
  const quarantined: Quarantined[] = [];
  const notes: NormalizedObs[] = [];
  const seenIds = new Set<string>();

  for (const obs of observations) {
    if (!isPlainObject(obs)) {
      quarantine(quarantined, {}, "invalid_structure");
      continue;
    }
    const obsId = obs.obs_id;
    if (typeof obsId !== "string" || obsId === "") {
      quarantine(quarantined, obs, "invalid_structure:obs_id");
      continue;
    }
    if (seenIds.has(obsId)) {
      quarantine(quarantined, obs, "duplicate_obs_id");
      flags.add("duplicate_obs_id");
      continue;
    }
    const otype = obs.type;
    if (typeof otype !== "string" || !OBSERVATION_TYPES.includes(otype)) {
      quarantine(quarantined, obs, `unknown_type:${pyStrOpt(otype)}`);
      continue;
    }
    const source = obs.source;
    if (typeof source !== "string" || !VALID_SOURCES.includes(source)) {
      quarantine(quarantined, obs, `unknown_source:${pyStrOpt(source)}`);
      continue;
    }
    let ts: number;
    try {
      ts = parseTs(obs.timestamp);
    } catch {
      quarantine(quarantined, obs, "invalid_timestamp");
      continue;
    }

    const norm: NormalizedObs = {
      obs_id: obsId,
      ts,
      timestamp: obs.timestamp,
      type: otype,
      source,
      quality_meta: orEmpty(obs.quality_meta),
    };

    if (otype === "free_text_note") {
      // Logged, NEVER parsed for logic (§2).
      norm.text = typeof obs.text === "string" ? obs.text : "";
      seenIds.add(obsId);
      notes.push(norm);
      continue;
    }

    if (otype === "event") {
      const eventId = obs.event_id;
      if (typeof eventId !== "string") {
        quarantine(quarantined, obs, "invalid_value:event_id_missing");
        continue;
      }
      if (!eventIds.has(eventId)) {
        quarantine(quarantined, obs, `unknown_event_code:${eventId}`);
        flags.add("unknown_event_code");
        continue;
      }
      norm.event_id = eventId;
      seenIds.add(obsId);
      accepted.push(norm);
      continue;
    }

    let value = obs.value;
    if (otype in enums) {
      if (!enums[otype].includes(value)) {
        quarantine(quarantined, obs, `invalid_value:${pyStrOpt(value)}`);
        continue;
      }
      norm.value = value;
    } else if (NUMERIC_TYPES.includes(otype)) {
      if (typeof value !== "number") {
        quarantine(quarantined, obs, "invalid_value:not_numeric");
        continue;
      }
      const unit = obs.unit;
      const canonicalUnit = unitsTable.canonical[otype];
      if (unit !== null && unit !== undefined && unit !== canonicalUnit) {
        const conv = conversions.get(`${otype}\u0000${unit}`);
        if (conv === undefined) {
          quarantine(quarantined, obs, `unknown_unit:${pyStrOpt(unit)}`);
          continue;
        }
        value = q6(value * conv.factor + conv.offset);
      }
      const b = bounds[otype];
      if (b === undefined || value < b.min || value > b.max) {
        quarantined.push({ obs_id: obsId, reason: `out_of_bounds:${otype}`, type: otype, value });
        flags.add("data_rejected");
        continue;
      }
      norm.value = value;
      norm.unit = canonicalUnit;
    }
    seenIds.add(obsId);
    accepted.push(norm);
  }

  if (quarantined.some((q) => q.reason.startsWith("out_of_bounds") || q.reason.startsWith("invalid_") || q.reason.startsWith("unknown_"))) {
    flags.add("data_rejected");
  }

  const byTsThenId = (a: NormalizedObs, b: NormalizedObs) =>
    a.ts - b.ts || (a.obs_id < b.obs_id ? -1 : a.obs_id > b.obs_id ? 1 : 0);
  accepted.sort(byTsThenId);
  notes.sort(byTsThenId);
  return [accepted, quarantined, notes];
}

/** Python str() of an arbitrary quarantine-reason value (None → "None"). */
function pyStrOpt(v: unknown): string {
  if (v === null || v === undefined) return "None";
  if (v === true) return "True";
  if (v === false) return "False";
  return String(v);
}
