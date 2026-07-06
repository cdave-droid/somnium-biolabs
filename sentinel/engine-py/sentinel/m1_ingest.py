"""M1 — Ingest & Validate. Quarantines (never drops silently) anything
structurally invalid, physically impossible, or outside the controlled
vocabularies. Bounds and unit conversions are content, not code.
"""
from __future__ import annotations

from .canonical import fmt_val, q6
from .constants import NUMERIC_TYPES, OBSERVATION_TYPES
from .timeutil import parse_ts

VALID_SOURCES = ["wearable_sensor", "inline_gauge", "manual_entry", "fixed_monitor", "event_report"]


def _quarantine(quarantined, obs, reason):
    obs_id = obs.get("obs_id") if isinstance(obs, dict) else None
    quarantined.append({"obs_id": obs_id if isinstance(obs_id, str) else "(missing)", "reason": reason})


def ingest(observations, content, flags):
    """Returns (accepted, quarantined, notes). Accepted observations are
    normalized: canonical units, epoch-second `ts`, sorted by (ts, obs_id)."""
    bounds = content["tables"]["operational_bounds"]["bounds"]
    enums = content["tables"]["operational_bounds"]["enums"]
    units_table = content["tables"]["units"]
    event_ids = {c["event_id"] for c in content["tables"]["event_codes"]["codes"]}
    conversions = {(c["type"], c["from"]): c for c in units_table["conversions"]}

    accepted, quarantined, notes = [], [], []
    seen_ids = set()

    for obs in observations:
        if not isinstance(obs, dict):
            _quarantine(quarantined, {}, "invalid_structure")
            continue
        obs_id = obs.get("obs_id")
        if not isinstance(obs_id, str) or not obs_id:
            _quarantine(quarantined, obs, "invalid_structure:obs_id")
            continue
        if not obs_id.isascii():
            # ASCII-only ids keep the (timestamp, obs_id) tie-break sort and
            # canonical hashing byte-identical across runtimes.
            _quarantine(quarantined, obs, "invalid_structure:obs_id_not_ascii")
            continue
        if obs_id in seen_ids:
            _quarantine(quarantined, obs, "duplicate_obs_id")
            flags.add("duplicate_obs_id")
            continue
        otype = obs.get("type")
        if otype not in OBSERVATION_TYPES:
            _quarantine(quarantined, obs, f"unknown_type:{otype}")
            continue
        source = obs.get("source")
        if source not in VALID_SOURCES:
            _quarantine(quarantined, obs, f"unknown_source:{source}")
            continue
        try:
            ts = parse_ts(obs.get("timestamp"))
        except ValueError:
            _quarantine(quarantined, obs, "invalid_timestamp")
            continue

        stream_id = obs.get("stream_id")
        if stream_id is not None:
            if not isinstance(stream_id, str) or not stream_id or not stream_id.isascii():
                _quarantine(quarantined, obs, "invalid_structure:stream_id")
                continue

        norm = {
            "obs_id": obs_id,
            "ts": ts,
            "timestamp": obs["timestamp"],
            "type": otype,
            "source": source,
            # Stream identity: device/channel instance if given, else the
            # source class. All per-stream screening keys off this (D19).
            "stream": stream_id if stream_id is not None else source,
            "quality_meta": obs.get("quality_meta") or {},
        }

        if otype == "free_text_note":
            # Logged, NEVER parsed for logic (§2).
            norm["text"] = obs.get("text") if isinstance(obs.get("text"), str) else ""
            seen_ids.add(obs_id)
            notes.append(norm)
            continue

        if otype == "event":
            event_id = obs.get("event_id")
            if not isinstance(event_id, str):
                _quarantine(quarantined, obs, "invalid_value:event_id_missing")
                continue
            if event_id not in event_ids:
                _quarantine(quarantined, obs, f"unknown_event_code:{event_id}")
                flags.add("unknown_event_code")
                continue
            norm["event_id"] = event_id
            seen_ids.add(obs_id)
            accepted.append(norm)
            continue

        value = obs.get("value")
        if otype in enums:
            if value not in enums[otype]:
                # fmt_val keeps numeric interpolation byte-identical with
                # engine-ts (Python str(3.0) is "3.0"; JS String(3.0) is "3").
                _quarantine(quarantined, obs, f"invalid_value:{fmt_val(value)}")
                continue
            norm["value"] = value
        elif otype in NUMERIC_TYPES:
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                _quarantine(quarantined, obs, "invalid_value:not_numeric")
                continue
            if value != value or value in (float("inf"), float("-inf")):
                # NaN passes < / > bounds comparisons; it must never reach
                # feature math or the audit log.
                _quarantine(quarantined, obs, "invalid_value:not_finite")
                flags.add("data_rejected")
                continue
            unit = obs.get("unit")
            canonical_unit = units_table["canonical"].get(otype)
            if unit is not None and unit != canonical_unit:
                conv = conversions.get((otype, unit))
                if conv is None:
                    _quarantine(quarantined, obs, f"unknown_unit:{unit}")
                    continue
                value = q6(value * conv["factor"] + conv["offset"])
            b = bounds.get(otype)
            if b is None or value < b["min"] or value > b["max"]:
                # Value is kept on the quarantine record so M8 can still test
                # never-ignore bounds against it (extreme-but-real vs garbage
                # is undecidable here; either way it must not vanish).
                quarantined.append({"obs_id": obs_id, "reason": f"out_of_bounds:{otype}",
                                    "type": otype, "value": value})
                flags.add("data_rejected")
                continue
            norm["value"] = value
            norm["unit"] = canonical_unit
        seen_ids.add(obs_id)
        accepted.append(norm)

    if any(q["reason"].startswith(("out_of_bounds", "invalid_", "unknown_")) for q in quarantined):
        flags.add("data_rejected")

    accepted.sort(key=lambda o: (o["ts"], o["obs_id"]))
    notes.sort(key=lambda o: (o["ts"], o["obs_id"]))
    return accepted, quarantined, notes
