"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import Plot, { baseLayout, CAT } from "@/components/Plot";
import { PhenomenonArt } from "@/components/illustrations";
import { MediaFigure, OrbitMediaPanel } from "@/components/media";
import { Callout, Loadable, PageHeader, Panel, Prov, Segmented } from "@/components/ui";
import { expHref, fmt, qs, useApi } from "@/lib/api";
import BassReportSection from "@/components/views/BassReportSection";

type Rec = { experiment_uid: string; test_id: string; pi: string; material_class: string; geometry: string; o2_initial: number | null;
  o2_final: number | null; co2_initial: number | null; co2_final: number | null; co_initial: number | null; co_final: number | null;
  delta_o2: number | null; delta_co2: number | null; delta_co: number | null; flags: string[]; raw: Record<string, string>;
  air_raw: string; fan_raw: string; air_tokens: string[]; flow_restrictor: number | null };
type Resp = { summary: Record<string, number | null>; by_material_class: { material_class: string; n: number; slope_co2_per_o2: number | null; median_o2_consumed: number | null }[];
  records: Rec[]; formula: string; reference: { label: string; ratio: number; applies_to: string }; limitations: string[] };

// Four validated hue slots; more classes fold into "Fabric, wax and other". Rod color is a marker shape, not a hue.
const GROUPS: { name: string; match: (c: string) => boolean }[] = [
  { name: "PMMA thin film", match: (c) => c === "PMMA thin film" },
  { name: "PMMA slab", match: (c) => c === "PMMA slab" },
  { name: "PMMA rod or sphere", match: (c) => c.startsWith("PMMA rod") || c.startsWith("PMMA sphere") },
  { name: "Fabric, wax and other", match: () => true },
];

