# SENTINEL — Spec Issues & Gaps

Findings from building the spec plus an adversarial six-lens review of the spec
text (consistency, determinism/parity, state/API, safety, testing, security).
Three sections: **(A)** spec gaps this build resolved (with the decision taken),
**(B)** open gaps that need your / SME decisions, **(C)** deliberate deviations.

Severity: 🟥 would have shipped wrong/unsafe · 🟧 would bite in production · 🟨 polish.

---

## A. Spec gaps resolved by this build (decision recorded in DECISIONS.md)

| # | Gap in the spec | Resolution here |
|---|---|---|
| A1 🟥 | **No evaluation-time anchor.** Every window (`window_min`, 14-day baselines, `sustained_for_min`) needs a "now", but `evaluate()` takes none — wall-clock use would break determinism, the 1,000-run gate, and replay. | Explicit `reference_time` parameter; defaults to max observation timestamp; recorded in M9 and reused by replay. Wall clock and RNG are banned in core. (D2, D4) |
| A2 🟥 | **S1–S4 / D0–D5 never defined** — not even which end is severe. Every safety invariant ("higher wins", "only raise") is order-theoretic, and clinical triage scales (CTAS/ESI) run the OPPOSITE direction, so an SME importing that convention silently inverts every max/floor. Also: the zero-match "healthy" output is never defined (max over an empty set). | Orderings pinned (S4/D5 = most severe/strongest) in engine constants and DECISIONS D1; healthy path defined as S1/D0/confidence-high with explicit explanation (D10). **Open: operational meaning of each D-tier is content/SOP work — see B2.** |
| A3 🟥 | **Never-ignore bounds bypassed whenever any signature matches** ("zero signatures matched" precondition). A trivial S2 match while saturation breaches an absolute bound → confident under-triage. | Bound floors apply **unconditionally** via the max-lattice; the insufficient-confidence route fires when the breached metric isn't covered by a matched signature. Golden case `m8_contradiction_artifact_saturation` + G3 battery pin this. (D13.5) |
| A4 🟥 | **Quarantined extreme values vanish silently.** M1 conflates "sensor-impossible" with "extreme but real" (a true cycle_rate of 12 is quarantined, then checked against nothing). | Quarantined out-of-bounds values are still tested against never-ignore bounds → M8 `never_ignore_breach_on_rejected`, insufficient + bound floor ("may be real or garbage; re-measure"). (D13.5) |
| A5 🟥 | **Artifact/suspect weighting undefined downstream** — M2 "never deletes, downstream decides" but no module defines the deciding. The spec's own worked example (sat 60% + normal others → artifact) is the classic silent-hypoxemia trap. | Weighting defined (D7): suspect used; artifact excluded unless mechanism-protected; artifact readings that breach never-ignore bounds escalate to M8 instead of disappearing. |
| A6 🟥 | **"Conflict" between signatures never defined**, and severity-suppression could interact with tier composition. | Content-declared `conflict_group` with (severity, priority, id) precedence; losers always recorded in `suppressed_signatures`. Final tier is max over ALL contributions, so suppression can't lower response below any floor. (D9, D10) |
| A7 🟥 | **Logic grammar unformalized** — parameter shapes, `at_least_n_of` arity, boundary inclusivity, missing-data propagation all undefined; the example signature's `optional_inputs` reference types (`recovery_lag`, `throughput`) that don't exist in the observation-type list. | Full JSON Schema for the grammar; three-valued logic with defined propagation (unknown → `not_evaluable`, never silent false); windows closed-inclusive; semantic load-time checks reject incoherent conditions. (D5, D6) |
| A8 🟥 | **"Byte-identical" gates with no numeric/serialization contract** (float formatting, percentile method, OLS detail, JSON canonicalization, uuid randomness vs determinism; Python/JS render `1e-06` vs `0.000001`). numpy-in-core vs zero-dep TS is irreconcilable for bit parity. | Canonical JSON + q6 scaled-integer formatter + pinned percentile/OLS algorithms, identical accumulation order; pure-stdlib Python core and pure-TS SHA-256 (numpy only as a test-side reference, satisfying G2a). Deterministic hash-derived `case_id`. (D2, D3, D5) |
| A9 🟥 | **Monotonicity gate (G2c) is self-contradictory as written**: perturbing values "worse" can cross artifact/quarantine classification boundaries and legally lower the response. | The artifact/rejected never-ignore escalation paths (A3–A5) close the under-triage flips; the G2 property test perturbs uniformly (preserving inter-reading deltas) across 4 scenarios × all metrics × 6 magnitudes and asserts non-decrease. |
| A10 🟥 | **Baseline ownership circular** (M3 "maintains" them; UnitProfile carries them; evaluate() is stateless), population-default stratification fallback undefined, zero-median `delta_pct` division undefined. | Resolution chain profile → computed-from-history → stratified population default → unavailable; zero-median → `unknown` + flag; per-metric `baseline_status`. Persistence stays caller-side (stateless core). (D8) **Drift risk stays open — B8.** |
| A11 🟥 | **Content-verification failure behavior undefined** (and M8's safe floor lives inside the content that failed). | `load_content` fails **closed** with every error listed — an engine with unverifiable content never evaluates at all, which is the only floor that doesn't depend on the failed content. |
| A12 🟧 | **Missing/unknown ContextObject unhandled** (M8's "floor for the context" is circular when context is missing). | Missing deployment → `default` tier map entry (schema-required) + `missing_context` flag + degraded confidence; emergency path uses the MAXIMUM configured floor. (D13.6) |
| A13 🟧 | **`{rate_delta_pct}`-style template variables not derivable** from conditions; explanation completeness unenforceable. | Explicit `template_bindings` (condition id → computed field); unbound variables are a **load-time** content error; G3 lint asserts every flag and matched signature is narrated and no `{placeholder}` survives. (D14) |
| A14 🟧 | **`evaluate_stream` lifecycle undefined**; duplicate/out-of-order observations unspecified; input-order nondeterminism. | `open_case` handle; stream = append + full re-evaluate (provably identical to batch — tested); duplicates quarantined by `obs_id` with flag; internal (timestamp, obs_id) sort makes input order irrelevant (tested). (D18) |
| A15 🟧 | **Trajectory conflicts** (multiple `trajectory_override`s) and multi-match `recommended_recheck_min` unresolved. | Highest-severity match's override wins, ties resolve toward `worsening`; recheck is keyed off the FINAL tier so max-composition resolves it. (D11) |
| A16 🟧 | **Version compatibility absent** (old engine + newer content operators). | Manifest `min_engine_version`, enforced at load; engine+content versions stamped on every output and audit record; replay refuses mismatched content. |
| A17 🟨 | **G0 "100% of schema fields" unmeasurable.** | Interpreted as: for every required field of every schema, removal is programmatically proven to be rejected (parametrized tests), plus the 20 committed malformed fixtures. |

## B. Open gaps — decisions for you / SMEs (the build cannot close these)

1. 🟥 **The scenario workbook does not exist, and it IS the product.** Every
   signature, threshold, bound, and baseline in `content/packages/demo-2026.07.0`
   is a **placeholder I authored to exercise the machinery** — explicitly marked
   `NOT SME REVIEWED`. The engine is scaffolding; the clinical knowledge base is
   the deliverable that needs SME authorship, dual sign-off (G5 requires ≥2
   reviewers recorded), and counterfactual coverage. The workbook JSON format is
   defined in `tools/workbook_converter.py` so SMEs can start now.
2. 🟥 **Regulatory pathway.** The vocabulary map decodes to remote patient
   monitoring and triage (heart rate, SpO₂, blood pressure, AVPU responsiveness,
   pain 0–10; care-setting contexts). If that's the real domain, this is very
   likely Software as a Medical Device: FDA (510(k)/De Novo) and, given qmed.ca,
   Health Canada SOR/98-282 (likely Class II+). The spec never mentions IEC
   62304 lifecycle, ISO 14971 risk management, clinical validation, human-factors
   testing, or labeling ("does not replace clinical judgment"). The determinism/
   audit design here is regulator-friendly, but none of that work is scoped.
3. 🟥 **Silent-unit problem: nothing owns data absence.** The engine only runs
   when called with observations. A unit that stops reporting — the highest-risk
   event in remote monitoring — never triggers anything. A scheduler/watchdog
   ("expected cadence per unit; overdue → synthesize an evaluation with a
   missing-data M8 route") must exist OUTSIDE the pure engine. Deliberately not
   invented here because expected-cadence policy is domain content.
4. 🟥 **Key custody & content trust chain.** v1 is hash-integrity only
   (`signing.algorithm: "none"`, flagged on every output). Real Ed25519 signing,
   key custody, revocation, anti-rollback (a signed-but-outdated package is
   still "valid"), and offline verification need a decision. SME sign-offs are
   currently unbound plaintext fields.
5. 🟥 **PHI governance.** `free_text_note` is an unmanaged PHI sink; an
   append-only tamper-evident log collides with PIPEDA/GDPR erasure and
   retention; §7 override telemetry exports outcome-linked data. Needs counsel +
   design (e.g., PHI vault with hash references from the chain, not PHI in the
   chain).
6. 🟧 **Audit-log anchoring.** The hash chain detects modification but not
   whole-log truncation-from-the-tail or full rewrite. Needs periodic external
   anchoring (countersigning, remote checkpoint, or WORM storage) — an
   integration concern outside the pure engine.
7. 🟧 **Observation authenticity.** Nothing prevents fabricated or replayed
   "healthy" readings — the one direction escalation-bias cannot defend. Device
   signing/provenance is transport-layer work.
8. 🟧 **Baseline drift normalizing slow deterioration.** A rolling 14-day
   personalized baseline slowly absorbs a slow decline (the classic "boiled
   frog"). Mitigations (baseline vs. long-term anchor comparison, drift alarms)
   should be SME-designed content. Never-ignore absolute bounds are the current
   backstop.
9. 🟧 **Alert fatigue is structurally unmanaged.** Escalation-biased failure +
   conservative floors will produce high D-tier volume; the spec's only feedback
   is a lagging weekly override report. Needs an alarm lifecycle
   (dedup/hysteresis/acknowledgement) and a burden metric per deployment. The
   >20% override auto-flag also lacks a minimum sample size (3 overrides of 10
   firings would trip it).
10. 🟧 **Severity→tier coupling.** Nothing stops content from pairing S4 with
    D1. A content lint ("each severity has a minimum permissible tier") is a
    5-line addition to `validate_content.py` once SMEs define the mapping.
11. 🟧 **Graded severity within a signature.** One fixed severity per signature
    forces banded families (mild/moderate/severe variants) with no lint that the
    bands partition the axis without gaps (e.g., `gte 20/lte 40` + `gte 50`
    silently under-covers +45%). Band-partition lint is recommended before real
    content ships.
12. 🟧 **Device clock skew.** Offline units timestamp locally; UTC discipline is
    assumed, not enforced. A future-timestamp tolerance and per-device skew
    correction policy belongs in M1 content.
13. 🟨 **§7 surveillance jobs** (override clustering, PPV/recall back-testing,
    red-team suite growth) are specified as operations, not engine code — not
    built here; they consume the M9 log, which does capture `record_outcome`.

## C. Deliberate deviations from the spec (all documented in DECISIONS.md)

1. **`event_present` operator added** — the spec's operator vocabulary cannot
   reference `event` observations at all despite `event` being a supported type
   with a controlled vocabulary (D15). Remove it if SMEs prefer strict v1.
2. **`not_evaluable_signatures` output field added** — the spec demands nothing
   be dropped silently; this is where per-signature honest failure is recorded.
3. **`reference_time` input + output field added** (A1).
4. **Repo layout**: everything lives under `sentinel/` because this repository
   already hosts a Next.js app (D17).
5. **Confidence `degraded` excludes missing-modality** `not_evaluable` reasons —
   otherwise every real deployment reads "degraded" forever and the label stops
   meaning anything (D12). Data-quality reasons still degrade.
6. **Suppression scoped to `conflict_group`s** rather than all matches (D9) —
   suppressing across unrelated patterns would hide co-occurring conditions.
