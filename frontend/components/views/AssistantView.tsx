"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { DUR, EASE, motion } from "@/components/motion";
import { Button, Callout, ErrorState, inputCls, PageHeader, Panel, Prov, Segmented } from "@/components/ui";
import { apiFetch, ApiError, apiStream, expHref, fmt, useApi } from "@/lib/api";
import { canonical, PHENOMENA } from "@/lib/routes";

type Citation = {
  citation_id: string; source_type: string; title: string; url: string | null; document_id: string | null;
  chunk_id: string | null; experiment_uid: string | null; doi: string | null; page_pdf: number | null;
  section: string | null; excerpt: string | null; data: unknown; access_level: string | null; rank_label: string | null;
  reasons: string[] | null;
};
type Claim = { text: string; kind: string; citation_ids: string[]; conditions: string };
type Answer = {
  question: string; answer: string | null; status: string; claims: Claim[]; citations: Citation[];
  limitations: string[]; suggested_followups: string[]; tool_calls: { tool: string; args: unknown; ok: boolean; error?: string; ms?: number }[];
  llm: { configured: boolean; mode: string; reason: string | null; provider?: string; model?: string; error?: string;
    model_version?: string | null; latency_ms?: number | null; calls?: number; retry_after_s?: number | null;
    cached?: boolean; cached_at?: string | null; paused_until?: string };
  investigations_detected: string[]; experiments_matched: string[];
  external_providers: Record<string, { status: string; error?: string }> | null; trace_id: string;
  verification?: { rejected: string[]; accepted_claims: number };
};
type Step = { tool: string; args: unknown; running: boolean; ok?: boolean; ms?: number; error?: string };
type Turn = { id: number; q: string; scope: string; res?: Answer; err?: ApiError; steps: Step[] };

const SOURCE_LABEL: Record<string, string> = { experiment: "Experiment rows", analysis: "Computed", quality_flag: "Quality rules",
  local_document: "NASA documents", report_table: "Report tables", external_paper: "External papers" };

const STATUS: Record<string, { label: string; cls: string; note: string }> = {
  answered: { label: "Answered", cls: "text-ok border-ok/50", note: "All statements passed citation and number checks." },
  partial: { label: "Partial answer", cls: "text-warn border-warn/50", note: "Some generated statements failed verification and were removed." },
  insufficient_evidence: { label: "Insufficient evidence", cls: "text-crit border-crit/50", note: "The available sources do not support an answer." },
  retrieval_only: { label: "Evidence only", cls: "text-info border-info/50", note: "No AI-written answer: showing retrieved and computed evidence." },
};

function withMarkers(text: string, onCite: (id: string) => void): ReactNode[] {
  return text.split(/(\[cite-\d+\])/g).map((part, i) => {
    const m = part.match(/^\[(cite-\d+)\]$/);
    if (!m) return <span key={i}>{part}</span>;
    return (
      <button key={i} onClick={() => onCite(m[1])} className="mx-0.5 rounded bg-raised px-1 text-xs text-link hover:underline">
        {m[1].replace("cite-", "")}
      </button>
    );
  });
}

function DataPreview({ data }: { data: unknown }) {
  if (data === null || data === undefined) return null;
  const json = JSON.stringify(data, null, 1);
  return (
    <details className="mt-1">
      <summary className="cursor-pointer text-xs text-text-3">Show tool output ({json.length.toLocaleString()} characters)</summary>
      <pre className="mt-1 max-h-64 overflow-auto rounded bg-ink p-2 text-[12px] text-text-2">{json.slice(0, 6000)}{json.length > 6000 ? "\n…" : ""}</pre>
    </details>
  );
}

