/** Deterministic statistics (DECISIONS.md D5). Mirrors engine-py/sentinel/stats.py.
 *
 * Accumulation order is fixed (input order after an ascending sort) so both
 * runtimes execute the identical IEEE-754 operation sequence.
 */
import { q6 } from "./canonical.js";

/** Linear-interpolation percentile (numpy default). `p` in [0, 100]. */
export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) {
    return null;
  }
  const vs = [...values].sort((a, b) => a - b);
  if (vs.length === 1) {
    return q6(vs[0]);
  }
  const rank = (vs.length - 1) * (p / 100.0);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) {
    return q6(vs[Math.trunc(rank)]);
  }
  const frac = rank - lo;
  return q6(vs[lo] + (vs[hi] - vs[lo]) * frac);
}

export function median(values: readonly number[]): number | null {
  return percentile(values, 50.0);
}

/** Least-squares slope in value-units per minute over (epoch_s, value) points.
 *
 * Returns null (refusal) when n < min_points or all timestamps coincide.
 */
export function olsSlope(points: ReadonlyArray<readonly [number, number]>, minPoints: number): number | null {
  if (points.length < minPoints || minPoints < 2 || points.length < 2) {
    return null;
  }
  const t0 = points[0][0];
  const xs = points.map((p) => (p[0] - t0) / 60.0);
  const ys = points.map((p) => p[1]);
  const n = xs.length;
  const meanX = sumInOrder(xs) / n;
  const meanY = sumInOrder(ys) / n;
  let sxx = 0.0;
  let sxy = 0.0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    sxx += dx * dx;
    sxy += dx * (ys[i] - meanY);
  }
  if (sxx === 0.0) {
    return null;
  }
  return q6(sxy / sxx);
}

export function sumInOrder(values: readonly number[]): number {
  let total = 0.0;
  for (const v of values) {
    total += v;
  }
  return total;
}
