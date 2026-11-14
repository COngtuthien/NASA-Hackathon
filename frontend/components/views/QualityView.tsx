"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Disclosure } from "@/components/disclosure";
import { BarChart } from "@/components/charts";
import { Field, inputCls, Loadable, PageHeader, Pager, Panel, Severity, Skeleton } from "@/components/ui";
import { PHENOMENA } from "@/lib/routes";
import { expHref, INV_LABEL, qs, useApi } from "@/lib/api";

type Flag = { flag_id: string; investigation_id: string; experiment_uid: string | null; display_id: string | null; source_path: string | null;
  source_row: number | null; raw_field: string | null; raw_value: string | null; rule_id: string; category: string; severity: string;
  description: string; derived_value: string | null; evidence_ref: string | null; proposed_correction: string | null; status: string };
type List = { total: number; page: number; pages: number; items: Flag[] };
type Summary = { total: number; policy: string; per_investigation: Record<string, { flags: number; experiments_affected: number }>;
  by_category: Record<string, number>;
  by_investigation_severity: Record<string, number>; rules: { investigation_id: string; rule_id: string; category: string; severity: string;
    status: string; n: number; experiments: number; example: string }[] };

const KEYS = ["investigation", "severity", "category", "rule_id", "status", "q"];

// What each rule category means for a reader judging reliability. Counts come from /quality/summary.
const CATEGORY: { key: string; title: string; note: string }[] = [
  { key: "missing", title: "Missing values", note: "Blank or placeholder cells; data completeness" },
  { key: "document_conflict", title: "Source mismatches", note: "CSV disagrees with a NASA document or report table" },
  { key: "source_warning", title: "Ambiguous fields", note: "Headers or cells whose meaning needs a caveat" },
  { key: "unit", title: "Unit questions", note: "Unit missing, mislabelled or inferred" },
  { key: "inconsistent", title: "Internal inconsistencies", note: "Values that disagree within the dataset" },
  { key: "duplicate", title: "Duplicates", note: "Repeated IDs or reused samples" },
  { key: "suspicious", title: "Physically implausible", note: "Values outside what the physics allows" },
  { key: "invalid", title: "Invalid", note: "Impossible values, excluded from analyses" },
];
const STATUS_NOTE: Record<string, string> = {
  reported: "flagged by a rule, no further review", unresolved: "needs information not in the repository",
  confirmed: "checked against a second source", disputed: "two NASA sources disagree; both values kept",
};

type Inv = { items: { investigation_id: string; burns: number }[] };

