/** Canonical serialization primitives shared (by convention) with engine-py.
 *
 * Every rule here mirrors engine-py/sentinel/canonical.py byte-for-byte; see
 * DECISIONS.md D2/D3. Cross-runtime parity depends on both sides using only
 * IEEE-754 arithmetic (identical in both runtimes) and this formatter —
 * native float→string conversion (Number.prototype.toString for non-integers,
 * JSON.stringify) is never used for canonical output.
 */
import { sha256Utf8 } from "./sha256.js";

export const MAX_SAFE_INT = 2 ** 53;

/** Quantize to 6 decimal places, round half away from zero. */
export function q6(x: number): number {
  if (x !== x || x === Infinity || x === -Infinity) {
    throw new Error("non-finite number in engine output");
  }
  const sign = x < 0 ? -1.0 : 1.0;
  return (sign * Math.floor(Math.abs(x) * 1e6 + 0.5)) / 1e6;
}

/** Scaled-integer 6-dp formatter — the ONLY number→string used in canonical output. */
export function fmtNum(x: number): string {
  if (typeof (x as unknown) === "boolean") {
    throw new TypeError("bool is not a number");
  }
  if (x !== x || x === Infinity || x === -Infinity) {
    throw new Error("non-finite number in canonical JSON");
  }
  if (x === Math.floor(x) && Math.abs(x) < MAX_SAFE_INT) {
    // Integral double below 2^53: String() is exact, never exponent notation,
    // and String(-0) === "0" — same as Python str(int(x)).
    return String(x);
  }
  // n is an integral double (Math.floor), exactly representable; BigInt makes
  // the divide/modulo split exact like Python's arbitrary-precision ints.
  const nf = Math.floor(Math.abs(x) * 1e6 + 0.5);
  const n = BigInt(nf);
  const sign = x < 0 ? "-" : "";
  const intPart = n / 1000000n;
  const frac = n % 1000000n;
  if (frac === 0n) {
    return sign + intPart.toString();
  }
  let fracStr = frac.toString().padStart(6, "0");
  fracStr = fracStr.replace(/0+$/, "");
  return sign + intPart.toString() + "." + fracStr;
}

/** Cross-runtime-safe string form for trace/explanation interpolation. */
export function fmtVal(v: unknown): string {
  if (typeof v === "number") {
    return fmtNum(v);
  }
  if (typeof v === "boolean") {
    // Python str(True) — never reached by engine values, kept for fidelity.
    return v ? "True" : "False";
  }
  return String(v);
}

const ESCAPES: Record<string, string> = {
  '"': '\\"',
  "\\": "\\\\",
  "\b": "\\b",
  "\f": "\\f",
  "\n": "\\n",
  "\r": "\\r",
  "\t": "\\t",
};

function escapeStr(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const esc = ESCAPES[ch];
    if (esc !== undefined) {
      out += esc;
    } else if (ch.charCodeAt(0) < 0x20) {
      out += "\\u" + ch.charCodeAt(0).toString(16).padStart(4, "0");
    } else {
      out += ch;
    }
  }
  return out;
}

export function canonicalJson(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number") {
    return fmtNum(value);
  }
  if (typeof value === "string") {
    return '"' + escapeStr(value) + '"';
  }
  if (Array.isArray(value)) {
    return "[" + value.map((v) => canonicalJson(v)).join(",") + "]";
  }
  if (typeof value === "object") {
    // Default Array.prototype.sort = code-unit order, same as Python sorted()
    // for the ASCII keys the schemas allow.
    const keys = Object.keys(value as Record<string, unknown>).sort();
    const items: string[] = [];
    for (const k of keys) {
      items.push('"' + escapeStr(k) + '":' + canonicalJson((value as Record<string, unknown>)[k]));
    }
    return "{" + items.join(",") + "}";
  }
  throw new TypeError(`unserializable type: ${typeof value}`);
}

export function sha256Hex(text: string): string {
  return sha256Utf8(text);
}

/** Deterministic UUID derived from the canonical hash of `value` (D2). */
export function deterministicUuid(value: unknown): string {
  const digest = sha256Hex(canonicalJson(value));
  const bytes: number[] = [];
  for (let i = 0; i < 16; i++) {
    bytes.push(parseInt(digest.slice(i * 2, i * 2 + 2), 16));
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/** Own-property membership — the TS equivalent of Python's dict `in`.
 * MANDATORY for any lookup keyed by a caller- or content-controlled string:
 * bare `key in obj` / `obj[key]` walk the prototype chain, so hostile keys
 * like "constructor" or "__proto__" resolve to inherited members and can
 * silently corrupt tier lookups (under-triage) or crash the engine. */
export function own(obj: unknown, key: string): boolean {
  return (
    typeof obj === "object" && obj !== null && Object.prototype.hasOwnProperty.call(obj, key)
  );
}

/** Own-property read: `obj[key]` if own, else undefined. */
export function ownGet(obj: any, key: string): any {
  return own(obj, key) ? obj[key] : undefined;
}

/** Python truthiness (`bool(x)` / `or` semantics) for ported call sites:
 * false for false, 0/-0, "", null/undefined, empty array, empty plain object.
 * NaN is truthy, exactly as in Python. */
export function pyTruthy(v: unknown): boolean {
  if (v === null || v === undefined || v === false || v === "") {
    return false;
  }
  if (typeof v === "number") {
    return v !== 0; // NaN !== 0 → truthy, matching Python bool(nan)
  }
  if (Array.isArray(v)) {
    return v.length > 0;
  }
  if (typeof v === "object") {
    return Object.keys(v as Record<string, unknown>).length > 0;
  }
  return true;
}
