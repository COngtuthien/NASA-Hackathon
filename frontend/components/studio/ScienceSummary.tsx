"use client";

// Scientific conclusions and literature blocks for the phenomenon pages. Every claim carries its basis (a NASA
// document page, a computed analysis on this page, or a data-quality rule) and a link; computed numbers are passed
// in from the page's own API responses, never typed in.
import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/icons";
import { Loadable, Panel, Prov } from "@/components/ui";
import { useApi } from "@/lib/api";
import { ROUTES } from "@/lib/routes";

export type Claim = { text: ReactNode; kind: string; source?: { label: string; href: string; external?: boolean } };

export function ScientificConclusions({ id = "conclusions", findings, limits }: { id?: string; findings: Claim[]; limits: Claim[] }) {
  const item = (c: Claim, i: number) => (
    <li key={i} className="flex flex-col gap-1 border-l-2 border-line-strong/70 pl-3">
      <span className="text-[14px] leading-relaxed text-text">{c.text}</span>
      <span className="flex flex-wrap items-center gap-2 text-[12px]"><Prov kind={c.kind} />
        {c.source && <a href={c.source.href} target={c.source.external ? "_blank" : undefined} rel="noreferrer">{c.source.label}</a>}</span>
    </li>
  );
  return (
    <Panel id={id} title="Scientific conclusions" aside="What the evidence supports, and what it does not">
      <div className="grid gap-6 lg:grid-cols-2" data-testid="conclusions">
        <section aria-labelledby={`${id}-f`}>
          <h3 id={`${id}-f`} className="subhead text-[15px]">Key findings</h3>
          <ul className="mt-2 flex flex-col gap-3">{findings.map(item)}</ul>
        </section>
        <section aria-labelledby={`${id}-l`}>
          <h3 id={`${id}-l`} className="subhead text-[15px]">Uncertainties and limits</h3>
          <ul className="mt-2 flex flex-col gap-3">{limits.map(item)}</ul>
        </section>
      </div>
    </Panel>
  );
}

type Pub = { title: string; authors: string | null; doi: string | null; status: string | null; source: string };

/** NASA PSI's publication list for the investigation (titles only; contents not read) plus research entry points. */
export function LiteraturePanel({ inv, source, query, question }: { inv: string; source: string; query: string; question: string }) {
  const pubs = useApi<{ items: Pub[] }>(`/research/publications?investigation=${encodeURIComponent(inv)}`);
  return (
    <Panel id="literature" title="Scientific literature" aside={`Listed by NASA PSI for ${source} (${inv})`}>
      <Loadable state={pubs} rows={4}>
        {(d) => (
          <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
            <div>
              {d.items.length ? (
                <ul className="flex flex-col gap-2 text-[13.5px]" data-testid="publications">
                  {d.items.map((p) => (
                    <li key={p.title}>
                      {p.doi ? <a href={`https://doi.org/${p.doi}`} target="_blank" rel="noreferrer">{p.title}</a> : <span className="text-text">{p.title}</span>}
                      {p.authors && <span className="block text-[12px] text-text-3">{p.authors.slice(0, 140)}{p.authors.length > 140 ? "…" : ""}</span>}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-text-2">NASA PSI lists no publications for this investigation in the local metadata.</p>}
              <p className="mt-3 flex items-center gap-2 text-[12px] text-text-3"><Prov kind="publication_list" /> Titles from NASA PSI ISA-Tab metadata; the papers themselves were not read by SpaceFire.</p>
            </div>
            <div className="flex flex-col gap-2 text-[13.5px]">
              <Link href={`${ROUTES.literature}?q=${encodeURIComponent(query)}`} className="inline-flex items-center gap-1.5"><Icon name="research" />Search external literature</Link>
              <Link href={`${ROUTES.documents}?q=${encodeURIComponent(source)}`} className="inline-flex items-center gap-1.5"><Icon name="documents" />Search the local NASA documents</Link>
              <Link href={`${ROUTES.copilot}?${new URLSearchParams({ draft: question, inv, from: "lab" }).toString()}`} className="inline-flex items-center gap-1.5" data-testid="literature-ask">
                <Icon name="assistant" />Ask the Research Copilot (draft only)</Link>
              <p className="text-[12px] text-text-3">The Copilot opens with a drafted question; nothing is sent until you press Ask.</p>
            </div>
          </div>
        )}
      </Loadable>
    </Panel>
  );
}
