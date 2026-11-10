"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { FlexMapChart, type FlexPoint } from "@/components/charts";
import ScaleLadder from "@/components/ScaleLadder";
import { Button, Callout, inputCls, LinkButton, Loadable, MetricTile, Panel, Prov } from "@/components/ui";
import { fmt, INV_KEY, qs, useApi } from "@/lib/api";

type Investigation = {
  investigation_id: string; short_name: string; title: string; description: string; scale: string; fuel_system: string;
  burns: number; documents: number; publications_listed: number; quality_flags: number; doi: string; official_url: string;
};
type Insight = {
  id: string; investigation_id: string; kind: string; title: string; text: string; n: number | null; caveat: string;
  link: string; citations: { type: string; label: string; document_id?: string; page_pdf?: number }[];
};
type Overview = {
  investigations: Investigation[]; counts: Record<string, number>; ingested_at: string; insights: Insight[];
  caveat: string;
};

function FlameHero() {
  // Decorative illustration of a spherically symmetric droplet flame (microgravity has no buoyant plume).
  return (
    <figure className="relative mx-auto aspect-square w-full max-w-[280px]" aria-hidden>
      <svg viewBox="0 0 200 200" className="h-full w-full">
        <defs>
          <radialGradient id="flame" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0A1424" />
            <stop offset="44%" stopColor="#0A1424" />
            <stop offset="52%" stopColor="#1E3A8A" stopOpacity="0.55" />
            <stop offset="60%" stopColor="#4FD1E8" stopOpacity="0.95" />
            <stop offset="66%" stopColor="#3B6EF0" stopOpacity="0.6" />
            <stop offset="80%" stopColor="#1E3A8A" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#0A1424" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="drop" cx="42%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#FFD2A8" />
            <stop offset="55%" stopColor="#FF8A3D" />
            <stop offset="100%" stopColor="#B4521A" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="98" fill="url(#flame)" />
        <circle cx="100" cy="100" r="15" fill="url(#drop)" />
        <circle cx="100" cy="100" r="62" fill="none" stroke="#4FD1E8" strokeOpacity="0.25" strokeDasharray="2 5" />
      </svg>
    </figure>
  );
}