export default function BassLabView() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const pi = sp.get("pi") ?? "";
  const g = useApi<Resp>(`/analytics/bass/gases${qs({ pi })}`);

  const plot = useMemo(() => {
    if (!g.data) return null;
    const pts = g.data.records.filter((r) => r.delta_o2 !== null && r.delta_co2 !== null && !r.flags.includes("o2_unphysical"));
    const used = new Set<string>();
    const data: unknown[] = GROUPS.map((grp, i) => {
      const s = pts.filter((r) => !used.has(r.experiment_uid) && grp.match(r.material_class));
      s.forEach((r) => used.add(r.experiment_uid));
      return { type: "scatter", mode: "markers", name: `${grp.name} (n=${s.length})`, x: s.map((r) => -(r.delta_o2 as number)),
        y: s.map((r) => r.delta_co2), customdata: s.map((r) => r.experiment_uid),
        text: s.map((r) => `${r.test_id}: ${r.material_class}, PI ${r.pi}`),
        hovertemplate: "<b>%{text}</b><br>O₂ consumed %{x:.2f} %-points<br>CO₂ produced %{y:.2f} %-points<extra></extra>",
        marker: { color: CAT[i], size: 9, symbol: s.map((r) => (r.material_class.includes("black") ? "square" : r.material_class.includes("clear") ? "triangle-up" : "circle")),
          line: { color: "#101E33", width: 1.5 } } };
    });
    const xmax = Math.max(1, ...pts.map((r) => -(r.delta_o2 as number)));
    data.push({ type: "scatter", mode: "lines", name: `PMMA complete combustion, slope 5/6`, x: [0, xmax], y: [0, xmax * g.data.reference.ratio],
      line: { color: "#E6EDF7", dash: "dash", width: 1.5 }, hoverinfo: "skip" });
    return { data, layout: baseLayout("O₂ consumed, initial − final (% by volume, points)", "CO₂ produced, final − initial (% by volume, points)"), n: pts.length };
  }, [g.data]);

  return (
    <>
      <PageHeader kicker="Scientific analysis" title="Flame Spread & Material Behavior"
        lead="Exploring how material properties, oxygen consumption, and airflow influence solid-fuel combustion. Small solid samples burned in a flow duct inside the ISS Microgravity Science Glovebox. Oxygen, CO₂ and CO were read once before and once after each burn for the whole ~250 L chamber: these are endpoints, not time series."
        source={{ source: "BASS-II", inv: "PSI-25" }}
        art={<MediaFigure id="bass2-flame-gmt203" eager compact aspect="4 / 3" sizes="(min-width: 768px) 340px, 92vw"
          caption="BASS-II flame over an acrylic slab aboard the ISS, 2014 (NASA)." />}
        facts={[
          { value: g.data ? fmt(g.data.summary.n_total) : "…", label: "tests in this selection" },
          { value: g.data ? fmt(g.data.summary.slope_co2_per_o2_above_resolution) : "…", label: "CO₂ produced per O₂ consumed (fitted slope)" },
          { value: g.data ? fmt(g.data.summary.pmma_stoichiometric_reference) : "…", label: "PMMA complete-combustion reference (5/6)" },
        ]}
        sections={[{ id: "seen", label: "Seen in orbit" }, { id: "materials", label: "Investigator & material" }, { id: "gas", label: "Gas balance" }, { id: "endpoints", label: "Per-test endpoints" }, { id: "spread", label: "Spread rate (Table 5.1)" }, { id: "outcomes", label: "SIBAL outcomes (Table 7.1)" }, { id: "report", label: "Test matrices" }]} />
      <OrbitMediaPanel galleryInv="PSI-25" title="Small samples, controlled airflow"
        lead={<>BASS-II burned small samples, including rods, slabs, thin films and fabric strips, inside a small flow duct in the Microgravity Science Glovebox. A fan pushes air past the sample, against the spreading flame (opposed), with it (concurrent) or, for some rods, head-on (stagnation). The spread rate falls as the opposed flow is reduced, and under some conditions the flame goes out (<a href="/api/v1/documents/bass-ii-summary-report/file#page=27" target="_blank" rel="noreferrer">Summary Report, PDF p.27</a>). The photos show what that looks like; the charts below quantify it.</>}
        items={[
          { id: "bass2-msg-operations", caption: "The Microgravity Science Glovebox, where the BASS-II flow duct is installed and operated through glove ports." },
          { id: "bass2-flame-gmt213", caption: "A dim, mostly blue flame at reduced oxygen: less soot, a weaker flame, closer to extinction." },
          { id: "bass2-flame-gmt214", caption: "An elongated flame around a rod-shaped sample during a reduced-oxygen session." },
        ]}
        schematic={{ node: <PhenomenonArt kind="spread" caption="" />, caption: "Schematic of opposed-flow spread: air (cyan) flows against the flame (orange) moving along the strip. Not to scale; not data." }} />
      <Panel id="materials" tone="feature" title="Investigator and material family" aside="Selection applies to the gas-balance views">
        <div className="flex flex-col gap-3">
          <Segmented label="Principal investigator" value={pi} onChange={(v) => router.replace(`${pathname}${qs({ pi: v })}`, { scroll: false })}
            options={[["", "All PIs"], ...["Bhattacharjee", "Ferkul", "Miller", "Olson", "Fernandez-Pello", "T'ien"].map((p) => [p, p] as [string, string])]} />
          <p className="max-w-[80ch] text-sm text-text-3">Each PI used one material family, geometry and flow direction, so differences between PIs are confounded. Compare within a PI where possible.</p>
          {g.data && (
            <ul className="flex flex-wrap gap-2" aria-label="Material classes in this selection">
              {g.data.by_material_class.map((m) => (
                <li key={m.material_class} className="rounded-full border border-line-strong/80 bg-ink/60 px-3 py-1 text-[13px]">
                  {m.material_class} <span className="text-text-3">n = {m.n}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>
      <div className="h-5" />
      <Loadable state={g} rows={10}>
        {(d) => (
          <div className="flex flex-col gap-5">
            <Panel id="gas" title="Oxygen consumed vs CO₂ produced" aside={plot ? `n = ${plot.n} tests with both endpoints; ${d.summary.n_excluded_unphysical} excluded as unphysical` : undefined}>
              <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
                <div>{plot && <Plot data={plot.data} layout={plot.layout} height={400} ariaLabel="Scatter of oxygen consumed versus CO2 produced per BASS-II test"
                  onPointClick={(u) => router.push(expHref(String(u)))} />}
                  <p className="mt-1 text-xs text-text-3">Marker shape: triangle = clear rod, square = black rod, circle = other. Click a point to open the test.</p></div>
                <div className="text-sm">
                  <h3 className="subhead text-[15px]">Result <Prov kind="COMPUTED" /></h3>
                  <p className="mt-1">Slope ΔCO₂ / O₂ consumed: <b className="text-data">{fmt(d.summary.slope_co2_per_o2_above_resolution)}</b> for {d.summary.n_fit_above_resolution} tests with &gt; 0.2 point O₂ drop
                    (all {d.summary.n_fit}: {fmt(d.summary.slope_co2_per_o2_all)}, Pearson r = {fmt(d.summary.pearson_r)}).</p>
                  <p className="mt-1 text-text-2">Reference: {d.reference.label} gives {fmt(d.reference.ratio)} mol CO₂ per mol O₂; applies to {d.reference.applies_to}.</p>
                  <table className="data mt-3"><thead><tr><th>Material</th><th className="num">n</th><th className="num">Slope</th></tr></thead>
                    <tbody>{d.by_material_class.map((m) => <tr key={m.material_class}><td>{m.material_class}</td><td className="num">{m.n}</td><td className="num">{fmt(m.slope_co2_per_o2)}</td></tr>)}</tbody></table>
                  <p className="mt-1 text-xs text-text-3">Rows with O₂ drop &gt; 0.2 points only. n below ~5 is not meaningful.</p>
                  <p className="mt-2"><span className="raw">{d.formula}</span></p>
                </div>
              </div>
              <div className="mt-4"><Callout><ul className="list-disc pl-5">{d.limitations.map((l) => <li key={l}>{l}</li>)}</ul></Callout></div>
            </Panel>
            <Panel id="endpoints" title="Per-test gas endpoints and flow history" aside={`${d.records.length} tests`}>
              <div className="max-h-[60vh] overflow-auto">
                <table className="data">
                  <thead><tr><th>Test</th><th>Material</th><th className="num">O₂ i→f (%)</th><th className="num">ΔO₂</th><th className="num">CO₂ i→f (%)</th><th className="num">ΔCO₂</th><th className="num">CO i→f (ppm)</th><th>Air display (cm/s, stages as recorded)</th><th>Notes</th></tr></thead>
                  <tbody>{d.records.map((r) => (
                    <tr key={r.experiment_uid}>
                      <td><Link href={expHref(r.experiment_uid)}>{r.test_id}</Link><span className="block text-xs text-text-3">{r.pi}</span></td>
                      <td className="text-sm">{r.material_class}</td>
                      <td className="num">{fmt(r.o2_initial)} → {r.o2_final === null ? <span className="raw">{r.raw.o2_final || "blank"}</span> : fmt(r.o2_final)}</td>
                      <td className="num">{fmt(r.delta_o2)}</td>
                      <td className="num">{fmt(r.co2_initial)} → {r.co2_final === null ? <span className="raw">{r.raw.co2_final || "blank"}</span> : fmt(r.co2_final)}</td>
                      <td className="num">{fmt(r.delta_co2)}</td>
                      <td className="num">{r.co_initial === null ? <span className="raw">{r.raw.co_initial || "blank"}</span> : fmt(r.co_initial)} → {r.co_final === null ? <span className="raw">{r.raw.co_final || "blank"}</span> : fmt(r.co_final)}</td>
                      <td>{r.air_raw ? <span className="raw">{r.air_raw}</span> : <span className="text-text-3">blank</span>}</td>
                      <td className="text-xs text-warn">{r.flags.filter((f) => !f.startsWith("co_not")).join(", ")}</td>
                    </tr>))}</tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-text-3">Non-numeric gas cells (none, OR, over, &gt;500, blank) are shown as recorded and never converted to numbers. Velocity is never inferred from Fan display. Report tables: <Link href={`/evidence?q=${encodeURIComponent("BASS-II Table 5.1")}`}>Table 5.1 (Miller)</Link>, <Link href={`/evidence?q=${encodeURIComponent("Table 7.1 SIBAL")}`}>Table 7.1 (T&apos;ien)</Link>.</p>
            </Panel>
          </div>
        )}
      </Loadable>
      <BassReportSection />
    </>
  );
}
