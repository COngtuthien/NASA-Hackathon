"use client";

import Link from "next/link";
import { Loadable, PageHeader, Panel, Prov } from "@/components/ui";
import { INV_LABEL, useApi } from "@/lib/api";

type Health = { database: { ingested_at: string; counts: Record<string, number> }; retrieval: { mode: string };
  llm: { configured: boolean; provider: string; model: string; reason: string | null }; external: Record<string, unknown> };
type Doc = { document_id: string; title: string; investigation_id: string; relative_path: string; sha256: string; scope_note: string | null };

export default function MethodologyView() {
  const h = useApi<Health>("/health");
  const docs = useApi<{ items: Doc[] }>("/documents");
  return (
    <>
      <PageHeader kicker="Trust & methods" title="Methodology"
        lead="How SpaceFire turns NASA files into searchable, citable evidence, and the rules it follows so that nothing is invented." />
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Provenance labels">
          <ul className="flex flex-col gap-3 text-sm">
            <li><Prov kind="ORIGINAL_EXPERIMENT" /> An exact cell from a NASA CSV/XLSX, shown with its file, row, column and SHA-256.</li>
            <li><Prov kind="DOC" /> Text from a NASA document, cited with the PDF page (and printed page when the offset is known).</li>
            <li><Prov kind="COMPUTED" /> A deterministic calculation by SpaceFire code; formula, n, filters and exclusions are shown.</li>
            <li><Prov kind="EXTERNAL" /> Metadata or an abstract from NASA NTRS, OpenAlex or Crossref. Full texts are never read or summarized.</li>
            <li><Prov kind="HYPOTHESIS" /> An interpretation that the sources do not confirm.</li>
            <li><Prov kind="UNSUPPORTED" /> The question cannot be answered from the available evidence; no value is produced.</li>
          </ul>
        </Panel>
        <Panel title="Rules the system follows">
          <ul className="list-disc pl-5 text-sm text-text-2">
            <li>Original NASA folders are read-only; tests check that their SHA-256 hashes never change.</li>
            <li>Every cell keeps its raw text. Blank, dash (–), “none”, “OR”, “over”, “&gt;500”, “~6” and ranges are distinct states.</li>
            <li>Header interpretations (FLEX “CO” as CO₂, “Burning rate; mm” as mm²/s) are separate annotations with evidence; the original header is kept.</li>
            <li>FLEX, BASS-II and SAFFIRE-I measure different physical systems and are never pooled into one numeric scale or model.</li>
            <li>BASS-II gases are before/after readings; Fan display is never treated as a velocity.</li>
            <li>The SAFFIRE workbook is an image manifest; file sizes are never used as a flame measurement.</li>
            <li>The language model, when configured, only phrases answers from retrieved evidence; numbers must appear in cited tool output, or the statement is removed.</li>
            <li>Document text and external metadata are treated as untrusted data, never as instructions.</li>
          </ul>
        </Panel>
        <Panel title="System state">
          <Loadable state={h} rows={4}>
            {(d) => (
              <ul className="text-sm">
                <li>Data imported {d.database.ingested_at}</li>
                <li>Rows: FLEX {d.database.counts.flex_burns}, BASS-II {d.database.counts.bass2_burns}, SAFFIRE-I {d.database.counts.saffire1_burns} burns (+{d.database.counts.saffire1_image_sets} image-set rows)</li>
                <li>{d.database.counts.documents} documents, {d.database.counts.chunks} indexed passages, {d.database.counts.quality_flags} quality flags</li>
                <li>Search mode: {d.retrieval.mode}</li>
                <li>AI synthesis: {d.llm.configured ? `${d.llm.provider} ${d.llm.model}` : `off. ${d.llm.reason}`}</li>
              </ul>
            )}
          </Loadable>
        </Panel>
        <Panel title="Official data sources">
          <ul className="text-sm">
            <li><a href="https://psi.nasa.gov/physci/repo/data/investigations/PSI-69" target="_blank" rel="noreferrer">FLEX, PSI-69</a> (DOI 10.60555/mbq8-0451)</li>
            <li><a href="https://psi.nasa.gov/physci/repo/data/investigations/PSI-25" target="_blank" rel="noreferrer">BASS-II, PSI-25</a> (DOI 10.60555/4qc4-de67)</li>
            <li><a href="https://psi.nasa.gov/physci/repo/data/investigations/PSI-98" target="_blank" rel="noreferrer">SAFFIRE-I, PSI-98</a> (DOI 10.60555/0t15-1z43)</li>
            <li>Literature: <a href="https://ntrs.nasa.gov/" target="_blank" rel="noreferrer">NASA NTRS</a>, <a href="https://openalex.org/" target="_blank" rel="noreferrer">OpenAlex</a>, <a href="https://www.crossref.org/" target="_blank" rel="noreferrer">Crossref</a></li>
          </ul>
          <p className="mt-2 text-xs text-text-3">NASA public data. External records keep their provider attribution and links; no paywalled content is stored.</p>
        </Panel>
      </div>
      <div className="mt-5">
        <Panel title="Indexed source documents">
          <Loadable state={docs} rows={6}>
            {(d) => (
              <div className="overflow-x-auto"><table className="data"><thead><tr><th>Document</th><th>Investigation</th><th>File</th><th>Scope note</th></tr></thead>
                <tbody>{d.items.map((x) => <tr key={x.document_id}><td><Link href={`/evidence?q=${encodeURIComponent(x.title.split(" (")[0])}&investigation=${x.investigation_id}`}>{x.title}</Link></td>
                  <td>{INV_LABEL[x.investigation_id]}</td><td><span className="raw">{x.relative_path}</span></td><td className="text-sm text-text-2">{x.scope_note}</td></tr>)}</tbody></table></div>
            )}
          </Loadable>
        </Panel>
      </div>
    </>
  );
}
