"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { FlexMapChart, type FlexPoint } from "@/components/charts";
import Plot, { baseLayout, CAT } from "@/components/Plot";
import { Callout, Field, inputCls, Loadable, PageHeader, Panel, Prov } from "@/components/ui";
import { expHref, fmt, qs, useApi } from "@/lib/api";

type MapResp = { points: FlexPoint[]; excluded: { experiment_uid: string; identifier: string; reason: string }[]; n_total: number;
  n_plotted: number; outcome_by_o2_band: { fuel: string; o2_band: string; n: number; outcomes: Record<string, number> }[];
  correlations: { fuel: string; n: number; pearson_r: number | null }[]; notes: string[] };
type D2Rec = { experiment_uid: string; identifier: string; fuel: string; test_end: string; included: boolean; reasons: string[];
  assumptions: string[]; d0_mm: number | null; d_end_mm?: number; k_mm2_s: number | null; burn_time_s: number | null;
  t_est_s?: number; ratio?: number; outlier?: boolean };
type D2Resp = { formula: string; label: string; summary: Record<string, number | null>; by_fuel: { fuel: string; n: number; median_ratio: number; q10: number; q90: number }[];
  exclusion_reasons: Record<string, number>; records: D2Rec[]; assumptions: string[] };

export default function FlexLabView() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const filters = { fuel: sp.get("fuel"), diluent: sp.get("diluent"), pressure_band: sp.get("pressure_band"),
    o2_min: sp.get("o2_min"), o2_max: sp.get("o2_max") };
  const query = qs(filters);
  const map = useApi<MapResp>(`/analytics/flex/map${query}`);
  const d2 = useApi<D2Resp>(`/analytics/flex/d2${query}`);
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp.toString());
    if (v) n.set(k, v); else n.delete(k);
    router.replace(`${pathname}?${n.toString()}`, { scroll: false });
  };

  const d2Plot = useMemo(() => {
    if (!d2.data) return null;
    const inc = d2.data.records.filter((r) => r.included);
    const fuels = ["Methanol", "Heptane"];
    const max = Math.max(1, ...inc.map((r) => Math.max(r.t_est_s ?? 0, r.burn_time_s ?? 0)));
    const data: unknown[] = fuels.map((f, i) => {
      const pts = inc.filter((r) => r.fuel === f);
      return { type: "scatter", mode: "markers", name: `${f} (n=${pts.length})`, x: pts.map((r) => r.t_est_s), y: pts.map((r) => r.burn_time_s),
        customdata: pts.map((r) => r.experiment_uid), text: pts.map((r) => `${r.identifier}, ${r.test_end}`),
        hovertemplate: "<b>%{text}</b><br>d²-law estimate %{x:.2f} s<br>Reported %{y:.2f} s<extra></extra>",
        marker: { color: CAT[i], symbol: i ? "diamond" : "circle", size: 8, line: { color: "#101E33", width: 1.5 },
          opacity: pts.map((r) => (r.outlier ? 1 : 0.8)) } };
    });
    data.push({ type: "scatter", mode: "lines", name: "Equality (ratio 1)", x: [0, max], y: [0, max],
      line: { color: "#7F92AD", dash: "dash", width: 1.5 }, hoverinfo: "skip" });
    return { data, layout: baseLayout("d²-law estimate (D₀² − D_end²)/K (s)", "Reported burn time (s)") };
  }, [d2.data]);

  const ratioPlot = useMemo(() => {
    if (!map.data) return null;
    const pts = map.data.points.filter((p) => p.test_end === "Extinction" && p.dext_over_d0 !== null && p.dext_mm! > 0);
    const data = ["Methanol", "Heptane"].map((f, i) => {
      const s = pts.filter((p) => p.fuel === f);
      return { type: "scatter", mode: "markers", name: `${f} (n=${s.length})`, x: s.map((p) => p.x_o2), y: s.map((p) => p.dext_over_d0),
        customdata: s.map((p) => p.experiment_uid), text: s.map((p) => `${p.identifier}, ${p.diluent}`),
        hovertemplate: "<b>%{text}</b><br>X_O2 %{x:.3f}<br>Dext/D0 %{y:.3f}<extra></extra>",
        marker: { color: CAT[i], symbol: i ? "diamond" : "circle", size: 8, line: { color: "#101E33", width: 1.5 } } };
    });
    return { data, layout: baseLayout("Initial O₂ (mole fraction)", "Visible-flame extinction diameter / D₀ (ratio)"), n: pts.length };
  }, [map.data]);

  return (
    <>
      <PageHeader title="FLEX droplet physics lab"
        lead="Isolated methanol and n-heptane droplets burned on the ISS in O₂/N₂ atmospheres diluted with CO₂ or helium. Charts use only rows with the required values; excluded rows are listed with the reason."
        sections={[{ id: "map", label: "Extinction map" }, { id: "d2", label: "d²-law check" }, { id: "ratio", label: "Extinction diameter" }]} />
      <div className="mb-5 grid gap-3 rounded-lg border border-line bg-panel p-4 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Fuel" htmlFor="ff"><select id="ff" className={inputCls} value={filters.fuel ?? ""} onChange={(e) => set("fuel", e.target.value)}>
          <option value="">Both</option><option>Methanol</option><option>Heptane</option></select></Field>
        <Field label="Diluent" htmlFor="fd"><select id="fd" className={inputCls} value={filters.diluent ?? ""} onChange={(e) => set("diluent", e.target.value)}>
          <option value="">All</option><option value="CO2">CO₂ (header &apos;CO&apos;)</option><option value="He">Helium</option><option value="N2-only">N₂ only</option></select></Field>
        <Field label="Pressure band" htmlFor="fp"><select id="fp" className={inputCls} value={filters.pressure_band ?? ""} onChange={(e) => set("pressure_band", e.target.value)}>
          <option value="">All</option><option>~0.7 atm</option><option>~1.0 atm</option><option>~2.0 atm</option><option>2.7-3.1 atm</option></select></Field>
        <Field label="Min initial O₂ (mole fraction)" htmlFor="fo1"><input id="fo1" type="number" step="0.01" className={inputCls} defaultValue={filters.o2_min ?? ""} key={`a${filters.o2_min}`} onBlur={(e) => set("o2_min", e.target.value)} /></Field>
        <Field label="Max initial O₂ (mole fraction)" htmlFor="fo2"><input id="fo2" type="number" step="0.01" className={inputCls} defaultValue={filters.o2_max ?? ""} key={`b${filters.o2_max}`} onBlur={(e) => set("o2_max", e.target.value)} /></Field>
      </div>

      <div className="flex flex-col gap-5">
        <Panel id="map" title="Extinction map: initial O₂ vs droplet size" aside={map.data ? `n = ${map.data.n_plotted} plotted of ${map.data.n_total} rows matching filters` : undefined}>
          <Loadable state={map} rows={8}>
            {(m) => (
              <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
                <div>
                  <FlexMapChart points={m.points} />
                  <ul className="mt-2 list-disc pl-5 text-xs text-text-3">{m.notes.map((n) => <li key={n}>{n}</li>)}</ul>
                </div>
                <div className="text-sm">
                  <h3 className="subhead text-[15px]">Outcomes by initial O₂ band <Prov kind="COMPUTED" /></h3>
                  <table className="data mt-2"><thead><tr><th>Fuel, band</th><th className="num">n</th><th>Ext / Disr / Comp</th></tr></thead>
                    <tbody>{m.outcome_by_o2_band.filter((b) => b.n).map((b) => (
                      <tr key={b.fuel + b.o2_band}><td>{b.fuel}<span className="block text-xs text-text-3">{b.o2_band}</span></td><td className="num">{b.n}</td>
                        <td>{b.outcomes.Extinction ?? 0} / {b.outcomes.Disruption ?? 0} / {b.outcomes.Completion ?? 0}</td></tr>))}</tbody></table>
                  <h3 className="subhead mt-4 text-[15px]">K vs initial O₂ <Prov kind="COMPUTED" /></h3>
                  <ul className="mt-1">{m.correlations.map((c) => <li key={c.fuel}>{c.fuel}: Pearson r = {fmt(c.pearson_r)} (n = {c.n})</li>)}</ul>
                  <p className="mt-1 text-xs text-text-3">Descriptive correlation; adaptive test design, not a random sample. No limiting oxygen index is derived here.</p>
                  {m.excluded.length > 0 && (
                    <details className="mt-3"><summary className="cursor-pointer text-text-2">{m.excluded.length} rows excluded</summary>
                      <ul className="mt-1 text-xs">{m.excluded.map((x) => <li key={x.experiment_uid}><Link href={expHref(x.experiment_uid)}>{x.identifier}</Link>: {x.reason}</li>)}</ul></details>
                  )}
                </div>
              </div>
            )}
          </Loadable>
        </Panel>

        <Panel id="d2" title="d²-law consistency check" aside={d2.data ? `${d2.data.summary.n_included} included, ${d2.data.summary.n_excluded} excluded` : undefined}>
          <Loadable state={d2} rows={8}>
            {(d) => (
              <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
                <div>
                  <Callout>{d.label}</Callout>
                  <p className="mt-2 text-sm"><span className="raw">{d.formula}</span></p>
                  {d2Plot && <Plot data={d2Plot.data} layout={d2Plot.layout} height={380} ariaLabel="Scatter of d²-law estimated burn time versus reported burn time"
                    onPointClick={(u) => router.push(expHref(String(u)))} />}
                </div>
                <div className="text-sm">
                  <h3 className="subhead text-[15px]">Result <Prov kind="COMPUTED" /></h3>
                  <p className="mt-1">Median reported / estimated time: <b className="text-data">{fmt(d.summary.median_ratio)}</b> (10th–90th percentile {fmt(d.summary.q10_ratio)}–{fmt(d.summary.q90_ratio)}).</p>
                  <p>{d.summary.within_20pct} of {d.summary.n_included} within ±20 %; {d.summary.outliers} outside 0.6–1.5.</p>
                  <ul className="mt-2">{d.by_fuel.map((b) => <li key={b.fuel}>{b.fuel}: median {fmt(b.median_ratio)} (n = {b.n})</li>)}</ul>
                  <h3 className="subhead mt-3 text-[15px]">Exclusions</h3>
                  <ul className="mt-1">{Object.entries(d.exclusion_reasons).map(([k, v]) => <li key={k}>{k}: {v}</li>)}</ul>
                  <h3 className="subhead mt-3 text-[15px]">Assumptions</h3>
                  <ul className="mt-1 list-disc pl-5 text-text-2">{d.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
                  <p className="mt-2"><a href="/api/v1/documents/2g11-070he-0310/file#page=2" target="_blank" rel="noreferrer">d²-law definition, 2G11-070HE-0310 PDF p.2</a></p>
                  <details className="mt-3"><summary className="cursor-pointer text-text-2">Outliers ({d.records.filter((r) => r.outlier).length})</summary>
                    <ul className="mt-1 text-xs">{d.records.filter((r) => r.outlier).map((r) => <li key={r.experiment_uid}><Link href={expHref(r.experiment_uid)}>{r.identifier}</Link>: ratio {fmt(r.ratio)}</li>)}</ul></details>
                </div>
              </div>
            )}
          </Loadable>
        </Panel>

        <Panel id="ratio" title="Extinction diameter relative to D₀ vs oxygen" aside={ratioPlot ? `n = ${ratioPlot.n} Extinction rows with Dext > 0` : undefined}>
          {ratioPlot ? <Plot data={ratioPlot.data} layout={ratioPlot.layout} height={340} ariaLabel="Scatter of extinction diameter ratio versus initial oxygen"
            onPointClick={(u) => router.push(expHref(String(u)))} /> : <Loadable state={map}>{() => null}</Loadable>}
          <p className="mt-2 text-xs text-text-3">For heptane, the visible flame can go out (radiative extinction) while a cool flame keeps burning, so Dext marks the end of the visible flame, not of burning.</p>
        </Panel>
      </div>
    </>
  );
}
