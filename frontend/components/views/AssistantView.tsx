"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button, Callout, ErrorState, inputCls, PageHeader, Panel, Prov } from "@/components/ui";
import { apiFetch, ApiError, expHref, fmt } from "@/lib/api";

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
  llm: { configured: boolean; mode: string; reason: string | null; model?: string; error?: string };
  investigations_detected: string[]; experiments_matched: string[];
  external_providers: Record<string, { status: string; error?: string }> | null; trace_id: string;
  verification?: { rejected: string[]; accepted_claims: number };
};
type Turn = { q: string; scope: string; res?: Answer; err?: ApiError };

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
    : c.source_type === "local_document" && c.document_id ? `/api/v1/documents/${c.document_id}/file${c.page_pdf ? `#page=${c.page_pdf}` : ""}`
      : c.url;
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

function AnswerBlock({ a }: { a: Answer }) {
  const [hl, setHl] = useState<string | null>(null);
  const st = STATUS[a.status] ?? STATUS.retrieval_only;
  const cite = (id: string) => {
    setHl(id);
    document.getElementById(`c-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded border px-2 py-0.5 text-sm font-semibold ${st.cls}`}>{st.label}</span>
        <span className="text-sm text-text-3">{st.note}</span>
      </div>
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
          <ol className="mt-2 flex flex-col gap-2">{a.citations.map((c) => <CitationCard key={c.citation_id} c={c} highlight={hl === c.citation_id} />)}</ol>
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

export default function AssistantView() {
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [scope, setScope] = useState(sp.get("scope") ?? "internal");
  const [invs, setInvs] = useState<string[]>([]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const auto = useRef(false);
  const ctxUid = sp.get("uid");

  async function ask(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    setBusy(true);
    setElapsed(0);
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    const ctrl = new AbortController();
    const kill = setTimeout(() => ctrl.abort(), 120000);
    const turn: Turn = { q: text, scope };
    setTurns((t) => [turn, ...t]);
    try {
      const res = await apiFetch<Answer>("/assistant/ask", { method: "POST", signal: ctrl.signal, body: JSON.stringify({
        question: text, source_scope: scope, investigations: invs, context_experiment_uids: ctxUid ? [ctxUid] : [] }) });
      setTurns((t) => t.map((x) => (x === turn ? { ...x, res } : x)));
    } catch (e) {
      const err = (e as Error).name === "AbortError" ? new ApiError(0, "timeout", "The assistant did not respond within 120 s. Try a narrower question.")
        : e instanceof ApiError ? e : new ApiError(0, "unknown", String(e));
      setTurns((t) => t.map((x) => (x === turn ? { ...x, err } : x)));
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
      <PageHeader title="Research assistant"
        lead="Ask about the three NASA investigations. The assistant runs fixed data tools and searches the documents (and, if you choose, external literature). Every statement must cite a source, and every number must appear in that source." />
      <div className="grid gap-5 xl:grid-cols-[340px_1fr]">
        <Panel title="Question">
          <form onSubmit={submit} className="flex flex-col gap-3">
            <label htmlFor="aq" className="sr-only">Your question</label>
            <textarea id="aq" rows={4} className={`${inputCls} resize-y`} value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="e.g. Is the d²-law consistent with the reported FLEX burn times?" />
            <fieldset className="text-sm">
              <legend className="text-text-2">Sources</legend>
              {[["internal", "NASA data and documents"], ["both", "NASA + external literature"], ["external", "External literature only"]].map(([v, l]) => (
                <label key={v} className="mt-1 flex items-center gap-2"><input type="radio" name="scope" value={v} checked={scope === v} onChange={() => setScope(v)} />{l}</label>
              ))}
            </fieldset>
            <fieldset className="text-sm">
              <legend className="text-text-2">Limit to investigations (optional)</legend>
              {[["PSI-69", "FLEX"], ["PSI-25", "BASS-II"], ["PSI-98", "SAFFIRE-I"]].map(([v, l]) => (
                <label key={v} className="mr-3 mt-1 inline-flex items-center gap-1.5">
                  <input type="checkbox" checked={invs.includes(v)} onChange={() => setInvs((s) => s.includes(v) ? s.filter((x) => x !== v) : [...s, v])} />{l}
                </label>
              ))}
            </fieldset>
            {ctxUid && <p className="text-xs text-text-3">Context: experiment <Link href={expHref(ctxUid)}>{ctxUid}</Link></p>}
            <Button type="submit" variant="primary" disabled={busy || !q.trim()}>{busy ? `Working… ${elapsed}s` : "Ask"}</Button>
          </form>
          <p className="mt-4 text-sm text-text-3">Questions it should decline</p>
          <ul className="mt-1 flex flex-col gap-1 text-sm">
            {["What is the exact safe O2 threshold for an occupied spacecraft?", "Does the SAFFIRE workbook contain flame-front measurements?"].map((x) => (
              <li key={x}><button className="text-left text-link hover:underline" onClick={() => { setQ(x); void ask(x); }}>{x}</button></li>
            ))}
          </ul>
        </Panel>
        <div className="flex min-w-0 flex-col gap-5" aria-live="polite">
          {turns.length === 0 && (
            <Panel><p className="text-text-2">Ask a question to begin. Answers show their sources, the tools that ran, and what could not be determined.</p></Panel>
          )}
          {turns.map((t, i) => (
            <Panel key={i} title={t.q} aside={t.scope === "internal" ? "NASA sources" : t.scope === "both" ? "NASA + external" : "External only"}>
              {t.err ? <ErrorState error={t.err} onRetry={() => void ask(t.q)} /> : t.res ? <AnswerBlock a={t.res} /> : (
                <p className="text-sm text-text-2">Running data tools and searching sources… {fmt(elapsed)} s</p>
              )}
            </Panel>
          ))}
        </div>
      </div>
    </>
  );
}
