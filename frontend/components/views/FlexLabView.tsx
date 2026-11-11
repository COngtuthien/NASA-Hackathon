"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { FlexMapChart, type FlexPoint } from "@/components/charts";
import { PhenomenonArt } from "@/components/illustrations";
import { MediaFigure, OrbitMediaPanel } from "@/components/media";
import Plot, { baseLayout, CAT, OUTCOME_COLOR } from "@/components/Plot";
import { Callout, Field, inputCls, Loadable, PageHeader, Panel, Prov, Segmented } from "@/components/ui";
import { expHref, fmt, qs, useApi } from "@/lib/api";

type MapResp = { points: FlexPoint[]; excluded: { experiment_uid: string; identifier: string; reason: string }[]; n_total: number;
  n_plotted: number; outcome_by_o2_band: { fuel: string; o2_band: string; n: number; outcomes: Record<string, number> }[];
  correlations: { fuel: string; n: number; pearson_r: number | null }[]; notes: string[] };
type D2Rec = { experiment_uid: string; identifier: string; fuel: string; test_end: string; included: boolean; reasons: string[];
  assumptions: string[]; d0_mm: number | null; d_end_mm?: number; k_mm2_s: number | null; burn_time_s: number | null;
  t_est_s?: number; ratio?: number; outlier?: boolean };
type D2Resp = { formula: string; label: string; summary: Record<string, number | null>; by_fuel: { fuel: string; n: number; median_ratio: number; q10: number; q90: number }[];
  exclusion_reasons: Record<string, number>; records: D2Rec[]; assumptions: string[] };

const OUTCOMES = ["Extinction", "Disruption", "Completion"] as const;

