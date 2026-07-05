/** M3 — Unit-State Model. Baseline resolution per DECISIONS.md D8:
 * profile-provided → computed-from-history → population default → unavailable.
 */
import { fmtVal, own, pyTruthy } from "./canonical.js";
import type { ContentHandle } from "./content.js";
import type { NormalizedObs } from "./m1_ingest.js";
import { median, percentile } from "./stats.js";

export interface Baseline {
  median: number | null;
  p10: number | null;
  p90: number | null;
  n_obs: number;
  status: string;
  source: string;
}

/** Python KeyError-equivalent access for user-provided dicts. */
function req(obj: any, key: string): any {
  if (obj === null || typeof obj !== "object" || !(key in obj)) {
    throw new Error(`'${key}'`);
  }
  return obj[key];
}

function ageBand(bands: any[], age: any): string | null {
  if (age === null || age === undefined) {
    return null;
  }
  for (const b of bands) {
    if (b.min <= age && age <= b.max) {
      return b.band;
    }
  }
  return null;
}

function populationLookup(popTable: any, unitProfile: any, metric: string): any {
  const band = ageBand(popTable.age_bands, unitProfile?.service_age_years);
  const klass = unitProfile?.class ?? null;
  for (const entry of popTable.defaults) {
    const m = entry.match;
    if (own(m, "class") && m.class !== klass) {
      continue;
    }
    if (own(m, "age_band") && m.age_band !== band) {
      continue;
    }
    if (own(entry.baselines, metric)) {
      const b = entry.baselines[metric];
      return { median: b.median, p10: b.p10, p90: b.p90, n_obs: 0 };
    }
  }
  return null;
}

function validStored(entry: any, minNObs: number): boolean {
  return (
    entry !== null && typeof entry === "object" && !Array.isArray(entry) &&
    ["median", "p10", "p90", "n_obs"].every((f) => typeof entry[f] === "number") &&
    entry.n_obs >= minNObs
  );
}

export function computeBaselines(
  unitProfile: any,
  accepted: NormalizedObs[],
  content: ContentHandle,
  referenceTime: number,
  neededMetrics: Set<string>,
  flags: Set<string>,
  trace: Array<{ stage: string; detail: string }>,
  storedBaselines: any = null,
): Record<string, Baseline> {
  const cfg = content.tables["baseline_config"];
  const popTable = content.tables["population_baselines"];
  const windowS = cfg.window_days * 86400;

  const baselines: Record<string, Baseline> = {};
  for (const metric of Array.from(neededMetrics).sort()) {
    const profBaselines = unitProfile?.baselines;
    const prof = pyTruthy(profBaselines) && own(profBaselines, metric) ? profBaselines[metric] : undefined;
    if (pyTruthy(prof) && req(prof, "n_obs") >= cfg.min_n_obs) {
      baselines[metric] = {
        median: req(prof, "median"), p10: req(prof, "p10"), p90: req(prof, "p90"),
        n_obs: req(prof, "n_obs"), status: "personalized", source: "profile",
      };
      continue;
    }
    const stored =
      storedBaselines !== null && typeof storedBaselines === "object" && !Array.isArray(storedBaselines) && own(storedBaselines, metric)
        ? storedBaselines[metric]
        : null;
    if (stored !== null && validStored(stored, cfg.min_n_obs)) {
      baselines[metric] = {
        median: stored.median, p10: stored.p10, p90: stored.p90,
        n_obs: stored.n_obs, status: "personalized", source: "store",
      };
      continue;
    }
    const values: number[] = [];
    for (const o of accepted) {
      if (
        o.type === metric &&
        (o.quality !== "artifact_likely" || o.mechanism_protected) &&
        referenceTime - windowS <= o.ts &&
        o.ts <= referenceTime
      ) {
        values.push(o.value);
      }
    }
    if (values.length >= cfg.min_n_obs) {
      baselines[metric] = {
        median: median(values), p10: percentile(values, 10), p90: percentile(values, 90),
        n_obs: values.length, status: "personalized", source: "computed",
      };
      continue;
    }
    const pop = populationLookup(popTable, unitProfile, metric);
    if (pop !== null) {
      pop.status = "population_default";
      pop.source = "population";
      baselines[metric] = pop;
    } else {
      baselines[metric] = {
        median: null, p10: null, p90: null, n_obs: 0,
        status: "unavailable", source: "none",
      };
    }
  }

  const statuses = new Set<string>(Object.values(baselines).map((b) => b.status));
  if (statuses.has("population_default")) {
    flags.add("baseline_population_default");
  }
  if (statuses.has("unavailable")) {
    flags.add("baseline_unavailable");
  }
  if (Object.keys(baselines).length > 0 && statuses.size === 1 && statuses.has("personalized")) {
    flags.add("baseline_ok");
  }
  for (const metric of Object.keys(baselines).sort()) {
    const b = baselines[metric];
    const med = b.median === null ? "none" : fmtVal(b.median);
    trace.push({
      stage: "M3",
      detail: `baseline ${metric}: ${b.status} (source=${b.source}, median=${med}, n_obs=${fmtVal(b.n_obs)})`,
    });
  }
  return baselines;
}
