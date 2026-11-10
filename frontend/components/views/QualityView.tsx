"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { BarChart } from "@/components/charts";
import { Field, inputCls, Loadable, PageHeader, Pager, Panel, Severity } from "@/components/ui";
import { expHref, INV_LABEL, qs, useApi } from "@/lib/api";

type Flag = { flag_id: string; investigation_id: string; experiment_uid: string | null; display_id: string | null; source_path: string | null;
  source_row: number | null; raw_field: string | null; raw_value: string | null; rule_id: string; category: string; severity: string;
  description: string; derived_value: string | null; evidence_ref: string | null; proposed_correction: string | null; status: string };
type List = { total: number; page: number; pages: number; items: Flag[] };
type Summary = { total: number; policy: string; per_investigation: Record<string, { flags: number; experiments_affected: number }>;
  by_investigation_severity: Record<string, number>; rules: { investigation_id: string; rule_id: string; category: string; severity: string;
    status: string; n: number; experiments: number; example: string }[] };

const KEYS = ["investigation", "severity", "category", "rule_id", "status", "q"];

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
      <PageHeader title="Data quality and validation"
        lead="Automated rules that flag missing, ambiguous, duplicated, inconsistent or physically implausible values, and conflicts between the CSVs and the NASA documents. Flags annotate the data; nothing in the original files is changed."
        actions={<a className="inline-flex min-h-9 items-center rounded-md border border-line-strong bg-raised px-3 text-sm text-text no-underline hover:border-flame/70"
          href={`/api/v1/quality/flags.csv${qs(f)}`}>Export these flags (CSV)</a>} />
      <Loadable state={sum} rows={4}>
        {(s) => (
          <div className="mb-5 grid gap-4 md:grid-cols-3">
            {["PSI-69", "PSI-25", "PSI-98"].map((inv) => (
              <button key={inv} onClick={() => set({ investigation: f.investigation === inv ? null : inv })} aria-pressed={f.investigation === inv}
                className={`rounded-lg border bg-panel p-4 text-left ${f.investigation === inv ? "border-flame" : "border-line hover:border-line-strong"}`}>
                <span className="subhead text-[17px]">{INV_LABEL[inv]}</span>
                <span className="block text-sm text-text-2">{s.per_investigation[inv]?.flags ?? 0} flags on {s.per_investigation[inv]?.experiments_affected ?? 0} rows</span>
                <span className="mt-2 flex flex-wrap gap-1.5">{["critical", "warning", "info"].map((sv) => s.by_investigation_severity[`${inv}|${sv}`] ?
                  <Severity key={sv} level={sv} count={s.by_investigation_severity[`${inv}|${sv}`]} /> : null)}</span>
              </button>
            ))}
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
        )}
      </Loadable>

      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
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
        <Panel title="Rules">
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
    </>
  );
}