/** Stacked share of recorded outcomes per oxygen band. Segment width = count / n for that band; counts are printed. */
function OutcomeBands({ bands }: { bands: { fuel: string; o2_band: string; n: number; outcomes: Record<string, number> }[] }) {
  return (
    <div className="mt-2">
      <ul className="flex flex-col gap-2.5">
        {bands.map((b) => (
          <li key={b.fuel + b.o2_band}>
            <div className="flex items-baseline justify-between gap-2 text-[13px]">
              <span>{b.fuel} <span className="text-text-3">{b.o2_band}</span></span><span className="text-text-3">n = {b.n}</span>
            </div>
            <div className="mt-1 flex h-2.5 gap-[2px] overflow-hidden rounded-full bg-ink" role="img"
              aria-label={`${b.fuel}, ${b.o2_band}: ${OUTCOMES.map((o) => `${o} ${b.outcomes[o] ?? 0}`).join(", ")} of ${b.n}`}>
              {OUTCOMES.map((o) => (b.outcomes[o] ?? 0) > 0 && (
                <span key={o} title={`${o}: ${b.outcomes[o]}`} className="h-full transition-[flex-grow] duration-500"
                  style={{ flexGrow: b.outcomes[o], flexBasis: 0, background: OUTCOME_COLOR[o] }} />
              ))}
            </div>
            <p className="mt-0.5 text-[12px] text-text-3">{OUTCOMES.map((o) => `${o} ${b.outcomes[o] ?? 0}`).join(", ")}</p>
          </li>
        ))}
      </ul>
      <p className="mt-2 flex flex-wrap gap-3 text-[12px] text-text-2">{OUTCOMES.map((o) => (
        <span key={o} className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2 w-2 rounded-full" style={{ background: OUTCOME_COLOR[o] }} />{o}</span>))}</p>
    </div>
  );
}

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
      <PageHeader kicker="Scientific analysis" title="Flame Extinction & Burning Dynamics"
        lead="Investigating droplet combustion, oxygen availability, burning rates, and extinction behavior in microgravity. Isolated methanol and n-heptane droplets burned aboard the ISS in O₂/N₂ atmospheres diluted with CO₂ or helium. Charts use only rows with the required values; excluded rows are listed with the reason."
        source={{ source: "FLEX", inv: "PSI-69" }}
        art={<MediaFigure id="flex-heptane-soot-composite" eager compact aspect="4 / 3" sizes="(min-width: 768px) 340px, 92vw"
          caption="A burning 3 mm heptane droplet in FLEX aboard the ISS (NASA colorized composite of video frames)." />}
        facts={[
          { value: map.data ? fmt(map.data.n_total) : "…", label: "test rows match these conditions" },
          { value: map.data ? fmt(map.data.n_plotted) : "…", label: "with numeric O₂ and D₀ (plotted)" },
          { value: d2.data ? fmt(d2.data.summary.median_ratio) : "…", label: "median reported ÷ d²-law burn time" },
        ]}
        sections={[{ id: "seen", label: "Seen in orbit" }, { id: "conditions", label: "Conditions" }, { id: "map", label: "Extinction map" }, { id: "d2", label: "d²-law check" }, { id: "ratio", label: "Extinction diameter" }]} />
      <OrbitMediaPanel galleryInv="PSI-69" title="A droplet flame without gravity"
        lead={<>On Earth a droplet flame is pulled upward into a teardrop; aboard the ISS it wraps the droplet in a near-spherical shell. That symmetry is what makes the d²-law check below testable (<a href="/api/v1/documents/2g11-070he-0310/file#page=2" target="_blank" rel="noreferrer">Liu et al., PDF p.2</a>). In FLEX a hot-flame extinction could be followed by low-temperature, &ldquo;cool-flame&rdquo; burning, observed for the first time (<a href="/api/v1/documents/cool-flames-in-space-a-hot-prospect-on-earth/file#page=23" target="_blank" rel="noreferrer">Cool Flames in Space, PDF p.23</a>), one reason a FLEX outcome is not a single number.</>}
        items={[
          { id: "flex-1g-vs-microgravity", fit: "contain", caption: "NASA FLEX comparison: top, the ISS flame (near-spherical, dim blue); bottom, the same kind of flame in 1 g (yellow teardrop)." },
          { id: "flex-heptane-soot-composite", caption: "Soot (green, false colour) forms near the shrinking heptane droplet and spirals out of the flame zone." },
          { id: "flex2-mdca-apparatus", caption: "The droplet apparatus (MDCA) inside the Combustion Integrated Rack, photographed for FLEX-2: the hardware family behind these tests." },
          { id: "cfi-g-cool-flame-video", caption: "Related experiment: a hot flame that dies out and leaves a cool flame too faint to see, the behaviour FLEX found in heptane droplets." },
        ]}
        schematic={{ node: <PhenomenonArt kind="droplet" caption="" />, caption: "Schematic of the idealized geometry the d²-law assumes: a droplet (orange) inside a spherical flame shell. Not to scale; not data." }} />
      <Panel id="conditions" tone="feature" title="Experimental conditions" aside="Every chart and value below follows these selectors">
        <div className="grid gap-4 xl:grid-cols-[auto_auto_1fr]">
          <Segmented label="Fuel" value={filters.fuel ?? ""} onChange={(v) => set("fuel", v)}
            options={[["", "Both fuels"], ["Methanol", "Methanol"], ["Heptane", "n-Heptane"]]} />
          <Segmented label="Diluent" value={filters.diluent ?? ""} onChange={(v) => set("diluent", v)}
            options={[["", "All"], ["CO2", "CO₂ (header 'CO')"], ["He", "Helium"], ["N2-only", "N₂ only"]]} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Pressure band" htmlFor="fp"><select id="fp" className={inputCls} value={filters.pressure_band ?? ""} onChange={(e) => set("pressure_band", e.target.value)}>
              <option value="">All</option><option>~0.7 atm</option><option>~1.0 atm</option><option>~2.0 atm</option><option>2.7-3.1 atm</option></select></Field>
            <Field label="Min initial O₂ (mole fraction)" htmlFor="fo1"><input id="fo1" type="number" step="0.01" className={inputCls} defaultValue={filters.o2_min ?? ""} key={`a${filters.o2_min}`} onBlur={(e) => set("o2_min", e.target.value)} /></Field>
            <Field label="Max initial O₂ (mole fraction)" htmlFor="fo2"><input id="fo2" type="number" step="0.01" className={inputCls} defaultValue={filters.o2_max ?? ""} key={`b${filters.o2_max}`} onBlur={(e) => set("o2_max", e.target.value)} /></Field>
          </div>
        </div>
      </Panel>
      <div className="h-5" />

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
                  <OutcomeBands bands={m.outcome_by_o2_band.filter((b) => b.n)} />
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
