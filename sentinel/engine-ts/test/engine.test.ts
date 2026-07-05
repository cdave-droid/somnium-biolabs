/** Engine behavior tests (TS side): smoke scenario, determinism, honest
 * failure, audit chain, replay, stream/batch equivalence. The full behavioral
 * battery lives in engine-py; the golden suite enforces cross-runtime parity.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { canonicalJson } from "../src/canonical.js";
import { loadContent } from "../src/content_node.js";
import { Engine, explain } from "../src/engine.js";
import { verifyChain } from "../src/m9_audit.js";

const here = dirname(fileURLToPath(import.meta.url));
const PKG = join(here, "..", "..", "..", "content", "packages", "demo-2026.07.0");
const content = loadContent(PKG);

const PROFILE = {
  unit_id: "u-001", service_age_years: 72, class: "M", mass_kg: 82,
  known_conditions: [], active_mitigations: [],
  baselines: {
    cycle_rate: { median: 68, p10: 60, p90: 78, window_days: 14, n_obs: 41 },
    pressure_primary: { median: 128, p10: 115, p90: 142, window_days: 14, n_obs: 30 },
  },
};
const CONTEXT = {
  deployment: "mobile_platform", operator_skill: "technician",
  time_to_service_min: { self_service: 30, on_site: 20, recovery: 1440 },
  connectivity: "intermittent",
};

function obs(i: number, typ: string, value: unknown, ts: string, source = "fixed_monitor"): any {
  const o: any = { obs_id: `o${String(i).padStart(3, "0")}`, unit_id: "u-001", timestamp: ts, type: typ, source };
  if (typ === "event") o.event_id = value;
  else if (typ === "free_text_note") o.text = value;
  else o.value = value;
  return o;
}

function stressObs(): any[] {
  const out: any[] = [];
  const cycles: Array<[string, number]> = [
    ["2026-07-03T10:00:00Z", 88], ["2026-07-03T11:30:00Z", 95],
    ["2026-07-03T12:30:00Z", 104], ["2026-07-03T13:30:00Z", 118]];
  const pressures: Array<[string, number]> = [
    ["2026-07-03T10:00:00Z", 131], ["2026-07-03T11:30:00Z", 126],
    ["2026-07-03T12:30:00Z", 120], ["2026-07-03T13:30:00Z", 116]];
  cycles.forEach(([ts, v], i) => out.push(obs(i, "cycle_rate", v, ts)));
  pressures.forEach(([ts, v], i) => out.push(obs(i + 4, "pressure_primary", v, ts)));
  return out;
}

test("smoke: compensated stress matches with mobile D5", () => {
  const out = new Engine(content).evaluate(PROFILE, stressObs(), CONTEXT);
  assert.deepEqual(out.matched_signatures, ["compensated_stress_v1"]);
  assert.equal(out.severity, "S3");
  assert.equal(out.action_tier, "D5");
  assert.equal(out.trajectory, "worsening");
  assert.ok(explain(out, "specialist").includes("Reasoning trace:"));
});

test("determinism: repeated runs byte-identical", () => {
  const reference = canonicalJson(new Engine(content).evaluate(PROFILE, stressObs(), CONTEXT));
  for (let i = 0; i < 50; i++) {
    assert.equal(canonicalJson(new Engine(content).evaluate(PROFILE, stressObs(), CONTEXT)), reference);
  }
});

test("honest failure: empty input routes to M8 floor", () => {
  const out = new Engine(content).evaluate(PROFILE, [], CONTEXT);
  assert.equal(out.confidence, "insufficient");
  assert.equal(out.action_tier, "D3");
  assert.ok(out.flags.includes("engine_could_not_fully_evaluate"));
  assert.ok(out.explanation.includes("ENGINE COULD NOT FULLY EVALUATE"));
});

test("audit chain verifies and detects tampering; replay is byte-identical", () => {
  const eng = new Engine(content);
  eng.evaluate(PROFILE, stressObs(), CONTEXT);
  eng.evaluate(PROFILE, [], CONTEXT);
  verifyChain(eng.audit.records);
  assert.equal(new Engine(content).replay(eng.audit.records).length, 2);

  const tampered = JSON.parse(JSON.stringify(eng.audit.records));
  tampered[1].payload.output.action_tier = "D0";
  assert.throws(() => verifyChain(tampered));
});

test("stream equals batch; duplicates flagged", () => {
  const eng = new Engine(content);
  const handle = eng.openCase(PROFILE, CONTEXT);
  let last: any = null;
  for (const o of stressObs()) {
    last = eng.evaluateStream(handle, o);
  }
  const batch = new Engine(content).evaluate(PROFILE, stressObs(), CONTEXT);
  assert.equal(canonicalJson(last), canonicalJson(batch));
  const dup = eng.evaluateStream(handle, stressObs()[0]);
  assert.ok(dup.flags.includes("duplicate_obs_id"));
});
