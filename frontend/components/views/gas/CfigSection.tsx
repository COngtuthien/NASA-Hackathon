"use client";

// ACME CFI-G (PSI-159) analysis: every chart is computed by the backend from the 333 processed test points
// (normal and inverse kept apart; FT burn times shown as censored) and the 15 verified Table 3 cool-flame events.
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { Disclosure } from "@/components/disclosure";
import { DocLink, EvidenceTag } from "@/components/evidence-tag";
import Plot, { baseLayout, CAT } from "@/components/Plot";
import { Callout, Field, inputCls, Loadable, Segmented } from "@/components/ui";
import { fmt, qs, useApi } from "@/lib/api";

export type Outcome = "self_extinguished" | "flow_terminated" | "flash_self_extinguished" | "no_hot_ignition_flow_terminated" | "not_ignited";
export type CfigTest = { record_id: string; test_id: string; configuration: "normal" | "inverse"; fuel: string; fuel_raw: string;
  x_o2: number | null; p_bar: number | null; flow_mg_s: number | null; outcome: Outcome; burn_time_s: number | null; censored: boolean;
  cool_flame: string | null; flags: string[]; date: string };
export type CoolFlame = { record_id: string; test_id: string; sub_event: number | null; x_o2: number; x_f: number; p_bar: number;
  m_fuel_mg_s: number; cool_flame_duration_s: number | null; r_hot_mm: number; r_cool_mm: number | null; radius_ratio: number | null;
  page_pdf: number; verification: string; flags: string[] };
type Dist = { configuration: string; fuel: string; n: number; median?: number; q1?: number; q3?: number; min?: number; max?: number; values: number[] };
type FlagRule = { rule_id: string; severity: string; category: string; status: string; n: number; example: string };
export type CfigResp = {
  n_total: number; n_matching: number; facets: { configuration: Record<string, number>; fuel: Record<string, number>; p_bar: number[]; outcome: Record<string, number> };
  outcome_labels: Record<Outcome, string>; outcome_order: Outcome[]; outcome_definitions: Record<Outcome, string>;
  by_fuel: { configuration: string; fuel: string; n: number; outcomes: Partial<Record<Outcome, number>> }[];
  by_condition: { configuration: string; o2_band: string; p_bar: number | null; n: number; outcomes: Partial<Record<Outcome, number>> }[];
  burn_time_se: Dist[]; burn_time_censored: Dist[]; tests: CfigTest[]; cool_flames: CoolFlame[];
  cool_flame_cross_check: { match: boolean; tests: number; events: number };
  test_days: { test_day: string; date: string; round: number; configuration: string; atmospheres: string[]; bottle_printed: string | null;
    hot_flames_ignited: number; csv_test_points: number; csv_hot_ignition_yes: number; page_pdf: number; verification: string }[];
  report_totals: Record<string, number | string>; notes: string[]; flag_rules: FlagRule[];
  report_document: { document_id: string; pages: Record<string, number> };
};

export const OUTCOME_COLOR: Record<Outcome, string> = {
  self_extinguished: CAT[0], flow_terminated: CAT[1], flash_self_extinguished: CAT[2],
  no_hot_ignition_flow_terminated: "#F5C451", not_ignited: "#7F92AD",
};
const FUELS: [string, string][] = [["", "All fuels"], ["ethane", "Ethane"], ["propane", "Propane"], ["n-butane", "n-Butane"]];
const DOC = "psi-159-reports-finalrpt-acme-cfi-g";
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function FlagRules({ rules, limit = 8 }: { rules: FlagRule[]; limit?: number }) {
  return (
    <ul className="flex flex-col gap-2 text-[13.5px]" data-testid="flag-rules">
      {rules.slice(0, limit).map((r) => (
        <li key={r.rule_id} className="border-l-2 border-line-strong/70 pl-3">
          <span className="font-medium text-text">{r.rule_id}</span>
          <span className="ml-2 text-[12px] text-text-3">{r.severity} · {r.status} · {r.n} flag{r.n === 1 ? "" : "s"}</span>
          <p className="text-text-2">{r.example}</p>
        </li>
      ))}
    </ul>
  );
}

