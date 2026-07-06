# SENTINEL — Implementation Decisions

This document pins every convention the spec leaves open. Both runtimes (engine-py,
engine-ts) MUST follow it exactly — cross-runtime byte-identical parity (§6 G4c)
depends on it. Anything here marked **(spec gap)** fills a hole in the source spec;
see `GAPS.md` for the full issue list.

## D1. Ordinal scales

- Severity: `S1 < S2 < S3 < S4` (S4 most severe).
- Action tier: `D0 < D1 < D2 < D3 < D4 < D5` (D5 strongest response).
- Confidence: `high > degraded > insufficient`.
- Responsiveness: ordinal `R0 < R1 < R2 < R3` (R3 = unresponsive = worst).
  **(spec gap — orderings are implied but never stated.)**

## D2. Determinism primitives

- **No wall clock.** `evaluate()` derives `reference_time` = max accepted observation
  timestamp; callers may pass an explicit `reference_time`. `Date.now()`,
  `datetime.now()`, and `uuid4()` are banned in engine code.
- **case_id** = deterministic UUID formatted from the first 16 bytes of
  `sha256(canonical_json({unit_profile, observations, context, reference_time,
  engine_version, content_version}))`, with the UUID version nibble forced to `5`
  and variant bits to `10`. **(spec gap — a random uuid would violate directive 1.)**
- **Observation ordering**: sort by `(timestamp, obs_id)` — obs_id is the
  deterministic tie-break for identical timestamps.
- **Signature evaluation order**: lexicographic by `signature_id`.

## D3. Canonical JSON (shared serializer, both runtimes)

