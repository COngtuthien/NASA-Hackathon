"use client";

// Phase 16: detail page for a Phase 13 record (CFI-G test point, Flame Design condition, BRE day, SAME log or size row,
// PSI-117 series, FLEX-2 plan row): identity, values with their role, the raw source cells, provenance, flags, the
// knowledge-graph sources and links to charts or 3D.
import Link from "next/link";
import { useParams } from "next/navigation";
import { docHref } from "@/components/evidence-tag";
import { Loadable, PageHeader, Panel } from "@/components/ui";
import { fmt, useApi } from "@/lib/api";
import { LEVEL_CLS } from "./DomainPicker";

type Rec = {
  record_id: string; dataset: string; dataset_title: string; investigation_id: string; level: string; level_label: string; badge: string;
  note: string; test_id: string; fields: { field: string; label: string; unit: string | null; role: string; value: unknown }[];
  raw: Record<string, unknown>; provenance: { source_file: string; source_table: string | null; page_pdf: number | null; source_row: number | null;
    verification: string; document_id: string | null };
  flags: { rule_id: string; severity: string | null; description: string | null }[]; graph: { node_id: string; sources: string[] } | null;
  links: { label: string; href: string }[];
};
const ROLE: Record<string, string> = { outcome: "Outcome", condition: "Condition", derived: "Derived", id: "Identity", log: "Log" };
const show = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : typeof v === "boolean" ? (v ? "yes" : "no") : Array.isArray(v) ? v.join(", ") : fmt(v));

export default function RecordView() {
  const { uid } = useParams<{ dataset: string; uid: string }>();
  const id = decodeURIComponent(uid);
  const r = useApi<Rec>(`/combustion/record/${encodeURIComponent(id)}`);
  return (
    <Loadable state={r} rows={10}>{(x) => (
      <div className="flex flex-col gap-5" data-testid="record-view" data-record={x.record_id}>
        <nav className="text-[13.5px]"><Link href={`/experiments?dataset=${x.dataset}`}>← {x.dataset_title}</Link></nav>
        <PageHeader kicker={`${x.investigation_id} · ${x.dataset_title}`} title={`${x.dataset_title.replace(/s$/, "")}: ${x.test_id || x.record_id}`} />
        <p className="flex flex-wrap items-center gap-2 text-[14px] text-text-2">
          <span className={`rounded border px-1.5 py-px text-[12px] font-medium ${LEVEL_CLS[x.level] ?? ""}`} data-testid="record-badge">{x.badge}</span>{x.note}
        </p>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <Panel title="Values">
            <table className="data" data-testid="record-values"><thead><tr><th>Field</th><th>Value</th><th>Role</th></tr></thead>
              <tbody>{x.fields.map((f) => <tr key={f.field}><td>{f.label}</td><td className={f.role === "outcome" ? "text-data" : ""}>{show(f.value)}{f.unit && f.value !== null && f.value !== undefined ? ` ${f.unit}` : ""}</td><td className="text-text-3">{ROLE[f.role] ?? f.role}</td></tr>)}</tbody></table>
          </Panel>
          <div className="flex flex-col gap-4">
            <Panel title="Provenance">
              <dl className="grid gap-1 text-[13.5px]" data-testid="record-provenance">
                <dt className="text-text-3">Source file</dt><dd className="break-all">{x.provenance.source_file}</dd>
                {x.provenance.source_table && <><dt className="text-text-3">Table</dt><dd>{x.provenance.source_table}</dd></>}
                {x.provenance.source_row !== null && <><dt className="text-text-3">CSV row</dt><dd>{x.provenance.source_row}</dd></>}
                {x.provenance.page_pdf !== null && <><dt className="text-text-3">PDF page</dt><dd>{x.provenance.document_id
                  ? <a href={docHref(x.provenance.document_id, x.provenance.page_pdf)} target="_blank" rel="noreferrer">p.{x.provenance.page_pdf}</a> : `p.${x.provenance.page_pdf}`}</dd></>}
                <dt className="text-text-3">Verification</dt><dd>{x.provenance.verification.replace(/_/g, " ")}</dd>
              </dl>
            </Panel>
            <Panel title={`Data-quality flags (${x.flags.length})`}>
              {x.flags.length ? <ul className="flex flex-col gap-1 text-[13px]" data-testid="record-flags">{x.flags.map((f) => <li key={f.rule_id}><b className="text-warn">{f.rule_id}</b> {f.description}</li>)}</ul>
                : <p className="text-[13px] text-text-3">No flag on this record.</p>}
            </Panel>
            <Panel title="Explore further">
              <ul className="flex flex-col gap-1 text-[13.5px]">{x.links.map((l) => <li key={l.href}><Link href={l.href}>{l.label}</Link></li>)}</ul>
              {x.graph && <p className="mt-2 text-[12.5px] text-text-3">Knowledge graph sources: {x.graph.sources.join(" · ")}</p>}
            </Panel>
          </div>
        </div>
        <Panel title="Raw source cells (exactly as in the file)">
          <div className="overflow-x-auto"><table className="data"><tbody>{Object.entries(x.raw).filter(([, v]) => typeof v !== "object" || v === null).slice(0, 60).map(([k, v]) => <tr key={k}><td className="text-text-3">{k}</td><td>{String(v ?? "")}</td></tr>)}</tbody></table></div>
        </Panel>
      </div>
    )}</Loadable>
  );
}
