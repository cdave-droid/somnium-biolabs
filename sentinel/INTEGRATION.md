# SENTINEL — Product Integration

How the engine connects to the Somnium product today, and the designed (not
yet built) persistence layer.

## What is wired now

- **API route** `app/api/sentinel/evaluate/route.ts` (Node runtime): POSTs
  `{unit_profile, observations, context, reference_time?}` →
  `{demo_notice, output: EngineOutput}`. Imports `sentinel/engine-ts/dist`
  (build the engine first: `npm run build --prefix sentinel/engine-ts`).
  Content is the demo package, loaded once per server process.
- **Demo page** `app/sentinel/page.tsx`: presets, editable case JSON,
  tier/severity/confidence badges, full explanation, reasoning-trace viewer.
- Every response carries the demo notice and the `content_unsigned` flag —
  the shipped content is placeholder, NOT SME-reviewed (GAPS.md B1).

## Durability pieces available to wire (Phase 5)

| Piece | Python | TypeScript |
|---|---|---|
| Audit sink (JSONL, chain-verified on load) | `FileAuditSink`, `load_audit_log` | `FileAuditSink`, `loadAuditLog` (`m9_audit_node`) |
| Chain anchor | `AuditLog.chain_head()` | `AuditLog.chainHead()` |
| Baseline store | `InMemoryBaselineStore`, `FileBaselineStore` | `InMemoryBaselineStore` (+ `BaselineStore` interface) |
| Silent-unit watchdog | `check_overdue()` + `tools/watchdog_check.py` | — (ops-side job; run the Python CLI) |

Determinism contract: the baseline store is read once per `evaluate()`, the
snapshot is recorded in the audit `case_input`, and `replay` uses the snapshot
— never the live store.

## Designed persistence schema (Supabase/Postgres — NOT yet created)

```sql
create table units (
  unit_id     text primary key,
  profile     jsonb not null,          -- UnitProfile
  deployment  text,                    -- for watchdog cadence lookup
  updated_at  timestamptz not null default now()
);

create table observations (
  obs_id      text primary key,
  unit_id     text not null references units,
  ts          timestamptz not null,
  body        jsonb not null,          -- raw Observation
  inserted_at timestamptz not null default now()
);
create index on observations (unit_id, ts desc);

create table baselines (
  unit_id     text primary key references units,
  baselines   jsonb not null,          -- {metric: {median,p10,p90,n_obs}}
  computed_at timestamptz not null
);

create table cases (
  case_id     text primary key,        -- deterministic engine case_id
  unit_id     text not null references units,
  output      jsonb not null,          -- EngineOutput
  created_at  timestamptz not null default now()
);

create table audit_records (
  seq         bigint not null,
  stream_id   text not null,           -- one hash chain per stream/site
  record      jsonb not null,          -- full chained record (canonical form)
  hash        text not null,
  prev_hash   text not null,
  primary key (stream_id, seq)
);

create table outcomes (
  case_id            text primary key references cases,
  human_action_tier  text not null,
  outcome_note       text,
  recorded_at        timestamptz not null default now()
);

create table chain_anchors (              -- truncation defense (GAPS B6)
  stream_id   text not null,
  seq         bigint not null,
  chain_head  text not null,             -- AuditLog.chain_head() at anchor time
  anchored_at timestamptz not null default now(),
  primary key (stream_id, seq)
);
```

Wiring sketch:
1. Ingest writes `observations` and bumps `units.updated_at` (feeds the
   watchdog's `last_seen`).
2. An evaluation worker (or the API route) loads the unit's profile +
   trailing observations + `baselines` row, calls `evaluate(...,
   stored_baselines=…)`, stores the `EngineOutput` in `cases`, and appends
   the two audit records to `audit_records`.
3. A nightly job recomputes `baselines` from history (M3's computed path)
   and `put`s them — the store is a cache of personalized baselines, never
   a source of clinical truth.
4. A scheduler runs `tools/watchdog_check.py` (or the `check_overdue`
   function) every few minutes over `units.updated_at`; overdue reports go
   to the alerting channel.
5. A cron countersigns `chain_anchors` (or ships the head hash to an
   external WORM store) so tail-truncation of `audit_records` is detectable.
6. §7 surveillance jobs (override clustering, PPV/recall back-testing) read
   `cases` ⋈ `outcomes`.

## Open before any real deployment

Everything in GAPS.md section B — above all: SME-authored content (B1),
regulatory pathway (B2), PHI governance (B5), and observation authenticity
(B7). The demo route intentionally has no auth and must not front real data.
