"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Plot, { baseLayout, CAT } from "@/components/Plot";
import { PhenomenonArt } from "@/components/illustrations";
import ScienceStudio from "@/components/studio/ScienceStudio";
import { LiteraturePanel, ScientificConclusions } from "@/components/studio/ScienceSummary";
import { SOURCES } from "@/lib/lab-scientific-metadata";
import { MediaFigure, SchematicFigure } from "@/components/media";
import { usePauseOffscreen } from "@/components/motion";
import { Disclosure } from "@/components/disclosure";
import { AskSuggestions } from "@/components/ask-suggestions";
import { Term } from "@/components/glossary";
import { ScientificNotice } from "@/components/scientific-notice";
import { NOTICES } from "@/lib/scientific-notices";
import { Field, inputCls, Loadable, PageHeader, Prov, Severity } from "@/components/ui";
import { expHref, fmt, useApi } from "@/lib/api";

type Manifest = { set_label: string; camera: string; frames: number; start_utc: string; end_utc: string; duration_s: number;
  median_dt_ms: number; max_gap_ms: number; jpeg_received: number; jpeg_corrupt: number; zips_listed: number; zips_received: number; received_pct: number };
type Case = {
  burns: Record<string, unknown>[]; comparison: { field: string; label: string; unit: string | null; S1: unknown; S2: unknown; same: boolean }[];
  image_sets: { label: string; csv_description: string; csv_role: string; documented_role: string }[]; manifest: Manifest[];
  quality_flags: { flag_id: string; rule_id: string; severity: string; description: string; evidence_ref: string | null; status: string }[];
  publications: { title: string; authors: string | null; doi: string | null }[]; statements: { kind: string; text: string }[];
  campaign_window: { start_utc: string; end_utc: string };
};
type Timeline = { bin_s: number; series: { key: string; set_label: string; camera: string; bins: { bin_start_s: number; bin_start_utc: string; frames: number; received: number; corrupt: number }[]; missing: number[] }[]; note: string };

function FlowCard({ burn }: { burn: Record<string, unknown> }) {
  const dir = String(burn.flow_direction ?? "");
  const concurrent = dir.toLowerCase().startsWith("concurrent");
  const ref = usePauseOffscreen<HTMLDivElement>();
  return (
    <div ref={ref} className="flex items-center gap-5 rounded-xl border border-line/80 bg-ink/50 p-4">
      <svg viewBox="0 0 120 160" className="h-36 w-28 shrink-0" role="img"
        aria-label={`${String(burn.sample)}: ${dir} flame spread, airflow ${fmt(burn.air_flow_cm_s)} centimetres per second`}>
        <rect x="34" y="12" width="52" height="136" rx="2" className="fill-raised stroke-line-strong" />
        {[18, 102].map((x) => (
          <g key={x}>
            <line x1={x} y1="152" x2={x} y2="16" className="anim-flow stroke-data" strokeWidth="1.6" strokeDasharray="5 5" />
            <path d="M0 0 L-6 -4 L-6 4 Z" className="fill-data" transform={`translate(${x} 12) rotate(-90)`} />
          </g>
        ))}
        <rect x="34" y={concurrent ? 104 : 12} width="52" height="44" className="fill-flame" opacity="0.18" />
        <path d={concurrent ? "M34 104 C 46 96 54 108 60 98 C 66 108 76 96 86 104" : "M34 56 C 46 64 54 52 60 62 C 66 52 76 64 86 56"} fill="none" className="stroke-flame" strokeWidth="2.5" />
        <line x1="60" y1={concurrent ? 92 : 68} x2="60" y2={concurrent ? 64 : 96} className="stroke-ember" strokeWidth="2" />
        <path d="M0 0 L-7 -4 L-7 4 Z" className="fill-ember" transform={concurrent ? "translate(60 60) rotate(-90)" : "translate(60 100) rotate(90)"} />
      </svg>
      <dl className="text-sm">
        <dt className="text-text-3">Burn</dt><dd className="subhead text-[20px]"><Link href={expHref(String(burn.experiment_uid))}>{String(burn.sample)}</Link></dd>
        <dt className="mt-2 text-text-3">Flame spread vs airflow</dt><dd className="text-text">{dir || "not recorded"}</dd>
        <dt className="mt-2 text-text-3">Air flow (CSV)</dt><dd className="text-text">{fmt(burn.air_flow_cm_s)} cm/s</dd>
        <dt className="mt-2 text-text-3">Burn time (CSV)</dt><dd className="text-text">{fmt(burn.burn_time_s)} s</dd>
      </dl>
    </div>
  );
}

const SET_LABEL: Record<string, string> = { BIT: "Built-in test", PreFlowVis: "F1 flow visualization", Sample1: "S1 burn (concurrent)", Sample2: "S2 burn (opposed)", PostFlowVis: "F2 flow visualization" };