function AssistantRail() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const examples = [
    "Does 'Disruption' mean extinction in FLEX?",
    "How does BASS-II GMT differ from clock time?",
    "Does the SAFFIRE workbook contain flame-front measurements?",
  ];
  function go(e?: FormEvent, text?: string) {
    e?.preventDefault();
    const s = (text ?? q).trim();
    if (s) router.push(`/assistant${qs({ q: s })}`);
  }
  return (
    <Panel title="Ask the research assistant">
      <form onSubmit={go} className="flex flex-col gap-2">
        <label htmlFor="rail-q" className="text-sm text-text-2">Answers cite NASA rows, document pages and papers.</label>
        <textarea id="rail-q" rows={3} value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. Which FLEX methanol tests extinguished below 17.5 % O₂?" className={`${inputCls} resize-y`} />
        <Button type="submit" variant="primary" disabled={!q.trim()}>Ask</Button>
      </form>
      <p className="mt-4 text-sm text-text-3">Try one of these</p>
      <ul className="mt-1 flex flex-col gap-1.5">
        {examples.map((x) => (
          <li key={x}>
            <button onClick={() => go(undefined, x)} className="text-left text-sm text-link hover:underline">{x}</button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

const QUICK = [
  { href: "/experiments", label: "Browse 405 experiment rows", note: "Filter, sort, export with provenance" },
  { href: "/evidence", label: "Search NASA documents", note: "Page-level citations, ranked with reasons" },
  { href: "/research", label: "Find external papers", note: "NASA NTRS and OpenAlex" },
  { href: "/physics/flex", label: "FLEX extinction & d²-law", note: "Droplet physics checks" },
  { href: "/physics/bass-ii", label: "BASS-II gas balance", note: "O₂ consumed vs CO₂ produced" },
  { href: "/quality", label: "Review data-quality flags", note: "Every anomaly, traced to its cell" },
];

export default function OverviewView() {
  const ov = useApi<Overview>("/overview");
  const [fuel, setFuel] = useState<string>("");
  const map = useApi<{ points: FlexPoint[]; n_total: number; n_plotted: number; excluded: unknown[] }>(
    `/analytics/flex/map${qs({ fuel })}`);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div className="flex min-w-0 flex-col gap-6">
        <section className="grid items-center gap-6 rounded-lg border border-line bg-panel px-5 py-6 md:grid-cols-[1fr_260px] md:px-8">
          <div>
            <h1 className="display text-[32px] md:text-[44px]">How fire behaves when nothing falls</h1>
            <p className="mt-3 max-w-[62ch] text-[16.5px] text-text-2">
              SpaceFire AI brings together NASA&apos;s microgravity combustion records: liquid droplets (FLEX),
              burning solids (BASS-II) and a spacecraft-scale fabric fire (SAFFIRE-I). Every number links back to
              the row, page or paper it came from.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <LinkButton href="/assistant" variant="primary">Ask a research question</LinkButton>
              <LinkButton href="/experiments">Explore experiments</LinkButton>
            </div>
          </div>
          <div>
            <FlameHero />
            <p className="mt-1 text-center text-xs text-text-3">Illustration of a spherical droplet flame, not data</p>
          </div>
        </section>

        <Loadable state={ov} rows={6}>
          {(d) => (
            <>
              <section aria-label="Investigations" className="grid gap-4 md:grid-cols-3">
                {d.investigations.slice().sort((a, b) => b.burns - a.burns).map((i) => (
                  <article key={i.investigation_id} className="flex flex-col rounded-lg border border-line bg-panel p-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <h2 className="subhead text-[19px]">{i.short_name}</h2>
                      <span className="text-sm text-text-3">{i.investigation_id}</span>
                    </div>
                    <p className="mt-1 text-sm text-text-2">{i.fuel_system}, {i.scale}</p>
                    <p className="mt-3"><span className="display text-[34px] text-data">{i.burns}</span>
                      <span className="ml-2 text-sm text-text-2">burn rows</span></p>
                    <p className="mt-2 flex-1 text-sm text-text-2">{i.description}</p>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      <Link href={`/experiments?dataset=${INV_KEY[i.investigation_id]}`}>Open records</Link>
                      <Link href={`/evidence?investigation=${i.investigation_id}`}>{i.documents} documents</Link>
                      <Link href={`/quality?investigation=${i.investigation_id}`}>{i.quality_flags} quality flags</Link>
                    </div>
                  </article>
                ))}
              </section>
              <section aria-label="What is in the database" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <MetricTile value={d.counts.total_burn_rows} label="Experiment rows" note="FLEX + BASS-II + SAFFIRE-I burns" href="/experiments" />
                <MetricTile value={d.counts.chunks} label="Indexed passages" note={`from ${d.counts.documents} NASA documents`} href="/evidence" />
                <MetricTile value={d.counts.report_records ?? "—"} label="Report table rows" note="BASS-II Summary Report, checked against the CSV" href="/physics/bass-ii#report" />
                <MetricTile value={d.counts.quality_flags} label="Quality flags" note="each traced to a file, row and cell" href="/quality" />
              </section>
              <Panel title="Three physical scales, analyzed separately">
                <ScaleLadder />
              </Panel>
              <Callout>{d.caveat}</Callout>

              <Panel title="Key findings, recomputed from the data" aside={`${d.insights.length} findings`}>
                <ul className="flex flex-col divide-y divide-line">
                  {d.insights.map((x) => (
                    <li key={x.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Prov kind={x.kind} />
                        <h3 className="font-semibold">{x.title}</h3>
                        <span className="text-xs text-text-3">{x.investigation_id}{x.n ? `, n = ${x.n}` : ""}</span>
                      </div>
                      <p className="mt-1 max-w-[80ch] text-[14.5px]">{x.text}</p>
                      <p className="mt-1 text-sm text-text-3">{x.caveat}</p>
                      <div className="mt-1 flex flex-wrap gap-x-4 text-sm">
                        <Link href={x.link}>See the analysis</Link>
                        {x.citations.filter((c) => c.document_id).map((c) => (
                          <a key={c.label} href={`/api/v1/documents/${c.document_id}/file#page=${c.page_pdf}`} target="_blank"
                            rel="noreferrer">{c.label}</a>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </Panel>
            </>
          )}
        </Loadable>

        <Panel title="FLEX: oxygen versus droplet size by outcome"
          aside={map.data ? `n = ${map.data.n_plotted} plotted of ${map.data.n_total} rows` : undefined}>
          <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Fuel filter">
            {["", "Methanol", "Heptane"].map((f) => (
              <button key={f || "all"} onClick={() => setFuel(f)} aria-pressed={fuel === f}
                className={`rounded-full border px-3 py-1 text-sm ${fuel === f ? "border-flame bg-flame/15 text-text" : "border-line-strong text-text-2 hover:text-text"}`}>
                {f || "Both fuels"}
              </button>
            ))}
            <span className="text-sm text-text-3">Click a point to open its source row.</span>
          </div>
          <Loadable state={map} rows={8}>
            {(m) => (
              <>
                <FlexMapChart points={m.points} height={380} />
                <p className="mt-2 text-xs text-text-3">
                  {fmt(m.excluded.length)} rows without a numeric D₀ are excluded. &apos;Disruption&apos; is undefined in
                  the local documents and may be censored.
                </p>
              </>
            )}
          </Loadable>
        </Panel>

        <section aria-label="Quick actions">
          <h2 className="subhead mb-3 text-[17px]">Go to a tool</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {QUICK.map((q) => (
              <li key={q.href}>
                <Link href={q.href} className="block rounded-lg border border-line bg-panel px-4 py-3 no-underline hover:border-flame/60 hover:no-underline">
                  <span className="font-semibold text-text">{q.label}</span>
                  <span className="block text-sm text-text-2">{q.note}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <aside className="xl:sticky xl:top-20 xl:self-start">
        <AssistantRail />
      </aside>
    </div>
  );
}
