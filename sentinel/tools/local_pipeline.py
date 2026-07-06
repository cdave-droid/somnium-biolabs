#!/usr/bin/env python3
"""Local end-to-end pipeline demo: the full INTEGRATION.md loop on SQLite,
no cloud dependencies. Deterministic (fixed simulated clock).

  ingest observations -> evaluate (engine-py) -> persist cases
  -> hash-chained audit records in the DB -> chain anchor
  -> silent-unit watchdog -> human outcome -> §7 override report + back-test

Usage: python tools/local_pipeline.py [--db pipeline.sqlite]
The schema mirrors sentinel/INTEGRATION.md (SQLite dialect).
"""
from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "engine-py"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "analysis"))
from sentinel import Engine, check_overdue, load_content, verify_chain  # noqa: E402
from sentinel.canonical import canonical_json  # noqa: E402

from override_report import build_report  # noqa: E402
from outcome_backtest import backtest  # noqa: E402
from replay_loader import join_cases  # noqa: E402

PKG = os.path.join(os.path.dirname(__file__), "..", "content", "packages", "demo-2026.07.0")

SCHEMA = """
create table if not exists units (
  unit_id text primary key, profile text not null, deployment text,
  last_seen text);
create table if not exists observations (
  obs_id text primary key, unit_id text not null, ts text not null,
  body text not null);
create table if not exists cases (
  case_id text primary key, unit_id text not null, output text not null,
  evaluated_at text not null);
create table if not exists audit_records (
  stream_id text not null, seq integer not null, record text not null,
  hash text not null, prev_hash text not null,
  primary key (stream_id, seq));
create table if not exists outcomes (
  case_id text primary key, human_action_tier text not null,
  outcome_note text, outcome_label text);
create table if not exists chain_anchors (
  stream_id text not null, seq integer not null, chain_head text not null,
  anchored_at text not null, primary key (stream_id, seq));
"""


class SqliteAuditSink:
    def __init__(self, conn, stream_id="local"):
        self.conn = conn
        self.stream_id = stream_id

    def write(self, record):
        self.conn.execute(
            "insert into audit_records (stream_id, seq, record, hash, prev_hash) values (?,?,?,?,?)",
            (self.stream_id, record["seq"], canonical_json(record), record["hash"], record["prev_hash"]))
        self.conn.commit()


def ingest(conn, unit_id, observations):
    for obs in observations:
        conn.execute("insert or ignore into observations (obs_id, unit_id, ts, body) values (?,?,?,?)",
                     (obs["obs_id"], unit_id, obs["timestamp"], json.dumps(obs)))
        conn.execute("update units set last_seen = max(coalesce(last_seen,''), ?) where unit_id = ?",
                     (obs["timestamp"], unit_id))
    conn.commit()


def trailing_observations(conn, unit_id):
    rows = conn.execute("select body from observations where unit_id = ? order by ts, obs_id",
                        (unit_id,)).fetchall()
    return [json.loads(r[0]) for r in rows]


def evaluate_unit(conn, engine, unit_id, context, now):
    profile = json.loads(conn.execute(
        "select profile from units where unit_id = ?", (unit_id,)).fetchone()[0])
    out = engine.evaluate(profile, trailing_observations(conn, unit_id), context, reference_time=now)
    conn.execute("insert or replace into cases (case_id, unit_id, output, evaluated_at) values (?,?,?,?)",
                 (out["case_id"], unit_id, canonical_json(out), now))
    conn.commit()
    return out


