"""Strict ISO-8601 UTC timestamp handling (DECISIONS.md D4).

Native datetime parsing is deliberately avoided so engine-py and engine-ts
share one algorithm (days_from_civil / civil_from_days).
"""
from __future__ import annotations

import re

# [0-9] and NOT \d: Python's \d matches Unicode digits (e.g. Arabic-Indic),
# which int() also accepts — engine-ts would reject the same timestamp.
_TS_RE = re.compile(r"^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(\.[0-9]{1,3})?Z$")

_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]


def _is_leap(y: int) -> bool:
    return (y % 4 == 0 and y % 100 != 0) or y % 400 == 0


def _days_from_civil(y: int, m: int, d: int) -> int:
    y -= m <= 2
    era = (y if y >= 0 else y - 399) // 400
    yoe = y - era * 400
    doy = (153 * (m + (-3 if m > 2 else 9)) + 2) // 5 + d - 1
    doe = yoe * 365 + yoe // 4 - yoe // 100 + doy
    return era * 146097 + doe - 719468


def _civil_from_days(z: int):
    z += 719468
    era = (z if z >= 0 else z - 146096) // 146097
    doe = z - era * 146097
    yoe = (doe - doe // 1460 + doe // 36524 - doe // 146096) // 365
    y = yoe + era * 400
    doy = doe - (365 * yoe + yoe // 4 - yoe // 100)
    mp = (5 * doy + 2) // 153
    d = doy - (153 * mp + 2) // 5 + 1
    m = mp + (3 if mp < 10 else -9)
    return y + (m <= 2), m, d


def parse_ts(s: str) -> float:
    """Parse strict `YYYY-MM-DDTHH:MM:SS(.mmm)?Z` to epoch seconds."""
    if not isinstance(s, str):
        raise ValueError(f"timestamp must be a string, got {type(s).__name__}")
    m = _TS_RE.match(s)
    if not m:
        raise ValueError(f"invalid timestamp (must be ISO-8601 UTC with Z): {s!r}")
    year, month, day, hh, mm, ss = (int(m.group(i)) for i in range(1, 7))
    if not (1 <= month <= 12):
        raise ValueError(f"invalid month in timestamp: {s!r}")
    dim = _DAYS_IN_MONTH[month - 1] + (1 if month == 2 and _is_leap(year) else 0)
    if not (1 <= day <= dim):
        raise ValueError(f"invalid day in timestamp: {s!r}")
    if hh > 23 or mm > 59 or ss > 59:
        raise ValueError(f"invalid time in timestamp: {s!r}")
    epoch = _days_from_civil(year, month, day) * 86400 + hh * 3600 + mm * 60 + ss
    frac = m.group(7)
    if frac:
        epoch += int(frac[1:].ljust(3, "0")) / 1000.0
    return float(epoch)


def fmt_ts(epoch: float) -> str:
    """Format epoch seconds back to strict ISO-8601 UTC (millisecond precision)."""
    ms_total = int(epoch * 1000 + (0.5 if epoch >= 0 else -0.5))
    days, rem_ms = divmod(ms_total, 86400000)
    y, mo, d = _civil_from_days(days)
    secs, ms = divmod(rem_ms, 1000)
    mins, sec = divmod(secs, 60)
    hh, mi = divmod(mins, 60)
    base = f"{y:04d}-{mo:02d}-{d:02d}T{hh:02d}:{mi:02d}:{sec:02d}"
    if ms:
        return f"{base}.{ms:03d}Z"
    return base + "Z"
