"use client";

// ACME Flame Design (PSI-10, conditions only) and ACME BRE (PSI-20, day log + report findings) sections.
import { useMemo, useState } from "react";
import { Disclosure } from "@/components/disclosure";
import { DocLink, EvidenceTag } from "@/components/evidence-tag";
import Plot, { baseLayout, CAT } from "@/components/Plot";
import { Callout, Loadable, Segmented } from "@/components/ui";
import { useApi } from "@/lib/api";
import { FlagRules } from "@/components/views/gas/CfigSection";

type Finding = { id: string; text: string; page_pdf: number; kind: string; values?: { variable: string; value: number | number[]; unit: string }[] };
type FdPoint = { test_id: string; configuration: string; fuel: string; zst: number; tad_k: number; p_atm: number | null; x_o2: number | null; m_total_mg_s?: number | null };
type FdResp = { n_total: number; n_plotted: number; excluded: Record<string, number>; points: FdPoint[]; cfig_points: FdPoint[];
  facets: { configuration: Record<string, number>; fuel: Record<string, number> };
  test_days: { test_day: string; date: string; round: number; configuration: string; burner_printed: string | null; reactant_bottle_printed: string | null;
    atmosphere: string; flames_ignited: number; csv_test_points: number; page_pdf: number }[];
  totals: Record<string, number>; findings: Finding[]; notes: string[];
  flag_rules: { rule_id: string; severity: string; category: string; status: string; n: number; example: string }[] };

const FD_DOC = "psi-10-reports-finalrpt-acmeflamedesign";

export function FlameDesignSection() {
  const d = useApi<FdResp>("/gasflames/flame-design");
  const [overlay, setOverlay] = useState("fd");
  const [cfg, setCfg] = useState("");
  const plot = useMemo(() => {
    if (!d.data) return null;
    const keep = (p: FdPoint) => !cfg || p.configuration === cfg;
    const series: unknown[] = ["normal", "inverse"].flatMap((c, i) => {
      const pts = d.data!.points.filter((p) => p.configuration === c && keep(p));
      return pts.length ? [{ type: "scatter", mode: "markers", name: `Flame Design · ${c} (n = ${pts.length})`, x: pts.map((p) => p.zst), y: pts.map((p) => p.tad_k),
        text: pts.map((p) => `${p.test_id} · ${p.fuel} · ${p.p_atm?.toFixed(2) ?? "?"} atm`), hovertemplate: "<b>%{text}</b><br>Zst %{x:.3f}<br>Tad %{y:.0f} K<extra></extra>",
        marker: { color: CAT[i], symbol: c === "normal" ? "circle" : "diamond", size: 8, line: { color: "#101E33", width: 1 } } }] : [];
    });
    if (overlay === "both") {
      ["normal", "inverse"].forEach((c, i) => {
        const pts = d.data!.cfig_points.filter((p) => p.configuration === c && keep(p));
        if (pts.length) series.push({ type: "scatter", mode: "markers", name: `CFI-G · ${c} (n = ${pts.length})`, x: pts.map((p) => p.zst), y: pts.map((p) => p.tad_k),
          text: pts.map((p) => `${p.test_id} · ${p.fuel} · ${p.p_atm?.toFixed(2) ?? "?"} atm`), hovertemplate: "<b>%{text}</b> (CFI-G)<br>Zst %{x:.3f}<br>Tad %{y:.0f} K<extra></extra>",
          marker: { color: CAT[i], symbol: c === "normal" ? "circle-open" : "diamond-open", size: 8 } });
      });
    }
    return series;
  }, [d.data, overlay, cfg]);
  return (
    <div className="flex flex-col gap-4" data-testid="fd-section">
      <div className="rounded-xl border border-line/60 bg-panel/50 p-4 text-[14.5px] leading-relaxed text-text-2">
        <p><b className="text-text">What was flown.</b> Spherical ethylene flames on a 0.25-inch porous sintered sphere, normal (fuel out, April–July 2019) and inverse
          (O₂/N₂ out into C₂H₄/N₂, October 2021–February 2022), plus one propane day used to calibrate thin-filament pyrometry (<DocLink id={FD_DOC} page={3}>final report p.3</DocLink>, <DocLink id={FD_DOC} page={24}>Table 1 p.24</DocLink>).
          The aim: separate soot formation and extinction from flame temperature by controlling the stoichiometric mixture fraction Zst.</p>
      </div>
      <Callout tone="warn"><span data-testid="fd-missing-outcomes"><b>Conditions only.</b> The PSI-10 experimental tables record test conditions, not results: there is no ignition, burn time, flame size,
        soot or extinction column. The findings below are the authors&apos; published results, quoted with their page; they are not computed from these tables.</span></Callout>
      <Loadable state={d} rows={8}>{(x) => (
        <>
          <div className="rounded-xl border border-line/60 bg-panel/40 p-3" data-testid="chart-fd-conditions">
            <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
              <h3 className="subhead text-[15px]">Condition space: adiabatic flame temperature vs stoichiometric mixture fraction <EvidenceTag kind="condition" /> <EvidenceTag kind="derived" /></h3>
              <div className="flex flex-wrap gap-3">
                <Segmented label="Configuration" value={cfg} onChange={setCfg} options={[["", "Both"], ["normal", "Normal"], ["inverse", "Inverse"]]} />
                <Segmented label="Compare with CFI-G" value={overlay} onChange={setOverlay} options={[["fd", "Flame Design only"], ["both", "Add CFI-G conditions"]]} />
              </div>
            </div>
            {plot && <Plot data={plot} layout={baseLayout("Stoichiometric mixture fraction Zst (–)", "Adiabatic flame temperature Tad (K)")} height={400}
              ariaLabel="Scatter of Flame Design test conditions, Tad against Zst" />}
            <p className="text-[12px] text-text-3">{x.n_plotted} of {x.n_total} Flame Design test points plotted; {Object.entries(x.excluded).map(([k, v]) => `${v} marked ${k}`).join(", ")} (ramped flows, no single value) are excluded, not deleted.
              Tad and Zst were calculated by the investigators. CFI-G and Flame Design share the ACME burner type; this chart compares conditions only, never outcomes. Pressure is in atm here and bar in CFI-G (converted for hover text).</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-line/60 bg-panel/40 p-4" data-testid="fd-findings">
              <h3 className="subhead text-[15px]">Published findings <EvidenceTag kind="report" /></h3>
              <ul className="mt-2 flex flex-col gap-2 text-[14px] text-text-2">{x.findings.map((f) => (
                <li key={f.id} className="border-l-2 border-line-strong/70 pl-3">{f.text} <DocLink id={FD_DOC} page={f.page_pdf}>(p.{f.page_pdf})</DocLink></li>))}</ul>
            </div>
            <div className="rounded-xl border border-line/60 bg-panel/40 p-4">
              <h3 className="subhead text-[15px]">Flames ignited per test day <EvidenceTag kind="log" /></h3>
              <p className="text-[13px] text-text-3">Table 1 total {x.totals.table1_flames} (round 1: {x.totals.table1_round1}; round 2: {x.totals.table1_round2}); the PSI tables hold {x.totals.csv_test_points} test points.</p>
              <div className="mt-2 max-h-[300px] overflow-auto"><table className="w-full text-[13px]"><thead><tr className="text-left text-text-3"><th>Day</th><th>Date</th><th>Config.</th><th>Atmosphere</th><th>Flames</th></tr></thead>
                <tbody>{x.test_days.map((t) => <tr key={t.test_day} className="border-t border-line/40"><td className="py-1">{t.test_day}</td><td>{t.date}</td><td>{t.configuration}</td><td>{t.atmosphere}</td><td>{t.flames_ignited}</td></tr>)}</tbody></table></div>
            </div>
          </div>
          <Disclosure id="fd-limits" title="Scientific limitations (Flame Design)" action="Show the limitations" summary="Why no outcome chart is shown for Flame Design.">
            <div className="grid gap-4 lg:grid-cols-2"><ul className="list-disc pl-5 text-[14px] text-text-2">{x.notes.map((n) => <li key={n}>{n}</li>)}</ul><FlagRules rules={x.flag_rules} /></div>
          </Disclosure>
        </>)}</Loadable>
    </div>
  );
}

