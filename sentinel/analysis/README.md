# analysis/ — offline evaluation harness & §7 surveillance jobs

Post-launch misalignment surveillance (spec §7) plus the replay tooling it
runs on. Everything here consumes the M9 audit log (hash-verified before any
number is computed) and is deterministic — no wall clock, no randomness.

| Job | Spec | What it does |
|---|---|---|
| `replay_loader.py` | §5 | Load audit JSONL chains, verify hashes, join case input + output + human outcome |
| `override_report.py` | §7.1 | Cluster human overrides by signature; flag >threshold override rates **with a minimum sample size** (fixes the spec's bare >20% rule); down-override dominance is the alert-fatigue signal |
| `outcome_backtest.py` | §7.2 | Per-signature PPV and engine-level detection recall from `record_outcome(..., outcome_label=...)` ground truth; tolerance breaches exit non-zero |
| `content_diff.py` | §7.3 | Run the golden inputs under OLD vs NEW content packages; emit the per-case sign-off report a content update must carry |
| `run_redteam.py` + `redteam_cases.json` | §7.4 | Adversarial pins: boundary-exact thresholds, unit errors, plausible-but-wrong inputs. Runs in CI. **The suite only grows** — no incident closes without adding its case |

End-to-end wiring example (SQLite, no cloud): `python tools/local_pipeline.py`
runs ingest → evaluate → persist → chained audit → anchor → watchdog →
outcome → override report → back-test → replay-from-DB.

Ground-truth labels for back-testing: `deterioration_confirmed`,
`no_deterioration`, `indeterminate` (excluded from PPV). Who assigns labels,
and on what adjudication protocol, is SME/process work — see GAPS.md B1/B2.
