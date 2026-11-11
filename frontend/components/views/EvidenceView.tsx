"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent } from "react";
import { Button, Callout, Empty, Field, inputCls, Loadable, PageHeader, Panel, Prov } from "@/components/ui";
import { expHref, INV_LABEL, qs, useApi, useDraft } from "@/lib/api";

type Result = {
  result_type: string; evidence_id: string; chunk_id: string | null; document_id: string | null; title: string;
  investigation_id: string | null; doc_type: string; year: number | null; page_pdf: number | null; page_printed: number | null;
  section: string | null; snippet: string; citation: string; source_url: string | null; access_level: string;
  rank_label: string; reasons: string[]; scores: { fused: number; lexical_rank: number | null; semantic_rank: number | null };
  linked_experiments: { experiment_uid: string; matched_text: string }[];
};
type SearchResp = { results: Result[]; total: number; retrieval_mode: string; score_note: string; terms: string[];
  experiment_matches: { experiment_uid: string; display_id: string; investigation_id: string; source_row: number }[] };
type Chunk = { chunk_id: string; document_id: string; title: string; page_pdf: number | null; page_printed: number | null;
  section: string | null; text: string; citation: string; source_url: string; scope_note: string | null; relative_path: string;
  linked_experiments: { experiment_uid: string; display_id: string; matched_text: string }[];
  neighbors: { chunk_id: string; page_pdf: number | null; ordinal: number }[]; ordinal: number };
type Doc = { document_id: string; title: string; investigation_id: string; doc_type: string; page_count: number | null;
  chunk_count: number; year: number | null; scope_note: string | null; file_url: string; low_text_pages: number[] };