function CitationCard({ c, highlight }: { c: Citation; highlight: boolean }) {
  const link = c.source_type === "experiment" && c.experiment_uid ? expHref(c.experiment_uid)
    : (c.source_type === "local_document" || c.source_type === "report_table") && c.document_id ? `/api/v1/documents/${c.document_id}/file${c.page_pdf ? `#page=${c.page_pdf}` : ""}`
      : c.url ? canonical(c.url) : null;
  const external = c.source_type === "external_paper" || c.source_type === "local_document";
  return (
    <li id={`c-${c.citation_id}`} className={`rounded-md border p-3 ${highlight ? "border-flame" : "border-line"}`}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded bg-raised px-1.5 text-xs text-text-2">{c.citation_id.replace("cite-", "")}</span>
        <Prov kind={c.source_type} />
        {link ? <a href={link} target={external ? "_blank" : undefined} rel="noreferrer" className="font-semibold">{c.title}</a>
          : <span className="font-semibold">{c.title}</span>}
        {c.page_pdf && <span className="text-xs text-text-3">PDF p.{c.page_pdf}</span>}
        {c.source_type === "external_paper" && (
          <span className="text-xs text-text-3">{c.access_level === "abstract" ? "abstract only, full text not read" : "metadata only"}</span>)}
      </div>
      {c.excerpt && <p className="mt-1 text-sm text-text-2">{c.excerpt.slice(0, 600)}{c.excerpt.length > 600 ? "…" : ""}</p>}
      {c.doi && <p className="mt-1 text-xs"><a href={`https://doi.org/${c.doi}`} target="_blank" rel="noreferrer">doi:{c.doi}</a></p>}
      {c.chunk_id && <Link className="text-xs" href={`/evidence?chunk=${encodeURIComponent(c.chunk_id)}`}>Open passage in Evidence explorer</Link>}
      {c.source_type !== "local_document" && c.source_type !== "external_paper" && <DataPreview data={c.data} />}
    </li>
  );
}

const TOOL_LABEL: Record<string, string> = {
  get_experiment: "Read experiment record", compare_experiments: "Compare tests", get_similar_experiments: "Find similar tests",
  aggregate_experiments: "Aggregate experiment rows", bass_gas_deltas: "BASS-II gas balance", flex_extinction_map: "FLEX extinction map",
  saffire_case: "SAFFIRE-I case data", list_quality_flags: "Check quality flags", get_document_evidence: "Search NASA documents",
  search_literature: "Search external literature", flex_d2_check: "FLEX d²-law check",
  synthesize_answer: "Write answer with the model", verify_citations: "Verify citations and numbers",
};

function stepLabel(t: { tool: string; args: unknown }) {
  const base = TOOL_LABEL[t.tool] ?? t.tool.replace(/_/g, " ");
  const a = (t.args ?? {}) as Record<string, unknown>;
  if (t.tool === "synthesize_answer" && Number(a.attempt) > 1) return `${base} (retry after failed verification)`;
  if (t.tool === "get_experiment" && a.uid) return `${base} ${String(a.uid)}`;
  return base;
}

