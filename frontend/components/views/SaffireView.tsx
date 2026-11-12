"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Plot, { baseLayout, CAT } from "@/components/Plot";
import { PhenomenonArt } from "@/components/illustrations";
import LabEntryLink from "@/components/lab/LabEntryLink";
import { MediaFigure, MediaPanelBlock, SchematicFigure } from "@/components/media";
import { usePauseOffscreen } from "@/components/motion";
import { Callout, Field, inputCls, Loadable, PageHeader, Panel, Prov, Severity } from "@/components/ui";
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
        <rect x="34" y="12" width="52" height="136" rx="2" fill="#1C2A42" stroke="#31496D" />
        {[18, 102].map((x) => (
          <g key={x}>
            <line x1={x} y1="152" x2={x} y2="16" stroke="#4FD1E8" strokeWidth="1.6" strokeDasharray="5 5" className="anim-flow" />
            <path d="M0 0 L-6 -4 L-6 4 Z" fill="#4FD1E8" transform={`translate(${x} 12) rotate(-90)`} />
          </g>
        ))}
        <rect x="34" y={concurrent ? 104 : 12} width="52" height="44" fill="#FF8A3D" opacity="0.18" />
        <path d={concurrent ? "M34 104 C 46 96 54 108 60 98 C 66 108 76 96 86 104" : "M34 56 C 46 64 54 52 60 62 C 66 52 76 64 86 56"} fill="none" stroke="#FF8A3D" strokeWidth="2.5" />
        <line x1="60" y1={concurrent ? 92 : 68} x2="60" y2={concurrent ? 64 : 96} stroke="#FFB547" strokeWidth="2" />
        <path d="M0 0 L-7 -4 L-7 4 Z" fill="#FFB547" transform={concurrent ? "translate(60 60) rotate(-90)" : "translate(60 100) rotate(90)"} />
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

