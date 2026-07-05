'use client';

import { useState } from 'react';

type EngineOutput = {
  case_id: string;
  severity: string;
  trajectory: string;
  action_tier: string;
  confidence: string;
  matched_signatures: string[];
  suppressed_signatures: { id: string; reason: string }[];
  not_evaluable_signatures: { id: string; reason: string }[];
  flags: string[];
  explanation: string;
  reasoning_trace: { stage: string; detail: string }[];
  recommended_recheck_min: number;
  engine_version: string;
  content_version: string;
};

const PRESETS: Record<string, object> = {
  'Compensated stress (S3/D5)': {
    unit_profile: {
      unit_id: 'u-001', service_age_years: 72, class: 'M', mass_kg: 82,
      known_conditions: [], active_mitigations: [],
      baselines: {
        cycle_rate: { median: 68, p10: 60, p90: 78, window_days: 14, n_obs: 41 },
        pressure_primary: { median: 128, p10: 115, p90: 142, window_days: 14, n_obs: 30 },
      },
    },
    observations: [
      { obs_id: 'o000', unit_id: 'u-001', timestamp: '2026-07-03T10:00:00Z', type: 'cycle_rate', value: 88, unit: 'rpm', source: 'fixed_monitor' },
      { obs_id: 'o001', unit_id: 'u-001', timestamp: '2026-07-03T11:30:00Z', type: 'cycle_rate', value: 95, unit: 'rpm', source: 'fixed_monitor' },
      { obs_id: 'o002', unit_id: 'u-001', timestamp: '2026-07-03T12:30:00Z', type: 'cycle_rate', value: 104, unit: 'rpm', source: 'fixed_monitor' },
      { obs_id: 'o003', unit_id: 'u-001', timestamp: '2026-07-03T13:30:00Z', type: 'cycle_rate', value: 118, unit: 'rpm', source: 'fixed_monitor' },
      { obs_id: 'o004', unit_id: 'u-001', timestamp: '2026-07-03T10:00:00Z', type: 'pressure_primary', value: 131, unit: 'torr', source: 'fixed_monitor' },
      { obs_id: 'o005', unit_id: 'u-001', timestamp: '2026-07-03T11:30:00Z', type: 'pressure_primary', value: 126, unit: 'torr', source: 'fixed_monitor' },
      { obs_id: 'o006', unit_id: 'u-001', timestamp: '2026-07-03T12:30:00Z', type: 'pressure_primary', value: 120, unit: 'torr', source: 'fixed_monitor' },
      { obs_id: 'o007', unit_id: 'u-001', timestamp: '2026-07-03T13:30:00Z', type: 'pressure_primary', value: 116, unit: 'torr', source: 'fixed_monitor' },
    ],
    context: {
      deployment: 'mobile_platform', operator_skill: 'technician',
      time_to_service_min: { self_service: 30, on_site: 20, recovery: 1440 },
      connectivity: 'intermittent',
    },
    reference_time: null,
  },
  'Healthy unit (S1/D0)': {
    unit_profile: {
      unit_id: 'u-001', service_age_years: 72, class: 'M',
      baselines: { cycle_rate: { median: 68, p10: 60, p90: 78, window_days: 14, n_obs: 41 } },
    },
    observations: [
      { obs_id: 'o000', unit_id: 'u-001', timestamp: '2026-07-03T09:00:00Z', type: 'cycle_rate', value: 70, unit: 'rpm', source: 'fixed_monitor' },
      { obs_id: 'o001', unit_id: 'u-001', timestamp: '2026-07-03T11:00:00Z', type: 'cycle_rate', value: 72, unit: 'rpm', source: 'fixed_monitor' },
      { obs_id: 'o002', unit_id: 'u-001', timestamp: '2026-07-03T13:00:00Z', type: 'cycle_rate', value: 69, unit: 'rpm', source: 'fixed_monitor' },
      { obs_id: 'o003', unit_id: 'u-001', timestamp: '2026-07-03T13:00:00Z', type: 'pressure_primary', value: 129, unit: 'torr', source: 'fixed_monitor' },
      { obs_id: 'o004', unit_id: 'u-001', timestamp: '2026-07-03T13:05:00Z', type: 'saturation_pct', value: 97, unit: 'pct', source: 'fixed_monitor' },
    ],
    context: {
      deployment: 'fixed_site', operator_skill: 'engineer',
      time_to_service_min: { self_service: 5, on_site: 5, recovery: 60 },
      connectivity: 'online',
    },
    reference_time: null,
  },
  'Honest failure — no data (M8)': {
    unit_profile: { unit_id: 'u-002' },
    observations: [],
    context: { deployment: 'mobile_platform' },
    reference_time: null,
  },
};

