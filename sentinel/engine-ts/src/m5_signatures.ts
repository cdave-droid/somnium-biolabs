/** M5 — Signature Evaluator. Three-valued logic (DECISIONS.md D6): a leaf
 * that lacks the data to answer is `unknown`, which makes the signature
 * not_evaluable rather than silently unmatched. All matches recorded;
 * conflicts resolved by explicit precedence with losers logged.
 */
import { fmtVal, q6 } from "./canonical.js";
import { SEV_ORD } from "./constants.js";
import type { ContentHandle } from "./content.js";
import type { Baseline } from "./m3_state.js";
import type { Features } from "./m4_trend.js";

export const TRUE = "true";
export const FALSE = "false";
export const UNKNOWN = "unknown";

export interface SigResult {
  matched: Array<{ sig: any; computed: Record<string, Record<string, unknown>> }>;
  suppressed: Array<{ id: string; reason: string }>;
  not_evaluable: Array<{ id: string; reason: string }>;
  not_matched: string[];
}

class EvalCtx {
  computed: Record<string, Record<string, unknown>> = {};
  unknownReasons: string[] = [];
  constructor(
    public features: Features,
    public baselines: Record<string, Baseline>,
    public sigFlags: Set<string>,
    public caseFlags: Set<string>,
  ) {}
}

function compare(result: number, cond: any): string {
  if ("gte" in cond) {
    return result >= cond.gte ? TRUE : FALSE;
  }
  if ("lte" in cond) {
    return result <= cond.lte ? TRUE : FALSE;
  }
  if ("eq" in cond) {
    return result === cond.eq ? TRUE : FALSE;
  }
  return FALSE;
}

function store(ctx: EvalCtx, cond: any, values: Record<string, unknown>): void {
  const cid = cond.id;
  if (cid) {
    const out: Record<string, unknown> = { ...values };
    if ("window_min" in cond) {
      out.window_min = cond.window_min;
      out.window_h = q6(cond.window_min / 60.0);
    }
    if ("threshold" in cond) {
      out.threshold = cond.threshold;
    }
    ctx.computed[cid] = out;
  }
}

function evalLeaf(cond: any, ctx: EvalCtx): string {
  const f = ctx.features;
  if ("flag" in cond) {
    return ctx.sigFlags.has(cond.flag) || ctx.caseFlags.has(cond.flag) ? TRUE : FALSE;
  }
  if ("baseline_status" in cond && !("op" in cond)) {
    const b = ctx.baselines[cond.metric];
    const status = b !== undefined ? b.status : "unavailable";
    return status === cond.baseline_status ? TRUE : FALSE;
  }

  const op = cond.op;
  const metric = cond.metric;

  if (op === "event_present") {
    const present = f.eventPresent(cond.event_id, cond.window_min);
    store(ctx, cond, { value: present ? 1 : 0 });
    return present ? TRUE : FALSE;
  }

  if (op === "gte" || op === "lte" || op === "eq") {
    const latest = f.latest(metric, cond.window_min);
    if (latest === null) {
      ctx.unknownReasons.push(`no_data:${metric}`);
      return UNKNOWN;
    }
    const raw = latest[1];
    const display = latest[2] !== null ? latest[2] : latest[1];
    let target = cond.value;
    if (metric in f.enums) {
      target = f.ordinalIndex(metric, target);
      if (target === null) {
        ctx.unknownReasons.push(`bad_ordinal_target:${metric}`);
        return UNKNOWN;
      }
    }
    store(ctx, cond, { value: display });
    const faux = op === "gte" ? { gte: target } : op === "lte" ? { lte: target } : { eq: target };
    return compare(raw, faux);
  }

  if (op === "delta_from_baseline_abs" || op === "delta_from_baseline_pct") {
    const b = ctx.baselines[metric];
    if (b === undefined || b.status === "unavailable") {
      ctx.unknownReasons.push(`no_baseline:${metric}`);
      return UNKNOWN;
    }
    const med = f.windowMedian(metric, cond.window_min, cond.min_points ?? 1);
    if (med === null) {
      ctx.unknownReasons.push(`insufficient_points:${metric}`);
      return UNKNOWN;
    }
    const bMedian = b.median as number;
    const deltaAbs = q6(med - bMedian);
    const values: Record<string, unknown> = { value: med, delta_abs: deltaAbs, baseline_median: bMedian };
    let result: number;
    if (op === "delta_from_baseline_pct") {
      if (bMedian === 0) {
        ctx.caseFlags.add("baseline_zero_division");
        ctx.unknownReasons.push(`baseline_zero:${metric}`);
        return UNKNOWN;
      }
      values.delta_pct = q6(((med - bMedian) / bMedian) * 100.0);
      result = values.delta_pct as number;
    } else {
      result = deltaAbs;
    }
    store(ctx, cond, values);
    return compare(result, cond);
  }

  if (op === "trend_slope") {
    const s = f.slope(metric, cond.window_min, cond.min_points);
    if (s === null) {
      ctx.unknownReasons.push(`insufficient_points:${metric}`);
      return UNKNOWN;
    }
    store(ctx, cond, { slope: s, value: s });
    return compare(s, cond);
  }

  if (op === "crossed_threshold_count") {
    const c = f.crossings(metric, cond.window_min, cond.threshold, cond.direction);
    if (c === null) {
      ctx.unknownReasons.push(`insufficient_points:${metric}`);
      return UNKNOWN;
    }
    store(ctx, cond, { count: c, value: c });
    return compare(c, cond);
  }

  if (op === "sustained_for_min") {
    const s = f.sustainedMin(metric, cond.window_min, cond.threshold, cond.direction);
    if (s === null) {
      ctx.unknownReasons.push(`no_data:${metric}`);
      return UNKNOWN;
    }
    store(ctx, cond, { sustained_min: s, value: s });
    return compare(s, cond);
  }

  throw new Error(`unknown op ${op}`); // unreachable: content validation rejects
}

