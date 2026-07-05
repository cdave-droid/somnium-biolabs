/** M6 — Context Adapter. Maps matched signatures × context to tiers and
 * applies global modifier floors. May only RAISE tiers, never lower them —
 * the safety invariant is structural: everything here contributes floors to
 * a max() in M7 (DECISIONS.md D10).
 */
import { own, ownGet } from "./canonical.js";
import { SEV_ORD } from "./constants.js";
import type { ContentHandle } from "./content.js";

export function dottedGet(obj: any, path: string): unknown {
  let node = obj;
  for (const part of path.split(".")) {
    if (node === null || typeof node !== "object" || Array.isArray(node) || !own(node, part)) {
      return null;
    }
    node = node[part];
  }
  return node;
}

export function signatureTier(
  sig: any,
  context: any,
  flags: Set<string>,
  trace: Array<{ stage: string; detail: string }>,
): string {
  const tierMap = sig.action_tier_by_context;
  const deployment = context?.deployment ?? null;
  const contextTruthy =
    context !== null && context !== undefined && !(typeof context === "object" && Object.keys(context).length === 0);
  if (!contextTruthy || deployment === null || deployment === undefined) {
    flags.add("missing_context");
    const tier = tierMap.default;
    trace.push({ stage: "M6", detail: `${sig.signature_id}: no deployment context; default tier ${tier}` });
    return tier;
  }
  let tier: string;
  if (own(tierMap, deployment)) {
    tier = ownGet(tierMap, deployment);
    trace.push({ stage: "M6", detail: `${sig.signature_id}: ${deployment} -> ${tier}` });
  } else {
    flags.add("context_default_tier");
    tier = tierMap.default;
    trace.push({ stage: "M6", detail: `${sig.signature_id}: ${deployment} not in tier map; default ${tier}` });
  }
  return tier;
}

/** Content-defined global context modifiers; each yields a floor tier. */
export function modifierFloors(
  caseSeverity: string | null,
  context: any,
  content: ContentHandle,
  trace: Array<{ stage: string; detail: string }>,
): string[] {
  const floors: string[] = [];
  if (caseSeverity === null) {
    return floors;
  }
  for (const mod of content.tables["global_modifiers"].modifiers) {
    if (SEV_ORD[caseSeverity] < SEV_ORD[mod.min_severity]) {
      continue;
    }
    const actual = dottedGet(context ?? {}, mod.when.field);
    if (actual === null || actual === undefined) {
      continue;
    }
    const op = mod.when.op;
    const target = mod.when.value;
    if (typeof target === "number" && typeof actual !== "number") {
      continue;
    }
    const a = actual as any;
    const hit =
      (op === "gt" && a > target) ||
      (op === "gte" && a >= target) ||
      (op === "lt" && a < target) ||
      (op === "lte" && a <= target) ||
      (op === "eq" && a === target);
    if (hit) {
      floors.push(mod.floor_tier);
      trace.push({ stage: "M6", detail: `modifier ${mod.id} raises floor to ${mod.floor_tier}` });
    }
  }
  return floors;
}
