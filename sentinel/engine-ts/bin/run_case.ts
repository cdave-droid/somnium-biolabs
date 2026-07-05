/** Parity CLI: node dist/bin/run_case.js <packagePath> <inputJsonPath>
 * Prints exactly canonicalJson(EngineOutput) — the byte contract compared
 * against the Python runtime and the golden expected.canonical.json files.
 */
import { readFileSync } from "node:fs";
import { canonicalJson } from "../src/canonical.js";
import { loadContent } from "../src/content_node.js";
import { Engine } from "../src/engine.js";

const [packagePath, inputPath] = process.argv.slice(2);
if (!packagePath || !inputPath) {
  process.stderr.write("usage: run_case.js <packagePath> <inputJsonPath>\n");
  process.exit(2);
}
const input = JSON.parse(readFileSync(inputPath, "utf-8"));
const content = loadContent(packagePath);
const engine = new Engine(content);
const output = engine.evaluate(
  input.unit_profile,
  input.observations,
  input.context ?? null,
  input.reference_time ?? null,
);
process.stdout.write(canonicalJson(output) + "\n");
