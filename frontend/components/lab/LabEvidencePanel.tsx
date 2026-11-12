"use client";

// NASA evidence beside the 3D scenes. Every value here is read from the SpaceFire API exactly as stored from the
// NASA files (or a verified report table), with its unit, raw header where it matters, and its quality flags.
// Nothing in this panel is computed from the conceptual controls.
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { MediaFigure, MediaPanelBlock } from "@/components/media";
import { Callout, Kind, Loadable, Prov, Severity, SourceBadge } from "@/components/ui";
import { expHref, fmt, qs, useApi } from "@/lib/api";
import { copilotHref } from "@/lib/lab-copilot";
import type { LabScene } from "@/lib/lab-models";
import { BASS_SAMPLES, type BassState, type FlexState } from "@/lib/lab-presets";
import { FLEX_K_UNIT } from "@/lib/lab-scientific-metadata";
import { ROUTES } from "@/lib/routes";

export type Flag = { flag_id: string; rule_id: string; severity: string; description: string; evidence_ref?: string | null; status?: string; experiment_uid?: string | null };
export type ReportRec = { record_id: string; document_id: string; table_id: string; page_pdf: number; verification: string;
  values: Record<string, unknown>; units: Record<string, string>; raw: Record<string, string> };
export type Detail = {
  experiment_uid: string; display_id: string; investigation: string; investigation_id: string;
  normalized: Record<string, unknown>; raw_fields: { header: string; value: string }[];
  quality_flags: Flag[]; dataset_flags: Flag[]; report_records: ReportRec[];
};
const REPORT_KEY: Record<string, string> = {
  thickness_mm: "Thickness", width_cm: "Width", sides_burning: "Sides burning", velocity_cm_s: "Velocity", spread_rate_mm_s: "Spread rate",
  spread_rate_status: "Spread-rate status", burn_time_min: "Burn time", initial_o2_vol_pct: "Initial O₂", final_o2_vol_pct: "Final O₂",
  gmt_day_of_year: "GMT day", sample_width_cm: "Sample width", flow_cm_s: "Flow", flow_change: "Flow change", o2_vol_pct: "O₂",
  o2_footnote: "O₂ footnote", comment: "Comment", outcome: "Outcome",
};
type ListItem = { experiment_uid: string; display_id: string; fields: Record<string, unknown> };
type ListResp = { total: number; items: ListItem[] };

/** Debounce a fast-changing value (slider drags) before it reaches the API. */
function useDebounced<T>(v: T, ms = 300): T {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

function Row({ label, children, prov = "experiment", note }: { label: ReactNode; children: ReactNode; prov?: string; note?: ReactNode }) {
  return (
    <tr>
      <th scope="row" className="py-1.5 pr-3 text-left align-top text-[13px] font-normal text-text-2">{label}</th>
      <td className="py-1.5 align-top text-[13.5px] text-text">
        <span className="inline-flex flex-wrap items-center gap-1.5"><span>{children}</span><Prov kind={prov} /></span>
        {note && <span className="mt-0.5 block text-[12px] leading-snug text-text-3">{note}</span>}
      </td>
    </tr>
  );
}

function Flags({ flags, title }: { flags: Flag[]; title: string }) {
  if (!flags.length) return null;
  return (
    <div>
      <p className="text-[12.5px] font-medium text-text-3">{title}</p>
      <ul className="mt-1.5 flex flex-col gap-2">
        {flags.map((f) => (
          <li key={f.flag_id} className="text-[12.5px] leading-snug text-text-2">
            <span className="mr-1.5 inline-flex items-center gap-1.5"><Severity level={f.severity} /><b className="text-text">{f.rule_id}</b></span>{f.description}
          </li>
        ))}
      </ul>
    </div>
  );
}

function RecordButton({ on, onClick, title, meta }: { on: boolean; onClick: () => void; title: string; meta: string }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={`press flex w-full items-baseline justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[13px] ${on ? "border-data bg-data/10 text-text" : "border-line/80 text-text-2 hover:border-data/50 hover:text-text"}`}>
      <span className="font-medium">{title}</span><span className="text-[12px] text-text-3">{meta}</span>
    </button>
  );
}

