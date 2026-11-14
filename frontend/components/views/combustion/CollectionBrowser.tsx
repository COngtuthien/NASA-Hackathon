"use client";

// Phase 16: browse one of the Phase 13 collections at its real evidence level. Filters, columns and comparison rules
// come from /api/v1/combustion/collections/{key}; nothing is assumed from the FLEX table.
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, Callout, Field, inputCls, Loadable, Pager, Panel } from "@/components/ui";
import { apiFetch, fmt, useApi } from "@/lib/api";
import InvestigationProfile from "./InvestigationProfile";
import { LEVEL_CLS } from "./DomainPicker";

type Col = { field: string; label: string; unit: string | null; kind: string; role: string };
type Item = { record_id: string; test_id: string | null; values: Record<string, unknown>; flags: string[] };
export type BrowseResp = {
  key: string; investigation_id: string; title: string; level: string; level_label: string; badge: string; note: string;
  columns: Col[]; key_columns: string[]; filters: { cats: string[]; nums: string[] };
  facets: Record<string, { value: string; count: number }[] | { min: number | null; max: number | null; n: number; missing: number }>;
  applied: Record<string, unknown>; excluded_missing: number; total: number; page: number; pages: number; items: Item[];
  comparison: { allowed: boolean; within: string | null; reason: string | null }; links: { label: string; href: string }[];
};
type CompareResp = { compatible: boolean; reason?: string; rows?: { field: string; label: string; unit: string | null; role: string; values: unknown[] }[];
  records?: { record_id: string; test_id: string }[]; level_label?: string };

const ROLE_CLS: Record<string, string> = { outcome: "text-data", condition: "", derived: "text-text-2", id: "", log: "text-text-3" };
const show = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : typeof v === "boolean" ? (v ? "yes" : "no") : Array.isArray(v) ? v.join(", ") : fmt(v));

