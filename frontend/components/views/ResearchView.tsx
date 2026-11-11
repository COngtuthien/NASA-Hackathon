"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Callout, Empty, ErrorState, Field, inputCls, Loadable, PageHeader, Pager, Panel, Skeleton } from "@/components/ui";
import { qs, useApi } from "@/lib/api";

type Paper = {
  paper_id: string; doi: string | null; title: string; authors: string[]; year: number | null; venue: string | null;
  canonical_url: string | null; abstract: string | null; is_open_access: boolean | null; fulltext_url: string | null;
  doc_type: string | null; cited_by_count: number | null; found_in: string[]; access_type: string; fulltext_read: boolean;
  nasa_psi_listed?: string[];
};
type ProviderStatus = { status: string; fetched_at?: string; is_stale?: boolean; error?: string; returned?: number; total?: number; cache?: string };
type SearchResp = { results: Paper[]; total: number; providers: Record<string, ProviderStatus>; external_available?: boolean;
  message?: string | null; fulltext_policy: string; mode: string; provider_totals?: Record<string, number> };
type Related = { references: Paper[]; related: Paper[]; relation_semantics: Record<string, string>; note: string | null;
  providers: Record<string, ProviderStatus> };
type Doi = { doi: string; verified: boolean; paper: Paper | null; providers: Record<string, ProviderStatus>;
  listed_in_nasa_psi_metadata: { investigation_id: string; title: string }[]; note: string | null };

function ProviderLine({ p }: { p: Record<string, ProviderStatus> }) {
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {Object.entries(p).map(([k, v]) => (
        <span key={k} className={v.status === "ok" ? "text-ok" : v.status === "stale_cache" ? "text-warn" : "text-crit"}>
          {k === "ntrs" ? "NASA NTRS" : k === "openalex" ? "OpenAlex" : k}: {v.status === "ok" ? `${v.cache === "hit" ? "cached" : "live"}${v.total !== undefined ? `, ${v.total.toLocaleString()} matches` : ""}`
            : v.status === "stale_cache" ? `offline, showing cache from ${v.fetched_at?.slice(0, 16)}` : v.status === "not_found" ? "not found" : `unavailable (${v.error})`}
        </span>
      ))}
    </p>
  );
}

function PaperItem({ p, onRelated }: { p: Paper; onRelated?: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="border-b border-line py-3 last:border-0">
      <a href={p.canonical_url ?? "#"} target="_blank" rel="noreferrer" className="font-semibold">{p.title}</a>
      <p className="text-sm text-text-2">{p.authors.slice(0, 5).join(", ")}{p.authors.length > 5 ? ", et al." : ""}{p.year ? ` (${p.year})` : ""}{p.venue ? `, ${p.venue}` : ""}</p>
      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-3">
        {p.nasa_psi_listed && p.nasa_psi_listed.length > 0 && (
          <span className="rounded border border-ok/50 px-1 text-ok" title="This DOI is listed in NASA PSI investigation metadata">
            Listed by NASA PSI for {p.nasa_psi_listed.map((i) => ({ "PSI-69": "FLEX", "PSI-25": "BASS-II", "PSI-98": "SAFFIRE-I" } as Record<string, string>)[i] ?? i).join(", ")}
          </span>)}
        <span>Found in {p.found_in.map((f) => (f === "ntrs" ? "NASA NTRS" : f === "openalex" ? "OpenAlex" : f)).join(" and ")}</span>
        {p.doi && <a href={`https://doi.org/${p.doi}`} target="_blank" rel="noreferrer">doi:{p.doi}</a>}
        <span className={p.access_type === "abstract" ? "text-data" : ""}>{p.access_type === "abstract" ? "Abstract available, full text not read" : "Metadata only"}</span>
        {p.is_open_access && p.fulltext_url && <a href={p.fulltext_url} target="_blank" rel="noreferrer">Open-access full text</a>}
        {p.cited_by_count !== null && <span>Cited by {p.cited_by_count}</span>}
      </p>
      <div className="mt-1 flex gap-3 text-sm">
        {p.abstract && <button className="text-link" onClick={() => setOpen((o) => !o)} aria-expanded={open}>{open ? "Hide abstract" : "Show abstract"}</button>}
        {onRelated && <button className="text-link" onClick={() => onRelated(p.paper_id)}>Related works</button>}
      </div>
      {open && p.abstract && <p className="mt-2 max-w-[80ch] text-sm text-text-2">{p.abstract}</p>}
    </li>
  );
}

