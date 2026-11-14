"use client";

import Link from "next/link";
import { Disclosure } from "@/components/disclosure";
import { GlossaryList } from "@/components/glossary";
import type { ReactNode } from "react";
import { Icon } from "@/components/icons";
import { CountUp, Reveal, Stagger, StaggerItem } from "@/components/motion";
import { LinkLevel } from "@/components/report";
import { Loadable, PageHeader, Panel, Prov } from "@/components/ui";
import { fmt, INV_LABEL, useApi } from "@/lib/api";
import { ROUTES } from "@/lib/routes";

type Llm = { configured: boolean; provider: string; model: string; mode: string; reason: string | null; paused_until?: string };
type Health = { database: { ingested_at: string; counts: Record<string, number> }; retrieval: { mode: string }; llm: Llm };
type Method = {
  links: { by_level: Record<string, number>; manually_reviewed_by_relation: Record<string, number>; excluded: number | null };
  report_consistency: { thickness_checked: number; thickness_agree: number; width_checked: number; width_agree: number;
    velocity_checked: number; velocity_all_in_display: number; conflicts: number } | null;
  quality: { rules: number; flags: number };
  assistant: { llm: Llm; cached_answers: number; golden_questions: number | null };
};
type Doc = { document_id: string; title: string; investigation_id: string; relative_path: string; scope_note: string | null };


const SECTIONS = [
  { id: "glance", label: "At a glance" }, { id: "pipeline", label: "Pipeline" }, { id: "ai", label: "AI answers" },
  { id: "limits", label: "Limitations" }, { id: "glossary", label: "Glossary" }, { id: "sources", label: "Sources" },
];


/** The real processing chain, left to right; counts are live from /health and /methodology. */
function Pipeline({ h, m }: { h: Health | null; m: Method | null }) {
  const c = h?.database.counts;
  const llm = m?.assistant.llm ?? h?.llm;
  const steps: { icon: string; title: string; value?: ReactNode; note: string; tone?: string }[] = [
    { icon: "experiments", title: "NASA files", value: c ? `${fmt(c.flex_burns + c.bass2_burns + c.saffire1_burns)} burn rows` : undefined,
      note: "CSV/XLSX and PDFs from NASA PSI, read-only; SHA-256 recorded for every file." },
    { icon: "quality", title: "Quality rules", value: m ? `${m.quality.rules} rules · ${fmt(m.quality.flags)} flags` : undefined,
      note: "Ambiguous headers, units, duplicates and conflicts are flagged; raw text is never overwritten." },
    { icon: "documents", title: "Evidence index", value: c ? `${fmt(c.chunks)} passages · ${fmt(c.evidence_links)} ID links` : undefined,
      note: "Page-cited passages, BM25 + semantic search, and test-ID links with a stated confidence." },
    { icon: "model", title: "Fixed tools", value: "11 whitelisted tools",
      note: "Deterministic counts, comparisons, d²-law and gas-balance checks. No free-form SQL." },
    { icon: "assistant", title: "Language model", value: llm?.configured ? llm.model : "off",
      note: "Optional. Writes the answer only from the evidence pack, as structured claims with citation ids.", tone: "flame" },
    { icon: "method", title: "Verifier", value: "ids + numbers checked",
      note: "Every claim must cite listed evidence and every number must appear in it, or it is removed." },
  ];
  return (
    <Stagger as="ol" className="grid gap-3 md:grid-cols-3 xl:grid-cols-6" >
      {steps.map((s, i) => (
        <StaggerItem as="li" key={s.title} className="relative">
          <div className={`hairline-top flex h-full flex-col rounded-xl border p-4 ${s.tone === "flame" ? "border-flame/40 bg-flame/[0.05]" : "border-line/80 bg-panel/90"}`}>
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full border border-line-strong text-[12px] text-text-2" aria-hidden>{i + 1}</span>
              <Icon name={s.icon} size={16} className={s.tone === "flame" ? "text-flame" : "text-data"} />
            </div>
            <h3 className="subhead mt-3 text-[15.5px]">{s.title}</h3>
            {s.value !== undefined && <p className="mt-1 text-[13px] font-semibold text-data">{s.value}</p>}
            <p className="mt-1.5 text-[13px] leading-snug text-text-2">{s.note}</p>
          </div>
          {i < steps.length - 1 && <span aria-hidden className="absolute -right-2 top-1/2 hidden h-px w-4 bg-line-strong xl:block" />}
        </StaggerItem>
      ))}
    </Stagger>
  );
}