const TIER_COLORS: Record<string, string> = {
  D0: 'bg-emerald-700', D1: 'bg-emerald-600', D2: 'bg-yellow-600',
  D3: 'bg-amber-600', D4: 'bg-orange-600', D5: 'bg-red-600',
};

export default function SentinelDemo() {
  const [input, setInput] = useState(JSON.stringify(PRESETS['Compensated stress (S3/D5)'], null, 2));
  const [output, setOutput] = useState<EngineOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showTrace, setShowTrace] = useState(false);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/sentinel/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: input,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        setOutput(null);
      } else {
        setOutput(data.output);
      }
    } catch (e) {
      setError(String(e));
      setOutput(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-semibold">SENTINEL — evaluation demo</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Deterministic rule-based monitoring &amp; triage engine. Demo content only —
          thresholds and signatures are <span className="text-amber-400">not SME-reviewed placeholders</span>,
          not for operational use.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {Object.keys(PRESETS).map((name) => (
            <button
              key={name}
              className="rounded border border-neutral-700 px-3 py-1 text-sm hover:bg-neutral-800"
              onClick={() => { setInput(JSON.stringify(PRESETS[name], null, 2)); setOutput(null); setError(null); }}
            >
              {name}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div>
            <label className="text-xs uppercase tracking-wide text-neutral-500">Case input</label>
            <textarea
              className="mt-1 h-96 w-full rounded border border-neutral-700 bg-neutral-900 p-3 font-mono text-xs"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              spellCheck={false}
            />
            <button
              className="mt-3 rounded bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
              onClick={run}
              disabled={busy}
            >
              {busy ? 'Evaluating…' : 'Evaluate'}
            </button>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-neutral-500">Engine output</label>
            {error && <div className="mt-2 rounded border border-red-700 bg-red-950 p-3 text-sm">{error}</div>}
            {output && (
              <div className="mt-1 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded px-3 py-1 text-sm font-bold ${TIER_COLORS[output.action_tier] ?? 'bg-neutral-700'}`}>
                    {output.action_tier}
                  </span>
                  <span className="rounded bg-neutral-800 px-3 py-1 text-sm">severity {output.severity}</span>
                  <span className="rounded bg-neutral-800 px-3 py-1 text-sm">trajectory {output.trajectory}</span>
                  <span className={`rounded px-3 py-1 text-sm ${output.confidence === 'insufficient' ? 'bg-red-900' : output.confidence === 'degraded' ? 'bg-amber-900' : 'bg-emerald-900'}`}>
                    confidence {output.confidence}
                  </span>
                  <span className="rounded bg-neutral-800 px-3 py-1 text-sm">recheck in {output.recommended_recheck_min} min</span>
                </div>

                <p className="rounded border border-neutral-800 bg-neutral-900 p-3 text-sm leading-relaxed">
                  {output.explanation}
                </p>

                <div className="text-xs text-neutral-400">
                  <div>matched: {output.matched_signatures.join(', ') || '—'}</div>
                  {output.suppressed_signatures.length > 0 && (
                    <div>suppressed: {output.suppressed_signatures.map((s) => `${s.id} (${s.reason})`).join(', ')}</div>
                  )}
                  {output.not_evaluable_signatures.length > 0 && (
                    <div>not evaluable: {output.not_evaluable_signatures.map((s) => s.id).join(', ')}</div>
                  )}
                  <div className="mt-1">flags: {output.flags.join(', ') || '—'}</div>
                </div>

                <button
                  className="text-xs text-blue-400 hover:underline"
                  onClick={() => setShowTrace(!showTrace)}
                >
                  {showTrace ? 'hide' : 'show'} reasoning trace ({output.reasoning_trace.length} steps)
                </button>
                {showTrace && (
                  <ol className="space-y-1 rounded border border-neutral-800 bg-neutral-900 p-3 font-mono text-xs text-neutral-300">
                    {output.reasoning_trace.map((t, i) => (
                      <li key={i}>
                        <span className="text-blue-400">[{t.stage}]</span> {t.detail}
                      </li>
                    ))}
                  </ol>
                )}
                <div className="text-[10px] text-neutral-600">
                  case {output.case_id} · engine {output.engine_version} · content {output.content_version}
                </div>
              </div>
            )}
            {!output && !error && (
              <div className="mt-2 rounded border border-dashed border-neutral-800 p-6 text-sm text-neutral-500">
                Pick a preset (or edit the JSON) and press Evaluate.
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