/** NASA's public Saffire-I footage. It is not derived from the local manifest, which holds file names and times only. */
function SaffireFootage() {
  return (
    <section id="footage" aria-labelledby="footage-title" className="hairline-top scroll-mt-36 rounded-2xl border border-line/80 bg-[linear-gradient(170deg,rgba(255,138,61,0.07),rgba(16,30,51,0.92)_45%)] p-4 md:p-6">
      <p className="kicker">NASA footage</p>
      <h2 id="footage-title" className="subhead mt-2 text-[22px] md:text-[26px]">The first large-scale fire in a spacecraft, as NASA filmed it</h2>
      <p className="mt-2 max-w-[80ch] text-[15px] leading-relaxed text-text-2">
        On 14 June 2016, after Cygnus left the space station, a hot wire ignited the fabric sample inside a closed enclosure while cameras recorded the burn
        and later downlinked the images. Nothing plays until you press play; the YouTube video loads only then.
      </p>
      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <MediaPanelBlock id="saffire1-burn-animation">
          <p className="text-xs text-text-3">What it shows: a flame front moving along the sample. It cannot tell you the spread rate: the frames are NASA&apos;s selection, played faster than real time, with no scale.</p>
        </MediaPanelBlock>
        <MediaPanelBlock id="saffire1-youtube" />
      </div>
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
      <PageHeader kicker="Scientific analysis" title="Spacecraft Fire Dynamics"
        lead="Examining large-scale fire behavior and airflow conditions in spacecraft environments. A ~0.4 m × 0.94 m SIBAL cotton/fiberglass sheet burned aboard an uncrewed Cygnus vehicle in June 2016, the first large-scale fire experiment in microgravity. The local data holds two burn records and a manifest of image files: no images, flame measurements or sensor time series."
        source={{ source: "SAFFIRE-I", inv: "PSI-98" }}
        art={<MediaFigure id="saffire1-hardware-cygnus" eager compact aspect="4 / 3" sizes="(min-width: 768px) 340px, 92vw"
          caption="The Saffire-I flight unit strapped inside the Cygnus cargo module (NASA)." />}
        facts={cs.data ? (() => {
          const sm = cs.data.manifest.filter((m) => m.set_label.startsWith("Sample"));
          const listed = sm.reduce((a, m) => a + m.frames, 0);
          const got = sm.reduce((a, m) => a + m.jpeg_received, 0);
          return [
            { value: cs.data.burns.length, label: "burn records (S1, S2)" },
            { value: fmt(listed), label: "burn-camera frames listed in the manifest" },
            { value: `${fmt((got / listed) * 100)} %`, label: "of those frames marked received on the ground" },
          ];
        })() : undefined}
        sections={[{ id: "footage", label: "NASA footage" }, { id: "airflow", label: "Airflow" }, { id: "compare", label: "S1 vs S2" }, { id: "timeline", label: "Downlink timeline" }, { id: "manifest", label: "Manifest summary" }, { id: "sets", label: "Image sets & papers" }]} />
      <Loadable state={cs} rows={10}>
        {(c) => (
          <div className="flex flex-col gap-5">
            <Callout tone="warn">{c.statements.find((s) => s.kind === "UNSUPPORTED")?.text} The manifest lists image files, but their pixels are not in the local data, so no manifest frame is shown or reconstructed. The footage below is NASA&apos;s public release.</Callout>
            <SaffireFootage />
            <LabEntryLink scene="saffire" label="Inspect a conceptual 3D cutaway of the Saffire-I flow duct" />
            <Panel id="airflow" tone="feature" title="Airflow and flame-spread direction" aside="Direction and speed as recorded in the CSV">
              <div className="grid gap-5 md:grid-cols-2">
                {c.burns.map((bn) => <FlowCard key={String(bn.experiment_uid)} burn={bn} />)}
              </div>
              <p className="mt-3 text-xs text-text-3">Schematics: sheet orientation is illustrative. In concurrent spread the flame moves with the airflow; in opposed spread it moves against it. Burn times differ partly because of that, so they are not a material property.</p>
            </Panel>
            <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
              <Panel id="compare" title="S1 vs S2, as recorded in the CSV" aside={<Link href="/intelligence/compare?uids=saffire1:S1,saffire1:S2">Open in compare</Link>}>
                <div className="overflow-x-auto">
                  <table className="data">
                    <thead><tr><th>Field</th><th><Link href={expHref("saffire1:S1")}>S1</Link></th><th><Link href={expHref("saffire1:S2")}>S2</Link></th></tr></thead>
                    <tbody>{c.comparison.map((r) => (
                      <tr key={r.field}><td className="text-text-2">{r.label}{r.unit ? ` (${r.unit})` : ""}</td>
                        <td className={r.same ? "" : "font-semibold"}>{fmt(r.S1)}</td><td className={r.same ? "" : "font-semibold"}>{fmt(r.S2)}</td></tr>))}</tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-text-3">n = 2 burns. Differences are descriptive; flow direction differs, so burn times are not directly comparable as a material property.</p>
              </Panel>
              <Panel title="Data conflicts and warnings">
                <ul className="flex flex-col gap-3 text-sm">
                  {c.quality_flags.filter((f) => f.severity !== "info" || f.rule_id === "SAF-METADATA-CONFLICT").map((f) => (
                    <li key={f.flag_id}><div className="flex items-center gap-2"><Severity level={f.severity} /><b>{f.rule_id}</b><span className="text-xs text-text-3">{f.status}</span></div>
                      <p className="mt-1 text-text-2">{f.description}</p>{f.evidence_ref && <p className="text-xs text-text-3">Evidence: {f.evidence_ref}</p>}</li>))}
                </ul>
              </Panel>
            </div>

            <Panel id="timeline" title="Image downlink timeline" aside={<a href={`/api/v1/analytics/saffire/timeline.csv?bin_s=${bin}`}>Download timeline CSV</a>}>
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
            </Panel>

            <Panel id="manifest" title="Manifest summary by image set and camera" aside={`Campaign ${c.campaign_window.start_utc?.slice(11, 19)} to ${c.campaign_window.end_utc?.slice(11, 19)} UTC`}>
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
            </Panel>

            <div className="grid gap-5 md:grid-cols-2">
              <Panel id="sets" title="Image-set rows (F1, F2)">
                <ul className="flex flex-col gap-2 text-sm">{c.image_sets.map((s) => (
                  <li key={s.label}><b>{s.label}</b>: CSV text <span className="raw">{s.csv_description}</span>
                    <span className="block text-text-2">Documented role: {s.documented_role}{s.csv_role !== s.documented_role && <span className="text-warn"> (conflicts with CSV)</span>}</span></li>))}</ul>
              </Panel>
              <Panel title="Publications listed for SAFFIRE-I">
                <ul className="flex flex-col gap-2 text-sm">{c.publications.map((p) => (
                  <li key={p.title}>{p.doi ? <a href={`https://doi.org/${p.doi}`} target="_blank" rel="noreferrer">{p.title}</a> : p.title}</li>))}</ul>
                <p className="mt-2 text-xs text-text-3">Listed in NASA PSI metadata; contents not read. Search them in <Link href="/evidence/literature?q=Saffire%20spacecraft%20fire%20experiment">External research</Link>.</p>
              </Panel>
            </div>
          </div>
        )}
      </Loadable>
    </>
  );
}