function evalNode(node: any, ctx: EvalCtx): string {
  if ("all_of" in node) {
    const states = node.all_of.map((c: any) => evalNode(c, ctx));
    if (states.includes(FALSE)) {
      return FALSE;
    }
    if (states.includes(UNKNOWN)) {
      return UNKNOWN;
    }
    return TRUE;
  }
  if ("any_of" in node) {
    const states = node.any_of.map((c: any) => evalNode(c, ctx));
    if (states.includes(TRUE)) {
      return TRUE;
    }
    if (states.includes(UNKNOWN)) {
      return UNKNOWN;
    }
    return FALSE;
  }
  if ("none_of" in node) {
    const states = node.none_of.map((c: any) => evalNode(c, ctx));
    if (states.includes(TRUE)) {
      return FALSE;
    }
    if (states.includes(UNKNOWN)) {
      return UNKNOWN;
    }
    return TRUE;
  }
  if ("at_least_n_of" in node) {
    const spec = node.at_least_n_of;
    const states = spec.of.map((c: any) => evalNode(c, ctx));
    const trues = states.filter((s: string) => s === TRUE).length;
    const unknowns = states.filter((s: string) => s === UNKNOWN).length;
    if (trues >= spec.n) {
      return TRUE;
    }
    if (trues + unknowns < spec.n) {
      return FALSE;
    }
    return UNKNOWN;
  }
  return evalLeaf(node, ctx);
}

function hasInput(features: Features, itype: string): boolean {
  if (itype === "event") {
    return features.events.length > 0;
  }
  if (itype === "free_text_note") {
    return true; // notes are never logic inputs
  }
  return (features.byMetric.get(itype) ?? []).length > 0;
}

const strCmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Returns matched / suppressed / not_evaluable / not_matched lists.
 * `matched` entries: {sig, computed}. Deterministic order everywhere. */