/** Live view of the pipeline while the answer is being built: every step the backend reports, as it happens. */
function LiveProgress({ steps, elapsed }: { steps: Step[]; elapsed: number }) {
  const current = [...steps].reverse().find((s) => s.running);
  return (
    <div className="flex flex-col gap-3" role="status" aria-live="polite">
      <div className="flex items-center gap-3 text-sm text-text-2">
        <span aria-hidden className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-flame/60" /><span className="relative inline-flex h-3 w-3 rounded-full bg-flame" /></span>
        <span>{current ? `${stepLabel(current)}…` : steps.length ? "Preparing the next step…" : "Planning which tools to run…"}</span>
        <span className="text-text-3">{fmt(elapsed)} s</span>
      </div>
      {steps.length > 0 && (
        <ol className="flex flex-col gap-1 border-l border-line pl-4" aria-label="Steps so far">
          {steps.map((s, i) => (
            <motion.li key={i} className="flex flex-wrap items-center gap-2 text-[13.5px]" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
              transition={{ duration: DUR.base, ease: EASE }}>
              <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${s.running ? "animate-pulse bg-flame" : s.ok ? "bg-ok" : "bg-crit"}`} />
              <span className={s.running ? "text-text" : s.ok ? "text-text-2" : "text-crit"}>{stepLabel(s)}</span>
              {!s.running && typeof s.ms === "number" && s.ms > 0 && <span className="text-text-3">{fmt(s.ms)} ms</span>}
              {!s.running && !s.ok && s.error && <span className="text-xs text-crit">{s.error.slice(0, 120)}</span>}
              <span className="sr-only">{s.running ? "running" : s.ok ? "done" : "failed"}</span>
            </motion.li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** What actually ran for this answer, in order, with status and duration as reported by the backend. */
function ToolTrace({ calls }: { calls: Answer["tool_calls"] }) {
  if (!calls.length) return null;
  return (
    <ol className="flex flex-wrap items-center gap-1.5" aria-label="Tools that ran for this answer">
      {calls.map((t, i) => (
        <motion.li key={i} className="flex items-center gap-1.5" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
          transition={{ duration: DUR.base, ease: EASE, delay: i * 0.06 }}>
          {i > 0 && <span aria-hidden className="h-px w-3 bg-line-strong" />}
          <span title={JSON.stringify(t.args).slice(0, 200)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12.5px] ${t.ok ? "border-ok/35 text-text-2" : "border-crit/50 text-crit"}`}>
            <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${t.ok ? "bg-ok" : "bg-crit"}`} />
            {stepLabel(t)}
            {typeof t.ms === "number" && <span className="text-text-3">{fmt(t.ms)} ms</span>}
            <span className="sr-only">{t.ok ? "succeeded" : `failed${t.error ? `: ${t.error}` : ""}`}</span>
          </span>
        </motion.li>
      ))}
    </ol>
  );
}

function AnswerBlock({ a }: { a: Answer }) {
  const [hl, setHl] = useState<string | null>(null);
  const [kind, setKind] = useState<string>("all");
  const st = STATUS[a.status] ?? STATUS.retrieval_only;
  const counts = a.citations.reduce<Record<string, number>>((m, c) => ({ ...m, [c.source_type]: (m[c.source_type] ?? 0) + 1 }), {});
  const shown = kind === "all" ? a.citations : a.citations.filter((c) => c.source_type === kind);
  const cite = (id: string) => {
    setKind("all");
    setHl(id);
    document.getElementById(`c-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded border px-2 py-0.5 text-sm font-semibold ${st.cls}`}>{st.label}</span>
        <span className="text-sm text-text-3">{st.note}</span>
      </div>
      <ToolTrace calls={a.tool_calls} />
      {a.llm.configured && !a.llm.error && (a.llm.calls || a.llm.cached) ? (
        <p className="text-xs text-text-3">
          Written by {a.llm.model_version ?? a.llm.model}
          {a.llm.cached ? ` (saved answer from ${a.llm.cached_at?.slice(0, 16).replace("T", " ")} UTC for identical evidence, re-verified now; no model request used)`
            : a.llm.latency_ms ? ` in ${(a.llm.latency_ms / 1000).toFixed(1)} s` : ""}
          {(a.llm.calls ?? 0) > 1 ? ` (${a.llm.calls} model calls: the first draft failed verification)` : ""} · {a.claims.length} verified statement{a.claims.length === 1 ? "" : "s"}
        </p>
      ) : null}
      {a.llm.configured && a.llm.error && (
        <Callout tone="warn">The language model could not answer ({a.llm.error === "rate_limit" ? "free-tier quota reached" : a.llm.error.replace(/_/g, " ")}
          {a.llm.retry_after_s ? `; try again in about ${Math.ceil(a.llm.retry_after_s)} s` : ""}). Showing the retrieved and computed evidence only; nothing below is AI-written.</Callout>
      )}
      {a.answer && <p className="max-w-[78ch] text-[16px] leading-relaxed">{withMarkers(a.answer, cite)}</p>}
      {a.claims.length > 0 && (
        <ul className="flex flex-col gap-2">
          {a.claims.map((c, i) => (
            <li key={i} className="rounded-md border border-line bg-ink/40 p-3 text-sm">
              <div className="flex flex-wrap items-start gap-2"><Prov kind={c.kind} /><span className="flex-1">{c.text}</span>
                <span className="flex gap-1">{c.citation_ids.map((id) => (
                  <button key={id} onClick={() => cite(id)} className="rounded bg-raised px-1 text-xs text-link">{id.replace("cite-", "")}</button>))}</span></div>
              {c.conditions && <p className="mt-1 text-xs text-text-3">Applies to: {c.conditions}</p>}
            </li>
          ))}
        </ul>
      )}
      {!a.llm.configured && a.status !== "answered" && (
        <Callout tone="warn">AI synthesis is not configured ({a.llm.reason}). The sources below were retrieved and the numbers computed without a language model; nothing here is AI-written.</Callout>
      )}
      {a.limitations.length > 0 && (
        <div>
          <h3 className="subhead text-[15px]">Limitations</h3>
          <ul className="mt-1 list-disc pl-5 text-sm text-text-2">{a.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
        </div>
      )}
      <div>
        <h3 className="subhead text-[15px]">Sources ({a.citations.length})</h3>
        {a.citations.length === 0 ? <p className="text-sm text-text-2">No supporting source was found.</p> : (
          <>
            <div role="tablist" aria-label="Filter sources by type" className="mt-2 flex flex-wrap gap-1.5">
              {[["all", "All"], ...Object.keys(counts).map((k) => [k, SOURCE_LABEL[k] ?? k])].map(([k, l]) => (
                <button key={k} role="tab" aria-selected={kind === k} onClick={() => setKind(k)}
                  className={`rounded-full border px-2.5 py-0.5 text-[13px] ${kind === k ? "border-flame bg-flame/15 text-text" : "border-line-strong text-text-2 hover:text-text"}`}>
                  {l} <span className="text-text-3">{k === "all" ? a.citations.length : counts[k]}</span>
                </button>
              ))}
            </div>
            <ol className="mt-2 flex flex-col gap-2">{shown.map((c) => <CitationCard key={c.citation_id} c={c} highlight={hl === c.citation_id} />)}</ol>
          </>
        )}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-text-2">How this answer was built ({a.tool_calls.length} tool calls, trace {a.trace_id})</summary>
        <ul className="mt-2 flex flex-col gap-1 text-text-2">
          {a.tool_calls.map((t, i) => (
            <li key={i}><span className={t.ok ? "text-ok" : "text-crit"}>{t.ok ? "ok" : "failed"}</span> {t.tool}
              <span className="text-text-3"> {JSON.stringify(t.args).slice(0, 120)}</span>{t.error && <span className="text-crit"> {t.error}</span>}</li>
          ))}
          {a.investigations_detected.length > 0 && <li>Investigations detected: {a.investigations_detected.join(", ")}</li>}
          {a.experiments_matched.length > 0 && <li>Experiments matched: {a.experiments_matched.map((u) => <Link key={u} className="mr-2" href={expHref(u)}>{u}</Link>)}</li>}
          {a.external_providers && <li>External providers: {Object.entries(a.external_providers).map(([k, v]) => `${k}: ${v.status}`).join(", ")}</li>}
          {a.verification && a.verification.rejected.length > 0 && <li className="text-warn">Rejected by verifier: {a.verification.rejected.join(" | ")}</li>}
        </ul>
      </details>
      {a.suggested_followups.length > 0 && (
        <p className="text-sm text-text-3">Follow-up ideas: {a.suggested_followups.join("; ")}</p>
      )}
    </div>
  );
}

type Health = { llm: { configured: boolean; mode: string; provider?: string; model?: string; reason?: string | null; paused_until?: string };
  retrieval: { mode: string } };

function ModeBanner() {
  const h = useApi<Health>("/health");
  if (!h.data) return null;
  const paused = h.data.llm.configured && h.data.llm.mode === "paused";
  const on = h.data.llm.configured && !paused;
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${on ? "border-ok/35 bg-ok/[0.05]" : "border-warn/35 bg-warn/[0.05]"}`}>
      <p className={`font-semibold ${on ? "text-ok" : "text-warn"}`}>{on ? "AI synthesis on" : paused ? `AI synthesis paused until ${h.data.llm.paused_until}` : "Evidence-only mode"}</p>
      <p className="mt-0.5 text-text-2">{paused
        ? "The model's free-tier request quota is used up. Until it resets you get the retrieved passages and computed tool results without AI-written prose; previously answered questions with identical evidence are still served from saved answers."
        : on
        ? "A language model writes the answer; a verifier removes statements whose citations or numbers do not check out."
        : `No language model is available${h.data.llm.reason ? ` (${h.data.llm.reason.replace(/\.$/, "")})` : ""}. You get the retrieved passages and computed tool results themselves, never AI-written prose.`}</p>
      <p className="mt-1 text-xs text-text-3">{h.data.llm.configured && h.data.llm.model ? `Model: ${h.data.llm.model} (${h.data.llm.provider}) · ` : ""}Retrieval: {h.data.retrieval.mode}</p>
    </div>
  );
}

const STARTERS: { label: string; q: string }[] = [
  { label: "Flame extinction", q: "Which FLEX methanol tests extinguished below 17.5 % O2?" },
  { label: "Burning rate", q: "Is the d²-law consistent with the reported FLEX burn times?" },
  { label: "Gas balance", q: "How much CO2 is produced per O2 consumed in BASS-II PMMA tests?" },
  { label: "Data meaning", q: "Does 'Disruption' mean extinction in FLEX?" },
];

function EmptyWorkspace({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="hairline-top relative overflow-hidden rounded-2xl border border-line/80 bg-panel/70 p-6 md:p-8">
      <div aria-hidden className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgba(91,140,255,0.16),transparent)]" />
      <h2 className="display relative text-[26px]">Start with a question</h2>
      <p className="relative mt-2 max-w-[60ch] text-text-2">Answers show their sources, the tools that ran, and what could not be determined. Pick a starting point:</p>
      <ul className="relative mt-5 grid gap-3 sm:grid-cols-2">
        {STARTERS.map((s) => (
          <li key={s.q}>
            <button onClick={() => onPick(s.q)} className="lift press w-full rounded-xl border border-line-strong/70 bg-ink/50 p-4 text-left hover:border-flame/60">
              <span className="text-xs text-flame">{s.label}</span>
              <span className="mt-1 block text-[14.5px] text-text">{s.q}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AssistantView() {
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [scope, setScope] = useState(sp.get("scope") ?? "internal");
  const [invs, setInvs] = useState<string[]>([]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const auto = useRef(false);
  const seq = useRef(0);
  const ctxUid = sp.get("uid");

  async function ask(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    setBusy(true);
    setElapsed(0);
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    const ctrl = new AbortController();
    const kill = setTimeout(() => ctrl.abort(), 120000);
    const id = ++seq.current;
    const patch = (f: (x: Turn) => Turn) => setTurns((t) => t.map((x) => (x.id === id ? f(x) : x)));
    setTurns((t) => [{ id, q: text, scope, steps: [] }, ...t]);
    const body = { question: text, source_scope: scope, investigations: invs, context_experiment_uids: ctxUid ? [ctxUid] : [] };
    const onEvent = (ev: Record<string, unknown>) => {
      if (ev.event === "tool_start") {
        patch((x) => ({ ...x, steps: [...x.steps, { tool: String(ev.tool), args: ev.args, running: true }] }));
      } else if (ev.event === "tool_end") {
        patch((x) => {
          const steps = [...x.steps];
          const j = steps.map((s) => s.running && s.tool === ev.tool).lastIndexOf(true);
          const done: Step = { tool: String(ev.tool), args: ev.args, running: false, ok: Boolean(ev.ok),
            ms: typeof ev.ms === "number" ? ev.ms : undefined, error: typeof ev.error === "string" ? ev.error : undefined };
          if (j >= 0) steps[j] = done; else steps.push(done);
          return { ...x, steps };
        });
      }
    };
    try {
      let res: Answer;
      try {
        res = await apiStream<Answer>("/assistant/ask/stream", body, onEvent, ctrl.signal);
      } catch (e) {
        // an older backend without the streaming route: fall back to the one-shot endpoint
        if (!(e instanceof ApiError && (e.status === 404 || e.status === 405))) throw e;
        res = await apiFetch<Answer>("/assistant/ask", { method: "POST", signal: ctrl.signal, body: JSON.stringify(body) });
      }
      patch((x) => ({ ...x, res }));
    } catch (e) {
      const err = (e as Error).name === "AbortError" ? new ApiError(0, "timeout", "The assistant did not respond within 120 s. Try a narrower question.")
        : e instanceof ApiError ? e : new ApiError(0, "unknown", String(e));
      patch((x) => ({ ...x, err }));
    } finally {
      clearInterval(timer);
      clearTimeout(kill);
      setBusy(false);
    }
  }

  useEffect(() => {
    const initial = sp.get("q");
    if (initial && !auto.current) {
      auto.current = true;
      void ask(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit(e: FormEvent) {
    e.preventDefault();
    void ask(q);
  }

  return (
    <>
      <PageHeader kicker="Discover" title="Research Copilot"
        lead="Ask about microgravity combustion in the three NASA investigations. The Copilot runs fixed data tools and searches the documents (and, if you choose, external literature). Every statement must cite a source, and every number must appear in that source." />
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <div className="flex flex-col gap-4 xl:sticky xl:top-[calc(var(--hdr,57px)+1.5rem)] xl:self-start">
          <ModeBanner />
          <Panel tone="feature">
            <form onSubmit={submit} className="flex flex-col gap-4">
              <label htmlFor="aq" className="subhead text-[16px]">Your scientific question</label>
              <textarea id="aq" rows={5} className={`${inputCls} resize-y text-[15px] leading-relaxed`} value={q} onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void ask(q); } }}
                placeholder="e.g. Is the d²-law consistent with the reported FLEX burn times?" />
              <Segmented label="Sources" value={scope} onChange={setScope}
                options={[["internal", "NASA data + documents"], ["both", "+ external papers"], ["external", "External only"]]} />
              <fieldset className="text-sm">
                <legend className="text-text-2">Limit to phenomena (optional)</legend>
                <div className="mt-1.5 flex flex-col gap-1.5">
                  {PHENOMENA.map((p) => {
                    const on = invs.includes(p.inv);
                    return (
                      <label key={p.inv} className={`press flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 ${on ? "border-flame/60 bg-flame/[0.08]" : "border-line-strong/70 hover:border-line-strong"}`}>
                        <input type="checkbox" className="accent-[var(--flame)]" checked={on}
                          onChange={() => setInvs((s) => s.includes(p.inv) ? s.filter((x) => x !== p.inv) : [...s, p.inv])} />
                        <span className="flex-1">{p.short}</span>
                        <span className="text-xs text-text-3">{p.source}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              {ctxUid && <p className="text-xs text-text-3">Context: experiment <Link href={expHref(ctxUid)}>{ctxUid}</Link></p>}
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-text-3">Ctrl + Enter to ask</span>
                <Button type="submit" variant="primary" disabled={busy || !q.trim()}>{busy ? `Working… ${elapsed}s` : <>Ask<Icon name="chevron" size={14} /></>}</Button>
              </div>
            </form>
          </Panel>
          <div className="px-1">
            <p className="text-sm text-text-3">Try a question it should decline</p>
            <ul className="mt-1.5 flex flex-col gap-1.5 text-sm">
              {["What is the exact safe O2 threshold for an occupied spacecraft?", "Does the SAFFIRE workbook contain flame-front measurements?"].map((x) => (
                <li key={x}><button className="text-left text-link hover:underline" onClick={() => { setQ(x); void ask(x); }}>{x}</button></li>
              ))}
            </ul>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-5" aria-live="polite">
          {turns.length === 0 && <EmptyWorkspace onPick={(x) => { setQ(x); void ask(x); }} />}
          {turns.map((t) => (
            <Panel key={t.id} title={t.q} aside={t.scope === "internal" ? "NASA sources" : t.scope === "both" ? "NASA + external" : "External only"}>
              {t.err ? <ErrorState error={t.err} onRetry={() => void ask(t.q)} /> : t.res ? <AnswerBlock a={t.res} /> : (
                <LiveProgress steps={t.steps} elapsed={elapsed} />
              )}
            </Panel>
          ))}
        </div>
      </div>
    </>
  );
}
