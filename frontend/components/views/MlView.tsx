"use client";

import { useState, type FormEvent } from "react";
import { Button, Callout, ErrorState, Field, inputCls, Loadable, PageHeader, Panel } from "@/components/ui";
import { apiFetch, ApiError, fmt, useApi } from "@/lib/api";

type Metrics = { run_id: string; prediction_enabled: boolean; status_label: string; limitations: string[]; features: string[];
  training_ranges: Record<string, [number, number]>; n_train: number; source_sha256: string; seed: number; created_at: string;
  interval: { level: string; oof_coverage: number };
  metrics: { regression: { target: string; n: number; groups: number; cv: string; models: Record<string, Record<string, number>>; ridge_improvement_vs_dummy: number };
    classification: { target: string; n: number; class_counts: Record<string, number>; models: Record<string, Record<string, number>>; decision: string };
    leakage_review: { features: string[]; forbidden_outcomes_excluded: string[]; passed: boolean; group_split: string };
    gate: { rule: string; passed: boolean } } };
type Pred = { prediction_s: number; interval_80_s: [number, number]; warning: string; run_id: string };

const LABEL: Record<string, string> = { dummy_mean: "Dummy (predict the mean)", ridge: "Ridge regression (deployed)", gbr_depth2: "Gradient boosting, depth 2",
  dummy_prior: "Dummy (class prior)", logistic_balanced: "Logistic regression (balanced)", "rule_xo2_lt_0.175": "Rule: X_O₂ < 0.175 ⇒ Extinction" };

/** Point estimate on its own 80 % interval. The axis spans the interval with margin; nothing else is implied. */
function Estimate({ pred }: { pred: Pred }) {
  const [lo, hi] = pred.interval_80_s;
  const pad = (hi - lo) * 0.25 || 1;
  const a = Math.max(0, lo - pad), b = hi + pad;
  const x = (v: number) => `${((v - a) / (b - a)) * 100}%`;
  return (
    <div className="mt-4 rounded-xl border border-warn/40 bg-warn/[0.05] p-4 text-sm">
      <p>Exploratory estimate: <b className="text-[18px] text-data">{fmt(pred.prediction_s)} s</b>, 80 % interval {fmt(lo)}–{fmt(hi)} s.</p>
      <div className="relative mt-4 h-8" role="img" aria-label={`Estimate ${fmt(pred.prediction_s)} seconds within an 80 percent interval from ${fmt(lo)} to ${fmt(hi)} seconds`}>
        <div className="absolute inset-x-0 top-3 h-px bg-line-strong" />
        <div className="absolute top-1.5 h-3 rounded-full bg-warn/30 ring-1 ring-warn/60" style={{ left: x(lo), width: `calc(${x(hi)} - ${x(lo)})` }} />
        <div className="absolute top-0 h-6 w-0.5 -translate-x-1/2 bg-data" style={{ left: x(pred.prediction_s) }} />
        <span className="absolute top-5 -translate-x-1/2 text-[11px] text-text-3" style={{ left: x(lo) }}>{fmt(lo)} s</span>
        <span className="absolute top-5 -translate-x-1/2 text-[11px] text-text-3" style={{ left: x(hi) }}>{fmt(hi)} s</span>
      </div>
      <p className="mt-3 text-text-3">{pred.warning}</p>
    </div>
  );
}

