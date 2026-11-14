"use client";

// Phase 16: source-backed investigation profile (ISA-Tab metadata, documents, publications, limitations, documented
// relations). Used on its own for metadata-only investigations (PSI-62) and as a compact panel above each collection.
import Link from "next/link";
import { useState } from "react";
import { docHref } from "@/components/evidence-tag";
import { Loadable } from "@/components/ui";
import { useCachedApi } from "@/lib/api";

type Profile = {
  investigation_id: string; short_name: string; title: string; doi: string | null; psi_url: string | null; platform: string | null;
  objective: string | null; readiness: string; readiness_label: string; limitations: { code: string; text: string }[];
  related: { investigation_id: string; relation: string }[]; studies: { phenomenon: string; focus: string }[];
  documents: { document_id: string; title: string; doc_type: string }[]; publications: { title: string; doi: string | null }[];
  publication_count: number; collections: { key: string; title: string; badge: string }[]; scenario: string | null; route: string | null;
};

export default function InvestigationProfile({ inv, compact = false }: { inv: string; compact?: boolean }) {
  const p = useCachedApi<Profile>(`/combustion/investigation/${inv}`);
  const [open, setOpen] = useState(!compact);
  return (
    <Loadable state={p} rows={3}>{(x) => (
      <section className="rounded-xl border border-line/60 bg-panel/40 p-4" data-testid="investigation-profile" data-inv={x.investigation_id}>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[15.5px] font-semibold text-text">{x.short_name} · {x.investigation_id}</h3>
          <span className="rounded border border-line-strong/70 px-1.5 py-px text-[12px] text-text-2" data-testid="profile-readiness">{x.readiness_label}</span>
          {compact && <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="ml-auto text-[13px] text-link">{open ? "Hide investigation details" : "About this investigation"}</button>}
        </div>
        <p className="mt-1 text-[13.5px] text-text-2">{x.title}{x.platform ? ` · ${x.platform}` : ""}</p>
        {open && (
          <div className="mt-3 grid gap-4 text-[13.5px] text-text-2 md:grid-cols-2">
            <div>
              {x.objective && <p className="line-clamp-6">{x.objective}</p>}
              <ul className="mt-2 list-disc pl-5 text-warn" data-testid="profile-limitations">{x.limitations.map((l) => <li key={l.code}>{l.text}</li>)}</ul>
              {x.related.length > 0 && <p className="mt-2">Related: {x.related.map((r, i) => <span key={r.investigation_id}>{i ? "; " : ""}{r.investigation_id} ({r.relation})</span>)}</p>}
              <p className="mt-2 flex flex-wrap gap-3">
                {x.psi_url && <a href={x.psi_url} target="_blank" rel="noreferrer">NASA PSI record</a>}
                {x.doi && <a href={`https://doi.org/${x.doi}`} target="_blank" rel="noreferrer">DOI {x.doi}</a>}
                {x.scenario && <Link href={`/safety-explorer/${x.scenario}`}>Research-to-Safety scenario</Link>}
              </p>
            </div>
            <div>
              <p className="font-medium text-text">Documents in SpaceFire ({x.documents.length})</p>
              <ul className="mt-1 flex flex-col gap-0.5">{x.documents.slice(0, 6).map((d) => (
                <li key={d.document_id}>{d.doc_type === "metadata" ? d.title : <a href={docHref(d.document_id)} target="_blank" rel="noreferrer">{d.title}</a>}</li>))}</ul>
              <p className="mt-2 font-medium text-text">NASA publication list ({x.publication_count ?? x.publications.length})</p>
              <ul className="mt-1 flex flex-col gap-0.5">{x.publications.slice(0, 4).map((d) => <li key={d.title} className="line-clamp-1">{d.title}</li>)}</ul>
            </div>
          </div>
        )}
      </section>
    )}</Loadable>
  );
}
