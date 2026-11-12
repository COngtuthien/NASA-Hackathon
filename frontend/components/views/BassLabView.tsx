"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import Plot, { baseLayout, CAT } from "@/components/Plot";
import { PhenomenonArt } from "@/components/illustrations";
import ScienceStudio from "@/components/studio/ScienceStudio";
import { LiteraturePanel, ScientificConclusions } from "@/components/studio/ScienceSummary";
import { SOURCES } from "@/lib/lab-scientific-metadata";
import { MediaFigure, OrbitMediaPanel } from "@/components/media";
import { Disclosure, QualityNotice } from "@/components/disclosure";
import { Callout, Loadable, PageHeader, Prov, Segmented } from "@/components/ui";
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
  const rec = sp.get("record");
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
    // the test selected in the 3D studio, ringed
    for (const r of pts.filter((x) => x.experiment_uid === rec)) {
      data.push({ type: "scatter", mode: "markers", name: `Selected in the 3D studio: ${r.test_id}`, x: [-(r.delta_o2 as number)], y: [r.delta_co2], customdata: [r.experiment_uid],
        hovertemplate: `<b>${r.test_id}</b> (selected in the studio)<extra></extra>`, marker: { color: "rgba(0,0,0,0)", size: 22, line: { color: "#E6EDF7", width: 2.5 } } });
    }
    return { data, layout: baseLayout("O₂ consumed, initial − final (% by volume, points)", "CO₂ produced, final − initial (% by volume, points)"), n: pts.length };
  }, [g.data, rec]);

  return (
    <>
      <PageHeader kicker="Flame spread · BASS-II" title="Flame Spread & Material Behavior"
        lead="How does a flame creep across a solid when no rising hot gas carries heat ahead of it? BASS-II burned small samples in a controlled airflow aboard the ISS."
        source={{ source: "BASS-II", inv: "PSI-25" }}
        art={<MediaFigure id="bass2-flame-gmt203" eager compact aspect="4 / 3" sizes="(min-width: 768px) 340px, 92vw"
          caption="BASS-II flame over an acrylic slab aboard the ISS, 2014 (NASA)." />}
        sections={[{ id: "studio", label: "3D model" }, { id: "conclusions", label: "Key findings" }, { id: "seen", label: "In orbit" }, { id: "data", label: "Explore the data" }, { id: "literature", label: "Literature" }]} />
      <ScienceStudio sceneId="bass" />
      <div className="h-6" />
      <ScientificConclusions
        findings={[
          { title: "Airflow decides how a flame spreads: less opposed flow means slower spread, until the flame goes out.", kind: "DOC",
            detail: "The same material can spread readily in one flow configuration and go out in another.", sources: [SOURCES.bassP27] },
          ...(g.data && g.data.summary.slope_co2_per_o2_above_resolution !== null ? [{ title: <>The burns made about {fmt(g.data.summary.slope_co2_per_o2_above_resolution)} units of CO₂ per unit of O₂ used.</>, kind: "COMPUTED",
            detail: <>A fitted slope over {g.data.summary.n_fit_above_resolution} tests with an O₂ drop greater than 0.2 percentage points. Complete PMMA combustion would give {fmt(g.data.reference.ratio)}.</>,
            sources: [{ label: "Gas balance on this page", href: "#gas" }] }] : []),
          { title: "Measured spread rates exist only where NASA tracked the flame on video (Summary Report Table 5.1).", kind: "report_table",
            detail: "Each rate belongs to one test and the flow velocity printed beside it.", sources: [{ label: "Spread rate (Table 5.1)", href: "#spread" }] },
        ]}
        notice={<QualityNotice href="#report-trust" linkLabel="See the report cross-checks">Sample widths differ between sources: the CSV gives nominal widths (1 or 2 cm), the report tables actual widths (1.2 or 2.2 cm). Both are kept, never reconciled.</QualityNotice>}
        limits={[
          { text: "Gas values are whole-chamber endpoints (one reading before, one after each burn), not time series; non-numeric cells are kept as recorded.", kind: "experiment", source: { label: "Per-test endpoints", href: "#endpoints" } },
          { text: "Each PI used one material family, geometry and flow direction, so differences between PIs are confounded.", kind: "COMPUTED", source: { label: "Investigator & material", href: "#materials" } },
          { text: "The CSV and the Appendix A log give nominal sample widths (1 or 2 cm); the report tables print actual widths (1.2 or 2.2 cm). Both are kept, and T24's conflict is flagged.", kind: "quality_flag", source: { label: "Report cross-checks", href: "#report" } },
          { text: "The 3D studio's flame front and its timeline are illustrative progressions, not measured flame-front motion.", kind: "HYPOTHESIS" },
        ]} />
      <div className="h-10" />
      <OrbitMediaPanel galleryInv="PSI-25" title="Small samples, controlled airflow"
        lead={<>A fan pushes air past the sample, against the spreading flame (opposed) or with it (concurrent). Less opposed flow means slower spread, until the flame goes out (<a href="/api/v1/documents/bass-ii-summary-report/file#page=27" target="_blank" rel="noreferrer">Summary Report, PDF p.27</a>).</>}
        items={[
          { id: "bass2-msg-operations", caption: "The Microgravity Science Glovebox, where the flow duct is installed." },
          { id: "bass2-flame-gmt213", caption: "A dim, mostly blue flame at reduced oxygen." },
          { id: "bass2-flame-gmt214", caption: "An elongated flame around a rod-shaped sample." },
        ]}
        schematic={{ node: <PhenomenonArt kind="spread" caption="" />, caption: "Schematic of opposed-flow spread. Not to scale; not data." }} />
      <div className="mt-10 flex flex-col gap-4" id="data">
        <h2 className="subhead text-[22px] md:text-[26px]">Explore the data</h2>
        <p className="-mt-2 max-w-[65ch] text-[15px] text-text-2">Oxygen and CO₂ were read once before and once after each burn for the whole ~250 L chamber: endpoints, not time series.</p>
      <Disclosure id="gas" anchors={["materials"]} level="explore" title="Gas balance: oxygen used vs CO₂ made" action="Explore the gas balance"
        summary={g.data ? <>How much CO₂ each burn produced per unit of oxygen it used, by investigator and material ({fmt(g.data.summary.n_total)} tests).</> : "How much CO₂ each burn produced per unit of oxygen it used."}>
      <div id="materials" className="scroll-mt-36 rounded-xl border border-line/60 bg-ink/40 p-4">
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
      </div>
      <Loadable state={g} rows={10}>
        {(d) => (
          <div className="mt-5 flex flex-col gap-5">
            <div>
              <p className="mb-2 text-[13px] text-text-3">{plot ? `n = ${plot.n} tests with both endpoints; ${d.summary.n_excluded_unphysical} excluded as unphysical` : ""}</p>
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
            </div>
          </div>
        )}
      </Loadable>
      </Disclosure>
      <Loadable state={g} rows={3}>
        {(d) => (
            <Disclosure id="endpoints" title="Per-test gas endpoints" action="Show all test endpoints"
              summary={<>The recorded O₂, CO₂ and CO before and after each of {d.records.length} burns, with the airflow history. Non-numeric cells are shown exactly as recorded.</>}>
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
            </Disclosure>
        )}
      </Loadable>
      <Disclosure id="report-tables" anchors={["spread", "outcomes", "report", "report-trust"]} title="NASA Summary Report tables" action="Show the report tables"
        summary="Measured spread rates (Table 5.1), SIBAL fabric outcomes (Table 7.1), the test matrices, and how far report-only values can be trusted.">
        <BassReportSection />
      </Disclosure>
      </div>
      <div className="mt-10 flex flex-col gap-5">
        <LiteraturePanel inv="PSI-25" source="BASS-II" query="BASS-II flame spread microgravity solid" question="What do the NASA BASS-II (PSI-25) sources say about opposed versus concurrent flame spread over solids in microgravity?" />
      </div>
    </>
  );
}