/** Saffire-I hardware as NASA photographed it. NASA's burn footage lives in the studio's "NASA footage" view (#footage). */
function SaffireHardware() {
  return (
    <section id="hardware" aria-labelledby="hardware-title" className="hairline-top scroll-mt-36 rounded-2xl border border-line/80 bg-[linear-gradient(170deg,var(--tint-warm),color-mix(in_srgb,var(--panel)_92%,transparent)_45%)] p-4 md:p-6">
      <p className="kicker">NASA hardware</p>
      <h2 id="hardware-title" className="subhead mt-2 text-[22px] md:text-[26px]">The flight unit that held the first large-scale spacecraft fire</h2>
      <p className="mt-2 max-w-[80ch] text-[15px] leading-relaxed text-text-2">
        A hot wire ignited the fabric inside this closed unit on 14 June 2016. NASA&apos;s footage of the burn is in the 3D studio&apos;s <a href="#footage">NASA footage</a> view.
      </p>
      <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <MediaFigure id="saffire1-preflight-ceit" aspect="4 / 3" compact sizes="(min-width: 1280px) 30vw, (min-width: 640px) 45vw, 92vw"
          caption="Saffire-I before flight, during the OA-6 crew equipment interface test at Kennedy Space Center." />
        <MediaFigure id="saffire1-hardware-cygnus" aspect="4 / 3" compact sizes="(min-width: 1280px) 30vw, (min-width: 640px) 45vw, 92vw"
          caption="The flight unit in Cygnus. The sheet burned inside this box, not in the open cabin." />
        <SchematicFigure caption="Schematic of the sample sheet with airflow (cyan) and a spreading flame (orange). Not to scale; S1 burned in concurrent and S2 in opposed flow (CSV).">
          <PhenomenonArt kind="spacecraft" caption="" />
        </SchematicFigure>
      </div>
    </section>
  );
}

