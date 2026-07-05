/** Content package loading: schema validation, manifest hash verification,
 * semantic cross-checks. Fails closed — any problem raises ContentError with
 * every message collected (prime directives 2 and 4).
 *
 * This module is PURE (no filesystem access): all file reads go through an
 * injected ContentReader, so the core stays dependency-free and portable.
 * Node wiring lives in content_node.ts.
 */
import { canonicalJson, sha256Hex } from "./canonical.js";
import { ENGINE_VERSION, OBSERVATION_TYPES, REFERENCEABLE_FLAGS } from "./constants.js";
import { ContentError } from "./errors.js";
import { validate, type Json } from "./schema_validator.js";

export const TABLE_TYPES = [
  "operational_bounds", "never_ignore", "floors", "baseline_config",
  "population_baselines", "units", "worse_direction", "artifact_rules",
  "global_modifiers", "recheck_intervals", "trajectory_rules", "event_codes",
];

export const COMPARATOR_OPS = ["gte", "lte", "eq"];
export const FUNCTION_OPS = [
  "delta_from_baseline_abs", "delta_from_baseline_pct", "trend_slope",
  "crossed_threshold_count", "sustained_for_min", "event_present",
];

/** Injected file access. All paths are package-relative with forward slashes. */
export interface ContentReader {
  /** Label recorded on the handle (the package path or equivalent). */
  packagePath: string;
  /** UTF-8 text of a package file, or null if it does not exist. */
  readPackageText(rel: string): string | null;
  /** Relative forward-slash paths of ALL files under the package directory. */
  listPackageFiles(): string[];
  /** UTF-8 text of a schema file by base name (e.g. "manifest.schema.json"). */
  readSchemaText(name: string): string;
}

/** Build a ContentReader from an in-memory map of path → file text. */
export function mapReader(
  packagePath: string,
  packageFiles: Record<string, string>,
  schemaFiles: Record<string, string>,
): ContentReader {
  return {
    packagePath,
    readPackageText: (rel: string) => (rel in packageFiles ? packageFiles[rel] : null),
    listPackageFiles: () => Object.keys(packageFiles),
    readSchemaText: (name: string) => {
      if (!(name in schemaFiles)) {
        throw new Error(`schema file missing: ${name}`);
      }
      return schemaFiles[name];
    },
  };
}

export interface ContentHandle {
  package_path: string;
  content_version: string;
  flags: string[];
  tables: Record<string, any>;
  signatures: any[];
  published_signatures: any[];
}

function semverTuple(v: string): number[] {
  return v.split(".").map((x) => {
    const n = parseInt(x, 10);
    if (!/^\d+$/.test(x) || Number.isNaN(n)) {
      throw new Error(`invalid literal for int() with base 10: ${x}`);
    }
    return n;
  });
}

function semverGt(a: number[], b: number[]): boolean {
  // Python tuple comparison: element-wise, shorter tuple is a prefix-loser.
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) {
      return a[i] > b[i];
    }
  }
  return a.length > b.length;
}

/** Flatten a logic tree into its leaf conditions (depth-first, in order). */
export function walkConditions(node: any, out: any[]): void {
  if (typeof node !== "object" || node === null || Array.isArray(node)) {
    return;
  }
  for (const comb of ["all_of", "any_of", "none_of"]) {
    if (comb in node) {
      for (const child of node[comb]) {
        walkConditions(child, out);
      }
      return;
    }
  }
  if ("at_least_n_of" in node) {
    for (const child of node["at_least_n_of"]["of"]) {
      walkConditions(child, out);
    }
    return;
  }
  out.push(node);
}