const LABELS: [string, string][] = [
  ["ORIGINAL_EXPERIMENT", "An exact cell from a NASA CSV/XLSX, shown with its file, row, column and SHA-256."],
  ["DOC", "Text from a NASA document, cited with the PDF page (and printed page when the offset is known)."],
  ["COMPUTED", "A deterministic calculation by SpaceFire code; formula, n, filters and exclusions are shown."],
  ["EXTERNAL", "Metadata or an abstract from NASA NTRS, OpenAlex or Crossref. Full texts are never read or summarized."],
  ["HYPOTHESIS", "An interpretation the sources do not confirm. Never allowed to carry an unsupported number."],
  ["UNSUPPORTED", "The question cannot be answered from the available evidence; no value is produced."],
];

const STATUSES: [string, string, string][] = [
  ["Answered", "text-ok", "Every generated statement passed the citation and number checks."],
  ["Partial answer", "text-warn", "Some statements failed verification and were removed; the rest stand."],
  ["Insufficient evidence", "text-crit", "The evidence does not support an answer (or the question asks for a safety value the data cannot give)."],
  ["Evidence only", "text-info", "No AI-written text: no model, a provider error, or the free-tier quota is used up."],
];

function AiSection({ m }: { m: Method }) {
  const llm = m.assistant.llm;
  const on = llm.configured && llm.mode !== "paused";
  const cards: { title: string; body: ReactNode }[] = [
    { title: "What the model receives", body: <>The question and an <em>evidence pack</em>: tool outputs, page-cited NASA passages, quality rules and (if chosen) external abstracts, each with a citation id. The pack is marked as untrusted data; instructions inside it are ignored.</> },
    { title: "What it must not do", body: <>Invent ids, pages, DOIs, experiment IDs or numbers; do new arithmetic; pool FLEX, BASS-II and SAFFIRE-I numbers; or claim results from a paper whose full text was not read.</> },
    { title: "How the answer is checked", body: <>Deterministic code checks each claim: cited ids must exist and every number must appear in the cited evidence. A failing draft is sent back once with the problems listed; statements that still fail are removed and the status drops to partial.</> },
    { title: "When the model is unavailable", body: <>Errors, timeouts, refusals and quota limits fall back to evidence only. After a quota error the model is paused until the reset time the provider gives, so no request is wasted. An identical question with identical evidence reuses the earlier verified output.</> },
  ];
  return (
    <div className="grid gap-5 xl:grid-cols-[340px_1fr]">
      <Panel tone="feature" title="Current model">
        <dl className="flex flex-col gap-3 text-sm">
          <div><dt className="text-text-3">Status</dt><dd className={`font-semibold ${on ? "text-ok" : "text-warn"}`}>
            {on ? "AI synthesis on" : llm.mode === "paused" ? `Paused until ${llm.paused_until}` : "Evidence-only mode"}</dd></div>
          <div><dt className="text-text-3">Provider / model</dt><dd>{llm.provider} · <span className="raw">{llm.model}</span></dd></div>
          {!on && llm.reason && <div><dt className="text-text-3">Why</dt><dd className="text-text-2">{llm.reason}</dd></div>}
          <div><dt className="text-text-3">Saved verified answers</dt><dd><CountUp value={m.assistant.cached_answers} /></dd></div>
          {m.assistant.golden_questions && <div><dt className="text-text-3">Regression questions</dt><dd>{m.assistant.golden_questions} golden questions check retrieval and citations on every test run</dd></div>}
        </dl>
        <p className="mt-4 border-t border-line pt-3 text-xs text-text-3">The API key stays on the server: it is read from <span className="raw">.env</span>, sent to the provider in a request header, and never returned by the API, logged, or included in the web bundle.</p>
      </Panel>
      <div className="flex flex-col gap-5">
        <Stagger className="grid gap-3 md:grid-cols-2">
          {cards.map((c) => (
            <StaggerItem key={c.title} className="rounded-xl border border-line/80 bg-panel/90 p-4">
              <h3 className="subhead text-[15.5px]">{c.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-text-2">{c.body}</p>
            </StaggerItem>
          ))}
        </Stagger>
        <Panel title="Answer statuses">
          <ul className="grid gap-2 sm:grid-cols-2">
            {STATUSES.map(([label, cls, note]) => (
              <li key={label} className="text-sm"><span className={`font-semibold ${cls}`}>{label}</span> <span className="text-text-2">{note}</span></li>
            ))}
          </ul>
          <p className="mt-3 text-sm"><Link href={ROUTES.copilot}>Ask the Research Copilot</Link> <span className="text-text-3">and open “How this answer was built” to see every tool, model call and rejected statement.</span></p>
        </Panel>
      </div>
    </div>
  );
}

const LEVEL_ORDER = ["verified_table_row", "exact_context", "manually_reviewed", "auto_unreviewed"];
const RELATION_LABEL: Record<string, string> = { table_row: "own report row", figure_caption: "figure caption", cross_reference: "cross-reference in another test's notes" };

function Citations({ m }: { m: Method }) {
  const lv = m.links.by_level;
  const total = LEVEL_ORDER.reduce((a, k) => a + (lv[k] ?? 0), 0);
  const rc = m.report_consistency;
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Panel title="How each test-ID link was established" aside={`${fmt(total)} links`}>
        <ul className="flex flex-col gap-3">
          {LEVEL_ORDER.filter((k) => k in lv || k === "auto_unreviewed").map((k) => {
            const n = lv[k] ?? 0;
            return (
              <li key={k}>
                <div className="flex items-center justify-between gap-2 text-sm"><LinkLevel level={k} /><span className="text-text-2">{fmt(n)}</span></div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink" role="img" aria-label={`${k}: ${n} of ${total} links`}>
                  <div className="h-full rounded-full bg-data/70" style={{ width: `${total ? (n / total) * 100 : 0}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-sm text-text-2">Reviewed by hand: {Object.entries(m.links.manually_reviewed_by_relation).map(([k, v]) => `${v} ${RELATION_LABEL[k] ?? k}`).join(", ")}. Each was checked in its page context against the Appendix A run number, sample and GMT day.</p>
        {m.links.excluded !== null && <p className="mt-1 text-xs text-text-3">{fmt(m.links.excluded)} mentions were excluded, never linked: ID-like tokens that mean something else (O2 = oxygen, F2 = a camera card), “Table B1” labels, and GMT IDs that belong to the earlier BASS (I) series.</p>}
      </Panel>
      {rc && (
        <Panel title="BASS-II report values the CSV cannot verify" aside="cross-checked copies">
          <ul className="flex flex-col gap-2 text-sm">
            <li><span className="text-ok">{rc.thickness_agree} of {rc.thickness_checked}</span> sample thicknesses agree across Table 5.1, the Appendix A log and the CSV text.</li>
            <li><span className={rc.width_agree === rc.width_checked ? "text-ok" : "text-warn"}>{rc.width_agree} of {rc.width_checked}</span> widths agree; {rc.conflicts} report-internal conflict kept and flagged.</li>
            <li><span className="text-warn">{rc.velocity_all_in_display} of {rc.velocity_checked}</span> tests have every report velocity among the logged Air display readings: the display is a readout, not the analysed velocity.</li>
          </ul>
          <p className="mt-3 text-sm"><Link href={`${ROUTES.spread}#report-trust`}>See the cross-checks on the flame-spread page</Link></p>
          <p className="mt-1 text-xs text-text-3">Spread rates, burn times and outcomes are printed once only, so they remain faithful transcriptions that cannot be independently checked.</p>
        </Panel>
      )}
    </div>
  );
}

const SAFEGUARDS: { inv: string; rules: string[] }[] = [
  { inv: "All investigations", rules: [
    "Original NASA folders are read-only; tests check that their SHA-256 hashes never change.",
    "Every cell keeps its raw text. Blank, dash, “none”, “OR”, “over”, “>500”, “~6” and ranges are distinct states.",
    "FLEX, BASS-II and SAFFIRE-I measure different physical systems and are never pooled into one scale or model.",
    "Document text and external metadata are treated as untrusted data, never as instructions.",
    "No operational safety threshold is ever inferred from these experiments.",
  ] },
  { inv: "FLEX (PSI-69)", rules: [
    "“CO” is the CO₂ diluent and “Burning rate; mm” is the d²-law constant K in mm²/s: separate annotations with evidence; the header is kept.",
    "“Disruption” is not treated as extinction; its burn time may be censored.",
    "The duplicated identifier 193F001 keeps both rows, addressed by source row.",
  ] },
  { inv: "BASS-II (PSI-25)", rules: [
    "GMT is a day of year, not a clock time. Gases are before/after readings, not time series.",
    "Fan display mixes two scales and is never a velocity; Air display is a readout, not the analysed velocity.",
    "Report rows that disagree with the CSV, or with the report itself, keep both values and are flagged.",
  ] },
  { inv: "SAFFIRE-I (PSI-98)", rules: [
    "The workbook is an image manifest: no flame position, spread rate or temperature is derived from it.",
    "Image-set rows are not burns; only the two sample burns are counted.",
  ] },
];

const GLANCE = [
  { title: "How SpaceFire uses NASA data", href: "#pipeline", link: "See the pipeline",
    body: "It reads NASA's FLEX, BASS-II and SAFFIRE-I files as published, keeps every original cell, and adds labels and checks on top. It never edits a measured value." },
  { title: "How evidence is verified", href: "#labels", link: "See the provenance labels",
    body: "Every value says where it came from: a data row, a document page, a report table or a calculation. Links between documents and tests carry a confidence level." },
  { title: "What the AI can and cannot conclude", href: "#ai", link: "See how answers are checked",
    body: "The Copilot can summarise what the retrieved evidence says. It cannot add facts, make predictions or answer without a source, and it says so when evidence is missing." },
  { title: "Main limitations", href: "#limits", link: "See all limitations",
    body: "The local data has no flame time series for SAFFIRE-I, some BASS-II values exist only in reports, and some NASA column headers are wrong and must be interpreted." },
];

const LIMITS = [
  "The language model is optional and limited by the provider's quota; on the Gemini free tier this is 20 requests per day for the configured model, after which answers are evidence only until the reset.",
  "The verifier checks citations and numbers, not reasoning. A statement can cite the right passage and still over-generalize; claims are labelled by kind so readers can weigh them.",
  "Retrieval is lexical + LSA by default; a passage that uses different wording than the question can be missed, and the answer then says the evidence is insufficient.",
  "BASS-II report-only values (spread rates, burn times, outcomes) are transcriptions; report figures are not digitized.",
  "External literature is searched by metadata and abstracts only; paywalled full texts are never read.",
];

export default function MethodologyView() {
  const h = useApi<Health>("/health");
  const m = useApi<Method>("/methodology");
  const docs = useApi<{ items: Doc[] }>("/documents");
  return (
    <>
      <PageHeader kicker="Trust & methods" title="Methodology" sections={SECTIONS}
        lead="How SpaceFire turns NASA files into evidence you can check, how AI answers are verified, and what the system cannot do." />

      <section aria-labelledby="glance" className="mb-8">
        <h2 id="glance" className="sr-only">Methodology at a glance</h2>
        <ul className="grid gap-4 md:grid-cols-2" data-testid="method-glance">
          {GLANCE.map((g) => (
            <li key={g.title} className="rounded-2xl border border-line/60 bg-panel/50 p-5">
              <h3 className="subhead text-[17px]">{g.title}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-text-2">{g.body}</p>
              <a href={g.href} className="mt-2 inline-block text-[13.5px]">{g.link}</a>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-col gap-4">
        <Disclosure id="pipeline" title="From NASA files to a cited answer" action="Show the pipeline"
          summary="Each stage only adds labelled information on top of the original values; nothing downstream can change a measured cell.">
          <Pipeline h={h.data} m={m.data} />
        </Disclosure>
        <Disclosure id="labels" title="Every value says where it came from" action="Show the provenance labels"
          summary="Measured, computed, document, report table, external, hypothesis: what each label means.">
      <Stagger className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {LABELS.map(([k, t]) => (
          <StaggerItem key={k} className="rounded-xl border border-line/80 bg-panel/90 p-4 text-sm">
            <Prov kind={k} /><p className="mt-2 text-text-2">{t}</p>
          </StaggerItem>
        ))}
      </Stagger>
        </Disclosure>
        <Disclosure id="ai" title="The model phrases; code verifies" action="Show how AI answers are checked"
          summary="The Copilot writes only from evidence its tools retrieved, and shows only statements that pass a deterministic citation and number check.">
          <Loadable state={m} rows={6}>{(d) => <AiSection m={d} />}</Loadable>
        </Disclosure>
        <Disclosure id="citations" title="How strongly a passage is tied to a test" action="Show citation-link confidence"
          summary="When a document mentions a test ID, the link carries its evidence. Every bare mention has been checked by hand.">
          <Loadable state={m} rows={6}>{(d) => <Citations m={d} />}</Loadable>
        </Disclosure>
        <Disclosure id="safeguards" title="Scientific rules the system follows" action="Show the safeguards"
          summary="Per-investigation rules: units, header interpretations, what is never inferred.">
      <Stagger className="grid gap-3 md:grid-cols-2">
        {SAFEGUARDS.map((g) => (
          <StaggerItem key={g.inv} className="rounded-xl border border-line/80 bg-panel/90 p-4">
            <h3 className="subhead text-[15.5px]">{g.inv}</h3>
            <ul className="mt-2 list-disc pl-5 text-sm text-text-2">{g.rules.map((r) => <li key={r} className="mt-1">{r}</li>)}</ul>
          </StaggerItem>
        ))}
      </Stagger>
        </Disclosure>
        <Disclosure id="limits" title="What this system cannot do" action="Show all limitations"
          summary={LIMITS[0]}>
      <Reveal>
        <ul className="grid gap-2 md:grid-cols-2">
          {LIMITS.map((l) => <li key={l} className="rounded-lg border border-warn/25 bg-warn/[0.04] p-3 text-sm text-text-2">{l}</li>)}
        </ul>
      </Reveal>
        </Disclosure>
        <GlossaryList />
        <Disclosure id="sources" title="Data, documents and system state" action="Show sources and system state"
          summary="The NASA investigations, the indexed documents and the current data import.">
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="System state">
          <Loadable state={h} rows={4}>
            {(d) => (
              <ul className="text-sm">
                <li>Data imported {d.database.ingested_at}</li>
                <li>Rows: FLEX {d.database.counts.flex_burns}, BASS-II {d.database.counts.bass2_burns}, SAFFIRE-I {d.database.counts.saffire1_burns} burns (+{d.database.counts.saffire1_image_sets} image-set rows)</li>
                <li>{d.database.counts.documents} documents, {d.database.counts.chunks} indexed passages, {d.database.counts.quality_flags} quality flags</li>
                <li>Search mode: {d.retrieval.mode}</li>
                <li>AI synthesis: {d.llm.configured ? `${d.llm.provider} ${d.llm.model}${d.llm.mode === "paused" ? ` (paused until ${d.llm.paused_until})` : ""}` : `off. ${d.llm.reason}`}</li>
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
        </Disclosure>
      </div>
    </>
  );
}
