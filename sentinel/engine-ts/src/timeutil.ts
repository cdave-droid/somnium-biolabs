/** Strict ISO-8601 UTC timestamp handling (DECISIONS.md D4).
 *
 * Native Date parsing is deliberately avoided so engine-py and engine-ts
 * share one algorithm (days_from_civil / civil_from_days).
 */

const TS_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,3})?Z$/;

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** Python-style floor division for integers. */
function floorDiv(a: number, b: number): number {
  return Math.floor(a / b);
}

function daysFromCivil(y: number, m: number, d: number): number {
  y -= m <= 2 ? 1 : 0;
  const era = floorDiv(y >= 0 ? y : y - 399, 400);
  const yoe = y - era * 400;
  const doy = floorDiv(153 * (m + (m > 2 ? -3 : 9)) + 2, 5) + d - 1;
  const doe = yoe * 365 + floorDiv(yoe, 4) - floorDiv(yoe, 100) + doy;
  return era * 146097 + doe - 719468;
}

function civilFromDays(z: number): [number, number, number] {
  z += 719468;
  const era = floorDiv(z >= 0 ? z : z - 146096, 146097);
  const doe = z - era * 146097;
  const yoe = floorDiv(doe - floorDiv(doe, 1460) + floorDiv(doe, 36524) - floorDiv(doe, 146096), 365);
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + floorDiv(yoe, 4) - floorDiv(yoe, 100));
  const mp = floorDiv(5 * doy + 2, 153);
  const d = doy - floorDiv(153 * mp + 2, 5) + 1;
  const m = mp + (mp < 10 ? 3 : -9);
  return [y + (m <= 2 ? 1 : 0), m, d];
}

/** Parse strict `YYYY-MM-DDTHH:MM:SS(.mmm)?Z` to epoch seconds. */
export function parseTs(s: unknown): number {
  if (typeof s !== "string") {
    throw new Error(`timestamp must be a string, got ${pyTypeName(s)}`);
  }
  const m = TS_RE.exec(s);
  if (!m) {
    throw new Error(`invalid timestamp (must be ISO-8601 UTC with Z): ${pyRepr(s)}`);
  }
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  const hh = parseInt(m[4], 10);
  const mm = parseInt(m[5], 10);
  const ss = parseInt(m[6], 10);
  if (!(month >= 1 && month <= 12)) {
    throw new Error(`invalid month in timestamp: ${pyRepr(s)}`);
  }
  const dim = DAYS_IN_MONTH[month - 1] + (month === 2 && isLeap(year) ? 1 : 0);
  if (!(day >= 1 && day <= dim)) {
    throw new Error(`invalid day in timestamp: ${pyRepr(s)}`);
  }
  if (hh > 23 || mm > 59 || ss > 59) {
    throw new Error(`invalid time in timestamp: ${pyRepr(s)}`);
  }
  let epoch = daysFromCivil(year, month, day) * 86400 + hh * 3600 + mm * 60 + ss;
  const frac = m[7];
  if (frac) {
    epoch += parseInt(frac.slice(1).padEnd(3, "0"), 10) / 1000.0;
  }
  return epoch;
}

/** Format epoch seconds back to strict ISO-8601 UTC (millisecond precision). */
export function fmtTs(epoch: number): string {
  const msTotal = Math.trunc(epoch * 1000 + (epoch >= 0 ? 0.5 : -0.5));
  const days = floorDiv(msTotal, 86400000);
  const remMs = msTotal - days * 86400000;
  const [y, mo, d] = civilFromDays(days);
  const secs = floorDiv(remMs, 1000);
  const ms = remMs - secs * 1000;
  const mins = floorDiv(secs, 60);
  const sec = secs - mins * 60;
  const hh = floorDiv(mins, 60);
  const mi = mins - hh * 60;
  const base =
    `${String(y).padStart(4, "0")}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}` +
    `T${String(hh).padStart(2, "0")}:${String(mi).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  if (ms) {
    return `${base}.${String(ms).padStart(3, "0")}Z`;
  }
  return base + "Z";
}

/** Python type(x).__name__ equivalent for error-message fidelity. */
function pyTypeName(v: unknown): string {
  if (v === null || v === undefined) return "NoneType";
  if (typeof v === "boolean") return "bool";
  if (typeof v === "number") return Number.isInteger(v) ? "int" : "float";
  if (typeof v === "string") return "str";
  if (Array.isArray(v)) return "list";
  return "dict";
}

/** Minimal Python repr() for strings in error messages. */
function pyRepr(s: string): string {
  const hasSingle = s.includes("'");
  const hasDouble = s.includes('"');
  const q = hasSingle && !hasDouble ? '"' : "'";
  let out = q;
  for (const ch of s) {
    if (ch === "\\") out += "\\\\";
    else if (ch === q) out += "\\" + q;
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else {
      const c = ch.codePointAt(0) as number;
      if (c < 0x20 || c === 0x7f) out += "\\x" + c.toString(16).padStart(2, "0");
      else out += ch;
    }
  }
  return out + q;
}