- Object keys sorted by code unit (keys are ASCII by schema).
- Separators `,` and `:`, no whitespace; UTF-8; strings JSON-escaped with the
  minimal escape set (`"` `\` and control chars as `\u00XX`, plus `\n` `\r` `\t`).
- **Numbers**: integers (|x| < 2^53, no fractional part) render with no decimal
  point. Everything else is quantized to 6 decimal places (`q6`) and rendered by a
  scaled-integer formatter — never exponent notation, trailing zeros stripped.
  `q6(x) = sign(x) * floor(|x| * 1e6 + 0.5) / 1e6` (round half away from zero).
  Python's `round()` (banker's) is banned. All derived numeric outputs pass
  through q6 at the point of computation, not just serialization.
- Hashes are `sha256` over the UTF-8 bytes of canonical JSON. engine-ts ships a
  pure-TS SHA-256 (no `node:crypto`) so the core stays dependency-free and
  React-Native-portable.

## D4. Timestamps

- Accepted format (strict): `YYYY-MM-DDTHH:MM:SS(.mmm)?Z` — UTC only. Parsed by our
  own parser in both runtimes (native `Date` parsing is banned — engines differ).
- Internally: epoch **seconds** (number; may carry .mmm fraction).
- Window `[reference_time - window_min*60, reference_time]`, **inclusive** on both
  ends.

## D5. Statistics (identical implementations both runtimes)

- Median / percentile: linear interpolation (numpy default): `rank = (n-1)*p`;
  interpolate between floor/ceil neighbors of sorted values. q6 the result.
- `trend_slope`: ordinary least squares over `(t_min, value)` points where `t_min`
  = minutes since the earliest point **in the window**. Slope = Sxy/Sxx, q6'd.
  If `n < min_points` or `Sxx == 0` → **refused** (condition result `unknown`).
- `delta_from_baseline_*` uses the **median of usable values in the window**
  (robust to a single spike) vs `baseline.median`. **(spec gap — the spec never
  says which value the delta uses.)** `_pct` with `baseline.median == 0` →
  `unknown` + flag `baseline_zero_division`.
- `sustained_for_min`: length in minutes of the run of consecutive usable points
  beyond `threshold` in `direction` ending at the latest point; a run of one point
  has length 0.
- `crossed_threshold_count`: number of adjacent usable pairs where the value
  crosses `threshold` in `direction` (`above` = upward crossings, `below` =
  downward).

## D6. Three-valued condition logic

Metric conditions evaluate to `true | false | unknown` (`unknown` = not enough
data: missing metric, `n < min_points`, no baseline, division by zero).

- `all_of`: false if any false; unknown if any unknown; else true.
- `any_of`: true if any true; unknown if any unknown (and none true); else false.
- `none_of`: true if all false; false if any true; else unknown.
- `at_least_n_of {n, of: [...]}`: true if ≥n true; false if true-count + unknown-count < n; else unknown.
- Flag conditions (`{"flag": ...}`, `{"baseline_status": ...}`) are always known.

Signature disposition: logic `true` → **matched**; `false` → not matched;
`unknown` → **not_evaluable** (recorded with a reason; feeds M8). This is how
"missing input degrades toward caution, never silently" is realized per-signature.

## D7. Quality weighting (M2 → M3/M4/M5)

- `valid` and `suspect` observations are usable for logic.
- `artifact_likely` observations are **excluded** from series/baselines **unless**
  mechanism-protected (unit profile has a content-declared plausible mechanism for
  that abnormality), in which case they stay usable **and** the case action tier is
  floored at the content `mechanism_floor` (demo: D3). Escalation-biased both ways:
  a protected abnormal reading can still trigger signatures, and can never be
  waved off below the floor.
- Cross-signal contradiction marks the implausible reading (the rule's `metric`)
  `artifact_likely`.

## D8. Baselines (M3)

Priority: (1) `unit_profile.baselines[metric]` with `n_obs >= min_n_obs` →
`personalized`; (2) computed from usable observations in the trailing
`window_days` → `personalized` if enough points, else (3) population default from
`parameter_tables/population_baselines.json` matched by `(class, service_age_band)`
→ `(class)` → `(default)` → `population_default`; (4) nothing → `unavailable`
(baseline-dependent conditions become `unknown`).

## D9. Conflict resolution (M5)

Signatures may declare an optional `conflict_group` (content-declared). Within a
group, only the highest-severity match survives; ties broken by higher `priority`
(integer, content-declared), then lexicographic `signature_id`. Losers are recorded
in `suppressed_signatures` with reason `superseded_by_higher_severity` /
`superseded_by_priority`. Matches in different groups (or no group) coexist.
**(spec gap — the spec demands precedence but never defines which signatures
"conflict".)**

## D10. Tier composition (M6/M7) — raise-only lattice

`final_tier = max(` per-matched-signature context tier (via `action_tier_by_context`,
falling back to `"default"`), global context-modifier floors, mechanism floor (D7),
M8 context floor when M8 fired `)`. Nothing in the pipeline may lower a tier once
contributed. No matches + no M8 → severity `S1`, tier `D0` **(spec gap — the
healthy path output is never defined)**.

## D11. Trajectory

M4 classifies via content `trajectory_rules` (per-metric worse-direction slopes over
a window; counts of worsening/improving metrics). If matched signatures carry
`trajectory_override`, the override of the highest-severity match wins; ties resolve
by escalation order `worsening > unknown > stable > improving`.

## D12. Confidence

- `insufficient` — any M8 trigger (see D13).
- `degraded` — any of: population-default or unavailable baseline consulted;
  suspect observation used; any quarantined observation (`data_rejected`);
  a signature `not_evaluable` for a data-QUALITY reason (insufficient points,
  no baseline, artifacts) — a signature whose input modality was simply never
  observed is normal operation and does not degrade confidence, though it is
  always listed in `not_evaluable_signatures`; missing/incomplete
  `ContextObject`; any `artifact_likely` observation.
- `high` — otherwise. **(spec gap — "degraded" was never defined.)**

## D13. M8 triggers (each also sets an explicit flag)

1. Zero accepted observations. 2. All accepted observations `artifact_likely`
(none mechanism-protected). 3. Every published signature `not_evaluable` (or the
package has none). 4. Unknown `event_id` (G3 battery requires this to route to
M8). 5. Never-ignore absolute bounds: a breach by **any usable** reading within the
content-defined `never_ignore.window_min` (demo: 240) floors the tier
**unconditionally** — a breach must not vanish because a newer in-range reading
arrived afterwards (a matched low-tier signature must never shadow an
absolute bound) and additionally routes to M8-insufficient when no matched
signature covers that metric; a breach visible only in **artifact-flagged** or
**quarantined (physically impossible)** readings always routes to M8-insufficient
with the bound's floor — possibly-real extremes must not vanish via quality
filtering (spec's stated bypass — "zero signatures matched" — was itself an
under-triage hole; see GAPS.md). 6. Internal exception anywhere → outer catch
produces the safe output with flag `internal_error` and the **maximum** context
floor. On M8: `confidence: insufficient`,
`action_tier = max(already-computed tier, context safe floor)`, severity =
max(matched severities, content `severity_floor` for the context), and the
explanation names what is missing plus the single most valuable input (the most
frequently missing required input across not-evaluable signatures, else the
artifact-affected metric, else "any valid observation").

## D14. Explanation templates

Signatures declare `template_bindings`: map of template variable → `{condition_id,
field, round?}` where `field` ∈ computed values of that condition (`value`,
`delta_pct`, `delta_abs`, `slope`, `count`, `sustained_min`, `window_h`,
`window_min`, `baseline_median`). Content validation fails at load if a template
references an unbound variable — an incomplete explanation is a build failure
(directive 3), enforced before runtime. **(spec gap — `{rate_delta_pct}` in the
spec's example is not derivable from the condition set without an explicit
binding.)**

## D15. Operator addition (documented deviation)

The spec's operator vocabulary cannot reference `event` observations at all, yet
`event` is a supported type with a controlled vocabulary. We add ONE operator:
`event_present {event_id, window_min}` → true if a matching event observation is in
the window. Flagged in GAPS.md; remove if SMEs prefer v1 without events.

## D16. Content signing (v1)

`manifest.json` lists every content file with its sha256 and the package hash;
`sign_content.py` recomputes it; `load_content` verifies every hash and fails
closed on mismatch. Signing algorithm is `"none"` (hash-integrity only) in v1 —
real key management (Ed25519, key custody, revocation, offline verification) is an
open item in GAPS.md. Unsigned/`none` packages load but set flag
`content_unsigned` on every output.

## D16b. Boundary hardening (adversarial-review fixes)

- Malformed `unit_profile`/`context` shapes are **normalized identically in
  both runtimes** at `evaluate()` entry: wrong-typed fields are dropped with
  flags `invalid_profile_fields`/`invalid_context_fields` (confidence at most
  degraded) — never crashed on, never silently trusted.
- `missing_context` is flagged **centrally** on every output path, not only
  when a signature matched.
- M1 quarantines non-finite numeric values (`invalid_value:not_finite`) and
  non-ASCII `obs_id`s (sort/hash parity).
- M9 recording fails toward caution: unserializable raw inputs are recorded
  as `{"unserializable_input": true}`; `replay` skips such cases (they cannot
  be re-executed; their output records stay tamper-evident). `case_id` falls
  back to a sanitized deterministic hash with an M9 trace note.
- Emergency outputs carry a stable fault marker only — never runtime-specific
  exception class names (cross-runtime parity of the fault path).
- Lone UTF-16 surrogates in any input string canonicalize to U+FFFD in both
  runtimes.

## D19. Multi-stream handling (per-stream screening, explicit fusion)

A **stream** is one device/channel: `Observation.stream_id` if present, else
the `source` class. Multiple streams may report the same metric at different
frequencies. Rules:

1. **Screen per stream first.** Waveform-shape rules (impossible-jump,
   spike-and-recover) run WITHIN one (metric, stream) series only — comparing
   readings across devices manufactures artifacts out of ordinary
   inter-device offsets.
2. **Per-stream trust verdict.** A stream whose readings are dominated by
   artifact shapes (content: `stream_screening.max_artifact_fraction` per
   source, with `min_points_for_distrust`) is distrusted wholesale — its
   remaining readings are downgraded to artifact_likely (`stream_untrusted`
   flag) rather than believed selectively. Distrusted readings that breach
   never-ignore bounds still escalate via the on-artifact path (D13.5) —
   distrust never silently discards a critical value.
3. **Cross-stream reconciliation.** Near-simultaneous usable readings of the
   same metric disagreeing beyond content tolerance → `stream_disagreement`
   flag, lower-trust reading marked suspect, confidence degraded. Trust order
   is content (`source_priority`).
4. **Fusion for logic.** Each windowed computation uses the highest-trust
   single stream that can answer on its own. Pooling readings across streams
   is a last resort (no single stream has enough points), is always flagged
   (`pooled_streams`, degrades confidence), and never silent — inter-device
   offsets masquerade as trends.
5. Errors remain attributable: quarantine reasons are per observation,
   quality labels per reading, trust verdicts per stream (in the trace by
   stream name), and case flags summarize per-case.

## D17. Layout deviation

The spec assumes SENTINEL owns the repo root; this repository already hosts a
Next.js app, so everything lives under `sentinel/` with the spec's §5 layout
inside it.

## D18. evaluate_stream

`open_case(unit_profile, context)` returns a handle holding accumulated
observations; each `evaluate_stream(handle, obs)` appends (duplicate `obs_id` is
ignored with flag `duplicate_obs_id`) and re-runs the full pipeline. Incremental
computation is an optimization for later; recompute-from-scratch is trivially
deterministic and identical to batch `evaluate`.