function checkSignatureSemantics(
  sig: any,
  knownMetrics: Set<string>,
  eventIds: Set<string>,
  enumMetrics: Set<string>,
  errors: string[],
): void {
  const sid = sig.signature_id ?? "?";
  const conditions: any[] = [];
  walkConditions(sig.logic ?? {}, conditions);
  if (conditions.length === 0) {
    errors.push(`${sid}: logic tree has no conditions`);
  }
  const idsSeen = new Set<string>();
  conditions.forEach((cond, i) => {
    const where = `${sid}: condition ${i}`;
    if ("flag" in cond) {
      if (!REFERENCEABLE_FLAGS.includes(cond.flag)) {
        errors.push(`${where}: unknown flag '${cond.flag}'`);
      }
      return;
    }
    if ("baseline_status" in cond && !("op" in cond)) {
      if (!("metric" in cond)) {
        errors.push(`${where}: baseline_status condition requires 'metric'`);
      }
      return;
    }
    const op = cond.op;
    const metric = cond.metric;
    if (op === undefined || op === null) {
      errors.push(`${where}: leaf condition needs 'op', 'flag', or 'baseline_status'`);
      return;
    }
    const cid = cond.id;
    if (cid) {
      if (idsSeen.has(cid)) {
        errors.push(`${sid}: duplicate condition id '${cid}'`);
      }
      idsSeen.add(cid);
    }
    if (op === "event_present") {
      if (!("event_id" in cond)) {
        errors.push(`${where}: event_present requires 'event_id'`);
      } else if (!eventIds.has(cond.event_id)) {
        errors.push(`${where}: event_id '${cond.event_id}' not in controlled vocabulary`);
      }
      if (!("window_min" in cond)) {
        errors.push(`${where}: event_present requires 'window_min'`);
      }
      return;
    }
    if (metric === undefined || metric === null) {
      errors.push(`${where}: op '${op}' requires 'metric'`);
      return;
    }
    if (!knownMetrics.has(metric)) {
      errors.push(`${where}: unknown metric '${metric}'`);
    }
    const comparators = COMPARATOR_OPS.filter((k) => k in cond);
    if (COMPARATOR_OPS.includes(op)) {
      if (!("value" in cond)) {
        errors.push(`${where}: raw-value op '${op}' requires 'value'`);
      }
      if (comparators.length > 0) {
        errors.push(`${where}: raw-value op '${op}' must not also carry comparator keys`);
      }
      if (!("window_min" in cond)) {
        errors.push(`${where}: raw-value op '${op}' requires 'window_min'`);
      }
    } else if (FUNCTION_OPS.includes(op)) {
      if (comparators.length !== 1) {
        errors.push(`${where}: op '${op}' requires exactly one of gte/lte/eq keys`);
      }
      if (!("window_min" in cond)) {
        errors.push(`${where}: op '${op}' requires 'window_min'`);
      }
      if (op === "trend_slope" && !("min_points" in cond)) {
        errors.push(`${where}: trend_slope requires 'min_points'`);
      }
      if (op === "crossed_threshold_count" || op === "sustained_for_min") {
        if (!("threshold" in cond) || !("direction" in cond)) {
          errors.push(`${where}: op '${op}' requires 'threshold' and 'direction'`);
        }
      }
      if (enumMetrics.has(metric) && op !== "event_present" && !COMPARATOR_OPS.includes(op)) {
        errors.push(`${where}: op '${op}' not valid for ordinal metric '${metric}'`);
      }
    } else {
      errors.push(`${where}: unknown op '${op}'`);
    }
  });

  const inputTypes: string[] = [...(sig.required_inputs ?? []), ...(sig.optional_inputs ?? [])];
  for (const t of inputTypes) {
    if (!OBSERVATION_TYPES.includes(t)) {
      errors.push(`${sid}: unknown input type '${t}'`);
    }
  }

  // Explanation completeness is enforced at load time (prime directive 3).
  const templateVars = new Set<string>();
  const re = /\{([a-z_][a-z0-9_]*)\}/g;
  const template: string = sig.explanation_template ?? "";
  let m: RegExpExecArray | null;
  while ((m = re.exec(template)) !== null) {
    templateVars.add(m[1]);
  }
  const bindings: Record<string, any> = sig.template_bindings ?? {};
  for (const v of Array.from(templateVars).sort()) {
    if (!(v in bindings)) {
      errors.push(`${sid}: template variable '{${v}}' has no binding`);
    }
  }
  for (const v of Object.keys(bindings).sort()) {
    const b = bindings[v];
    if (!idsSeen.has(b.condition_id)) {
      errors.push(`${sid}: binding '${v}' references unknown condition id '${b.condition_id}'`);
    }
  }
}

function relBaseName(rel: string): string {
  const idx = rel.lastIndexOf("/");
  return idx === -1 ? rel : rel.slice(idx + 1);
}