export default function SaffireView() {
  const cs = useApi<Case>("/analytics/saffire/case");
  const [bin, setBin] = useState(30);
  const [set, setSet] = useState("Sample1");
  const tl = useApi<Timeline>(`/analytics/saffire/timeline?bin_s=${bin}&set_label=${set}`);

  const plot = useMemo(() => {
    if (!tl.data) return null;
    const data: unknown[] = [];
    // Camera bins start a few ms apart, so Plotly's automatic bar width collapses to a hairline.
    // Explicit widths (ms on a date axis): each camera gets its own half of the bin, starting at the bin start.
    const binMs = tl.data.bin_s * 1000;
    tl.data.series.forEach((s, i) => {
      const geo = { width: binMs * 0.44, offset: binMs * (i === 0 ? 0.04 : 0.52) };
      data.push({ type: "bar", name: `${s.camera} listed`, x: s.bins.map((b) => b.bin_start_utc), y: s.bins.map((b) => b.frames), ...geo,
        marker: { color: "rgba(0,0,0,0)", line: { color: CAT[i], width: 1.5 } },
        hovertemplate: `${s.camera}<br>%{x}<br>Listed frames %{y}<extra></extra>` });
      data.push({ type: "bar", name: `${s.camera} received`, x: s.bins.map((b) => b.bin_start_utc), y: s.bins.map((b) => b.received), ...geo,
        marker: { color: CAT[i], line: { color: "#101E33", width: 1 } },
        hovertemplate: `${s.camera}<br>%{x}<br>Received JPEGs %{y}<extra></extra>` });
    });
    return { data, layout: baseLayout("UTC time, 2016-06-14", `JPEG frames per ${tl.data.bin_s} s bin (count)`, { barmode: "overlay" }) };
  }, [tl.data]);

  return (
    <>
      <PageHeader kicker="Spacecraft fire · SAFFIRE-I" title="Spacecraft Fire Dynamics"
        lead="What happens when a large fire is lit inside a real spacecraft? In June 2016 NASA burned a fabric sheet aboard an uncrewed Cygnus cargo vehicle to find out."
        source={{ source: "SAFFIRE-I", inv: "PSI-98" }}
        art={<MediaFigure id="saffire1-hardware-cygnus" eager compact aspect="4 / 3" sizes="(min-width: 768px) 340px, 92vw"
          caption="The Saffire-I flight unit strapped inside the Cygnus cargo module (NASA)." />}
        sections={[{ id: "studio", label: "3D model & footage" }, { id: "conclusions", label: "Key findings" }, { id: "hardware", label: "Hardware" }, { id: "data", label: "Explore the data" }, { id: "literature", label: "Literature" }]} />
      <ScienceStudio sceneId="saffire" />
      <div className="h-6" />
      <Loadable state={cs} rows={10}>
        {(c) => (
          <div className="flex flex-col gap-5">
            <ScientificConclusions
              findings={[
                { title: "Saffire-I was the first large-scale fire run in a spacecraft in microgravity.", kind: "DOC",
                  detail: "A cotton-fiberglass sheet about 0.4 m wide by 0.94 m tall burned in a flow duct aboard Cygnus after it left the space station: the first of three Saffire flights.", sources: [SOURCES.saffireOps] },
                { title: <>The two recorded burns spread in opposite directions in the same {fmt(c.burns[0]?.air_flow_cm_s)} cm/s airflow.</>, kind: "experiment",
                  detail: <>S1 spread with the air (burn time {fmt(c.burns.find((b) => b.sample === "S1")?.burn_time_s)} s); S2 against it ({fmt(c.burns.find((b) => b.sample === "S2")?.burn_time_s)} s).</>,
                  limits: "Two burns with different flow directions: their burn times are not a material property.", sources: [{ label: "S1 vs S2 on this page", href: "#compare" }] },
                { title: "NASA's footage shows the flame front moving along the sample.", kind: "DOC",
                  detail: "Its playback rate is not the burn rate: the frames are NASA's selection, with no scale.", sources: [{ label: "NASA footage in the 3D studio", href: "#footage" }] },
              ]}
              notice={<ScientificNotice notice={NOTICES.saffire} />}
              limits={[
                { text: c.statements.find((x) => x.kind === "UNSUPPORTED")?.text ?? "Flame spread rates are not available in the local files.", kind: "UNSUPPORTED" },
                { text: "With only two burns and different flow directions, burn times are not a material property and cannot be compared as one.", kind: "COMPUTED", source: { label: "S1 vs S2", href: "#compare" } },
                { text: "CSV length and width appear swapped relative to the Operations document (SAF-LENGTH-WIDTH); F2's CSV label conflicts with the DoD; only about a quarter of the listed Sample 2 frames are marked received (SAF-DOWNLINK-GAP).", kind: "quality_flag", source: { label: "Data conflicts and warnings", href: "#compare" } },
                { text: "The 3D arrangement is conceptual: component positions, duct cross-section and the moving flame band are illustrative.", kind: "HYPOTHESIS" },
              ]} />
            <AskSuggestions ctx={{ inv: "PSI-98" }} className="rounded-xl border border-line/60 bg-panel/40 p-4" />
            <div className="h-4" />
            <SaffireHardware />
            <div className="mt-6 flex flex-col gap-4" id="data">
              <h2 className="subhead text-[22px] md:text-[26px]">Explore the data</h2>
              <p className="-mt-2 max-w-[65ch] text-[15px] text-text-2">The local data: two burn rows and a manifest of image file names and times.</p>
            <Disclosure id="airflow" level="explore" title="Airflow and flame-spread direction" action="Explore the two burns"
              summary={<>Both burns ran in a 20 cm/s airflow; S1 spread with the air (<Term id="concurrent-flow">concurrent</Term>), S2 against it (<Term id="opposed-flow">opposed</Term>).</>}>
              <div className="grid gap-5 md:grid-cols-2">
                {c.burns.map((bn) => <FlowCard key={String(bn.experiment_uid)} burn={bn} />)}
              </div>
              <p className="mt-3 text-xs text-text-3">Schematics: sheet orientation is illustrative. In concurrent spread the flame moves with the airflow; in opposed spread it moves against it. Burn times differ partly because of that, so they are not a material property.</p>
            </Disclosure>
            <Disclosure id="compare" title="S1 vs S2 and data conflicts" action="Show the recorded values"
              summary="Every CSV field for both burns, and the conflicts found between the CSV, the workbook and the documents.">
            <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
              <div>
                <p className="mb-2 text-[13px]"><Link href="/intelligence/compare?uids=saffire1:S1,saffire1:S2">Open S1 and S2 in Compare</Link></p>
                <div className="overflow-x-auto">
                  <table className="data">
                    <thead><tr><th>Field</th><th><Link href={expHref("saffire1:S1")}>S1</Link></th><th><Link href={expHref("saffire1:S2")}>S2</Link></th></tr></thead>
                    <tbody>{c.comparison.map((r) => (
                      <tr key={r.field}><td className="text-text-2">{r.label}{r.unit ? ` (${r.unit})` : ""}</td>
                        <td className={r.same ? "" : "font-semibold"}>{fmt(r.S1)}</td><td className={r.same ? "" : "font-semibold"}>{fmt(r.S2)}</td></tr>))}</tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-text-3">n = 2 burns. Differences are descriptive; flow direction differs, so burn times are not directly comparable as a material property.</p>
              </div>
              <div>
                <h3 className="subhead mb-2 text-[15px]">Data conflicts and warnings</h3>
                <ul className="flex flex-col gap-3 text-sm">
                  {c.quality_flags.filter((f) => f.severity !== "info" || f.rule_id === "SAF-METADATA-CONFLICT").map((f) => (
                    <li key={f.flag_id}><div className="flex items-center gap-2"><Severity level={f.severity} /><b>{f.rule_id}</b><span className="text-xs text-text-3">{f.status}</span></div>
                      <p className="mt-1 text-text-2">{f.description}</p>{f.evidence_ref && <p className="text-xs text-text-3">Evidence: {f.evidence_ref}</p>}</li>))}
                </ul>
              </div>
            </div>
            </Disclosure>

            <Disclosure id="timeline" title="Image downlink timeline" action="Show the downlink timeline"
              summary="When each camera's image files were listed and received on the ground. File timing only: no flame measurements.">
              <p className="mb-3 text-[13px]"><a href={`/api/v1/analytics/saffire/timeline.csv?bin_s=${bin}`}>Download timeline CSV</a></p>
              <div className="mb-3 flex flex-wrap gap-3">
                <Field label="Image set" htmlFor="sset"><select id="sset" className={inputCls} value={set} onChange={(e) => setSet(e.target.value)}>
                  {Object.entries(SET_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
                <Field label="Bin width" htmlFor="sbin"><select id="sbin" className={inputCls} value={bin} onChange={(e) => setBin(Number(e.target.value))}>
                  {[10, 30, 60].map((b) => <option key={b} value={b}>{b} s</option>)}</select></Field>
              </div>
              <Loadable state={tl} rows={6}>
                {(t) => (
                  <>
                    {plot && <Plot data={plot.data} layout={plot.layout} height={340} ariaLabel={`Bar chart of listed and received JPEG frames over time for ${SET_LABEL[set]}`} />}
                    <p className="mt-1 text-xs text-text-3"><Prov kind="COMPUTED" /> Outlined bars: frames listed in the manifest; filled bars: frames marked received. {t.note}
                      {t.series.some((s) => s.missing.length) && ` Bins with zero received frames: ${t.series.map((s) => `${s.camera} ${s.missing.length}`).join(", ")}.`}</p>
                  </>
                )}
              </Loadable>
            </Disclosure>

            <Disclosure id="manifest" anchors={["sets"]} title="Image manifest" action="Show the manifest"
              summary={`Frames listed and received per image set and camera, ${c.campaign_window.start_utc?.slice(11, 19)} to ${c.campaign_window.end_utc?.slice(11, 19)} UTC.`}>
              <div className="overflow-x-auto">
                <table className="data">
                  <thead><tr><th>Set</th><th>Camera</th><th className="num">Frames listed</th><th>Start (UTC)</th><th className="num">Duration (s)</th><th className="num">Median Δt (ms)</th><th className="num">Received</th><th className="num">Corrupt</th><th className="num">ZIPs received</th></tr></thead>
                  <tbody>{c.manifest.map((m) => (
                    <tr key={m.set_label + m.camera}><td>{SET_LABEL[m.set_label] ?? m.set_label}</td><td>{m.camera}</td><td className="num">{fmt(m.frames)}</td>
                      <td>{m.start_utc.slice(11, 23)}</td><td className="num">{fmt(m.duration_s)}</td><td className="num">{fmt(m.median_dt_ms)}</td>
                      <td className="num">{fmt(m.jpeg_received)} <span className={m.received_pct < 50 ? "text-crit" : "text-text-3"}>({fmt(m.received_pct)} %)</span></td>
                      <td className="num">{fmt(m.jpeg_corrupt)}</td><td className="num">{m.zips_received}/{m.zips_listed}</td></tr>))}</tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-text-3">Timestamps come from epoch-millisecond file names. JPEG file sizes exist in the workbook but are not shown: they are not a flame measurement.</p>
              <div id="sets" className="mt-5 scroll-mt-36">
                <h3 className="subhead mb-2 text-[15px]">Image-set rows (F1, F2)</h3>
                <ul className="flex flex-col gap-2 text-sm">{c.image_sets.map((s) => (
                  <li key={s.label}><b>{s.label}</b>: CSV text <span className="raw">{s.csv_description}</span>
                    <span className="block text-text-2">Documented role: {s.documented_role}{s.csv_role !== s.documented_role && <span className="text-warn"> (conflicts with CSV)</span>}</span></li>))}</ul>
              </div>
            </Disclosure>
            </div>
            <div className="mt-6"><LiteraturePanel inv="PSI-98" source="SAFFIRE-I" query="Saffire spacecraft fire experiment" question="What do the NASA SAFFIRE-I (PSI-98) sources say about large-scale flame spread in a spacecraft?" /></div>

          </div>
        )}
      </Loadable>
    </>
  );
}