def O(unit_id, i, typ, value, ts):
    return {"obs_id": f"{unit_id}-o{i:03d}", "unit_id": unit_id, "timestamp": ts,
            "type": typ, "value": value, "source": "fixed_monitor"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=None)
    args = ap.parse_args()
    db_path = args.db or os.path.join(tempfile.mkdtemp(prefix="sentinel-"), "pipeline.sqlite")

    conn = sqlite3.connect(db_path)
    conn.executescript(SCHEMA)
    content = load_content(PKG)
    engine = Engine(content, audit_sink=SqliteAuditSink(conn))
    context = {"deployment": "remote_station", "operator_skill": "technician",
               "time_to_service_min": {"self_service": 45, "on_site": 120, "recovery": 900},
               "connectivity": "intermittent"}

    # -- register units -------------------------------------------------
    for unit_id, profile in [
        ("u-100", {"unit_id": "u-100", "service_age_years": 72, "class": "M",
                   "baselines": {"cycle_rate": {"median": 68, "p10": 60, "p90": 78,
                                                "window_days": 14, "n_obs": 41},
                                 "pressure_primary": {"median": 128, "p10": 115, "p90": 142,
                                                      "window_days": 14, "n_obs": 30}}}),
        ("u-200", {"unit_id": "u-200", "service_age_years": 55, "class": "F"}),
    ]:
        conn.execute("insert or replace into units (unit_id, profile, deployment) values (?,?,?)",
                     (unit_id, json.dumps(profile), "remote_station"))
    conn.commit()

    # -- simulated day: u-100 deteriorates; u-200 reports once, goes silent
    batches = [
        ("2026-07-03T10:00:00Z", {"u-100": [O("u-100", 0, "cycle_rate", 88, "2026-07-03T10:00:00Z"),
                                            O("u-100", 1, "pressure_primary", 131, "2026-07-03T10:00:00Z")],
                                  "u-200": [O("u-200", 0, "cycle_rate", 74, "2026-07-03T10:00:00Z")]}),
        ("2026-07-03T11:30:00Z", {"u-100": [O("u-100", 2, "cycle_rate", 95, "2026-07-03T11:30:00Z"),
                                            O("u-100", 3, "pressure_primary", 126, "2026-07-03T11:30:00Z")]}),
        ("2026-07-03T12:30:00Z", {"u-100": [O("u-100", 4, "cycle_rate", 104, "2026-07-03T12:30:00Z"),
                                            O("u-100", 5, "pressure_primary", 120, "2026-07-03T12:30:00Z")]}),
        ("2026-07-03T13:30:00Z", {"u-100": [O("u-100", 6, "cycle_rate", 118, "2026-07-03T13:30:00Z"),
                                            O("u-100", 7, "pressure_primary", 116, "2026-07-03T13:30:00Z")]}),
    ]
    last_output = {}
    for now, per_unit in batches:
        for unit_id, obs in per_unit.items():
            ingest(conn, unit_id, obs)
            last_output[unit_id] = evaluate_unit(conn, engine, unit_id, context, now)

    final = last_output["u-100"]
    print(f"u-100 final assessment: {final['severity']}/{final['action_tier']} "
          f"({final['confidence']}), matched={final['matched_signatures']}")

    # -- human outcome closes the loop ----------------------------------
    engine.record_outcome(final["case_id"], final["action_tier"],
                          "responded; deterioration confirmed on inspection",
                          outcome_label="deterioration_confirmed")
    conn.execute("insert or replace into outcomes values (?,?,?,?)",
                 (final["case_id"], final["action_tier"],
                  "responded; deterioration confirmed on inspection", "deterioration_confirmed"))
    conn.commit()

    # -- watchdog over units.last_seen -----------------------------------
    last_seen = dict(conn.execute("select unit_id, last_seen from units where last_seen is not null"))
    deployments = dict(conn.execute("select unit_id, deployment from units"))
    overdue = check_overdue(content, last_seen, "2026-07-03T18:00:00Z", deployments)
    for r in overdue:
        print(f"watchdog: {r['unit_id']} silent {r['silent_min']} min "
              f"-> {r['severity']}/{r['action_tier']} ({r['flags'][0]})")

    # -- anchor + verify the chain from the DB ---------------------------
    records = [json.loads(r[0]) for r in conn.execute(
        "select record from audit_records where stream_id='local' order by seq")]
    verify_chain(records)
    head = records[-1]["hash"]
    conn.execute("insert or replace into chain_anchors values ('local', ?, ?, ?)",
                 (records[-1]["seq"], head, "2026-07-03T18:00:00Z"))
    conn.commit()
    print(f"audit chain: {len(records)} records verified; head anchored {head[:16]}…")

    # -- §7 surveillance straight off the chain --------------------------
    rows = join_cases(records)
    for line in build_report(rows, threshold=0.2, min_n=1):
        print(f"override telemetry: {line['signature']} "
              f"{line['overrides']}/{line['graded_firings']} overridden")
    bt = backtest(rows)
    print(f"back-test: engine recall {bt['engine_recall']} "
          f"({bt['confirmed_detected']}/{bt['confirmed_cases']} confirmed cases answered)")

    # -- replay from the DB reproduces byte-identical outputs ------------
    replayed = Engine(content).replay(records)
    print(f"replay from DB: {len(replayed)} cases byte-identical")
    print(f"db: {db_path}")


if __name__ == "__main__":
    main()
