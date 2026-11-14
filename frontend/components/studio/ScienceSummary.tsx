"use client";

// Key findings and literature for the phenomenon pages (Phase 8 progressive disclosure). Findings are short
// takeaways; each opens its rationale, values, sources and limits on request. The page-wide uncertainties sit in a
// named disclosure, while the most important data-quality notice is passed in and stays visible.
import Link from "next/link";
import type { ReactNode } from "react";
import { Disclosure, Takeaway, type Source } from "@/components/disclosure";
import { Icon } from "@/components/icons";
import { Loadable, Prov } from "@/components/ui";
import { useApi } from "@/lib/api";
import { ROUTES } from "@/lib/routes";

export type Finding = { title: ReactNode; kind: string; detail?: ReactNode; sources?: Source[]; limits?: ReactNode };
export type Claim = { text: ReactNode; kind: string; source?: Source };

export function ScientificConclusions({ id = "conclusions", findings, limits, notice }: {
  id?: string; findings: Finding[]; limits: Claim[]; notice?: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-36" data-testid="conclusions">
      <h2 id={`${id}-title`} className="subhead text-[22px] md:text-[26px]">Key findings</h2>
      <ul className="mt-4 grid gap-3 md:grid-cols-2">
        {findings.map((f, i) => (
          <Takeaway key={i} title={f.title} kind={f.kind} sources={f.sources} limits={f.limits}>{f.detail}</Takeaway>
        ))}
      </ul>
      {notice && <div className="mt-4">{notice}</div>}
      <Disclosure id={`${id}-limits`} className="mt-4" title="Uncertainties and limits" action="Show the limits"
        summary="What these data cannot tell you, and why.">
        <ul className="flex flex-col gap-3" aria-label="Uncertainties and limits">
          {limits.map((c, i) => (
            <li key={i} className="flex flex-col gap-1 border-l-2 border-line-strong/70 pl-3">
              <span className="text-[14.5px] leading-relaxed text-text">{c.text}</span>
              <span className="flex flex-wrap items-center gap-2 text-[12px]"><Prov kind={c.kind} />
                {c.source && <a href={c.source.href} target={c.source.external ? "_blank" : undefined} rel="noreferrer">{c.source.label}</a>}</span>
            </li>
          ))}
        </ul>
      </Disclosure>
    </section>
  );
}

type Pub = { title: string; authors: string | null; doi: string | null; status: string | null; source: string };

/** NASA PSI's publication list for the investigation (titles only; contents not read) plus research entry points. */
export function LiteraturePanel({ inv, source, query, question }: { inv: string; source: string; query: string; question: string }) {
  const pubs = useApi<{ items: Pub[] }>(`/research/publications?investigation=${encodeURIComponent(inv)}`);
  const n = pubs.data?.items.length;
  return (
    <Disclosure id="literature" title="Scientific literature" action="Show the publications"
      summary={<>{n !== undefined ? `${n} publication${n === 1 ? "" : "s"} listed` : "Publications listed"} by NASA PSI for {source}, plus search and the Research Copilot.</>}>
      <Loadable state={pubs} rows={4}>
        {(d) => (
          <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
            <div>
              {d.items.length ? (
                <ul className="flex flex-col gap-2.5 text-[14px]" data-testid="publications">
                  {d.items.map((p) => (
                    <li key={p.title}>
                      {p.doi ? <a href={`https://doi.org/${p.doi}`} target="_blank" rel="noreferrer">{p.title}</a> : <span className="text-text">{p.title}</span>}
                      {p.authors && <span className="block text-[12.5px] text-text-3">{p.authors.slice(0, 140)}{p.authors.length > 140 ? "…" : ""}</span>}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-text-2">NASA PSI lists no publications for this investigation in the local metadata.</p>}
              <p className="mt-3 flex items-center gap-2 text-[12.5px] text-text-3"><Prov kind="publication_list" /> Titles from NASA PSI metadata; SpaceFire has not read the papers.</p>
            </div>
            <div className="flex flex-col gap-2 text-[14px]">
              <Link href={`${ROUTES.literature}?q=${encodeURIComponent(query)}`} className="inline-flex items-center gap-1.5"><Icon name="research" />Search external literature</Link>
              <Link href={`${ROUTES.documents}?q=${encodeURIComponent(source)}`} className="inline-flex items-center gap-1.5"><Icon name="documents" />Search the NASA documents</Link>
              <Link href={`${ROUTES.copilot}?${new URLSearchParams({ draft: question, inv, from: "lab" }).toString()}`} className="inline-flex items-center gap-1.5" data-testid="literature-ask">
                <Icon name="assistant" />Ask the Research Copilot</Link>
              <p className="text-[12.5px] text-text-3">Opens with a drafted question; nothing is sent until you press Ask.</p>
            </div>
          </div>
        )}
      </Loadable>
    </Disclosure>
  );
}