export default function MlView() {
  const m = useApi<Metrics>("/ml/flex/metrics");
  const [form, setForm] = useState({ fuel: "Methanol", x_o2: "0.21", x_co2: "0", x_he: "0", pressure_atm: "1.0", d0_mm: "3.0" });
  const [pred, setPred] = useState<Pred | null>(null);
  const [err, setErr] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  async function predict(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null); setPred(null);
    try {
      setPred(await apiFetch<Pred>("/ml/flex/predict", { method: "POST", body: JSON.stringify({ ...form,
        x_o2: Number(form.x_o2), x_co2: Number(form.x_co2), x_he: Number(form.x_he), pressure_atm: Number(form.pressure_atm), d0_mm: Number(form.d0_mm) }) }));
    } catch (x) { setErr(x as ApiError); } finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader kicker="Research intelligence" title="Prediction & Modeling"
        lead="Exploratory statistical models trained on NASA experiment rows. A model is released only if it beats a trivial predictor under leakage-safe, grouped validation, and every estimate carries its interval, its training range and its limitations. Nothing here is a validated scientific or safety result."
        sections={[{ id: "card", label: "Model card" }, { id: "metrics", label: "Validation" }, { id: "estimate", label: "Try an estimate" }, { id: "limits", label: "Leakage & limitations" }]} />
      <Loadable state={m} rows={10}>
        {(d) => (
          <div className="flex flex-col gap-5">
            <Panel id="card" tone="feature" title="FLEX burn-time model" aside={<span className={d.prediction_enabled ? "text-warn" : "text-crit"}>{d.prediction_enabled ? "Exploratory, gated" : "Disabled"}</span>}>
              <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
                <div><dt className="text-text-3">Purpose</dt><dd className="mt-1 text-text">Estimate how long an isolated FLEX droplet burns from its initial conditions, to explore trends in the test matrix.</dd></div>
                <div><dt className="text-text-3">Inputs (pre-test only)</dt><dd className="mt-1 text-text">{d.features.join(", ")}</dd></div>
                <div><dt className="text-text-3">Target and data</dt><dd className="mt-1 text-text">{d.metrics.regression.target}; {d.metrics.regression.n} FLEX rows in {d.metrics.regression.groups} atmosphere groups</dd></div>
                <div><dt className="text-text-3">Validation</dt><dd className="mt-1 text-text">{d.metrics.regression.cv}; {d.interval.level} with {fmt(d.interval.oof_coverage * 100)} % out-of-fold coverage</dd></div>
              </dl>
              <p className="mt-4 text-xs text-text-3">Source: NASA FLEX (PSI-69) experimental table, SHA-256 {d.source_sha256.slice(0, 12)}…; run {d.run_id}. No model is offered for BASS-II or SAFFIRE-I.</p>
            </Panel>
            <Callout tone={d.prediction_enabled ? "warn" : "crit"}>
              <b className="text-text">{d.prediction_enabled ? "Prediction enabled (exploratory)." : "Prediction disabled."}</b> Gate: {d.metrics.gate.rule}. Result: {d.metrics.gate.passed ? "passed" : "failed"} (Ridge improves on the dummy by {fmt(d.metrics.regression.ridge_improvement_vs_dummy * 100)} %). {d.status_label}
            </Callout>
            <div id="metrics" className="grid scroll-mt-36 gap-5 xl:grid-cols-2">
              <Panel title="Burn-time regression" aside={`n = ${d.metrics.regression.n}, ${d.metrics.regression.groups} atmosphere groups, ${d.metrics.regression.cv}`}>
                <div className="overflow-x-auto"><table className="data"><thead><tr><th>Model</th><th className="num">MAE log(t)</th><th className="num">MAE (s)</th><th className="num">Median abs. error (%)</th></tr></thead>
                  <tbody>{Object.entries(d.metrics.regression.models).map(([k, v]) => <tr key={k}><td>{LABEL[k] ?? k}</td><td className="num">{fmt(v.mae_log)}</td><td className="num">{fmt(v.mae_s)}</td><td className="num">{fmt(v.median_ape_pct)}</td></tr>)}</tbody></table></div>
                <p className="mt-2 text-xs text-text-3">Target: {d.metrics.regression.target}. Rows: Extinction/Completion with an exact numeric burn time. Gradient boosting scores better but is not deployed, because the transparent linear model is preferred for an exploratory tool.</p>
              </Panel>
              <Panel title="Extinction vs completion (evaluation only)" aside={`n = ${d.metrics.classification.n}`}>
                <div className="overflow-x-auto"><table className="data"><thead><tr><th>Model</th><th className="num">Balanced accuracy</th><th className="num">Macro F1</th></tr></thead>
                  <tbody>{Object.entries(d.metrics.classification.models).map(([k, v]) => <tr key={k}><td>{LABEL[k] ?? k}</td><td className="num">{fmt(v.balanced_accuracy)}</td><td className="num">{fmt(v.macro_f1)}</td></tr>)}</tbody></table></div>
                <p className="mt-2 text-xs text-text-3">Classes: {Object.entries(d.metrics.classification.class_counts).map(([k, v]) => `${k} ${v}`).join(", ")}. Disruption excluded (undefined). {d.metrics.classification.decision}.</p>
              </Panel>
            </div>
            <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
              <Panel id="limits" title="Leakage review and reproducibility">
                <ul className="list-disc pl-5 text-sm text-text-2">
                  <li>Features (pre-test conditions only): {d.metrics.leakage_review.features.join(", ")}.</li>
                  <li>Excluded outcomes: {d.metrics.leakage_review.forbidden_outcomes_excluded.join(", ")} (K, Dext and burn time are algebraically linked by the d²-law).</li>
                  <li>Split: {d.metrics.leakage_review.group_split}, so repeat tests of one atmosphere never sit in both train and test.</li>
                  <li>Uncertainty: {d.interval.level}; out-of-fold coverage {fmt(d.interval.oof_coverage * 100)} %.</li>
                  <li>Run {d.run_id}, seed {d.seed}, source SHA-256 {d.source_sha256.slice(0, 16)}…, built {d.created_at}.</li>
                </ul>
                <h3 className="subhead mt-3 text-[15px]">Limitations</h3>
                <ul className="mt-1 list-disc pl-5 text-sm text-text-2">{d.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
              </Panel>
              <Panel id="estimate" title="Try an exploratory estimate">
                <form onSubmit={predict} className="grid grid-cols-2 gap-2">
                  <Field label="Fuel" htmlFor="mf"><select id="mf" className={inputCls} value={form.fuel} onChange={(e) => setForm({ ...form, fuel: e.target.value })} disabled={!d.prediction_enabled}>
                    <option>Methanol</option><option>Heptane</option></select></Field>
                  {([["x_o2", "Initial O₂ (mole frac.)"], ["x_co2", "Initial CO₂ (mole frac.)"], ["x_he", "Initial He (mole frac.)"], ["pressure_atm", "Pressure (atm)"], ["d0_mm", "D₀ (mm)"]] as const).map(([k, l]) => (
                    <Field key={k} label={l} htmlFor={`m-${k}`}><input id={`m-${k}`} type="number" step="any" className={inputCls} value={form[k]} disabled={!d.prediction_enabled}
                      onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></Field>))}
                  <div className="col-span-2"><Button type="submit" variant="primary" disabled={!d.prediction_enabled || busy}>Estimate burn time</Button></div>
                </form>
                <p className="mt-2 text-xs text-text-3">Training ranges: {Object.entries(d.training_ranges).map(([k, [a, b]]) => `${k} ${fmt(a)}–${fmt(b)}`).join("; ")}. Inputs outside them are refused.</p>
                {err && <div className="mt-3"><ErrorState error={err} /></div>}
                {pred && <Estimate pred={pred} />}
              </Panel>
            </div>
          </div>
        )}
      </Loadable>
    </>
  );
}
