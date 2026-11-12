"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { FlexMapChart, type FlexPoint } from "@/components/charts";
import { PhenomenonArt } from "@/components/illustrations";
import ScienceStudio from "@/components/studio/ScienceStudio";
import { LiteraturePanel, ScientificConclusions } from "@/components/studio/ScienceSummary";
import { SOURCES } from "@/lib/lab-scientific-metadata";
import { MediaFigure, OrbitMediaPanel } from "@/components/media";
import Plot, { baseLayout, CAT, OUTCOME_COLOR } from "@/components/Plot";
import { Disclosure, QualityNotice } from "@/components/disclosure";
import { Callout, Field, inputCls, Loadable, PageHeader, Prov, Segmented } from "@/components/ui";
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

  // lowest initial O₂ at which a methanol test did NOT end in Extinction; all methanol tests below it did
  const methanolLow = useMemo(() => {
    const pts = map.data?.points.filter((p) => p.fuel === "Methanol") ?? [];
    const non = pts.filter((p) => p.test_end !== "Extinction").map((p) => p.x_o2);
    if (!non.length) return null;
    const x = Math.min(...non);
    const below = pts.filter((p) => p.x_o2 < x);
    return below.length && below.every((p) => p.test_end === "Extinction") ? { x, n: below.length } : null;
  }, [map.data]);

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
      <PageHeader kicker="Droplet flames · FLEX" title="Flame Extinction & Burning Dynamics"
        lead={<>Why does a burning droplet make a sphere of flame in orbit, and what makes it go out? FLEX burned single methanol and n-heptane droplets aboard the ISS to find out.</>}
        source={{ source: "FLEX", inv: "PSI-69" }}
        art={<MediaFigure id="flex-heptane-soot-composite" eager compact aspect="4 / 3" sizes="(min-width: 768px) 340px, 92vw"
          caption="A burning 3 mm heptane droplet in FLEX aboard the ISS (NASA colorized composite of video frames)." />}
        sections={[{ id: "studio", label: "3D model" }, { id: "conclusions", label: "Key findings" }, { id: "seen", label: "In orbit" }, { id: "data", label: "Explore the data" }, { id: "literature", label: "Literature" }]} />
      <ScienceStudio sceneId="flex" />
      <div className="h-6" />
      <ScientificConclusions
        findings={[
          { title: "In microgravity a droplet flame can become a near-spherical shell, fed by diffusion rather than rising hot gas.", kind: "DOC",
            detail: "This is the geometry classical droplet-combustion theory assumes, which is why FLEX droplets are a clean test of it.", sources: [SOURCES.liuP2] },
          ...(d2.data && d2.data.summary.median_ratio !== null ? [{ title: <>Reported burn times sit close to the classical d²-law: median ratio {fmt(d2.data.summary.median_ratio)}.</>, kind: "COMPUTED",
            detail: <>Across {d2.data.summary.n_included} tests that meet the check&apos;s criteria; 10th–90th percentile {fmt(d2.data.summary.q10_ratio)}–{fmt(d2.data.summary.q90_ratio)}. A consistency check of reported values, not a prediction.</>,
            sources: [{ label: "d²-law check on this page", href: "#d2" }] }] : []),
          ...(methanolLow ? [{ title: <>Every methanol test below {fmt(methanolLow.x)} initial O₂ ended in extinction.</>, kind: "COMPUTED",
            detail: <>All {methanolLow.n} such tests. Above that level outcomes are mixed, so oxygen alone does not decide the result.</>,
            limits: "FLEX conditions were chosen adaptively, not randomly; this is not a limiting oxygen index.", sources: [{ label: "Extinction map on this page", href: "#map" }] }] : []),
          { title: "Large n-heptane droplets can keep burning as an invisible “cool flame” after the visible flame goes out.", kind: "DOC",
            detail: "Methanol instead shows classical radiative extinction.", sources: [SOURCES.faroukP2] },
        ]}
        notice={<QualityNotice href="/reliability?investigation=PSI-69">Two FLEX column headers are wrong in the source file: burning rate K is labelled ‘mm’ but read as mm²/s, and the CO₂ column is labelled ‘CO’. Values are interpreted, never altered.</QualityNotice>}
        limits={[
          { text: "‘Disruption’ outcomes are not defined in the local documents and may hide a censored result; they are excluded from the d²-law check.", kind: "quality_flag", source: { label: "Data reliability", href: "/reliability?investigation=PSI-69" } },
          { text: "The burning-rate column's header says ‘mm’; values are interpreted as mm²/s (flag FLEX-UNIT-K). The CO₂ column's header reads ‘CO’ (flag FLEX-HDR-CO2).", kind: "quality_flag", source: { label: "FLEX dataset flags", href: "/reliability?investigation=PSI-69" } },
          { text: "FLEX test conditions were chosen adaptively, not randomly, so outcome shares are not probabilities and correlations are descriptive. No limiting oxygen index is derived here.", kind: "COMPUTED", source: { label: "Extinction map notes", href: "#map" } },
          { text: "The 3D studio is conceptual: flame standoff, 1 g shape and the burn timeline are illustrations, not simulations of any test.", kind: "HYPOTHESIS" },
        ]} />
      <div className="h-10" />
      <OrbitMediaPanel galleryInv="PSI-69" title="A droplet flame without gravity"
        lead={<>On Earth a droplet flame is pulled into a teardrop; aboard the ISS it wraps the droplet in a near-spherical shell (<a href="/api/v1/documents/2g11-070he-0310/file#page=2" target="_blank" rel="noreferrer">Liu et al., PDF p.2</a>).</>}
        items={[
          { id: "flex-1g-vs-microgravity", fit: "contain", caption: "Top: the flame aboard the ISS. Bottom: the same kind of flame on Earth (1 g)." },
          { id: "flex-heptane-soot-composite", caption: "Soot (false colour) forming near a shrinking heptane droplet." },
          { id: "cfi-g-cool-flame-video", caption: "Related experiment: a hot flame that leaves an invisible cool flame, as FLEX found in heptane droplets." },
        ]}
        schematic={{ node: <PhenomenonArt kind="droplet" caption="" />, caption: "Schematic of the idealized droplet and flame shell. Not to scale; not data." }} />
      <div className="mt-10 flex flex-col gap-4" id="data">
        <h2 className="subhead text-[22px] md:text-[26px]">Explore the data</h2>
        <p className="-mt-2 max-w-[65ch] text-[15px] text-text-2">The charts behind the findings. Each uses only rows with the values it needs and lists the rows it leaves out.</p>
      <Disclosure id="map" anchors={["conditions"]} level="explore" title="Extinction map: oxygen vs droplet size" action="Explore the extinction map"
        summary={map.data ? <>Where {fmt(map.data.n_plotted)} tests ended in extinction, disruption or completion, by initial O₂ and droplet size. Filter by fuel, diluent and pressure.</> : "Where each test ended, by initial O₂ and droplet size."}>
      <div id="conditions" className="scroll-mt-36 rounded-xl border border-line/60 bg-ink/40 p-4">
        <p className="mb-3 text-[13.5px] text-text-2">Conditions: every chart in this section follows these selectors.</p>
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
      </div>
      <p className="mt-4 text-[13px] text-text-3">{map.data ? `n = ${map.data.n_plotted} plotted of ${map.data.n_total} rows matching filters` : ""}</p>
          <Loadable state={map} rows={8}>
            {(m) => (
              <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
                <div>
                  <FlexMapChart points={m.points} highlight={sp.get("record")} />
                  {sp.get("record")?.startsWith("flex:") && m.points.some((p) => p.experiment_uid === sp.get("record")) && (
                    <p className="mt-1 text-xs text-text-2">The ringed point is the test selected in the 3D studio.</p>)}
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
      </Disclosure>

        <Disclosure id="d2" title="d²-law consistency check" action="Show the d²-law check"
          summary={d2.data ? <>Do reported burn times match the classical d²-law? Median ratio {fmt(d2.data.summary.median_ratio)} across {d2.data.summary.n_included} tests.</> : "Do reported burn times match the classical d²-law?"}>
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
        </Disclosure>

        <Disclosure id="ratio" title="Extinction diameter vs oxygen" action="Show extinction diameters"
          summary={ratioPlot ? <>How large the droplet still was when the visible flame went out, for {ratioPlot.n} extinction tests.</> : "How large the droplet still was when the visible flame went out."}>
          {ratioPlot ? <Plot data={ratioPlot.data} layout={ratioPlot.layout} height={340} ariaLabel="Scatter of extinction diameter ratio versus initial oxygen"
            onPointClick={(u) => router.push(expHref(String(u)))} /> : <Loadable state={map}>{() => null}</Loadable>}
          <p className="mt-2 text-xs text-text-3">For heptane, the visible flame can go out (radiative extinction) while a cool flame keeps burning, so Dext marks the end of the visible flame, not of burning.</p>
        </Disclosure>
      </div>
      <div className="mt-10 flex flex-col gap-5">
        <LiteraturePanel inv="PSI-69" source="FLEX" query="FLEX droplet combustion microgravity extinction" question="What do the NASA FLEX (PSI-69) sources say about droplet flame extinction in microgravity?" />
      </div>
    </>
  );
}
