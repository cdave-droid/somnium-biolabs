/** M4 — Trend & Trajectory Engine. Windowed feature computations consumed by
 * M5, plus content-rule trajectory classification. Refuses to emit a slope
 * from fewer than min_points (§3 M4).
 */
import { fmtVal, q6 } from "./canonical.js";
import type { ContentHandle } from "./content.js";
import type { NormalizedObs } from "./m1_ingest.js";
import { median, olsSlope } from "./stats.js";

/** (ts, raw-or-ordinal-index, ordinal-label-or-null) — mirrors the Python tuple. */
export type Point = [number, number, string | null];

export class Features {
  ref: number;
  enums: Record<string, string[]>;
  byMetric: Map<string, Point[]> = new Map();
  events: NormalizedObs[] = [];

  constructor(accepted: NormalizedObs[], content: ContentHandle, referenceTime: number) {
    this.ref = referenceTime;
    this.enums = content.tables["operational_bounds"].enums;
    for (const o of accepted) {
      // already sorted by (ts, obs_id)
      const usable = o.quality !== "artifact_likely" || o.mechanism_protected;
      if (o.type === "event") {
        this.events.push(o);
        continue;
      }
      if (!usable || !("value" in o) || o.value === undefined) {
        continue;
      }
      let point: Point;
      if (o.type in this.enums) {
        const idx = this.enums[o.type].indexOf(o.value as string);
        point = [o.ts, idx, o.value as string];
      } else {
        point = [o.ts, o.value as number, null];
      }
      const arr = this.byMetric.get(o.type);
      if (arr === undefined) {
        this.byMetric.set(o.type, [point]);
      } else {
        arr.push(point);
      }
    }
  }

  ordinalIndex(metric: string, label: unknown): number | null {
    const order = this.enums[metric];
    if (order === undefined || typeof label !== "string" || !order.includes(label)) {
      return null;
    }
    return order.indexOf(label);
  }

  inWindow(metric: string, windowMin: number): Point[] {
    const lo = this.ref - windowMin * 60;
    return (this.byMetric.get(metric) ?? []).filter((p) => lo <= p[0] && p[0] <= this.ref);
  }

  latest(metric: string, windowMin: number): Point | null {
    const pts = this.inWindow(metric, windowMin);
    return pts.length > 0 ? pts[pts.length - 1] : null;
  }

  windowMedian(metric: string, windowMin: number, minPoints: number): number | null {
    const pts = this.inWindow(metric, windowMin);
    if (pts.length < minPoints) {
      return null;
    }
    return median(pts.map((p) => p[1]));
  }

  slope(metric: string, windowMin: number, minPoints: number): number | null {
    const pts = this.inWindow(metric, windowMin);
    return olsSlope(pts.map((p) => [p[0], p[1]] as const), minPoints);
  }

  sustainedMin(metric: string, windowMin: number, threshold: number, direction: string): number | null {
    const pts = this.inWindow(metric, windowMin);
    if (pts.length === 0) {
      return null;
    }
    const beyond = (v: number) => (direction === "above" ? v > threshold : v < threshold);
    if (!beyond(pts[pts.length - 1][1])) {
      return 0.0;
    }
    let start = pts.length - 1;
    while (start > 0 && beyond(pts[start - 1][1])) {
      start -= 1;
    }
    return q6((pts[pts.length - 1][0] - pts[start][0]) / 60.0);
  }

  crossings(metric: string, windowMin: number, threshold: number, direction: string): number | null {
    const pts = this.inWindow(metric, windowMin);
    if (pts.length < 2) {
      return null;
    }
    let count = 0;
    for (let i = 1; i < pts.length; i++) {
      const prevV = pts[i - 1][1];
      const curV = pts[i][1];
      if (direction === "above" && prevV <= threshold && threshold < curV) {
        count += 1;
      } else if (direction === "below" && prevV >= threshold && threshold > curV) {
        count += 1;
      }
    }
    return count;
  }

  eventPresent(eventId: string, windowMin: number): boolean {
    const lo = this.ref - windowMin * 60;
    return this.events.some((e) => e.event_id === eventId && lo <= e.ts && e.ts <= this.ref);
  }
}

export function classifyTrajectory(
  features: Features,
  content: ContentHandle,
  trace: Array<{ stage: string; detail: string }>,
): string {
  const rules = content.tables["trajectory_rules"];
  let worse = 0;
  let improving = 0;
  let evaluated = 0;
  const details: string[] = [];
  for (const m of rules.metrics) {
    const s = features.slope(m.metric, rules.window_min, rules.min_points);
    if (s === null) {
      continue;
    }
    evaluated += 1;
    const thr = m.slope_per_min;
    if (m.worse_direction === "up") {
      if (s >= thr) {
        worse += 1;
        details.push(`${m.metric} worsening (slope ${fmtVal(s)}/min)`);
      } else if (s <= -thr) {
        improving += 1;
      }
    } else {
      if (s <= -thr) {
        worse += 1;
        details.push(`${m.metric} worsening (slope ${fmtVal(s)}/min)`);
      } else if (s >= thr) {
        improving += 1;
      }
    }
  }
  let result: string;
  if (evaluated === 0) {
    result = "unknown";
  } else if (worse >= rules.worsening_min_signals) {
    result = "worsening";
  } else if (improving >= rules.improving_min_signals && worse === 0) {
    result = "improving";
  } else {
    result = "stable";
  }
  let detail = `trajectory ${result} (worse_signals=${worse}, improving_signals=${improving}, metrics_evaluated=${evaluated})`;
  if (details.length > 0) {
    detail += ": " + details.join("; ");
  }
  trace.push({ stage: "M4", detail });
  return result;
}
