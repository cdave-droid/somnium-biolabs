/** Cross-runtime contract vectors — identical assertions live in
 * engine-py/tests/test_g4_audit_replay_api.py. If either side changes, the
 * golden parity gate breaks; these unit vectors localize the fault.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { canonicalJson, deterministicUuid, q6, sha256Hex } from "../src/canonical.js";
import { fmtTs, parseTs } from "../src/timeutil.js";
import { olsSlope, percentile } from "../src/stats.js";

test("sha256 known vectors", () => {
  assert.equal(sha256Hex(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assert.equal(sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  // multi-block + non-ASCII (UTF-8 length 62, crosses padding boundary)
  assert.equal(
    sha256Hex("a".repeat(64) + "é✓"),
    sha256Hex("a".repeat(64) + "é✓"),
  );
});

test("canonical number formatting", () => {
  const cases: Array<[number, string]> = [
    [0, "0"], [1, "1"], [-1, "-1"], [2.0, "2"], [118, "118"], [68.0, "68"],
    [0.1, "0.1"], [-0.25, "-0.25"],
    [1 / 3, "0.333333"], [2 / 3, "0.666667"], [-2 / 3, "-0.666667"],
    [0.0000004, "0"], [0.0000005, "0.000001"], [-0.000001, "-0.000001"],
    [123456.789, "123456.789"], [999999999999999, "999999999999999"],
  ];
  for (const [value, expected] of cases) {
    assert.equal(canonicalJson(value), expected);
  }
});

test("canonical objects, arrays, strings", () => {
  assert.equal(canonicalJson({ b: 1, a: [true, false, null] }), '{"a":[true,false,null],"b":1}');
  assert.equal(canonicalJson({ Z: 1, a: 2 }), '{"Z":1,"a":2}'); // code-unit order
  assert.equal(canonicalJson('a"b\\c\nd\te'), '"a\\"b\\\\c\\nd\\te\\u0001"');
  assert.equal(canonicalJson("émoji ✓"), '"émoji ✓"');
});

test("q6 pinned IEEE values (must match Python exactly)", () => {
  assert.equal(q6(1.0000005), 1.000001); // 1.0000005*1e6 -> 1000000.5000000001
  assert.equal(q6(0.1234565), 0.123457); // 0.1234565*1e6 -> 123456.5 exactly
  assert.equal(q6(0.12345650000001), 0.123457);
  assert.equal(q6(2.5e-7), 0.0);
  assert.equal(q6(-1.5e-6), -2e-6);
});

test("deterministic uuid shape and stability", () => {
  const u1 = deterministicUuid({ a: 1 });
  assert.equal(u1, deterministicUuid({ a: 1 }));
  assert.notEqual(u1, deterministicUuid({ a: 2 }));
  assert.equal(u1[14], "5");
  assert.ok("89ab".includes(u1[19]));
});

test("timestamp strictness and roundtrip", () => {
  assert.equal(parseTs("1970-01-01T00:00:00Z"), 0);
  assert.equal(parseTs("2026-07-03T14:32:00Z"), 1783089120); // matches Python calendar.timegm
  for (const ts of ["2026-07-03T14:32:00Z", "2028-02-29T00:00:00.500Z", "1999-12-31T23:59:59Z"]) {
    assert.equal(fmtTs(parseTs(ts)), ts);
  }
  for (const bad of ["2026-07-03 14:32:00", "2026-07-03T14:32:00", "2026-13-01T00:00:00Z",
                     "2026-02-30T00:00:00Z", "2026-07-03T24:00:00Z", "2027-02-29T00:00:00Z", 42]) {
    assert.throws(() => parseTs(bad as any));
  }
});

test("stats fixed vectors", () => {
  assert.equal(percentile([60, 61, 62, 63, 64, 65, 66, 67, 68, 69], 10), 60.9);
  assert.equal(percentile([60, 61, 62, 63, 64, 65, 66, 67, 68, 69], 50), 64.5);
  assert.equal(percentile([60, 61, 62, 63, 64, 65, 66, 67, 68, 69], 90), 68.1);
  assert.equal(olsSlope([[0, 0], [60, 1], [120, 2]], 2), 1); // 1 unit/min
  assert.equal(olsSlope([[0, 5]], 2), null);                 // refusal: n < min_points
  assert.equal(olsSlope([[100, 5], [100, 9]], 2), null);     // refusal: zero time spread
});
