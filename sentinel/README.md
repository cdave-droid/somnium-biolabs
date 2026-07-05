# SENTINEL — Rule-Based Monitoring & Triage Engine

**S**ignal **E**valuation & **N**otification with **T**iered **I**ntervention &
**E**scalation **L**ogic. A deterministic, testable, fully-explainable engine
that watches streams of sensor readings from remote/disconnected units, decides
how serious the situation is, and recommends a graded response — while never
guessing silently and always recording why it decided what it decided.

Built from the SENTINEL Technical Specification. Start here:

- **`DECISIONS.md`** — every convention the spec left open, pinned (both
  runtimes depend on it byte-for-byte).
- **`INTEGRATION.md`** — how the engine is wired into the Next.js app
  (`/sentinel` demo page + `/api/sentinel/evaluate`), the durability pieces
  (audit sink, baseline store, silent-unit watchdog), and the designed
  persistence schema.
- **`GAPS.md`** — issues found in the spec: what this build resolved, what
  needs your/SME decisions, and deliberate deviations. **Read section B before
  planning any deployment.**

> ⚠️ **Every value in `content/packages/demo-2026.07.0` (thresholds, bounds,
> signatures, population baselines) is a placeholder authored to exercise the
> engine — none of it is SME-reviewed. The engine is scaffolding; the reviewed
> content package is the actual product.**

## Layout (spec §5, rooted under `sentinel/`)

```
content/schema/          JSON Schemas for every content file type
content/packages/…       demo content package (hash-verified manifest)
content/tests/malformed/ the 20 G0 malformed-content fixtures
engine-py/               Python 3.11 reference runtime (stdlib only)
engine-ts/               TypeScript runtime (zero runtime deps, RN-portable core)
golden/cases/            20 golden scenarios + counterfactuals; expected outputs
                         are the byte-exact cross-runtime contract
tools/                   content validator/signer, golden generator, workbook
                         converter, coverage reporter, parity gate
```

## Architecture (spec §1)

Fixed pipeline `M1 → M2 → M3 → M4 → M5 → M6 → M7`, with M8 intercepting at any
stage and M9 recording everything:

| Module | Role |
|---|---|
| M1 | Ingest & validate; quarantine impossible values (bounds/units are content) |
| M2 | Signal quality: artifact heuristics from content; never deletes data |
| M3 | Baselines: profile → computed → stratified population default → unavailable |
| M4 | Windowed trends (refuses slopes below `min_points`); trajectory rules |
| M5 | Signature evaluator: three-valued logic; suppression always recorded |
| M6 | Context adapter: tier maps + global modifiers; **raise-only** |
| M7 | Final severity/tier (max-lattice) + rendered explanation + recheck interval |
| M8 | Honest failure: `confidence: insufficient` + context floors; internal errors fail toward caution |
| M9 | Append-only hash-chained audit log; `replay` must reproduce byte-identical outputs |

## Quick start

```bash
# Python
cd sentinel/engine-py && pip install pytest numpy && python -m pytest tests/ -q

# TypeScript
cd sentinel/engine-ts && npm install && npm test

# Cross-runtime parity gate (both runtimes vs the golden byte contracts)
bash sentinel/tools/check_parity.sh

# Validate / re-sign a content package
python sentinel/tools/validate_content.py sentinel/content/packages/demo-2026.07.0
python sentinel/tools/sign_content.py <pkg> --version <ver>
```

```python
import sys; sys.path.insert(0, "sentinel/engine-py")
from sentinel import Engine, load_content, explain

content = load_content("sentinel/content/packages/demo-2026.07.0")
engine = Engine(content)
out = engine.evaluate(unit_profile, observations, context)   # spec §4
print(out["severity"], out["action_tier"], out["confidence"])
print(explain(out, audience="specialist"))
engine.record_outcome(out["case_id"], human_action_tier="D3")
```

## Gate status (spec §6)

| Gate | Status |
|---|---|
| G0 schemas & content validation | ✅ 20 malformed fixtures rejected; every required field programmatically enforced; hash tamper/unlisted-file/missing-table detected |
| G1 M1–M3 | ✅ impossible-value property test (300 randomized trials); artifact fixtures incl. the spec's worked example; baselines vs hand-calc to 1e-4; 1,000-run byte-identical determinism |
| G2 M4–M5 | ✅ slope/percentile vs numpy on 50+ series incl. refusals; full operator-vocabulary matrix; **monotonicity property** (worse inputs never lower severity/tier); conflict precedence + suppression records |
| G3 M6–M8 | ✅ raise-only property (200 random contexts); explanation-completeness lint; **40-case honest-failure battery** (all `insufficient` + floors, with a negative control); fault injection in every module |
| G4 M9 & API | ✅ single-bit tamper detection in a 10,000-record chain; byte-identical replay; stream≡batch |
| G5 golden suite | ✅ 20 scenarios (incl. 6 counterfactuals) byte-identical in BOTH runtimes; coverage ≥3 cases per published signature. **Release-blocked on real SME content** (see GAPS.md B1) |
