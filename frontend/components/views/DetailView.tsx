"use client";

import Link from "next/link";
import { PHENOMENA, ROUTES } from "@/lib/routes";
import { useParams } from "next/navigation";
import { Callout, Empty, Kind, LinkButton, Loadable, PageHeader, Panel, Prov, Severity } from "@/components/ui";
import { Disclosure, MeasureGroup, QualityNotice } from "@/components/disclosure";
import { MediaFigure } from "@/components/media";
import { Icon } from "@/components/icons";
import { AskSuggestions } from "@/components/ask-suggestions";
import type { Inv } from "@/lib/copilot-suggestions";
import { MEDIA_BY_ID } from "@/lib/scientific-media";
import { SCENE_OF_DATASET, studioHref } from "@/lib/lab-models";

/** Apparatus (not flame) photos, so no reader takes an investigation image for a picture of the selected test. */
const APPARATUS: Record<string, string> = { flex: "flex2-mdca-apparatus", bass2: "bass2-msg-operations", saffire1: "saffire1-hardware-cygnus" };
/** Charts whose points are individual tests: the record opens ringed there, with its spotlight. */
const CHART_OF: Record<string, { href: string; hash: string; name: string }> = {
  flex: { href: ROUTES.extinction, hash: "map", name: "extinction map" }, bass2: { href: ROUTES.spread, hash: "gas", name: "gas-balance chart" },
};
import { expHref, fmt, qs, useApi } from "@/lib/api";
import { LinkLevel, ReportRecordCard, type ReportRecord } from "@/components/report";

type Obs = {
  column_index: number; raw_field: string; raw_text: string; value_kind: string; numeric_value: number | null;
  numeric_low: number | null; numeric_high: number | null; text_value: string | null; normalized_name: string;
  unit_raw: string | null; unit_normalized: string | null; measurement_role: string; derivation_note: string | null;
};
type Flag = { flag_id: string; rule_id: string; severity: string; category: string; description: string; raw_field: string | null;
  raw_value: string | null; derived_value: string | null; evidence_ref: string | null; proposed_correction: string | null; status: string };
type Link_ = { chunk_id: string; document_id: string; title: string; page_pdf: number | null; page_printed: number | null;
  section: string | null; excerpt: string; matched_text: string; review_status: string; relation_type: string; match_method: string };
type Detail = {
  experiment_uid: string; dataset: string; investigation_id: string; investigation: string; display_id: string;
  experiment_kind: string; source: { relative_path: string; sha256: string; source_row: number; csv_line: number };
  observations: Obs[]; normalized: Record<string, unknown>; quality_flags: Flag[]; dataset_flags: Flag[];
  evidence_links: Link_[]; duplicate_display_ids: { experiment_uid: string; source_row: number }[];
  image_sets?: { label: string; csv_description: string; csv_role: string; documented_role: string; manifest_set: string }[];
  report_records: ReportRecord[];
};
type Pub = { title: string; authors: string | null; doi: string | null };

function parsedValue(o: Obs) {
  if (o.value_kind === "present") return <>{fmt(o.numeric_value, 4)}</>;
  if (o.value_kind === "range") return <>{fmt(o.numeric_low)} to {fmt(o.numeric_high)}</>;
  if (o.value_kind === "approximate") return <>≈ {fmt(o.numeric_value)}</>;
  if (o.value_kind === "lower_bound") return <>&gt; {fmt(o.numeric_low)}</>;
  if (o.value_kind === "upper_bound") return <>&lt; {fmt(o.numeric_high)}</>;
  if (o.text_value && !["blank", "dash", "none"].includes(o.value_kind)) return <>{o.text_value}</>;
  return <span className="text-text-3">no value</span>;
}

