"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Plot, { baseLayout, CAT } from "@/components/Plot";
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

const SET_LABEL: Record<string, string> = { BIT: "Built-in test", PreFlowVis: "F1 flow visualization", Sample1: "S1 burn (concurrent)", Sample2: "S2 burn (opposed)", PostFlowVis: "F2 flow visualization" };

export default function SaffireView() {
  const cs = useApi<Case>("/analytics/saffire/case");
  const [bin, setBin] = useState(30);
  const [set, setSet] = useState("Sample1");
  const tl = useApi<Timeline>(`/analytics/saffire/timeline?bin_s=${bin}&set_label=${set}`);

  const plot = useMemo(() => {
    if (!tl.data) return null;
    const data: unknown[] = [];
    tl.data.series.forEach((s, i) => {
      data.push({ type: "bar", name: `${s.camera} listed`, x: s.bins.map((b) => b.bin_start_utc), y: s.bins.map((b) => b.frames),
        marker: { color: "rgba(0,0,0,0)", line: { color: CAT[i], width: 1.5 } }, offsetgroup: s.camera,
        hovertemplate: `${s.camera}<br>%{x}<br>Listed frames %{y}<extra></extra>` });
      data.push({ type: "bar", name: `${s.camera} received`, x: s.bins.map((b) => b.bin_start_utc), y: s.bins.map((b) => b.received),
        marker: { color: CAT[i] }, offsetgroup: s.camera, base: 0,
        hovertemplate: `${s.camera}<br>%{x}<br>Received JPEGs %{y}<extra></extra>` });
    });
    return { data, layout: baseLayout("UTC time, 2016-06-14", `JPEG frames per ${tl.data.bin_s} s bin (count)`, { barmode: "group", bargap: 0.15 }) };
  }, [tl.data]);

  return (
    <>
      <PageHeader title="SAFFIRE-I case study"
        lead="The first large-scale fire in microgravity: a ~0.4 m × 0.94 m SIBAL cotton/fiberglass sheet burned aboard an uncrewed Cygnus vehicle in June 2016. The local data holds two burn records and a manifest of image files. It holds no images, flame measurements or sensor time series." />
      <Loadable state={cs} rows={10}>
        {(c) => (
          <div className="flex flex-col gap-5">
            <Callout tone="warn">{c.statements.find((s) => s.kind === "UNSUPPORTED")?.text} No image thumbnails are shown because no image bytes exist locally.</Callout>
            <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
              <Panel title="S1 vs S2, as recorded in the CSV" aside={<Link href="/compare?uids=saffire1:S1,saffire1:S2">Open in compare</Link>}>
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

            <Panel title="Manifest summary by image set and camera" aside={`Campaign ${c.campaign_window.start_utc?.slice(11, 19)} to ${c.campaign_window.end_utc?.slice(11, 19)} UTC`}>
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
              <Panel title="Image-set rows (F1, F2)">
                <ul className="flex flex-col gap-2 text-sm">{c.image_sets.map((s) => (
                  <li key={s.label}><b>{s.label}</b>: CSV text <span className="raw">{s.csv_description}</span>
                    <span className="block text-text-2">Documented role: {s.documented_role}{s.csv_role !== s.documented_role && <span className="text-warn"> (conflicts with CSV)</span>}</span></li>))}</ul>
              </Panel>
              <Panel title="Publications listed for SAFFIRE-I">
                <ul className="flex flex-col gap-2 text-sm">{c.publications.map((p) => (
                  <li key={p.title}>{p.doi ? <a href={`https://doi.org/${p.doi}`} target="_blank" rel="noreferrer">{p.title}</a> : p.title}</li>))}</ul>
                <p className="mt-2 text-xs text-text-3">Listed in NASA PSI metadata; contents not read. Search them in <Link href="/research?q=Saffire%20spacecraft%20fire%20experiment">External research</Link>.</p>
              </Panel>
            </div>
          </div>
        )}
      </Loadable>
    </>
  );
}