export function evaluateSignatures(
  content: ContentHandle,
  features: Features,
  baselines: Record<string, Baseline>,
  artifactMetrics: Set<string>,
  caseFlags: Set<string>,
  trace: Array<{ stage: string; detail: string }>,
): SigResult {
  const matched: SigResult["matched"] = [];
  const notEvaluable: Array<{ id: string; reason: string }> = [];
  const notMatched: string[] = [];

  for (const sig of content.published_signatures) {
    const sid = sig.signature_id;
    // artifact_suspected_any_input is scoped to THIS signature's required
    // inputs so an artifact on an unrelated metric cannot veto it.
    const sigFlags = new Set<string>();
    if (sig.required_inputs.some((m: string) => artifactMetrics.has(m))) {
      sigFlags.add("artifact_suspected_any_input");
    }

    const missing = sig.required_inputs.filter((t: string) => !hasInput(features, t));
    if (missing.length > 0) {
      const reason = "missing_required_input:" + [...missing].sort().join(",");
      notEvaluable.push({ id: sid, reason });
      trace.push({ stage: "M5", detail: `${sid} not_evaluable (${reason})` });
      continue;
    }

    if (sig.requires_personalized_baseline) {
      const degraded = sig.required_inputs.filter(
        (m: string) => m in baselines && baselines[m].status !== "personalized",
      );
      if (degraded.length > 0) {
        const reason = "personalized_baseline_required:" + [...degraded].sort().join(",");
        notEvaluable.push({ id: sid, reason });
        trace.push({ stage: "M5", detail: `${sid} not_evaluable (${reason})` });
        continue;
      }
    }

    const ctx = new EvalCtx(features, baselines, sigFlags, caseFlags);
    const state = evalNode(sig.logic, ctx);
    if (state === TRUE) {
      matched.push({ sig, computed: ctx.computed });
      let detail = `${sid} matched`;
      const parts: string[] = [];
      for (const cid of Object.keys(ctx.computed).sort()) {
        const vals = ctx.computed[cid];
        for (const key of ["delta_pct", "slope", "sustained_min", "count", "value"]) {
          if (key in vals) {
            parts.push(`${cid}.${key}=${fmtVal(vals[key])}`);
            break;
          }
        }
      }
      if (parts.length > 0) {
        detail += ": " + parts.join("; ");
      }
      trace.push({ stage: "M5", detail });
    } else if (state === UNKNOWN) {
      const reason = "insufficient_data:" + (ctx.unknownReasons.length > 0 ? ctx.unknownReasons[0] : "unknown");
      notEvaluable.push({ id: sid, reason });
      trace.push({ stage: "M5", detail: `${sid} not_evaluable (${reason})` });
    } else {
      notMatched.push(sid);
    }
  }

  // Conflict resolution (DECISIONS.md D9): within a conflict_group only the
  // highest (severity, priority, id) match survives; losers are recorded.
  const groups = new Map<string, SigResult["matched"]>();
  for (const m of matched) {
    const group = m.sig.conflict_group;
    if (group) {
      const arr = groups.get(group);
      if (arr === undefined) {
        groups.set(group, [m]);
      } else {
        arr.push(m);
      }
    }
  }
  const suppressed: Array<{ id: string; reason: string }> = [];
  const survivors: SigResult["matched"] = [];
  const losers = new Set<string>();
  for (const group of Array.from(groups.keys()).sort()) {
    const members = groups.get(group)!;
    members.sort(
      (a, b) =>
        SEV_ORD[b.sig.severity] - SEV_ORD[a.sig.severity] ||
        (b.sig.priority ?? 0) - (a.sig.priority ?? 0) ||
        strCmp(a.sig.signature_id, b.sig.signature_id),
    );
    const winner = members[0];
    for (const loser of members.slice(1)) {
      const reason =
        SEV_ORD[loser.sig.severity] < SEV_ORD[winner.sig.severity]
          ? "superseded_by_higher_severity"
          : "superseded_by_priority";
      suppressed.push({ id: loser.sig.signature_id, reason });
      losers.add(loser.sig.signature_id);
      trace.push({
        stage: "M5",
        detail: `${loser.sig.signature_id} suppressed (${reason} by ${winner.sig.signature_id})`,
      });
    }
  }
  for (const m of matched) {
    if (!losers.has(m.sig.signature_id)) {
      survivors.push(m);
    }
  }

  survivors.sort(
    (a, b) => SEV_ORD[b.sig.severity] - SEV_ORD[a.sig.severity] || strCmp(a.sig.signature_id, b.sig.signature_id),
  );
  suppressed.sort((a, b) => strCmp(a.id, b.id));
  notEvaluable.sort((a, b) => strCmp(a.id, b.id));
  return {
    matched: survivors,
    suppressed,
    not_evaluable: notEvaluable,
    not_matched: [...notMatched].sort(),
  };
}