/** The few recorded values that summarise a test; the full table stays one click away. */
function keyValues(d: Detail): { label: string; value: React.ReactNode; prov?: string; note?: React.ReactNode }[] {
  const n = d.normalized;
  const v = (k: string, unit = "") => (n[k] === null || n[k] === undefined || n[k] === "" ? <span className="text-text-3">not recorded</span> : <>{fmt(n[k])}{unit && <span className="text-text-3"> {unit}</span>}</>);
  if (d.dataset === "flex") return [
    { label: "Outcome (test end)", value: v("test_end"), prov: "experiment" },
    { label: "Fuel", value: v("fuel") },
    { label: "Initial O₂ (mole fraction)", value: v("x_o2"), prov: "experiment" },
    { label: "Initial droplet diameter D₀", value: v("d0_mm", "mm"), prov: "experiment" },
    { label: "Burning-rate constant K", value: v("k_mm2_s", "mm²/s"), prov: "experiment", note: "CSV header reads ‘Burning rate; mm’; interpreted as mm²/s." },
    { label: "Burn time", value: v("burn_time_s", "s"), prov: "experiment" },
  ];
  if (d.dataset === "bass2") return [
    { label: "Material", value: v("material_class") },
    { label: "Flow direction", value: v("flow_direction"), prov: "DOC" },
    { label: "Principal investigator", value: v("pi") },
    { label: "O₂ before → after (% vol)", value: <>{fmt(n.o2_initial)} → {fmt(n.o2_final)}</>, prov: "experiment" },
    { label: "CO₂ before → after (% vol)", value: <>{fmt(n.co2_initial)} → {fmt(n.co2_final)}</>, prov: "experiment" },
    { label: "Date", value: v("date_iso") },
  ];
  return [
    { label: "Material", value: v("material") },
    { label: "Flame spread vs airflow", value: v("flow_direction"), prov: "experiment" },
    { label: "Air flow", value: v("air_flow_cm_s", "cm/s"), prov: "experiment" },
    { label: "O₂ (as recorded)", value: n.o2_raw ? <span className="raw">{String(n.o2_raw)}</span> : v("o2_raw"), prov: "experiment" },
    { label: "Burn time", value: v("burn_time_s", "s"), prov: "experiment" },
  ];
}

