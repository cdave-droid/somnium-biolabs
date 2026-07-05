"""M3 — Unit-State Model. Baseline resolution per DECISIONS.md D8:
profile-provided → computed-from-history → population default → unavailable.
"""
from __future__ import annotations

from .canonical import fmt_val, q6
from .stats import median, percentile


def _age_band(bands, age):
    if age is None:
        return None
    for b in bands:
        if b["min"] <= age <= b["max"]:
            return b["band"]
    return None


def _population_lookup(pop_table, unit_profile, metric):
    band = _age_band(pop_table["age_bands"], unit_profile.get("service_age_years"))
    klass = unit_profile.get("class")
    for entry in pop_table["defaults"]:
        m = entry["match"]
        if "class" in m and m["class"] != klass:
            continue
        if "age_band" in m and m["age_band"] != band:
            continue
        if metric in entry["baselines"]:
            b = entry["baselines"][metric]
            return {"median": b["median"], "p10": b["p10"], "p90": b["p90"], "n_obs": 0}
    return None


def _valid_stored(entry, min_n_obs):
    return (isinstance(entry, dict)
            and all(isinstance(entry.get(f), (int, float)) and not isinstance(entry.get(f), bool)
                    for f in ("median", "p10", "p90", "n_obs"))
            and entry["n_obs"] >= min_n_obs)


def compute_baselines(unit_profile, accepted, content, reference_time, needed_metrics, flags, trace,
                      stored_baselines=None):
    cfg = content["tables"]["baseline_config"]
    pop_table = content["tables"]["population_baselines"]
    window_s = cfg["window_days"] * 86400

    baselines = {}
    for metric in sorted(needed_metrics):
        prof = (unit_profile.get("baselines") or {}).get(metric)
        if prof and prof["n_obs"] >= cfg["min_n_obs"]:
            baselines[metric] = {
                "median": prof["median"], "p10": prof["p10"], "p90": prof["p90"],
                "n_obs": prof["n_obs"], "status": "personalized", "source": "profile",
            }
            continue
        stored = (stored_baselines or {}).get(metric) if isinstance(stored_baselines, dict) else None
        if stored is not None and _valid_stored(stored, cfg["min_n_obs"]):
            baselines[metric] = {
                "median": stored["median"], "p10": stored["p10"], "p90": stored["p90"],
                "n_obs": stored["n_obs"], "status": "personalized", "source": "store",
            }
            continue
        values = [
            o["value"] for o in accepted
            if o["type"] == metric
            and (o["quality"] != "artifact_likely" or o.get("mechanism_protected"))
            and reference_time - window_s <= o["ts"] <= reference_time
        ]
        if len(values) >= cfg["min_n_obs"]:
            baselines[metric] = {
                "median": median(values), "p10": percentile(values, 10), "p90": percentile(values, 90),
                "n_obs": len(values), "status": "personalized", "source": "computed",
            }
            continue
        pop = _population_lookup(pop_table, unit_profile, metric)
        if pop is not None:
            pop.update({"status": "population_default", "source": "population"})
            baselines[metric] = pop
        else:
            baselines[metric] = {"median": None, "p10": None, "p90": None, "n_obs": 0,
                                 "status": "unavailable", "source": "none"}

    statuses = {b["status"] for b in baselines.values()}
    if "population_default" in statuses:
        flags.add("baseline_population_default")
    if "unavailable" in statuses:
        flags.add("baseline_unavailable")
    if baselines and statuses == {"personalized"}:
        flags.add("baseline_ok")
    for metric in sorted(baselines):
        b = baselines[metric]
        med = "none" if b["median"] is None else fmt_val(b["median"])
        trace.append({"stage": "M3", "detail": f"baseline {metric}: {b['status']} (source={b['source']}, median={med}, n_obs={fmt_val(b['n_obs'])})"})
    return baselines