function TestLookup({ tests }: { tests: CfigTest[] }) {
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const id = sp.get("test");
  const rec = useApi<{ test_id: string; records: { record_id: string; dataset_id: string; source_file: string; source_table: string;
    page_pdf: number | null; source_row: number | null; verification: string; values: Record<string, unknown>; raw: Record<string, unknown>;
    flags: { rule_id: string; severity: string | null }[] }[] }>(id ? `/gasflames/cfig/test/${encodeURIComponent(id)}` : null);
  const setId = (v: string) => {
    const n = new URLSearchParams(sp.toString());
    if (v) n.set("test", v); else n.delete("test");
    router.replace(`${path}?${n.toString()}#cfig-lookup`, { scroll: false });
  };
  const shown = ["configuration", "fuel_raw", "x_o2_before", "x_o2_supply", "x_f_supply", "x_f_ambient_before", "p_bar", "m_fuel_mg_s",
    "m_o2_mg_s", "hot_ignition", "termination", "outcome", "burn_time_s", "burn_time_censored", "peak_burner_t_c", "color", "cool_flame",
    "comments", "r_hot_mm", "r_cool_mm", "cool_flame_duration_s", "sub_event"];
  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Field label="Test ID" htmlFor="cfig-test">
        <select id="cfig-test" className={inputCls} value={id ?? ""} onChange={(e) => setId(e.target.value)} data-testid="cfig-test-select">
          <option value="">Choose a test…</option>
          {tests.map((t) => <option key={t.record_id} value={t.test_id}>{t.test_id} · {t.configuration} · {t.fuel_raw}</option>)}
        </select>
      </Field>
      <div data-testid="cfig-test-record">
        {!id ? <p className="text-sm text-text-3">Pick a test to see its values exactly as recorded, with the source row and quality flags.</p>
          : <Loadable state={rec} rows={4}>{(d) => (
            <div className="flex flex-col gap-3">
              {d.records.map((r) => (
                <div key={r.record_id} className="rounded-lg border border-line/60 bg-ink/40 p-3 text-[13.5px]">
                  <p className="flex flex-wrap items-center gap-2 font-medium">{r.dataset_id === "cfig_cool_flames" ? "Final report Table 3 event" : "Experimental table row"}
                    <EvidenceTag kind="measured" /></p>
                  <p className="mt-0.5 text-[12.5px] text-text-3">{r.source_file}{r.source_row ? `, row ${r.source_row}` : ""}{r.page_pdf ? `, PDF p.${r.page_pdf}` : ""} · {r.verification.replaceAll("_", " ")}</p>
                  <dl className="mt-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-x-3 gap-y-1">
                    {shown.filter((k) => k in r.values && r.values[k] !== null && r.values[k] !== undefined).map((k) => (
                      <div key={k} className="contents"><dt className="text-text-3">{k.replaceAll("_", " ")}</dt><dd className="text-text">{String(r.values[k])}</dd></div>))}
                  </dl>
                  {r.flags.length > 0 && <p className="mt-2 text-[12.5px] text-warn">Flags: {r.flags.map((f) => f.rule_id).join(", ")}</p>}
                  {Object.keys(r.raw).length > 0 && r.dataset_id === "cfig_tests" && (
                    <details className="mt-2"><summary className="cursor-pointer text-[12.5px] text-text-2">Original CSV cells</summary>
                      <ul className="mt-1 grid gap-0.5 text-[12px]">{Object.entries(r.raw).map(([k, v]) => <li key={k}><span className="text-text-3">{k}:</span> <span className="raw">{String(v)}</span></li>)}</ul></details>)}
                </div>
              ))}
            </div>)}</Loadable>}
      </div>
    </div>
  );
}

