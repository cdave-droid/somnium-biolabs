"""Deterministic statistics (DECISIONS.md D5). Mirrored in engine-ts/src/stats.ts.

Accumulation order is fixed (input order after an ascending sort) so both
runtimes execute the identical IEEE-754 operation sequence.
"""
from __future__ import annotations

import math

from .canonical import q6


def percentile(values, p: float):
    """Linear-interpolation percentile (numpy default). `p` in [0, 100]."""
    if not values:
        return None
    vs = sorted(values)
    if len(vs) == 1:
        return q6(vs[0])
    rank = (len(vs) - 1) * (p / 100.0)
    lo = math.floor(rank)
    hi = math.ceil(rank)
    if lo == hi:
        return q6(vs[int(rank)])
    frac = rank - lo
    return q6(vs[lo] + (vs[hi] - vs[lo]) * frac)


def median(values):
    return percentile(values, 50.0)


def ols_slope(points, min_points: int):
    """Least-squares slope in value-units per minute over (epoch_s, value) points.

    Returns None (refusal) when n < min_points or all timestamps coincide.
    """
    if len(points) < min_points or min_points < 2 or len(points) < 2:
        return None
    t0 = points[0][0]
    xs = [(t - t0) / 60.0 for t, _ in points]
    ys = [v for _, v in points]
    n = len(xs)
    mean_x = sum_in_order(xs) / n
    mean_y = sum_in_order(ys) / n
    sxx = 0.0
    sxy = 0.0
    for i in range(n):
        dx = xs[i] - mean_x
        sxx += dx * dx
        sxy += dx * (ys[i] - mean_y)
    if sxx == 0.0:
        return None
    return q6(sxy / sxx)


def sum_in_order(values) -> float:
    total = 0.0
    for v in values:
        total += v
    return total
