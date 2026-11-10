"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Callout, Empty, Kind, LinkButton, Loadable, PageHeader, Panel, Prov, Severity } from "@/components/ui";
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
  section: string | null; excerpt: string; matched_text: string; review_status: string };
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
          <PageHeader title={`${d.investigation} ${d.display_id}`}
            lead={<>Canonical record <span className="raw">{d.experiment_uid}</span>, a {d.experiment_kind} row from investigation {d.investigation_id}.</>}
            actions={
              <>
                <LinkButton href={`/compare${qs({ uids: d.experiment_uid })}`}>Compare with others</LinkButton>
                <LinkButton href={`/similar${qs({ uid: d.experiment_uid })}`}>Find similar tests</LinkButton>
                <LinkButton variant="primary" href={`/assistant${qs({ q: `Explain ${d.investigation} test ${d.display_id}`, uid: d.experiment_uid })}`}>Ask about this test</LinkButton>
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

          <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
            <div className="flex min-w-0 flex-col gap-5">
              <Panel title="Source provenance">
                <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[160px_1fr]">
                  <dt className="text-text-2">File</dt><dd><span className="raw">{d.source.relative_path}</span></dd>
                  <dt className="text-text-2">Data row</dt><dd>{d.source.source_row} (file line {d.source.csv_line}, after the header)</dd>
                  <dt className="text-text-2">File SHA-256</dt><dd className="break-all text-text-3">{d.source.sha256}</dd>
                </dl>
              </Panel>

              <Panel title="Recorded values" aside="Original cell text is shown exactly as in the NASA file">
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
              </Panel>

              {d.image_sets && (
                <Panel title="Image-set rows in the same CSV (not burns)">
                  <ul className="flex flex-col gap-2 text-sm">
                    {d.image_sets.map((s) => (
                      <li key={s.label}><b>{s.label}</b>: CSV says <span className="raw">{s.csv_description}</span>; documented role: {s.documented_role}.
                        {s.csv_role !== s.documented_role && <span className="ml-1 text-warn">Conflict flagged.</span>}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-sm"><Link href="/physics/saffire-i">Open the SAFFIRE-I case study and frame timeline</Link></p>
                </Panel>
              )}

              {d.report_records.length > 0 && (
                <Panel title="Values printed in the NASA Summary Report" aside={`${d.report_records.length} table rows`}>
                  <p className="mb-3 text-sm text-text-2">Extracted from report tables and checked against this test&apos;s CSV values. Values the CSV does not contain (flow direction, spread rates, observations) come only from the report page cited.</p>
                  <div className="flex flex-col gap-3">{d.report_records.map((r) => <ReportRecordCard key={r.record_id} r={r} />)}</div>
                </Panel>
              )}
              <Panel title="Report pages mentioning this test" aside={`${d.evidence_links.length} links`}>
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
                          <LinkLevel level={l.review_status} />
                          <span className="text-xs text-text-3">matched “{l.matched_text}”</span>
                        </div>
                        <p className="mt-1 text-sm text-text-2">{l.excerpt}</p>
                        <Link href={`/evidence?chunk=${encodeURIComponent(l.chunk_id)}`} className="text-sm">Open passage</Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>

            <div className="flex flex-col gap-5">
              <Panel title="Quality flags" aside={`${d.quality_flags.length} on this row`}>
                {d.quality_flags.length === 0 ? <p className="text-sm text-text-2">No row-level flags.</p> : (
                  <ul className="flex flex-col gap-3">
                    {d.quality_flags.map((f) => (
                      <li key={f.flag_id} className="text-sm">
                        <div className="flex flex-wrap items-center gap-2"><Severity level={f.severity} />
                          <Link href={`/quality?rule_id=${f.rule_id}`} className="font-semibold">{f.rule_id}</Link>
                          <span className="text-xs text-text-3">{f.status}</span></div>
                        <p className="mt-1 text-text-2">{f.description}</p>
                        {f.raw_value !== null && f.raw_field && <p className="mt-1 text-xs text-text-3">Cell <span className="raw">{f.raw_field}</span> = <span className="raw">{f.raw_value}</span></p>}
                        {f.evidence_ref && <p className="mt-1 text-xs text-text-3">Evidence: {f.evidence_ref}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
              {d.dataset_flags.length > 0 && (
                <Panel title="Column-level notes for this dataset">
                  <ul className="flex flex-col gap-3 text-sm">
                    {d.dataset_flags.map((f) => (
                      <li key={f.flag_id}><div className="flex items-center gap-2"><Severity level={f.severity} /><b>{f.rule_id}</b></div>
                        <p className="mt-1 text-text-2">{f.description}</p>
                        {f.evidence_ref && <p className="text-xs text-text-3">Evidence: {f.evidence_ref}</p>}</li>
                    ))}
                  </ul>
                </Panel>
              )}
              <Panel title="Related publications" aside="Listed in NASA PSI metadata">
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
                      <Link className="text-sm" href={`/research${qs({ q: d.investigation === "FLEX" ? "droplet flame extinction microgravity" : d.investigation === "BASS-II" ? "BASS-II flame spread solid microgravity" : "Saffire spacecraft fire experiment" })}`}>Search external research</Link>
                    </>
                  )}
                </Loadable>
              </Panel>
            </div>
          </div>
        </>
      )}
    </Loadable>
  );
}