export default function CfigSection() {
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const f = { configuration: sp.get("cfg"), fuel: sp.get("fuel"), p_bar: sp.get("p"), o2_min: sp.get("o2min"), o2_max: sp.get("o2max") };
  const data = useApi<CfigResp>(`/gasflames/cfig${qs(f)}`);
  const all = useApi<CfigResp>("/gasflames/cfig");
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp.toString());
    if (v) n.set(k, v); else n.delete(k);
    router.replace(`${path}?${n.toString()}`, { scroll: false });
  };

  const charts = useMemo(() => {
    const d = data.data;
    if (!d) return null;
    const cats = d.by_fuel.map((b) => `${cap(b.configuration)} · ${b.fuel}`);
    const fuelBars = d.outcome_order.map((o) => ({
      type: "bar", orientation: "h", name: d.outcome_labels[o], y: cats, x: d.by_fuel.map((b) => b.outcomes[o] ?? 0),
      marker: { color: OUTCOME_COLOR[o] }, hovertemplate: `%{y}<br>${d.outcome_labels[o]}: %{x}<extra></extra>`,
    }));
    const cfgs = ["normal", "inverse"].filter((c) => d.by_fuel.some((b) => b.configuration === c));
    const cfgTot = cfgs.map((c) => d.by_fuel.filter((b) => b.configuration === c).reduce((s, b) => s + b.n, 0));
    const cfgBars = d.outcome_order.map((o) => {
      const counts = cfgs.map((c) => d.by_fuel.filter((b) => b.configuration === c).reduce((s, b) => s + (b.outcomes[o] ?? 0), 0));
      return { type: "bar", name: d.outcome_labels[o], x: cfgs.map((c, i) => `${cap(c)} (n = ${cfgTot[i]})`),
        y: counts.map((n, i) => (cfgTot[i] ? (100 * n) / cfgTot[i] : 0)), customdata: counts, marker: { color: OUTCOME_COLOR[o] },
        hovertemplate: `%{x}<br>${d.outcome_labels[o]}: %{customdata} (%{y:.0f} %)<extra></extra>` };
    });
    // outcome vs O2 and pressure (each point = one test; small deterministic vertical offset so equal pressures stay readable)
    const scat = d.outcome_order.flatMap((o) => ["normal", "inverse"].map((c) => {
      const pts = d.tests.filter((t) => t.outcome === o && t.configuration === c && t.x_o2 !== null && t.p_bar !== null);
      if (!pts.length) return null;
      return { type: "scatter", mode: "markers", name: `${d.outcome_labels[o]} · ${c}`, legendgroup: o,
        x: pts.map((t) => t.x_o2), y: pts.map((t, i) => (t.p_bar as number) + ((i % 7) - 3) * 0.012),
        text: pts.map((t) => `${t.test_id} (${t.fuel_raw}), p ${fmt(t.p_bar)} bar`), customdata: pts.map((t) => t.test_id),
        hovertemplate: "<b>%{text}</b><br>O₂ %{x:.3f}<extra></extra>",
        marker: { color: OUTCOME_COLOR[o], symbol: c === "normal" ? "circle" : "diamond-open", size: 8, line: { color: "#101E33", width: 1 } } };
    })).filter(Boolean);
    const box = d.burn_time_se.map((b, i) => ({ type: "box", name: `${cap(b.configuration)} · ${b.fuel} (n = ${b.n})`, x: b.values.map(() => `${cap(b.configuration)} · ${b.fuel} (n = ${b.n})`), y: b.values, showlegend: false,
      boxpoints: "all", jitter: 0.4, pointpos: 0, marker: { color: CAT[i % 4], size: 5 }, line: { color: CAT[i % 4] },
      hovertemplate: "%{y:.1f} s<extra>self-extinguished</extra>" }));
    const lab = (c: string, fu: string) => `${cap(c)} · ${fu} (n = ${d.burn_time_se.find((s) => s.configuration === c && s.fuel === fu)?.n ?? 0})`;
    const cens = d.burn_time_censored.length ? [{ type: "scatter", mode: "markers", name: "Flow terminated (FT): censored, still burning",
      x: d.burn_time_censored.flatMap((b) => b.values.map(() => lab(b.configuration, b.fuel))), y: d.burn_time_censored.flatMap((b) => b.values),
      marker: { symbol: "triangle-up-open", size: 8, color: "#F5C451" }, hovertemplate: "%{x}<br>≥ %{y:.1f} s (flow terminated: still burning)<extra></extra>" }] : [];
    return { fuelBars, cfgBars, scat, box, cens, cats };
  }, [data.data]);

  const cool = useMemo(() => {
    const c = all.data?.cool_flames ?? [];
    const lab = c.map((e) => `${e.test_id}${e.sub_event ? `-${e.sub_event}` : ""}`);
    return { lab, data: [
      { type: "bar", name: "Hot-flame radius (mm)", x: lab, y: c.map((e) => e.r_hot_mm), marker: { color: CAT[1] }, hovertemplate: "%{x}<br>hot %{y} mm<extra></extra>" },
      { type: "bar", name: "Cool-flame radius (mm)", x: lab, y: c.map((e) => e.r_cool_mm), marker: { color: CAT[0] },
        hovertemplate: "%{x}<br>cool %{y} mm<extra></extra>" },
    ] };
  }, [all.data]);

  const pOpts = all.data?.facets.p_bar ?? [];
  return (
    <div className="flex flex-col gap-4" data-testid="cfig-section">
      <div className="rounded-xl border border-line/60 bg-panel/50 p-4 text-[14.5px] leading-relaxed text-text-2">
        <p><b className="text-text">What was flown.</b> Spherical diffusion flames on a porous spherical burner aboard the ISS (March–October 2021). In <i>normal</i> flames
          ethane, propane or n-butane flows out of the burner into an O₂/N₂ atmosphere; in <i>inverse</i> flames O₂/N₂ flows out into a fuel/N₂ atmosphere
          (<DocLink id={DOC} page={3}>final report p.3</DocLink>). Each row below is one test point from the PSI-159 experimental tables.</p>
        <p className="mt-2 flex flex-wrap gap-2"><EvidenceTag kind="measured" /> hot ignition, termination, burn time, burner temperature
          <EvidenceTag kind="condition" /> fuel, O₂, pressure, flow <EvidenceTag kind="derived" /> Tad, Zst (investigator-calculated)</p>
      </div>
      <div id="cfig-filters" className="rounded-xl border border-line/60 bg-ink/40 p-4" data-testid="cfig-filters">
        <p className="mb-3 text-[13.5px] text-text-2">Conditions: every CFI-G chart below follows these selectors. Normal and inverse flames are never pooled into one group.</p>
        <div className="grid gap-4 xl:grid-cols-[auto_auto_1fr]">
          <Segmented label="Configuration" value={f.configuration ?? ""} onChange={(v) => set("cfg", v)}
            options={[["", "Both (kept separate)"], ["normal", "Normal"], ["inverse", "Inverse"]]} />
          <Segmented label="Fuel" value={f.fuel ?? ""} onChange={(v) => set("fuel", v)} options={FUELS} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Pressure (bar, approx.)" htmlFor="cfig-p"><select id="cfig-p" className={inputCls} value={f.p_bar ?? ""} onChange={(e) => set("p", e.target.value)} data-testid="cfig-pressure">
              <option value="">All</option>{pOpts.map((p) => <option key={p} value={p}>{p}</option>)}</select></Field>
            <Field label="Min O₂ (mole fraction)" htmlFor="cfig-o1"><input id="cfig-o1" type="number" step="0.01" min="0" max="1" className={inputCls} defaultValue={f.o2_min ?? ""} key={`a${f.o2_min}`} onBlur={(e) => set("o2min", e.target.value)} /></Field>
            <Field label="Max O₂ (mole fraction)" htmlFor="cfig-o2"><input id="cfig-o2" type="number" step="0.01" min="0" max="1" className={inputCls} defaultValue={f.o2_max ?? ""} key={`b${f.o2_max}`} onBlur={(e) => set("o2max", e.target.value)} /></Field>
          </div>
        </div>
        <p className="mt-3 text-[12.5px] text-text-3">O₂ is the ambient O₂ before the test for normal flames and the O₂ fraction in the burner supply for inverse flames.</p>
      </div>
      <Loadable state={data} rows={8}>
        {(d) => (
          <>
            <p className="text-[13px] text-text-3" data-testid="cfig-n">n = {d.n_matching} test points matching of {d.n_total}</p>
            {d.n_matching === 0 ? <Callout tone="warn">No CFI-G test point matches these conditions. Widen the selectors.</Callout> : charts && (
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-xl border border-line/60 bg-panel/40 p-3" data-testid="chart-outcomes-fuel">
                  <h3 className="subhead text-[15px]">Test outcomes by fuel <EvidenceTag kind="measured" /></h3>
                  <Plot data={charts.fuelBars} layout={{ ...baseLayout("Test points (count)", ""), barmode: "stack", margin: { l: 130, r: 12, t: 12, b: 50 } }}
                    height={Math.max(220, 60 + charts.cats.length * 34)} ariaLabel="Stacked bars of CFI-G test outcomes by configuration and fuel" />
                </div>
                <div className="rounded-xl border border-line/60 bg-panel/40 p-3" data-testid="chart-normal-inverse">
                  <h3 className="subhead text-[15px]">Normal vs inverse outcome shares <EvidenceTag kind="measured" /></h3>
                  <Plot data={charts.cfgBars} layout={{ ...baseLayout("", "Share of test points (%)"), barmode: "stack" }} height={300}
                    ariaLabel="Outcome shares for normal and inverse CFI-G flames" />
                  <p className="text-[12px] text-text-3">Shares of the test points in each configuration; test conditions were planned, not sampled, so shares are not probabilities.</p>
                </div>
                <div className="rounded-xl border border-line/60 bg-panel/40 p-3 xl:col-span-2" data-testid="chart-o2-pressure">
                  <h3 className="subhead text-[15px]">Observed outcome vs O₂ and pressure <EvidenceTag kind="measured" /></h3>
                  <Plot data={charts.scat as unknown[]} layout={baseLayout("O₂ mole fraction (ambient for normal, burner supply for inverse)", "Pressure (bar, approx.)")}
                    height={380} ariaLabel="Scatter of CFI-G test outcomes against oxygen mole fraction and pressure" />
                  <p className="text-[12px] text-text-3">One marker per test point (● normal, ◇ inverse). Points at the same pressure are offset by up to ±0.04 bar so they do not hide each other.</p>
                </div>
                <div className="rounded-xl border border-line/60 bg-panel/40 p-3 xl:col-span-2" data-testid="chart-burn-time">
                  <h3 className="subhead text-[15px]">Burn time of self-extinguished flames <EvidenceTag kind="measured" /></h3>
                  <Plot data={[...charts.box, ...charts.cens]} layout={{ ...baseLayout("", "Burn time (s)"), showlegend: true }} height={380}
                    ariaLabel="Box plots of burn time for self-extinguished CFI-G flames with censored flow-terminated times" />
                  <p className="text-[12px] text-text-3">Boxes use self-extinguished (SE) flames only. Yellow triangles are flow-terminated (FT) runs: the flame was still burning when the flow stopped, so those times are lower bounds, never extinction times.</p>
                </div>
              </div>
            )}
          </>
        )}
      </Loadable>
      <Disclosure id="cfig-cool" title={<>Cool diffusion flames (final report Table 3) <EvidenceTag kind="measured" /></>} action="Show the 15 cool-flame events" defaultOpen
        summary={<>Fifteen cool flames were reported, all at one narrow condition: 30 % n-butane, normal flames, 2.03 bar, ~0.39 O₂, 0.75–1.5 mg/s (<DocLink id={DOC} page={44}>p.44</DocLink>). The radii below are measured for that condition only.</>}>
        <Loadable state={all} rows={6}>{(d) => (
          <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
            <div data-testid="chart-cool-radii">
              <Plot data={cool.data} layout={{ ...baseLayout("", "Radius (mm)"), barmode: "group", margin: { l: 56, r: 12, t: 12, b: 110 }, xaxis: { ...baseLayout("", "").xaxis, tickangle: -50, title: { text: "" } } }} height={360}
                ariaLabel="Grouped bars of hot- and cool-flame radius for each cool-flame event" />
              <p className="text-[12px] text-text-3">† 21174D1: cool-flame radius not measured (low camera gain, Table 3 footnote 3), so no cool bar is drawn.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]" data-testid="cool-flame-table">
                <thead><tr className="text-left text-text-3"><th>Event</th><th>O₂</th><th>ṁ (mg/s)</th><th>Duration (s)</th><th>r hot (mm)</th><th>r cool (mm)</th><th>ratio</th></tr></thead>
                <tbody>{d.cool_flames.map((e) => (
                  <tr key={e.record_id} className="border-t border-line/40"><td className="py-1">{e.test_id}{e.sub_event ? `-${e.sub_event}` : ""}{e.test_id === "21174D1" && <sup title="Table 3 footnote 3" aria-label="footnote 3">†</sup>}</td>
                    <td>{e.x_o2}</td><td>{e.m_fuel_mg_s}</td><td>{e.cool_flame_duration_s ?? "–"}</td><td>{e.r_hot_mm}</td><td>{e.r_cool_mm ?? "–"}</td><td>{e.radius_ratio ?? "–"}</td></tr>))}</tbody>
              </table>
              <p className="mt-2 text-[12px] text-text-3">Transcribed from <DocLink id={DOC} page={46}>final report Table 3, PDF p.46</DocLink>; every row verified against the page text. Sub-numbers are successive reignitions within one test. CSV cool-flame flags name the same {d.cool_flame_cross_check.tests} tests: {d.cool_flame_cross_check.match ? "match" : "mismatch"}.</p>
            </div>
          </div>)}</Loadable>
      </Disclosure>
      <Disclosure id="cfig-lookup" title="Look up one test" action="Open the test lookup" anchors={["cfig-lookup"]}
        summary="Every value for a single test exactly as recorded, with its source row and flags.">
        <Loadable state={all} rows={3}>{(d) => <TestLookup tests={d.tests} />}</Loadable>
      </Disclosure>
      <Disclosure id="cfig-counts" title="Report counts vs table rows" action="Compare the counts"
        summary="The final report and the PSI table count flames differently. Both counts are kept; neither is adjusted.">
        <Loadable state={all} rows={4}>{(d) => (
          <div className="grid gap-4 lg:grid-cols-2 text-[14px]" data-testid="cfig-counts">
            <ul className="flex flex-col gap-1">
              <li>Report Tables 1–2: <b className="text-data">{d.report_totals.hot_flames_tables_1_2}</b> hot flames ignited (sustained or momentary, incl. reignitions) <EvidenceTag kind="log" /></li>
              <li>Report text: {d.report_totals.report_text_hot_flames} hot flames, {d.report_totals.report_text_radiative_extinctions} radiative extinctions, {d.report_totals.report_text_cool_flames} cool flames <EvidenceTag kind="report" /></li>
              <li>PSI table: {d.report_totals.csv_rows} test-point rows; hot ignition &lsquo;yes&rsquo; {d.report_totals.csv_hot_ignition_yes}, &lsquo;flash&rsquo; {d.report_totals.csv_flash}; SE {d.report_totals.csv_self_extinguished}; FT {d.report_totals.csv_flow_terminated} <EvidenceTag kind="measured" /></li>
            </ul>
            <p className="text-text-2">{String(d.report_totals.why_counts_differ)} <DocLink id={DOC} page={44}>Report p.44</DocLink></p>
            <div className="lg:col-span-2 overflow-x-auto"><table className="w-full text-[13px]"><thead><tr className="text-left text-text-3"><th>Test day</th><th>Date</th><th>Config.</th><th>Atmospheres (nominal)</th><th>Hot flames (report)</th><th>Rows in table</th></tr></thead>
              <tbody>{d.test_days.map((t) => <tr key={t.test_day} className="border-t border-line/40"><td className="py-1">{t.test_day}</td><td>{t.date}</td><td>{t.configuration}</td><td>{t.atmospheres.join("; ")}</td><td>{t.hot_flames_ignited}</td><td>{t.csv_test_points}</td></tr>)}</tbody></table></div>
          </div>)}</Loadable>
      </Disclosure>
      <Disclosure id="cfig-limits" title="Scientific limitations (CFI-G)" action="Show the limitations"
        summary="What these data cannot tell you, and the quality rules behind each caveat.">
        <Loadable state={all} rows={4}>{(d) => (
          <div className="grid gap-4 lg:grid-cols-2" data-testid="cfig-limitations">
            <ul className="list-disc pl-5 text-[14px] text-text-2">{d.notes.map((n) => <li key={n}>{n}</li>)}
              <li>Outcome shares describe a planned test matrix, not probabilities; no flammability limit is derived here.</li>
              <li>Cool-flame radii are valid only at the Table 3 condition; they are not interpolated to other fuels, pressures or flows.</li></ul>
            <FlagRules rules={d.flag_rules} />
          </div>)}</Loadable>
      </Disclosure>
    </div>
  );
}