type BreResp = { test_days: { test_day: string; date: string; round: number; burner_mm: number; fuel_bottle: string; fuel: string; fuel_pct: number; o2_pct: number[];
    flames_ignited: number; page_pdf: number; verification: string; flags: string[]; csv?: { row: number; date: string; o2: string } }[];
  totals: Record<string, number | string>; findings: Finding[]; literature: { material: string; lhv_kj_g: number; l_kj_g: number[]; page_pdf: number }[];
  conflicts: { rule_id: string; description: string }[]; notes: string[] };
const BRE_DOC = "bre-final-report-20220201";

export function BreSection() {
  const d = useApi<BreResp>("/gasflames/bre");
  const chart = useMemo(() => {
    if (!d.data) return null;
    const groups: [string, string][] = [["100% C2H4", CAT[1]], ["50% C2H4", CAT[2]], ["100% CH4", CAT[0]]];
    return groups.map(([g, c]) => {
      const rows = d.data!.test_days.filter((t) => t.fuel_bottle === g);
      return { type: "bar", name: `${g.replace("C2H4", "C₂H₄").replace("CH4", "CH₄")} (balance N₂)`, x: rows.map((t) => `${t.test_day} (${t.burner_mm} mm)`),
        y: rows.map((t) => t.flames_ignited), marker: { color: c }, text: rows.map((t) => `O₂ ≈ ${t.o2_pct.join(", ")} %`),
        hovertemplate: "<b>%{x}</b><br>%{y} flames<br>%{text}<extra></extra>" };
    });
  }, [d.data]);
  return (
    <div className="flex flex-col gap-4" data-testid="bre-section">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-line/60 bg-panel/50 p-4 text-[14.5px] leading-relaxed text-text-2">
          <p><b className="text-text">What a burning-rate emulator is.</b> A flat porous burner (25 or 50 mm) feeds a gaseous fuel diluted with nitrogen through its surface.
            The gas mixture&apos;s heat of combustion stands in for a solid or liquid fuel, and the heat flux measured at the burner surface is used to infer the heat of
            gasification such a material would need to keep burning (<DocLink id={BRE_DOC} page={4}>final report pp.3–5</DocLink>).</p>
          <p className="mt-2"><b className="text-text">Why it matters for spacecraft.</b> Stopping ventilation is a standard step against a spacecraft fire. BRE asked whether flat
            materials can keep burning in still air in microgravity, including in the elevated-oxygen, reduced-pressure atmospheres proposed for exploration vehicles.</p>
        </div>
        <Callout tone="warn"><span data-testid="bre-limits-callout"><b>Emulation, not a material test.</b> BRE burns gas, not PMMA or any other material; the authors&apos; statement that a test
          &ldquo;could represent PMMA&rdquo; is an emulation analogy. BRE does not measure flame-spread rates and is not a validated flammability classifier. The download has no per-test measurements, only the day log and the report.</span></Callout>
      </div>
      <Loadable state={d} rows={8}>{(x) => (
        <>
          <div className="rounded-xl border border-line/60 bg-panel/40 p-3" data-testid="chart-bre-days">
            <h3 className="subhead text-[15px]">Test campaign: flames ignited per test day <EvidenceTag kind="log" /></h3>
            {chart && <Plot data={chart} layout={{ ...baseLayout("Test day (YYDDD, burner diameter)", "Flames ignited"), barmode: "group" }} height={340}
              ariaLabel="Bar chart of BRE flames ignited per test day by fuel bottle" />}
            <p className="text-[12px] text-text-3">Total {x.totals.table1_flames} flames (round 1, Feb–Apr 2019: {x.totals.round1}; round 2, Sept 2020–Jan 2021: {x.totals.round2}), from final report Table 1 (<DocLink id={BRE_DOC} page={24}>p.24</DocLink>). 19091: no flames, the igniter tip had failed.</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-line/60 bg-panel/40 p-4" data-testid="bre-findings">
              <h3 className="subhead text-[15px]">Reported results <EvidenceTag kind="report" /></h3>
              <ul className="mt-2 flex flex-col gap-2 text-[14px] text-text-2">{x.findings.map((f) => (
                <li key={f.id} className="border-l-2 border-line-strong/70 pl-3">{f.text} <DocLink id={BRE_DOC} page={f.page_pdf}>(p.{f.page_pdf})</DocLink></li>))}</ul>
              <p className="mt-2 text-[12.5px] text-text-3">The authors describe these results as preliminary; flammability maps exist only as figures in the report.</p>
            </div>
            <div className="rounded-xl border border-line/60 bg-panel/40 p-4">
              <h3 className="subhead text-[15px]">Day log, with the PSI table&apos;s differences <EvidenceTag kind="log" /></h3>
              <div className="mt-2 max-h-[320px] overflow-auto"><table className="w-full text-[13px]" data-testid="bre-day-table"><thead><tr className="text-left text-text-3"><th>Day</th><th>Date (report)</th><th>Burner</th><th>Fuel</th><th>O₂ %</th><th>Flames</th></tr></thead>
                <tbody>{x.test_days.map((t) => <tr key={t.test_day} className="border-t border-line/40"><td className="py-1">{t.test_day}</td>
                  <td>{t.date}{t.csv && t.csv.date !== t.date && <span className="block text-[11.5px] text-warn">PSI CSV: {t.csv.date}</span>}</td>
                  <td>{t.burner_mm} mm</td><td>{t.fuel_bottle}</td><td>{t.o2_pct.join(", ")}{t.csv && t.csv.o2.endsWith("00%") && <span className="block text-[11.5px] text-warn">CSV cell: {t.csv.o2}</span>}</td><td>{t.flames_ignited}</td></tr>)}</tbody></table></div>
              <p className="mt-2 text-[12px] text-text-3">The report table is used; the PSI CSV&apos;s two different dates and two percent-format cells are shown, not silently replaced.</p>
            </div>
          </div>
          <Disclosure id="bre-literature" title={<>Materials near BRE heats of combustion <EvidenceTag kind="literature" /></>} action="Show the literature values"
            summary="Literature values quoted in the BRE report (Table 2, p.29) to relate emulated flames to real materials. These are not BRE measurements.">
            <table className="w-full max-w-xl text-[13.5px]" data-testid="bre-literature"><thead><tr className="text-left text-text-3"><th>Material</th><th>Lower heating value (kJ/g)</th><th>Heat of gasification (kJ/g)</th></tr></thead>
              <tbody>{x.literature.map((l) => <tr key={l.material} className="border-t border-line/40"><td className="py-1">{l.material}</td><td>{l.lhv_kj_g}</td><td>{l.l_kj_g.join(", ")}</td></tr>)}</tbody></table>
          </Disclosure>
        </>)}</Loadable>
    </div>
  );
}