export default function ResearchView() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const q = sp.get("q") ?? "";
  const [draft, setDraft] = useState({ q, author: sp.get("author") ?? "", year_min: sp.get("year_min") ?? "",
    year_max: sp.get("year_max") ?? "", open_access: sp.get("open_access") ?? "", sort: sp.get("sort") ?? "relevance",
    sources: sp.get("sources") ?? "ntrs,openalex" });
  const page = Number(sp.get("page") ?? "1");
  const search = useApi<SearchResp>(q ? `/research/search?${new URLSearchParams({ ...Object.fromEntries(sp.entries()) }).toString()}` : null);
  const [relId, setRelId] = useState<string | null>(null);
  const rel = useApi<Related>(relId ? `/research/${encodeURIComponent(relId)}/related` : null);
  const [doiDraft, setDoiDraft] = useState("");
  const [doi, setDoi] = useState<string | null>(null);
  const doiRes = useApi<Doi>(doi ? `/research/doi/${doi}` : null);

  function submit(e: FormEvent) {
    e.preventDefault();
    router.replace(`${pathname}${qs({ ...draft, open_access: draft.open_access || null })}`);
  }
  const srcs = draft.sources.split(",").filter(Boolean);

  return (
    <>
      <PageHeader kicker="Evidence & Literature" title="External scientific literature"
        lead="Search NASA's Technical Reports Server and OpenAlex. Results with the same DOI are merged. SpaceFire reads abstracts only when the provider supplies them, and never claims a paper's full-text findings." />
      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <div className="flex flex-col gap-5">
          <Panel title="Search">
            <form onSubmit={submit} className="flex flex-col gap-3">
              <Field label="Topic, title or keywords" htmlFor="rq">
                <input id="rq" className={inputCls} value={draft.q} onChange={(e) => setDraft({ ...draft, q: e.target.value })} placeholder="e.g. cool flame droplet extinction" />
              </Field>
              <fieldset className="text-sm"><legend className="text-text-2">Providers</legend>
                {[["ntrs", "NASA NTRS"], ["openalex", "OpenAlex"]].map(([v, l]) => (
                  <label key={v} className="mr-3 inline-flex items-center gap-1.5"><input type="checkbox" checked={srcs.includes(v)}
                    onChange={() => setDraft({ ...draft, sources: (srcs.includes(v) ? srcs.filter((x) => x !== v) : [...srcs, v]).join(",") })} />{l}</label>
                ))}
              </fieldset>
              <Field label="Author" htmlFor="ra"><input id="ra" className={inputCls} value={draft.author} onChange={(e) => setDraft({ ...draft, author: e.target.value })} /></Field>
              <div className="flex gap-2">
                <Field label="From year" htmlFor="ry1"><input id="ry1" type="number" className={`${inputCls} w-full`} value={draft.year_min} onChange={(e) => setDraft({ ...draft, year_min: e.target.value })} /></Field>
                <Field label="To year" htmlFor="ry2"><input id="ry2" type="number" className={`${inputCls} w-full`} value={draft.year_max} onChange={(e) => setDraft({ ...draft, year_max: e.target.value })} /></Field>
              </div>
              <Field label="Open access" htmlFor="roa">
                <select id="roa" className={inputCls} value={draft.open_access} onChange={(e) => setDraft({ ...draft, open_access: e.target.value })}>
                  <option value="">Any</option><option value="true">Open access only</option><option value="false">Not open access</option>
                </select>
              </Field>
              <Field label="Sort" htmlFor="rs">
                <select id="rs" className={inputCls} value={draft.sort} onChange={(e) => setDraft({ ...draft, sort: e.target.value })}>
                  <option value="relevance">Relevance</option><option value="date">Newest first</option>
                </select>
              </Field>
              <Button type="submit" variant="primary" disabled={!draft.q.trim() || srcs.length === 0}>Search</Button>
            </form>
          </Panel>
          <Panel title="Verify a DOI">
            <form onSubmit={(e) => { e.preventDefault(); setDoi(doiDraft.trim() || null); }} className="flex flex-col gap-2">
              <label htmlFor="doi" className="sr-only">DOI</label>
              <input id="doi" className={inputCls} value={doiDraft} onChange={(e) => setDoiDraft(e.target.value)} placeholder="10.1016/j.combustflame.2018.10.012" />
              <Button type="submit" disabled={!doiDraft.trim()}>Verify</Button>
            </form>
            {doi && (
              <div className="mt-3 text-sm">
                <Loadable state={doiRes} rows={3}>
                  {(d) => (
                    <div className="flex flex-col gap-2">
                      <p className={d.verified ? "text-ok" : "text-warn"}>{d.verified ? "Registered with Crossref" : "Not verified by Crossref"}</p>
                      <ProviderLine p={d.providers} />
                      {d.paper ? <ul><PaperItem p={d.paper} /></ul> : <p className="text-text-2">{d.note}</p>}
                      {d.listed_in_nasa_psi_metadata.length > 0 && <p className="text-text-2">Listed in NASA PSI metadata for {d.listed_in_nasa_psi_metadata.map((x) => x.investigation_id).join(", ")}.</p>}
                    </div>
                  )}
                </Loadable>
              </div>
            )}
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          {!q ? (
            <Empty title="Search the literature">Try <button className="text-link" onClick={() => router.replace(`${pathname}?q=${encodeURIComponent("cool flame droplet microgravity")}`)}>cool flame droplet microgravity</button> or <button className="text-link" onClick={() => router.replace(`${pathname}?q=${encodeURIComponent("Saffire spacecraft fire experiment")}`)}>Saffire spacecraft fire experiment</button>.</Empty>
          ) : (
            <Loadable state={search} rows={8}>
              {(d) => (
                <Panel title={`${d.results.length} results for “${q}”`} aside={<ProviderLine p={d.providers} />}>
                  {d.external_available === false && <div className="mb-3"><Callout tone="crit">{d.message}</Callout></div>}
                  <p className="mb-2 text-xs text-text-3">{d.fulltext_policy}</p>
                  {d.results.length === 0 ? <Empty title="No papers found">Try broader keywords or remove the year filter.</Empty> : (
                    <ul>{d.results.map((p) => <PaperItem key={p.paper_id} p={p} onRelated={setRelId} />)}</ul>
                  )}
                  <div className="mt-3"><Pager page={page} pages={Math.max(page + (d.results.length ? 1 : 0), 1)}
                    onPage={(p) => router.replace(`${pathname}?${new URLSearchParams({ ...Object.fromEntries(sp.entries()), page: String(p) }).toString()}`)} /></div>
                </Panel>
              )}
            </Loadable>
          )}
          {relId && (
            <Panel title="Related works" aside={<button className="text-link" onClick={() => setRelId(null)}>Close</button>}>
              {rel.loading ? <Skeleton rows={4} /> : rel.error ? <ErrorState error={rel.error} onRetry={rel.reload} /> : rel.data && (
                <div className="flex flex-col gap-4">
                  {rel.data.note && <Callout>{rel.data.note}</Callout>}
                  {(["references", "related"] as const).map((k) => (
                    <div key={k}>
                      <h3 className="subhead text-[15px]">{k === "references" ? "Cited by this paper" : "Similar topics"}</h3>
                      <p className="text-xs text-text-3">{rel.data!.relation_semantics[k]}</p>
                      {rel.data![k].length === 0 ? <p className="text-sm text-text-2">None available.</p> : <ul>{rel.data![k].map((p) => <PaperItem key={p.paper_id} p={p} />)}</ul>}
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