function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return <>{text}</>;
  const rx = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "[\\s-]+")).join("|")})`, "gi");
  return <>{text.split(rx).map((p, i) => (i % 2 ? <mark key={i} className="rounded bg-data/20 px-0.5 text-text">{p}</mark> : <span key={i}>{p}</span>))}</>;
}

export default function EvidenceView() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const q = sp.get("q") ?? "";
  const chunk = sp.get("chunk");
  const [draft, setDraft] = useDraft(q);
  const params = { q, investigation: sp.get("investigation"), source_type: sp.get("source_type") ?? "all",
    doc_type: sp.get("doc_type"), year_min: sp.get("year_min"), year_max: sp.get("year_max"), limit: 20 };
  const res = useApi<SearchResp>(q ? `/evidence/search${qs(params)}` : null);
  const ch = useApi<Chunk>(chunk ? `/evidence/${encodeURIComponent(chunk)}` : null);
  const docs = useApi<{ items: Doc[] }>(`/documents${qs({ investigation: sp.get("investigation") })}`);

  function set(patch: Record<string, string | null>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    set({ q: draft.trim() || null, chunk: null });
  }

  return (
    <>
      <PageHeader kicker="Evidence & Literature" title="NASA document evidence"
        lead="Hybrid search over 20 NASA source documents: keyword ranking (BM25) fused with a local semantic index. Every hit is a verbatim passage with its PDF page; rank labels describe retrieval relevance, not whether a claim is true." />
      <form onSubmit={submit} className="mb-4 grid gap-3 rounded-lg border border-line bg-panel p-4 md:grid-cols-[1fr_180px_180px_auto] md:items-end">
        <Field label="Search" htmlFor="eq"><input id="eq" className={inputCls} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="e.g. M5, BASS-II Table 5.1, FLEX d²-law, SIBAL" /></Field>
        <Field label="Investigation" htmlFor="einv">
          <select id="einv" className={inputCls} value={sp.get("investigation") ?? ""} onChange={(e) => set({ investigation: e.target.value || null })}>
            <option value="">All</option><option value="PSI-69">FLEX</option><option value="PSI-25">BASS-II</option><option value="PSI-98">SAFFIRE-I</option>
          </select>
        </Field>
        <Field label="Source type" htmlFor="est">
          <select id="est" className={inputCls} value={sp.get("source_type") ?? "all"} onChange={(e) => set({ source_type: e.target.value })}>
            <option value="all">NASA documents + saved external abstracts</option><option value="nasa_document">NASA documents</option><option value="external_abstract">Saved external abstracts</option>
          </select>
        </Field>
        <Button type="submit" variant="primary">Search</Button>
      </form>

      <div className="grid gap-5 xl:grid-cols-[1fr_400px]">
        <div className="min-w-0">
          {!q ? (
            <Empty title="Search the NASA documents">Start with a test ID like <Link href="/evidence?q=M5">M5</Link>, a table like <Link href={`/evidence?q=${encodeURIComponent("BASS-II Table 5.1")}`}>BASS-II Table 5.1</Link>, or a concept like <Link href={`/evidence?q=${encodeURIComponent("cool flame heptane")}`}>cool flame heptane</Link>.</Empty>
          ) : (
            <Loadable state={res} rows={8}>
              {(d) => (
                <Panel title={`${d.total} passages`} aside={`Mode: ${d.retrieval_mode}`}>
                  <p className="mb-3 text-xs text-text-3">{d.score_note}</p>
                  {d.experiment_matches.length > 0 && (
                    <div className="mb-3"><Callout>Experiment records with this ID: {d.experiment_matches.map((e) => (
                      <Link key={e.experiment_uid} className="mr-3" href={expHref(e.experiment_uid)}>{INV_LABEL[e.investigation_id]} {e.display_id} (row {e.source_row})</Link>))}</Callout></div>
                  )}
                  {d.results.length === 0 ? <Empty title="No passage matches">Try fewer words or another investigation.</Empty> : (
                    <ol className="flex flex-col gap-3">
                      {d.results.map((r, i) => (
                        <li key={r.evidence_id} className="rounded-md border border-line p-3">
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="text-text-3">{i + 1}.</span>
                            <Prov kind={r.result_type === "nasa_document" ? "DOC" : "EXTERNAL"} />
                            <span className={`text-xs font-semibold ${r.rank_label === "High relevance" ? "text-data" : "text-text-3"}`}>{r.rank_label}</span>
                            {r.investigation_id && <span className="text-xs text-text-3">{INV_LABEL[r.investigation_id]}</span>}
                          </div>
                          <p className="mt-1 font-semibold">{r.citation}</p>
                          {r.section && <p className="text-xs text-text-3">Section: {r.section}</p>}
                          <p className="mt-1 text-sm text-text-2 [overflow-wrap:anywhere]"><Highlight text={r.snippet} terms={d.terms} /></p>
                          <p className="mt-1 text-xs text-text-3">Why ranked here: {r.reasons.join("; ")}</p>
                          <div className="mt-1 flex flex-wrap gap-x-4 text-sm">
                            {r.chunk_id && <button className="text-link" onClick={() => set({ chunk: r.chunk_id })}>Read full passage</button>}
                            {r.source_url && <a href={r.source_url} target="_blank" rel="noreferrer">{r.result_type === "nasa_document" ? "Open source file at this page" : "Open publication"}</a>}
                            {r.linked_experiments.slice(0, 5).map((l) => <Link key={l.experiment_uid} href={expHref(l.experiment_uid)}>Test {l.matched_text}</Link>)}
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </Panel>
              )}
            </Loadable>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          {chunk && (
            <Panel title="Passage" aside={<button className="text-link" onClick={() => set({ chunk: null })}>Close</button>}>
              <Loadable state={ch} rows={8}>
                {(c) => (
                  <div className="text-sm">
                    <p className="font-semibold">{c.citation}</p>
                    <p className="text-xs text-text-3">File <span className="raw">{c.relative_path}</span>, chunk {c.chunk_id}</p>
                    {c.scope_note && <div className="mt-2"><Callout tone="warn">{c.scope_note}</Callout></div>}
                    <p className="mt-2 whitespace-pre-wrap text-text-2 [overflow-wrap:anywhere]"><Highlight text={c.text} terms={res.data?.terms ?? []} /></p>
                    <div className="mt-2 flex flex-wrap gap-3">
                      <a href={c.source_url} target="_blank" rel="noreferrer">Open the source file{c.page_pdf ? ` at PDF p.${c.page_pdf}` : ""}</a>
                      {c.neighbors.map((n) => <button key={n.chunk_id} className="text-link" onClick={() => set({ chunk: n.chunk_id })}>{n.ordinal < c.ordinal ? "Previous passage" : "Next passage"}</button>)}
                    </div>
                    {c.linked_experiments.length > 0 && <p className="mt-2 flex flex-wrap gap-x-2 gap-y-0.5"><span>Tests named here:</span> {c.linked_experiments.map((l) => <Link key={l.experiment_uid} href={expHref(l.experiment_uid)}>{l.display_id}</Link>)}</p>}
                  </div>
                )}
              </Loadable>
            </Panel>
          )}
          <Panel title="Indexed documents">
            <Loadable state={docs} rows={6}>
              {(d) => (
                <ul className="flex flex-col gap-2 text-sm">
                  {d.items.map((x) => (
                    <li key={x.document_id}>
                      <a href={x.file_url} target="_blank" rel="noreferrer">{x.title}</a>
                      <span className="block text-xs text-text-3">{INV_LABEL[x.investigation_id]}, {x.doc_type.replace("_", " ")}{x.year ? `, ${x.year}` : ""}{x.page_count ? `, ${x.page_count} pages` : ""}, {x.chunk_count} passages{x.low_text_pages.length ? `, ${x.low_text_pages.length} image-only pages not searchable` : ""}</span>
                      {x.scope_note && <span className="block text-xs text-warn">{x.scope_note}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </Loadable>
          </Panel>
        </div>
      </div>
    </>
  );
}