export default function CollectionBrowser({ dataset }: { dataset: string }) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const params = new URLSearchParams([...sp.entries()].filter(([k]) => !["dataset", "cols"].includes(k)));
  const d = useApi<BrowseResp>(`/combustion/collections/${dataset}${params.toString() ? `?${params}` : ""}`);
  const [sel, setSel] = useState<string[]>([]);
  const [cmp, setCmp] = useState<CompareResp | null>(null);
  const [q, setQ] = useState(sp.get("q") ?? "");
  const allCols = sp.get("cols") === "all";
  const update = (patch: Record<string, string | null>) => {
    const n = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) { if (v === null || v === "") n.delete(k); else n.set(k, v); }
    if (!("page" in patch)) n.delete("page");
    router.replace(`${pathname}?${n.toString()}`, { scroll: false });
    setCmp(null);
  };
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 5 ? s : [...s, id]));
  async function compare() {
    setCmp(await apiFetch<CompareResp>("/combustion/compare", { method: "POST", body: JSON.stringify({ record_ids: sel }) }));
  }
  return (
    <Loadable state={d} rows={10}>{(x) => {
      const cols = x.columns.filter((c) => allCols || x.key_columns.includes(c.field));
      return (
        <div className="flex flex-col gap-4" data-testid="collection-browser" data-collection={x.key}>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="subhead text-[20px]">{x.title}</h2>
            <span className={`rounded border px-1.5 py-px text-[12px] font-medium ${LEVEL_CLS[x.level] ?? ""}`} data-testid="evidence-badge">{x.badge}</span>
          </div>
          <p className="max-w-[80ch] text-[14px] text-text-2" data-testid="collection-note">{x.note}</p>
          <div className="flex flex-wrap gap-3 text-[13.5px]">
            {x.links.map((l) => <Link key={l.href} href={l.href}>{l.label}</Link>)}
          </div>
          <InvestigationProfile inv={x.investigation_id} compact />
          <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
            <Panel title="Filters" aside={Object.keys(x.applied).length ? <button className="text-link" onClick={() => router.replace(`${pathname}?dataset=${dataset}`)}>Reset</button> : undefined}>
              <div className="flex flex-col gap-3" data-testid="collection-filters">
                <form onSubmit={(e) => { e.preventDefault(); update({ q }); }}>
                  <Field label="Search" htmlFor="cq"><input id="cq" className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Test id, fuel, label…" /></Field>
                </form>
                {x.filters.cats.map((f) => {
                  const col = x.columns.find((c) => c.field === f);
                  const opts = x.facets[f] as { value: string; count: number }[];
                  return (
                    <Field key={f} label={col?.label ?? f} htmlFor={`cf-${f}`}>
                      <select id={`cf-${f}`} data-testid={`cfilter-${f}`} className={inputCls} value={sp.get(`f_${f}`) ?? ""} onChange={(e) => update({ [`f_${f}`]: e.target.value })}>
                        <option value="">Any</option>
                        {opts.map((o) => <option key={o.value} value={o.value}>{o.value === "true" ? "yes" : o.value === "false" ? "no" : o.value} ({o.count})</option>)}
                      </select>
                    </Field>
                  );
                })}
                {x.filters.nums.map((f) => {
                  const col = x.columns.find((c) => c.field === f);
                  const fc = x.facets[f] as { min: number | null; max: number | null; missing: number };
                  return (
                    <fieldset key={f} className="flex flex-col gap-1 text-sm">
                      <legend className="text-text-2">{col?.label ?? f}{col?.unit ? ` (${col.unit})` : ""}</legend>
                      <div className="flex gap-2">
                        {(["min", "max"] as const).map((b) => (
                          <input key={`${b}-${sp.get(`${b}_${f}`) ?? ""}`} aria-label={`${col?.label ?? f} ${b}`} data-testid={`cfilter-${b}-${f}`} type="number" step="any"
                            placeholder={fc.min !== null ? `${b} ${fmt(b === "min" ? fc.min : fc.max)}` : b} className={`${inputCls} w-full`} defaultValue={sp.get(`${b}_${f}`) ?? ""}
                            onBlur={(e) => update({ [`${b}_${f}`]: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") update({ [`${b}_${f}`]: (e.target as HTMLInputElement).value }); }} />
                        ))}
                      </div>
                      {fc.missing > 0 && <span className="text-[12px] text-text-3">{fc.missing} record(s) have no value; a range filter excludes them.</span>}
                    </fieldset>
                  );
                })}
                {x.filters.cats.length + x.filters.nums.length === 0 && <p className="text-[13px] text-text-3">No filterable fields in this collection.</p>}
              </div>
            </Panel>
            <div className="flex min-w-0 flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="subhead text-[16px]" data-testid="collection-count">{x.total} {x.level === "figure" ? "series" : x.level === "day_summary" ? "days" : "records"}</h3>
                <div className="flex items-center gap-3 text-[13px]">
                  {x.excluded_missing > 0 && <span className="text-text-3">{x.excluded_missing} without a value excluded by the range</span>}
                  <button className="text-link" onClick={() => update({ cols: allCols ? null : "all" })}>{allCols ? "Key columns" : "All columns"}</button>
                </div>
              </div>
              {x.comparison.allowed ? (
                <div className="flex flex-wrap items-center gap-2 text-[13px] text-text-2">
                  <Button onClick={compare} disabled={sel.length < 2} ariaLabel="Compare the selected records">Compare selected ({sel.length})</Button>
                  <span>Tick 2–5 records{x.comparison.within ? `; only the same ${x.comparison.within} can be compared` : ""}.</span>
                </div>
              ) : <p className="text-[13px] text-text-3" data-testid="compare-unavailable">Comparison unavailable: {x.comparison.reason}</p>}
              {cmp && (cmp.compatible ? (
                <Panel title={`Comparison (${cmp.level_label})`}>
                  <div className="overflow-x-auto" data-testid="compare-result">
                    <table className="data"><thead><tr><th>Field</th>{cmp.records!.map((r) => <th key={r.record_id}>{r.test_id}</th>)}</tr></thead>
                      <tbody>{cmp.rows!.map((r) => <tr key={r.field}><td className={ROLE_CLS[r.role]}>{r.label}{r.unit ? ` (${r.unit})` : ""}{r.role === "outcome" ? " · outcome" : ""}</td>
                        {r.values.map((v, i) => <td key={i}>{show(v)}</td>)}</tr>)}</tbody></table>
                  </div>
                </Panel>
              ) : <Callout tone="warn"><span data-testid="compare-rejected">{cmp.reason}</span></Callout>)}
              <div className="overflow-x-auto rounded-xl border border-line/60">
                <table className="data" data-testid="collection-table">
                  <thead><tr>{x.comparison.allowed && <th className="w-8"><span className="sr-only">Select</span></th>}
                    {cols.map((c) => <th key={c.field}><button className="text-left" onClick={() => update({ sort: c.field, order: sp.get("sort") === c.field && sp.get("order") !== "desc" ? "desc" : "asc" })}>
                      {c.label}{c.unit ? ` (${c.unit})` : ""}</button></th>)}<th>Flags</th></tr></thead>
                  <tbody>{x.items.map((it, i) => (
                    <tr key={it.record_id}>
                      {x.comparison.allowed && <td><input type="checkbox" aria-label={`Select ${it.test_id ?? it.record_id}`} checked={sel.includes(it.record_id)} onChange={() => toggle(it.record_id)} /></td>}
                      {cols.map((c, j) => <td key={c.field} className={ROLE_CLS[c.role]}>{j === 0
                        ? <Link href={`/experiments/${dataset}/${encodeURIComponent(it.record_id)}`} data-testid={i === 0 ? "first-record-link" : undefined}>{show(it.values[c.field] ?? it.test_id)}</Link>
                        : show(it.values[c.field])}</td>)}
                      <td className="text-[12px] text-warn">{it.flags.join(", ")}</td>
                    </tr>))}</tbody>
                </table>
              </div>
              <Pager page={x.page} pages={x.pages} onPage={(p) => update({ page: String(p) })} />
            </div>
          </div>
        </div>
      );
    }}</Loadable>
  );
}