export default function DetailView() {
  const params = useParams<{ dataset: string; uid: string }>();
  const uid = decodeURIComponent(params.uid);
  const st = useApi<Detail>(`/experiments/${encodeURIComponent(uid)}`);
  const inv = st.data?.investigation_id;
  const pubs = useApi<{ items: Pub[] }>(inv ? `/research/publications${qs({ investigation: inv })}` : null);

  return (
    <Loadable state={st} rows={12}>
      {(d) => (
        <>
          <p className="mb-2 text-sm"><Link href={`/experiments?dataset=${d.dataset}`}>← {d.investigation} experiments</Link></p>
          <PageHeader kicker={PHENOMENA.find((p) => p.inv === d.investigation_id)?.title ?? "Experiment record"} title={`${d.investigation} ${d.display_id}`}
            source={{ source: d.investigation, inv: d.investigation_id }}
            lead={<>One {d.experiment_kind === "burn" ? "test" : "row"} from NASA&apos;s {d.investigation} data, exactly as recorded. Record <span className="raw">{d.experiment_uid}</span>.</>}
            actions={
              <>
                <LinkButton href={`/intelligence/compare${qs({ uids: d.experiment_uid })}`}>Compare with others</LinkButton>
                <LinkButton href={`/intelligence/similar${qs({ uid: d.experiment_uid })}`}>Find similar tests</LinkButton>
                {SCENE_OF_DATASET[d.dataset] && d.experiment_kind === "burn" && (
                  <LinkButton href={studioHref(SCENE_OF_DATASET[d.dataset], { record: d.experiment_uid, mode: "evidence" })}><Icon name="lab" />Explore in 3D</LinkButton>
                )}
                <LinkButton variant="primary" href={`/copilot${qs({ draft: `Explain ${d.investigation} test ${d.display_id}`, uid: d.experiment_uid, inv: d.investigation_id })}`}>Ask about this test</LinkButton>
              </>
            } />

          {d.duplicate_display_ids.length > 0 && (
            <div className="mb-4">
              <Callout tone="warn">
                The identifier {d.display_id} also appears on {d.duplicate_display_ids.map((x, i) => (
                  <span key={x.experiment_uid}>{i ? ", " : ""}<Link href={expHref(x.experiment_uid)}>source row {x.source_row}</Link></span>
                ))} with different values. Each row keeps its own canonical address.
              </Callout>
            </div>
          )}

          <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
            <div className="flex min-w-0 flex-col gap-5">
              <section aria-labelledby="key-values" className="rounded-2xl border border-line/60 bg-panel/50 p-5" data-testid="test-overview">
                <h2 id="key-values" className="subhead text-[18px]">Key recorded values</h2>
                <div className="mt-4"><MeasureGroup label="Key recorded values" items={keyValues(d)} /></div>
                {d.quality_flags.some((f) => f.severity !== "info") && (
                  <div className="mt-5">
                    <QualityNotice href="#flags" linkLabel="View all flags for this test">
                      {d.quality_flags.filter((f) => f.severity !== "info").slice(0, 3).map((f) => <span key={f.flag_id} className="block"><b className="text-text">{f.rule_id}</b>: {f.description}</span>)}
                    </QualityNotice>
                  </div>
                )}
                <div className="mt-5 flex flex-col gap-4 border-t border-line/50 pt-4 md:flex-row md:items-start md:justify-between">
                  {CHART_OF[d.dataset] && d.experiment_kind === "burn" && (
                    <Link href={`${CHART_OF[d.dataset].href}?record=${encodeURIComponent(d.experiment_uid)}#${CHART_OF[d.dataset].hash}`} className="inline-flex shrink-0 items-center gap-1 text-[14px]" data-testid="show-on-chart">
                      Show this test on the {CHART_OF[d.dataset].name}<Icon name="chevron" size={13} /></Link>
                  )}
                  <AskSuggestions ctx={{ inv: d.investigation_id as Inv, record: { uid: d.experiment_uid, label: d.display_id }, from: "record" }} max={2} compact title="Questions about this test" className="md:max-w-[60%]" />
                </div>
              </section>

              <Disclosure id="values" title="All recorded values" action="Show raw and parsed values"
                summary={<>Every column of this row: the original cell text from the NASA file beside the parsed value, its unit and how it was interpreted ({d.observations.length} fields).</>}>
                <div className="overflow-x-auto">
                  <table className="data">
                    <thead><tr><th>Original column</th><th>Original cell</th><th>Parsed value</th><th>Role</th><th>Interpretation</th></tr></thead>
                    <tbody>
                      {d.observations.map((o) => (
                        <tr key={o.column_index}>
                          <td className="min-w-[160px]"><span className="raw">{o.raw_field}</span></td>
                          <td>{o.raw_text.trim() === "" ? <span className="text-text-3">(empty)</span> : <span className="raw">{o.raw_text}</span>}<Kind kind={o.value_kind} /></td>
                          <td className="whitespace-nowrap">{parsedValue(o)} {o.unit_normalized && ["present", "range", "approximate", "lower_bound", "upper_bound"].includes(o.value_kind) ? <span className="text-text-3">{o.unit_normalized}</span> : null}
                            {o.unit_raw && o.unit_normalized && o.unit_raw !== o.unit_normalized && (
                              <span className="block text-xs text-warn">header unit “{o.unit_raw}”</span>)}
                          </td>
                          <td className="text-text-2">{o.measurement_role}</td>
                          <td className="min-w-[220px] max-w-[340px] text-sm text-text-2">{o.derivation_note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Disclosure>

              {d.report_records.length > 0 && (
                <Disclosure id="report" title="Values printed in the NASA Summary Report" action="Show the report rows"
                  summary={<>{d.report_records.length} report-table row{d.report_records.length > 1 ? "s" : ""} for this test, checked against the CSV.</>}>
                  <p className="mb-3 text-sm text-text-2">Extracted from report tables and checked against this test&apos;s CSV values. Values the CSV does not contain (flow direction, spread rates, observations) come only from the report page cited.</p>
                  <div className="flex flex-col gap-3">{d.report_records.map((r) => <ReportRecordCard key={r.record_id} r={r} />)}</div>
                </Disclosure>
              )}

              <Disclosure id="pages" title="Report pages mentioning this test" action="Show the document pages"
                summary={d.evidence_links.length ? <>{d.evidence_links.length} NASA document passage{d.evidence_links.length > 1 ? "s" : ""} name this test, each with its link confidence.</> : "No document page names this test ID."}>
                {d.evidence_links.length === 0 ? (
                  <Empty title="No document page names this test ID">Search the documents for related context instead.</Empty>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {d.evidence_links.map((l) => (
                      <li key={l.chunk_id} className="rounded-md border border-line p-3">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <Prov kind="DOC" />
                          <a href={`/api/v1/documents/${l.document_id}/file${l.page_pdf ? `#page=${l.page_pdf}` : ""}`} target="_blank" rel="noreferrer">
                            {l.title}{l.page_pdf ? `, PDF p.${l.page_pdf}` : ""}{l.page_printed ? ` (printed p.${l.page_printed})` : ""}
                          </a>
                          <LinkLevel level={l.review_status} relation={l.relation_type}
                            note={l.review_status === "manually_reviewed" ? l.match_method.replace(/^manual_review /, "Reviewed ") : undefined} />
                          <span className="text-xs text-text-3">matched “{l.matched_text}”</span>
                        </div>
                        <p className="mt-1 text-sm text-text-2">{l.excerpt}</p>
                        <Link href={`/evidence?chunk=${encodeURIComponent(l.chunk_id)}`} className="text-sm">Open passage</Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Disclosure>

              {d.image_sets && (
                <Disclosure id="image-sets" title="Image-set rows in the same CSV (not burns)" action="Show the image-set rows">
                  <ul className="flex flex-col gap-2 text-sm">
                    {d.image_sets.map((s) => (
                      <li key={s.label}><b>{s.label}</b>: CSV says <span className="raw">{s.csv_description}</span>; documented role: {s.documented_role}.
                        {s.csv_role !== s.documented_role && <span className="ml-1 text-warn">Conflict flagged.</span>}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-sm"><Link href="/phenomena/spacecraft-fire">Open the SAFFIRE-I case study and frame timeline</Link></p>
                </Disclosure>
              )}

              <Disclosure id="flags" title="Data-quality flags" action="Show the flags"
                summary={<>{d.quality_flags.length} on this row{d.dataset_flags.length ? `, plus ${d.dataset_flags.length} notes about this dataset's columns` : ""}.</>}>
                {d.quality_flags.length === 0 ? <p className="text-sm text-text-2">No row-level flags.</p> : (
                  <ul className="flex flex-col gap-3">
                    {d.quality_flags.map((f) => (
                      <li key={f.flag_id} className="text-sm">
                        <div className="flex flex-wrap items-center gap-2"><Severity level={f.severity} />
                          <Link href={`/reliability?rule_id=${f.rule_id}`} className="font-semibold">{f.rule_id}</Link>
                          <span className="text-xs text-text-3">{f.status}</span></div>
                        <p className="mt-1 text-text-2">{f.description}</p>
                        {f.raw_value !== null && f.raw_field && <p className="mt-1 text-xs text-text-3">Cell <span className="raw">{f.raw_field}</span> = <span className="raw">{f.raw_value}</span></p>}
                        {f.evidence_ref && <p className="mt-1 text-xs text-text-3">Evidence: {f.evidence_ref}</p>}
                      </li>
                    ))}
                  </ul>
                )}
                {d.dataset_flags.length > 0 && (
                  <div className="mt-5">
                    <h3 className="subhead mb-2 text-[15px]">Column-level notes for this dataset</h3>
                  <ul className="flex flex-col gap-3 text-sm">
                    {d.dataset_flags.map((f) => (
                      <li key={f.flag_id}><div className="flex items-center gap-2"><Severity level={f.severity} /><b>{f.rule_id}</b></div>
                        <p className="mt-1 text-text-2">{f.description}</p>
                        {f.evidence_ref && <p className="text-xs text-text-3">Evidence: {f.evidence_ref}</p>}</li>
                    ))}
                  </ul>
                  </div>
                )}
              </Disclosure>

              <Disclosure id="provenance" title="Source provenance" action="Show the source file"
                summary="The NASA file, row and checksum this record was read from.">
                <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[160px_1fr]">
                  <dt className="text-text-2">File</dt><dd><span className="raw">{d.source.relative_path}</span></dd>
                  <dt className="text-text-2">Data row</dt><dd>{d.source.source_row} (file line {d.source.csv_line}, after the header)</dd>
                  <dt className="text-text-2">File SHA-256</dt><dd className="break-all text-text-3">{d.source.sha256}</dd>
                </dl>
              </Disclosure>
            </div>

            <div className="flex flex-col gap-5">
              {APPARATUS[d.dataset] && (
                <Panel title="Investigation imagery" aside={<Link href={`/evidence/media?phenomenon=${d.investigation_id}`}>All media</Link>}>
                  <MediaFigure id={APPARATUS[d.dataset]} aspect="16 / 10" compact sizes="(min-width: 1280px) 340px, 92vw"
                    caption={<>Investigation-level photograph: {MEDIA_BY_ID[APPARATUS[d.dataset]].title.charAt(0).toLowerCase() + MEDIA_BY_ID[APPARATUS[d.dataset]].title.slice(1)}. <b className="text-text">It does not show test {d.display_id}</b>: NASA&apos;s captions identify no individual test.</>} />
                </Panel>
              )}
              <Disclosure id="publications" title="Related publications" action="Show publications" summary="Listed by NASA PSI for the whole investigation.">
                <Loadable state={pubs} rows={3}>
                  {(p) => (
                    <>
                      <ul className="flex flex-col gap-2 text-sm">
                        {p.items.slice(0, 6).map((x) => (
                          <li key={x.title}>
                            {x.doi ? <a href={`https://doi.org/${x.doi}`} target="_blank" rel="noreferrer">{x.title}</a> : x.title}
                            {x.authors && <span className="block text-xs text-text-3">{x.authors.slice(0, 90)}</span>}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 text-xs text-text-3">These are citations listed by NASA for the whole investigation; their contents were not read. {p.items.length} listed.</p>
                      <Link className="text-sm" href={`/evidence/literature${qs({ q: d.investigation === "FLEX" ? "droplet flame extinction microgravity" : d.investigation === "BASS-II" ? "BASS-II flame spread solid microgravity" : "Saffire spacecraft fire experiment" })}`}>Search external research</Link>
                    </>
                  )}
                </Loadable>
              </Disclosure>
            </div>
          </div>
        </>
      )}
    </Loadable>
  );
}