/** Load and fully validate a content package via the injected reader. */
export function loadContentFromReader(reader: ContentReader): ContentHandle {
  const errors: string[] = [];
  const flags: string[] = [];

  const manifestText = reader.readPackageText("manifest.json");
  if (manifestText === null) {
    throw new ContentError(["manifest.json missing from package"]);
  }
  const manifest = JSON.parse(manifestText);
  const manifestSchema = JSON.parse(reader.readSchemaText("manifest.schema.json"));
  for (const e of validate(manifest, manifestSchema)) {
    errors.push(`manifest.json ${e}`);
  }
  if (errors.length > 0) {
    throw new ContentError(errors);
  }

  if (semverGt(semverTuple(manifest.min_engine_version), semverTuple(ENGINE_VERSION))) {
    throw new ContentError([
      `content requires engine >= ${manifest.min_engine_version}, this is ${ENGINE_VERSION}`,
    ]);
  }
  if (manifest.signing.algorithm === "none") {
    flags.push("content_unsigned");
  }

  // Hash verification: every listed file must exist and match; every JSON
  // file in the package must be listed (no smuggled content).
  const listed: Record<string, string> = {};
  for (const f of manifest.files) {
    listed[f.path] = f.sha256;
  }
  const fileTexts: Record<string, string> = {};
  for (const rel of Object.keys(listed).sort()) {
    const expected = listed[rel];
    const text = reader.readPackageText(rel);
    if (text === null) {
      errors.push(`manifest lists missing file: ${rel}`);
      continue;
    }
    fileTexts[rel] = text;
    const actual = sha256Hex(text);
    if (actual !== expected) {
      errors.push(`hash mismatch for ${rel}: manifest=${expected} actual=${actual}`);
    }
  }
  const onDisk: string[] = [];
  for (const rel of reader.listPackageFiles()) {
    const name = relBaseName(rel);
    if (name.endsWith(".json") && name !== "manifest.json") {
      onDisk.push(rel);
    }
  }
  for (const rel of [...onDisk].sort()) {
    if (!(rel in listed)) {
      errors.push(`file present but not in manifest: ${rel}`);
    }
  }
  const fileList = Object.keys(listed)
    .map((p) => ({ path: p, sha256: listed[p] }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const expectedPkgHash = sha256Hex(canonicalJson(fileList));
  if (expectedPkgHash !== manifest.package_hash) {
    errors.push("package_hash does not match file list");
  }
  if (errors.length > 0) {
    throw new ContentError(errors);
  }

  const tablesSchema = JSON.parse(reader.readSchemaText("content_tables.schema.json"));
  const signatureSchema = JSON.parse(reader.readSchemaText("signature.schema.json"));

  const tables: Record<string, any> = {};
  const signatures: any[] = [];
  for (const rel of Object.keys(listed).sort()) {
    const doc = JSON.parse(fileTexts[rel]);
    if (rel.startsWith("signatures/")) {
      const errs = validate(doc, signatureSchema);
      for (const e of errs) {
        errors.push(`${rel} ${e}`);
      }
      if (errs.length === 0) {
        signatures.push(doc);
      }
    } else {
      const ct = doc?.content_type;
      if (typeof ct !== "string" || !TABLE_TYPES.includes(ct)) {
        errors.push(`${rel}: unknown or missing content_type '${ct === undefined || ct === null ? "None" : ct}'`);
        continue;
      }
      const sub: Record<string, Json> = { $defs: tablesSchema["$defs"], $ref: `#/$defs/${ct}` };
      for (const e of validate(doc, sub, tablesSchema)) {
        errors.push(`${rel} ${e}`);
      }
      if (ct in tables) {
        errors.push(`duplicate content_type '${ct}' (${rel})`);
      }
      tables[ct] = doc;
    }
  }
  for (const ct of TABLE_TYPES) {
    if (!(ct in tables)) {
      errors.push(`package is missing required table content_type '${ct}'`);
    }
  }
  if (errors.length > 0) {
    throw new ContentError(errors);
  }

  const bounds = tables["operational_bounds"];
  const knownMetrics = new Set<string>([...Object.keys(bounds.bounds), ...Object.keys(bounds.enums)]);
  const enumMetrics = new Set<string>(Object.keys(bounds.enums));
  const eventIds = new Set<string>(tables["event_codes"].codes.map((c: any) => c.event_id));

  const seenIds = new Set<string>();
  for (const sig of signatures) {
    if (seenIds.has(sig.signature_id)) {
      errors.push(`duplicate signature_id '${sig.signature_id}'`);
    }
    seenIds.add(sig.signature_id);
    checkSignatureSemantics(sig, knownMetrics, eventIds, enumMetrics, errors);
  }
  if (errors.length > 0) {
    throw new ContentError(errors);
  }

  signatures.sort((a, b) => (a.signature_id < b.signature_id ? -1 : a.signature_id > b.signature_id ? 1 : 0));
  return {
    package_path: reader.packagePath,
    content_version: manifest.package_version,
    flags,
    tables,
    signatures,
    published_signatures: signatures.filter((s) => s.status === "published"),
  };
}