function Completeness({ s }: { s: Summary }) {
  const inv = useApi<Inv>("/investigations");
  const burns = Object.fromEntries((inv.data?.items ?? []).map((i) => [i.investigation_id, i.burns]));
  const status = s.rules.reduce<Record<string, number>>((m, r) => ({ ...m, [r.status]: (m[r.status] ?? 0) + r.n }), {});
  const catMax = Math.max(1, ...Object.values(s.by_category));
  return (
    <div className="grid gap-5 xl:grid-cols-[1.1fr_1fr]">
      <Panel title="Rows carrying at least one flag" aside="any severity, including informational">
        <ul className="flex flex-col gap-4">
          {PHENOMENA.map((p) => {
            const n = burns[p.inv];
            const hit = s.per_investigation[p.inv]?.experiments_affected ?? 0;
            const pct = n ? (hit / n) * 100 : null;
            return (
              <li key={p.inv}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span><span className="text-text">{p.short}</span> <span className="text-text-3">{p.source}</span></span>
                  <span className="text-text-2">{hit} of {n ?? "…"} rows{pct !== null ? ` (${pct.toFixed(0)} %)` : ""}</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink" role="img" aria-label={`${p.short}: ${hit} of ${n ?? "unknown"} rows have at least one flag`}>
                  <div className="h-full rounded-full bg-[linear-gradient(90deg,var(--info),var(--warn))] transition-[width] duration-700" style={{ width: pct === null ? 0 : `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-text-3">A flagged row is not a bad row: most flags are informational (a blank optional cell, a multi-stage value kept as text). Filter by severity below to see what affects analyses.</p>
      </Panel>
      <Panel title="Review status of all flags" aside={`n = ${s.total}`}>
        <ul className="flex flex-col gap-2.5 text-sm">
          {["reported", "unresolved", "disputed", "confirmed"].map((k) => (
            <li key={k} className="flex items-baseline gap-3">
              <span className="w-14 text-right text-[18px] font-semibold text-data [font-stretch:115%]">{status[k] ?? 0}</span>
              <span><span className="capitalize text-text">{k}</span> <span className="text-text-3">{STATUS_NOTE[k]}</span></span>
            </li>
          ))}
        </ul>
      </Panel>
      <div className="xl:col-span-2">
        <Panel title="What kind of problems" aside="flags by rule category; select one to filter the list">
          <ul className="grid gap-x-8 gap-y-3 md:grid-cols-2">
            {CATEGORY.filter((c) => s.by_category[c.key]).map((c) => (
              <li key={c.key}>
                <Link href={`/reliability?category=${c.key}#flags`} scroll={false} className="group block no-underline hover:no-underline">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="text-text group-hover:text-flame">{c.title}</span><span className="text-text-2">{s.by_category[c.key]}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink" aria-hidden>
                    <div className="h-full rounded-full bg-data/70" style={{ width: `${(s.by_category[c.key] / catMax) * 100}%` }} />
                  </div>
                  <p className="mt-0.5 text-xs text-text-3">{c.note}</p>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

type FlagItem = { flag_id: string; rule_id: string; severity: string; description: string; investigation_id: string };

/**
 * The most important warnings, in plain words: one entry per critical or warning rule, with its count. Shown by
 * default so serious data problems are never hidden behind a summary.
 */
function TopWarnings({ s, onRule }: { s: Summary; onRule: (r: string) => void }) {
  const crit = useApi<{ items: FlagItem[] }>("/quality/flags?severity=critical&page_size=200");
  const warn = useApi<{ items: FlagItem[] }>("/quality/flags?severity=warning&page_size=200");
  const byRule = new Map<string, { rule: string; severity: string; text: string; inv: string; n: number }>();
  for (const f of [...(crit.data?.items ?? []), ...(warn.data?.items ?? [])]) {
    if (!byRule.has(f.rule_id)) byRule.set(f.rule_id, { rule: f.rule_id, severity: f.severity, text: f.description, inv: f.investigation_id,
      n: s.rules.filter((r) => r.rule_id === f.rule_id).reduce((a, r) => a + r.n, 0) });
  }
  const rows = [...byRule.values()].sort((a, b) => (a.severity === b.severity ? b.n - a.n : a.severity === "critical" ? -1 : 1));
  return (
    <section aria-labelledby="top-warn" className="mb-6">
      <h2 id="top-warn" className="subhead text-[20px]">Most important warnings</h2>
      <p className="mt-1 max-w-[65ch] text-[14.5px] text-text-2">Problems that change how a value can be used. Each is flagged, never silently corrected.</p>
      {crit.loading || warn.loading ? <div className="mt-3"><Skeleton rows={3} /></div> : (
        <ul className="mt-3 grid gap-2 md:grid-cols-2" data-testid="top-warnings">
          {rows.slice(0, 8).map((r) => (
            <li key={r.rule} className="flex flex-col gap-1 rounded-xl border border-line/60 bg-panel/40 p-3 text-[14px]">
              <span className="flex flex-wrap items-center gap-2"><Severity level={r.severity} count={r.n} />
                <button type="button" className="text-[13px] text-link hover:underline" onClick={() => onRule(r.rule)}>{r.rule}</button>
                <span className="text-[12px] text-text-3">{INV_LABEL[r.inv]}</span></span>
              <span className="text-text-2">{r.text.length > 220 ? `${r.text.slice(0, 220)}…` : r.text}</span>
            </li>
          ))}
        </ul>
      )}
      {rows.length > 8 && <p className="mt-2 text-[13px] text-text-3">{rows.length - 8} more warning rules in the full list below.</p>}
    </section>
  );
}

export default function QualityView() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const f = Object.fromEntries(KEYS.map((k) => [k, sp.get(k)]));
  const page = Number(sp.get("page") ?? "1");
  const list = useApi<List>(`/quality/flags${qs({ ...f, page, page_size: 25 })}`);
  const sum = useApi<Summary>("/quality/summary");
  const [q, setQ] = useState(sp.get("q") ?? "");
  const set = (patch: Record<string, string | null>) => {
    const n = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) n.set(k, v);
      else n.delete(k);
    }
    if (!("page" in patch)) n.delete("page");
    router.replace(`${pathname}?${n.toString()}`, { scroll: false });
  };
  const submit = (e: FormEvent) => { e.preventDefault(); set({ q: q.trim() || null }); };

  return (
    <>
      <PageHeader kicker="Trust & methods" title="Data Reliability"
        sections={[{ id: "overview", label: "Overview" }, { id: "stats", label: "Statistics" }, { id: "flags", label: "All flags" }]}
        lead="Automated checks find missing, ambiguous, inconsistent or implausible values, and places where NASA sources disagree. Flags annotate the data; the original files are never changed." />
      <Loadable state={sum} rows={4}>
        {(s) => (
          <>
          <div id="overview" className="mb-6 grid scroll-mt-36 gap-4 md:grid-cols-3">
            {["PSI-69", "PSI-25", "PSI-98"].map((inv) => (
              <button key={inv} onClick={() => set({ investigation: f.investigation === inv ? null : inv })} aria-pressed={f.investigation === inv}
                className={`lift press hairline-top rounded-xl border bg-panel/80 p-4 text-left ${f.investigation === inv ? "border-flame shadow-[0_0_0_1px_var(--flame)]" : "border-line hover:border-line-strong"}`}>
                <span className="subhead text-[17px]">{PHENOMENA.find((p) => p.inv === inv)?.short}</span> <span className="text-sm text-text-3">{INV_LABEL[inv]}</span>
                <span className="block text-sm text-text-2">{s.per_investigation[inv]?.flags ?? 0} flags on {s.per_investigation[inv]?.experiments_affected ?? 0} rows</span>
                <span className="mt-2 flex flex-wrap gap-1.5">{["critical", "warning"].map((sv) => s.by_investigation_severity[`${inv}|${sv}`] ?
                  <Severity key={sv} level={sv} count={s.by_investigation_severity[`${inv}|${sv}`]} /> : null)}
                  <span className="text-[12px] text-text-3">{s.by_investigation_severity[`${inv}|info`] ?? 0} informational</span></span>
              </button>
            ))}
          </div>
          <TopWarnings s={s} onRule={(r) => set({ rule_id: r })} />
          <Disclosure id="stats" title="Flag statistics" action="Show the statistics" className="mb-6"
            summary={<>{s.total} flags in total. Most are informational: a blank optional cell, or a multi-stage value kept as text.</>}>
          <div className="grid gap-5">
            <div><Completeness s={s} /></div>
            <div className="md:col-span-3">
              <Panel title="Flags by investigation and severity" aside={`n = ${s.total} flags`}>
                <BarChart x={["FLEX", "BASS-II", "SAFFIRE-I"]} stack xTitle="Investigation" yTitle="Flags (count)" height={260}
                  ariaLabel="Stacked bar chart of quality flags by investigation and severity"
                  series={(["critical", "warning", "info"] as const).map((sv) => ({
                    name: sv[0].toUpperCase() + sv.slice(1),
                    color: sv === "critical" ? "#FF6B6B" : sv === "warning" ? "#F5C451" : "#7FA7D9",
                    y: ["PSI-69", "PSI-25", "PSI-98"].map((inv) => s.by_investigation_severity[`${inv}|${sv}`] ?? 0),
                  }))} />
                <p className="mt-1 text-xs text-text-3">Most flags are informational (blank cells, multi-stage text, reused samples). Critical flags mark physically impossible or placeholder values.</p>
              </Panel>
            </div>
          </div>
          </Disclosure>
          </>
        )}
      </Loadable>

      <Disclosure id="flags" level="explore" title="All flags" action="Browse all flags" defaultOpen={KEYS.some((k) => !!f[k])}
        summary="Filter every flag by severity, category, status, rule or test ID; each one traces to its file, row and column.">
      <p className="mb-3 text-[13px]"><a href={`/api/v1/quality/flags.csv${qs(f)}`}>Export these flags (CSV)</a></p>
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <Panel title="Flags" aside={list.data ? `${list.data.total} matching` : undefined}>
          <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Severity" htmlFor="qs"><select id="qs" className={inputCls} value={f.severity ?? ""} onChange={(e) => set({ severity: e.target.value || null })}>
              <option value="">All</option><option>critical</option><option>warning</option><option>info</option></select></Field>
            <Field label="Category" htmlFor="qc"><select id="qc" className={inputCls} value={f.category ?? ""} onChange={(e) => set({ category: e.target.value || null })}>
              <option value="">All</option>{["missing", "invalid", "inconsistent", "duplicate", "document_conflict", "source_warning", "unit", "suspicious"].map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}</select></Field>
            <Field label="Status" htmlFor="qst"><select id="qst" className={inputCls} value={f.status ?? ""} onChange={(e) => set({ status: e.target.value || null })}>
              <option value="">All</option>{["reported", "confirmed", "disputed", "unresolved"].map((c) => <option key={c}>{c}</option>)}</select></Field>
            <form onSubmit={submit}><Field label="Text or test ID" htmlFor="qq"><input id="qq" className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} /></Field></form>
          </div>
          {f.rule_id && <p className="mb-2 text-sm">Rule <b>{f.rule_id}</b> <button className="text-link" onClick={() => set({ rule_id: null })}>clear</button></p>}
          <Loadable state={list} rows={8}>
            {(d) => (
              <>
                <ul className="flex flex-col divide-y divide-line">
                  {d.items.map((x) => (
                    <li key={x.flag_id} className="py-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Severity level={x.severity} />
                        <button className="font-semibold text-link" onClick={() => set({ rule_id: x.rule_id })}>{x.rule_id}</button>
                        <span className="text-xs text-text-3">{x.category.replace("_", " ")}, {x.status}, {INV_LABEL[x.investigation_id]}</span>
                        {x.experiment_uid && <Link href={expHref(x.experiment_uid)} className="ml-auto">{x.display_id} (row {x.source_row})</Link>}
                      </div>
                      <p className="mt-1 text-text-2">{x.description}</p>
                      <p className="mt-1 text-xs text-text-3">
                        {x.source_path && <>File <span className="raw">{x.source_path}</span>{x.source_row ? `, row ${x.source_row}` : ""}. </>}
                        {x.raw_field && <>Column <span className="raw">{x.raw_field}</span>{x.raw_value !== null && <> = <span className="raw">{x.raw_value}</span></>}. </>}
                        {x.derived_value && <>Derived: {x.derived_value}. </>}{x.evidence_ref && <>Evidence: {x.evidence_ref}. </>}
                        {x.proposed_correction && <>Proposed (not applied): {x.proposed_correction}.</>}
                      </p>
                    </li>
                  ))}
                </ul>
                <div className="mt-3"><Pager page={d.page} pages={d.pages} onPage={(p) => set({ page: String(p) })} /></div>
              </>
            )}
          </Loadable>
        </Panel>
        <Panel id="rules" title="Rules">
          <Loadable state={sum} rows={8}>
            {(s) => (
              <>
                <p className="mb-2 text-xs text-text-3">{s.policy}</p>
                <table className="data"><thead><tr><th>Rule</th><th className="num">Flags</th><th className="num">Rows</th></tr></thead>
                  <tbody>{s.rules.filter((r) => !f.investigation || r.investigation_id === f.investigation).map((r) => (
                    <tr key={r.rule_id + r.status}><td><button className="text-left text-link" onClick={() => set({ rule_id: r.rule_id })}>{r.rule_id}</button>
                      <span className="block"><Severity level={r.severity} /></span></td><td className="num">{r.n}</td><td className="num">{r.experiments}</td></tr>))}</tbody></table>
              </>
            )}
          </Loadable>
        </Panel>
      </div>
      </Disclosure>
    </>
  );
}
