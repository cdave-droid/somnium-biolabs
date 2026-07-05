"""Canonical serialization primitives shared (by convention) with engine-ts.

Every rule here is mirrored byte-for-byte in engine-ts/src/canonical.ts; see
DECISIONS.md D2/D3. Cross-runtime parity depends on both sides using only
IEEE-754 arithmetic (identical in both runtimes) and this formatter — native
float→string conversion is never used.
"""
from __future__ import annotations

import hashlib
import math

MAX_SAFE_INT = 2 ** 53


def q6(x: float) -> float:
    """Quantize to 6 decimal places, round half away from zero."""
    if x != x or x in (float("inf"), float("-inf")):
        raise ValueError("non-finite number in engine output")
    sign = -1.0 if x < 0 else 1.0
    return sign * math.floor(abs(x) * 1e6 + 0.5) / 1e6


def fmt_num(x) -> str:
    if isinstance(x, bool):
        raise TypeError("bool is not a number")
    if x != x or x in (float("inf"), float("-inf")):
        raise ValueError("non-finite number in canonical JSON")
    if float(x) == math.floor(x) and abs(x) < MAX_SAFE_INT:
        return str(int(x))
    n = int(math.floor(abs(x) * 1e6 + 0.5))
    sign = "-" if x < 0 else ""
    int_part = n // 1000000
    frac = n % 1000000
    if frac == 0:
        return sign + str(int_part)
    frac_str = str(frac).rjust(6, "0").rstrip("0")
    return sign + str(int_part) + "." + frac_str


def fmt_val(v) -> str:
    """Cross-runtime-safe string form for trace/explanation interpolation."""
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return fmt_num(v)
    return str(v)


_ESCAPES = {'"': '\\"', "\\": "\\\\", "\b": "\\b", "\f": "\\f", "\n": "\\n", "\r": "\\r", "\t": "\\t"}


def _escape(s: str) -> str:
    out = []
    for ch in s:
        if ch in _ESCAPES:
            out.append(_ESCAPES[ch])
        elif ord(ch) < 0x20:
            out.append("\\u%04x" % ord(ch))
        else:
            out.append(ch)
    return "".join(out)


def canonical_json(value) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return fmt_num(value)
    if isinstance(value, str):
        return '"' + _escape(value) + '"'
    if isinstance(value, (list, tuple)):
        return "[" + ",".join(canonical_json(v) for v in value) + "]"
    if isinstance(value, dict):
        items = []
        for k in sorted(value.keys()):
            if not isinstance(k, str):
                raise TypeError("non-string object key")
            items.append('"' + _escape(k) + '":' + canonical_json(value[k]))
        return "{" + ",".join(items) + "}"
    raise TypeError(f"unserializable type: {type(value)!r}")


def sha256_hex(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def deterministic_uuid(value) -> str:
    """Deterministic UUID derived from the canonical hash of `value` (D2)."""
    digest = sha256_hex(canonical_json(value))
    b = bytearray(bytes.fromhex(digest[:32]))
    b[6] = (b[6] & 0x0F) | 0x50
    b[8] = (b[8] & 0x3F) | 0x80
    h = b.hex()
    return f"{h[0:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:32]}"