function AskTest({ scene, detail }: { scene: LabScene; detail: Detail }) {
  return (
    <Link href={copilotHref(scene, null, { uid: detail.experiment_uid, label: detail.display_id })}
      className="press inline-flex min-h-9 items-center gap-2 rounded-lg border border-electric/60 bg-electric/10 px-3 text-sm text-text no-underline hover:border-electric hover:no-underline">
      <Icon name="assistant" />Ask AI about this test
    </Link>
  );
}

/* ------------------------------------------------------------------------------------------- FLEX ---------- */

function FlexEvidence({ scene, flex, uid, onRecord, detail }: { scene: LabScene; flex: FlexState; uid: string | null; onRecord: (uid: string | null) => void; detail: Detail | null }) {
  const p = useDebounced({ fuel: flex.fuel, o2: flex.o2, d0: flex.d0 });
  const near = useApi<ListResp>(`/experiments${qs({ dataset: "flex", f_fuel: p.fuel, min_x_o2: (p.o2 - 0.02).toFixed(3), max_x_o2: (p.o2 + 0.02).toFixed(3),
    min_d0_mm: (p.d0 - 0.5).toFixed(2), max_d0_mm: (p.d0 + 0.5).toFixed(2), sort: "x_o2", page_size: 12 })}`);
  const n = detail?.experiment_uid.startsWith("flex:") ? detail.normalized : null;
  const kObs = detail?.raw_fields.find((r) => r.header === FLEX_K_UNIT.rawHeader);
  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="flex-near">
        <h3 id="flex-near" className="subhead text-[15px]">Real FLEX tests near your settings</h3>
        <p className="mt-1 text-[12.5px] text-text-3">{p.fuel}, initial O₂ {p.o2.toFixed(2)} ± 0.02, D₀ {p.d0.toFixed(1)} ± 0.5 mm. A lookup, not a prediction.</p>
        <div className="mt-2">
          <Loadable state={near} rows={3}>
            {(d) => d.items.length ? (
              <>
                <ul className="flex flex-col gap-1.5" data-testid="flex-nearby">
                  {d.items.map((it) => (
                    <li key={it.experiment_uid}>
                      <RecordButton on={uid === it.experiment_uid} onClick={() => onRecord(uid === it.experiment_uid ? null : it.experiment_uid)}
                        title={String(it.display_id)} meta={`O₂ ${fmt(it.fields.x_o2)} · D₀ ${fmt(it.fields.d0_mm)} mm · ${String(it.fields.test_end ?? "—")}`} />
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-[12px] text-text-3">{d.total > d.items.length ? `Showing ${d.items.length} of ${d.total}. ` : `${d.total} matching. `}<Link href={`${ROUTES.explorer}?dataset=flex`}>All FLEX tests</Link></p>
              </>
            ) : <p className="rounded-lg border border-dashed border-line-strong px-3 py-3 text-[13px] text-text-2">No FLEX test matches these settings. Move the oxygen or diameter slider, or switch fuel.</p>}
          </Loadable>
        </div>
      </section>

      {n && detail ? (
        <section aria-labelledby="flex-rec" data-testid="evidence-record">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="flex-rec" className="subhead text-[15px]">Test {detail.display_id} <span className="text-[12.5px] font-normal text-text-3">{detail.experiment_uid}</span></h3>
            <Link href={expHref(detail.experiment_uid)} className="text-[13px]">Full record</Link>
          </div>
          <table className="mt-2 w-full"><tbody>
            <Row label="Date (GMT)">{String(n.test_date ?? "—")} {String(n.test_gmt ?? "")}</Row>
            <Row label="Fuel">{String(n.fuel ?? "—")}</Row>
            <Row label="Initial droplet diameter D₀">{fmt(n.d0_mm)} mm<Kind kind={n.d0_kind as string} /></Row>
            <Row label="Visible-flame extinction diameter">{fmt(n.dext_mm)} mm<Kind kind={n.dext_kind as string} /></Row>
            <Row label="Initial O₂ / N₂ (mole fraction)">{fmt(n.x_o2)} / {fmt(n.x_n2)}</Row>
            <Row label="CO₂ / He (mole fraction)" note="The CO₂ column's header reads 'CO' (flag FLEX-HDR-CO2).">{fmt(n.x_co2)} / {fmt(n.x_he)}</Row>
            <Row label="Ambient pressure">{fmt(n.pressure_mmhg)} mmHg</Row>
            <Row label="Pressure in atm" prov="COMPUTED" note="atm = mmHg / 760.">{fmt(n.pressure_atm)} atm</Row>
            <Row label="Burning-rate constant K" note={<>Raw header <span className="raw">{FLEX_K_UNIT.rawHeader}</span>{kObs ? <>, raw value <span className="raw">{kObs.value}</span></> : null}. {FLEX_K_UNIT.note}</>}>
              <span data-testid="k-value">{fmt(n.k_mm2_s)} {FLEX_K_UNIT.unit}</span><Kind kind={n.k_kind as string} />
            </Row>
            <Row label="Burn time">{fmt(n.burn_time_s)} s<Kind kind={n.burn_time_kind as string} /></Row>
            <Row label="Test end" note={n.test_end === "Disruption" ? "'Disruption' has no definition in the local documents; treated as unresolved." : undefined}>{String(n.test_end ?? "—")}</Row>
          </tbody></table>
          <p className="mt-2 text-[12px] text-text-3">The 3D view draws D₀ and the extinction diameter to scale and colours O₂ dots by the recorded fraction. It does not animate a burn: K is shown here, not used to drive motion.</p>
          <div className="mt-3 flex flex-col gap-3">
            <Flags flags={detail.quality_flags} title="Quality flags for this test" />
            <Flags flags={detail.dataset_flags.filter((f) => f.severity !== "info")} title="Dataset-wide caveats" />
          </div>
          <div className="mt-3"><AskTest scene={scene} detail={detail} /></div>
        </section>
      ) : (
        <Callout>Select a test above to see its measured values. In NASA Evidence mode the droplet is then drawn at the test&apos;s measured D₀ with its extinction diameter.</Callout>
      )}

      <section aria-labelledby="flex-media">
        <h3 id="flex-media" className="subhead text-[15px]">NASA imagery (not of a specific test)</h3>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <MediaFigure id="flex-1g-vs-microgravity" aspect="3 / 4" fit="contain" compact sizes="200px" caption="FLEX: microgravity flame (top) vs 1 g (bottom)." />
          <MediaFigure id="flex-heptane-soot-composite" aspect="3 / 4" compact sizes="200px" caption="Heptane droplet with soot streamers (false colour)." />
        </div>
      </section>
    </div>
  );
}

/* ---------------------------------------------------------------------------------------- BASS-II ---------- */

type BassReport = { consistency: { conflicts: { test_id: string; field: string; where: string; detail: string }[] } | null; appendix_a: { needs_review: string[] } };

function BassEvidence({ scene, bass, uid, onRecord, detail }: { scene: LabScene; bass: BassState; uid: string | null; onRecord: (uid: string | null) => void; detail: Detail | null }) {
  const classes = BASS_SAMPLES.find((s) => s.id === bass.sample)?.materialClasses ?? [];
  const list = useApi<ListResp>(`/experiments${qs({ dataset: "bass2", f_material_class: classes, page_size: 60, sort: "gmt_doy" })}`);
  const rep = useApi<BassReport>("/analytics/bass/report");
  const n = detail?.experiment_uid.startsWith("bass2:") ? detail.normalized : null;
  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="bass-list">
        <h3 id="bass-list" className="subhead text-[15px]">BASS-II tests: {BASS_SAMPLES.find((s) => s.id === bass.sample)?.label}</h3>
        <div className="mt-2">
          <Loadable state={list} rows={3}>
            {(d) => (
              <>
                <ul className="grid max-h-[220px] grid-cols-1 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2" data-testid="bass-list">
                  {d.items.map((it) => (
                    <li key={it.experiment_uid}>
                      <RecordButton on={uid === it.experiment_uid} onClick={() => onRecord(uid === it.experiment_uid ? null : it.experiment_uid)}
                        title={String(it.display_id)} meta={`${String(it.fields.pi ?? "")} · ${String(it.fields.flow_direction ?? "flow n/r")}`} />
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-[12px] text-text-3">{d.total} tests in the CSV for this sample type. Each PI used one material family and flow direction, so differences between PIs are confounded.</p>
              </>
            )}
          </Loadable>
        </div>
      </section>

      {n && detail ? (
        <section aria-labelledby="bass-rec" data-testid="evidence-record">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="bass-rec" className="subhead text-[15px]">Test {detail.display_id} <span className="text-[12.5px] font-normal text-text-3">{detail.experiment_uid}</span></h3>
            <Link href={expHref(detail.experiment_uid)} className="text-[13px]">Full record</Link>
          </div>
          <table className="mt-2 w-full"><tbody>
            <Row label="PI · date">{String(n.pi ?? "—")} · {String(n.date_iso ?? "—")}</Row>
            <Row label="Material (as recorded)"><span className="raw">{String(n.material_raw ?? "—")}</span></Row>
            <Row label="Material class · geometry" prov="COMPUTED" note="Parsed from the material text.">{String(n.material_class ?? "—")} · {String(n.geometry ?? "—")}</Row>
            {n.thickness_mm != null && <Row label="Thickness (CSV text)">{fmt(n.thickness_mm)} mm</Row>}
            {n.diameter_mm != null && <Row label="Diameter (CSV text)">{fmt(n.diameter_mm)} mm</Row>}
            {n.width_cm != null && <Row label="Width (CSV text)" note="The CSV and the Appendix A log give nominal widths (1 or 2 cm); report tables print actual widths (1.2 or 2.2 cm).">{fmt(n.width_cm)} cm</Row>}
            <Row label="Flow direction" prov="DOC" note={n.flow_direction_source ? `From ${String(n.flow_direction_source)}.` : undefined}>{String(n.flow_direction ?? "not recorded")}</Row>
            <Row label="Air display (cm/s, stages as recorded)" note="A facility readout, not the analysed velocity; never converted.">{n.air_raw ? <span className="raw">{String(n.air_raw)}</span> : "blank"}</Row>
            <Row label="Flow restrictors">{fmt(n.flow_restrictor)}</Row>
            <Row label="O₂ initial → final (% vol)" note="Whole-chamber endpoints, read once before and once after the burn.">{fmt(n.o2_initial)} → {fmt(n.o2_final)}</Row>
            <Row label="CO₂ initial → final (% vol)">{fmt(n.co2_initial)} → {fmt(n.co2_final)}</Row>
          </tbody></table>
          {detail.report_records.length > 0 && (
            <div className="mt-3">
              <p className="text-[12.5px] font-medium text-text-3">Report-table rows for this test</p>
              <ul className="mt-1.5 flex flex-col gap-2">
                {detail.report_records.map((r) => (
                  <li key={r.record_id} className="rounded-lg border border-line/80 p-2.5 text-[12.5px] text-text-2">
                    <span className="flex flex-wrap items-center gap-1.5"><Prov kind="report_table" /><b className="text-text">Table {r.table_id}</b>
                      <a href={`/api/v1/documents/${r.document_id}/file#page=${r.page_pdf}`} target="_blank" rel="noreferrer">PDF p.{r.page_pdf}</a>
                      <span className="text-text-3">{r.verification}</span></span>
                    <span className="mt-1 block">
                      {Object.entries(r.values).filter(([, v]) => Array.isArray(v) || (v !== null && typeof v !== "object")).map(([k, v]) => (
                        <span key={k} className="mr-3 inline-block">{REPORT_KEY[k] ?? k.replace(/_/g, " ")}: <b className="text-text">{Array.isArray(v) ? v.join(", ") : String(v)}</b>{r.units[k] ? ` ${r.units[k]}` : ""}</span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-[12px] text-text-3">Spread rates are as printed in the report (tracked from video by NASA). The moving front in the 3D view is not one of them.</p>
            </div>
          )}
          <div className="mt-3"><Flags flags={detail.quality_flags} title="Quality flags for this test" /></div>
          <div className="mt-3"><AskTest scene={scene} detail={detail} /></div>
        </section>
      ) : (
        <Callout>Select a test to see its recorded values, its report-table rows and its flags. In NASA Evidence mode the sample is then drawn with the test&apos;s recorded width or diameter and flow direction.</Callout>
      )}

      <section aria-labelledby="bass-conf">
        <h3 id="bass-conf" className="subhead text-[15px]">Known discrepancies (kept, not reconciled)</h3>
        <Loadable state={rep} rows={2}>
          {(r) => (
            <ul className="mt-1.5 flex flex-col gap-1.5 text-[12.5px] text-text-2" data-testid="bass-discrepancies">
              {(r.consistency?.conflicts ?? []).map((c) => <li key={c.test_id + c.field}><Severity level="warning" /> <b className="text-text">{c.test_id}</b> {c.field.replace(/_/g, " ")}: {c.detail} ({c.where}).</li>)}
              {r.appendix_a.needs_review.length > 0 && <li><Severity level="info" /> Appendix A rows needing review: {r.appendix_a.needs_review.join(", ")}.</li>}
              <li><Link href={`${ROUTES.spread}#report`}>All report cross-checks</Link></li>
            </ul>
          )}
        </Loadable>
      </section>

      <section aria-labelledby="bass-media">
        <h3 id="bass-media" className="subhead text-[15px]">NASA imagery (not of a specific test)</h3>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <MediaFigure id="bass2-flame-gmt203" aspect="4 / 3" compact sizes="200px" caption="BASS-II flame over an acrylic slab." />
          <MediaFigure id="bass2-msg-operations" aspect="4 / 3" compact sizes="200px" caption="The Microgravity Science Glovebox." />
        </div>
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------------------- SAFFIRE-I ---------- */

type SaffireCase = { burns: Record<string, unknown>[]; quality_flags: Flag[]; statements: { kind: string; text: string }[] };

function SaffireEvidence({ scene, burn, detail }: { scene: LabScene; burn: string; detail: Detail | null }) {
  const cs = useApi<SaffireCase>("/analytics/saffire/case");
  return (
    <div className="flex flex-col gap-5">
      <Loadable state={cs} rows={6}>
        {(c) => {
          const flags = c.quality_flags.filter((f, i, a) => a.findIndex((x) => x.rule_id === f.rule_id && x.description === f.description) === i);
          const row = (label: string, k: string, unit?: string, note?: string) => (
            <tr key={k}>
              <th scope="row" className="py-1.5 pr-3 text-left text-[13px] font-normal text-text-2">{label}{unit ? ` (${unit})` : ""}{note && <span className="block text-[11.5px] text-warn">{note}</span>}</th>
              {c.burns.map((b) => <td key={String(b.sample)} className={`py-1.5 text-[13.5px] ${b.sample === burn ? "text-text" : "text-text-3"}`}>{k === "o2_raw" ? <span className="raw">{String(b[k])}</span> : fmt(b[k])}</td>)}
            </tr>
          );
          return (
            <section aria-labelledby="saf-burns" data-testid="evidence-record">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id="saf-burns" className="subhead text-[15px]">Burn records S1 and S2 (CSV)</h3>
                <span className="text-[12px] text-text-3">Highlighted: {burn} <Prov kind="experiment" /></span>
              </div>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full">
                  <thead><tr><th className="text-left text-[12px] font-normal text-text-3">Field</th>{c.burns.map((b) => (
                    <th key={String(b.sample)} className="text-left text-[13px]"><Link href={expHref(String(b.experiment_uid))}>{String(b.sample)}</Link></th>))}</tr></thead>
                  <tbody>
                    {row("Material", "material")}
                    {row("Flame spread vs airflow", "flow_direction")}
                    {row("Air flow", "air_flow_cm_s", "cm/s")}
                    {row("O₂ (as recorded)", "o2_raw", "%")}
                    {row("Length", "length_cm", "cm", "Appears swapped with width (SAF-LENGTH-WIDTH)")}
                    {row("Width", "width_cm", "cm", "Document: ~0.4 m wide × 0.94 m tall")}
                    {row("Thickness", "thickness_cm", "cm")}
                    {row("Ignition power", "ignition_power_w", "W")}
                    {row("Ignition time", "ignition_time_s", "s")}
                    {row("Burn time", "burn_time_s", "s")}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[12px] text-text-3">n = 2 burns with different flow directions: their burn times are not a material property. {c.statements.find((s) => s.kind === "UNSUPPORTED")?.text}</p>
              <div className="mt-3"><Flags flags={flags.filter((f) => f.severity === "warning" || f.rule_id === "SAF-NO-MEDIA" || f.rule_id === "SAF-CSV-ONLY")} title="Data conflicts and caveats" /></div>
              {detail && <div className="mt-3"><AskTest scene={scene} detail={detail} /></div>}
            </section>
          );
        }}
      </Loadable>

      <section aria-labelledby="saf-media">
        <h3 id="saf-media" className="subhead text-[15px]">NASA footage and hardware</h3>
        <p className="mt-1 text-[12.5px] text-text-3">NASA&apos;s public release; the local manifest holds file names and times only, so no frame is reconstructed here.</p>
        <div className="mt-2"><MediaPanelBlock id="saffire1-burn-animation" /></div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <MediaFigure id="saffire1-hardware-cygnus" aspect="4 / 3" compact sizes="200px" caption="Flight unit in Cygnus." />
          <MediaFigure id="saffire1-preflight-ceit" aspect="4 / 3" compact sizes="200px" caption="Before flight (OA-6 check)." />
        </div>
        <p className="mt-2 text-[13px]"><Link href={`${ROUTES.spacecraft}#footage`}>NASA video and the full Spacecraft Fire Dynamics page</Link></p>
      </section>
    </div>
  );
}

export default function LabEvidencePanel({ scene, flex, bass, saffireBurn, uid, onRecord, detail }: {
  scene: LabScene; flex: FlexState; bass: BassState; saffireBurn: string; uid: string | null; onRecord: (uid: string | null) => void; detail: Detail | null;
}) {
  return (
    <div className="flex flex-col gap-4" data-testid="lab-evidence">
      <div className="flex flex-wrap items-center gap-2"><SourceBadge source={scene.source} inv={scene.inv} size="sm" />
        <Link href={scene.phenomenonHref} className="text-[13px]">{scene.phenomenonTitle}</Link></div>
      {scene.id === "flex" && <FlexEvidence scene={scene} flex={flex} uid={uid} onRecord={onRecord} detail={detail} />}
      {scene.id === "bass" && <BassEvidence scene={scene} bass={bass} uid={uid} onRecord={onRecord} detail={detail} />}
      {scene.id === "saffire" && <SaffireEvidence scene={scene} burn={saffireBurn} detail={detail} />}
    </div>
  );
}
