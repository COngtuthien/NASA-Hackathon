"use client";

import Link from "next/link";
import { DUR, EASE, motion } from "@/components/motion";
import { PHENOMENA } from "@/lib/routes";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Button, Empty, Field, FilterChips, inputCls, Kind, Loadable, PageHeader, Pager, Panel, Severity } from "@/components/ui";
import { DATASETS, expHref, fmt, useApi, useDraft } from "@/lib/api";

type FieldDef = { name: string; label: string; kind: string; unit: string | null; role: string; source_header: string | null; note: string | null };
type Item = {
  experiment_uid: string; display_id: string; source_row: number; fields: Record<string, unknown>;
  flags: Record<string, number>; value_kinds?: Record<string, string>;
};
type ListResp = {
  total: number; page: number; pages: number; items: Item[]; fields: FieldDef[];
  facets: Record<string, { value: string; count: number }[] | { min: number; max: number; n: number }>;
  filters_applied: Record<string, unknown>;
};

// `primary`: the filters shown by default; the rest sit behind "Show all filters" (opened automatically when one is active).
// `key`: the columns shown by default; "Show all columns" reveals every field (kept in the URL as cols=all).
const PRIMARY: Record<string, string[]> = { flex: ["fuel", "x_o2"], bass2: ["material_class", "pi"], saffire1: ["flow_direction"] };
const KEY_COLS: Record<string, string[]> = {
  flex: ["fuel", "x_o2", "d0_mm", "test_end"], bass2: ["pi", "material_class", "flow_direction", "o2_initial"],
  saffire1: ["sample", "material", "flow_direction", "air_flow_cm_s", "o2_raw", "burn_time_s"],
};
const FILTERS: Record<string, { cats: string[]; nums: string[]; has?: { field: string; label: string }[] }> = {
  flex: { cats: ["fuel", "diluent", "pressure_band", "test_end", "series"], nums: ["x_o2", "d0_mm", "pressure_atm"],
    has: [{ field: "dext_mm", label: "Has numeric extinction diameter" }] },
  bass2: { cats: ["pi", "material_class", "geometry", "flow_restrictor"], nums: ["o2_initial", "thickness_mm"],
    has: [{ field: "co_final", label: "Final CO is numeric" }, { field: "co2_final", label: "Final CO2 is numeric" }] },
  saffire1: { cats: ["flow_direction"], nums: [] },
};
const CONTROL_KEYS = new Set(["dataset", "q", "sort", "order", "page", "page_size", "cols"]);
/** URL keys that only affect the page layout and are never sent to the API. */
const VIEW_KEYS = new Set(["cols"]);

export default function ExplorerView() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const dataset = sp.get("dataset") ?? "flex";
  const pageSize = Number(sp.get("page_size") ?? "20");
  const [qDraft, setQDraft] = useDraft(sp.get("q") ?? "");
  const [sel, setSel] = useState<{ ds: string; list: string[] }>({ ds: dataset, list: [] });
  const selected = sel.ds === dataset ? sel.list : [];
  const setSelected = (fn: (s: string[]) => string[]) => setSel({ ds: dataset, list: fn(selected) });

  const apiPath = `/experiments?${new URLSearchParams({ ...Object.fromEntries([...sp.entries()].filter(([k]) => !VIEW_KEYS.has(k))), dataset }).toString()}`;
  const list = useApi<ListResp>(apiPath);

  function update(patch: Record<string, string | null>, resetPage = true) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    if (resetPage && !("page" in patch)) next.delete("page");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function switchDataset(key: string) {
    router.replace(`${pathname}?dataset=${key}`, { scroll: false });
  }

  const exportParams = useMemo(() => {
    const p = new URLSearchParams();
    for (const [k, v] of sp.entries()) if (!["sort", "order", "page", "page_size", ...VIEW_KEYS].includes(k)) p.set(k, v);
    p.set("dataset", dataset);
    return p;
  }, [sp, dataset]);

  const activeFilters = [...sp.keys()].filter((k) => !CONTROL_KEYS.has(k));
  const sort = sp.get("sort");
  const order = sp.get("order") ?? "asc";

  function toggleSort(col: string) {
    if (sort === col) update({ order: order === "asc" ? "desc" : "asc" });
    else update({ sort: col, order: "asc" });
  }

  function toggleSel(uid: string) {
    setSelected((s) => (s.includes(uid) ? s.filter((x) => x !== uid) : s.length >= 5 ? s : [...s, uid]));
  }

  const cfg = FILTERS[dataset] ?? FILTERS.flex;
  const primary = PRIMARY[dataset] ?? [];
  const allCols = sp.get("cols") === "all";
  const advancedActive = activeFilters.some((k) => {
    const name = k.replace(/^(f_|min_|max_)/, "");
    return k === "has" || !primary.includes(name);
  });
  const [moreOpen, setMoreOpen] = useState<boolean | null>(null);
  const showMore = moreOpen ?? advancedActive;

  return (
    <>
      <PageHeader kicker="Experiments" title="Combustion Explorer"
        lead="Browse every NASA test. Open one to see all its recorded values, or tick two to five to compare them." />

      <div role="tablist" aria-label="Investigation" className="mb-5 grid gap-2 sm:grid-cols-3">
        {DATASETS.map((d) => {
          const ph = PHENOMENA.find((p) => p.dataset === d.key);
          const on = dataset === d.key;
          return (
            <button key={d.key} role="tab" aria-selected={on} onClick={() => switchDataset(d.key)}
              className={`press relative rounded-xl border px-4 py-3 text-left ${on ? "border-flame/70 text-text" : "border-line-strong/70 text-text-2 hover:border-line-strong hover:text-text"}`}>
              {on && <motion.span layoutId="explorer-ds" aria-hidden className="absolute inset-0 rounded-xl bg-[linear-gradient(135deg,rgba(255,138,61,0.14),rgba(22,39,63,0.6))]"
                transition={{ duration: DUR.base, ease: EASE }} />}
              <span className="relative block text-[15px] font-semibold">{ph?.title ?? d.system}</span>
              <span className="relative mt-0.5 block text-[12.5px] text-text-3">{d.label} · {d.system}</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        <Panel title="Filters" aside={activeFilters.length ? <button className="text-link" onClick={() => switchDataset(dataset)}>Reset</button> : undefined}>
          <form onSubmit={(e) => { e.preventDefault(); update({ q: qDraft.trim() || null }); }} className="mb-4">
            <Field label="Search IDs and text" htmlFor="xq">
              <input id="xq" className={inputCls} value={qDraft} onChange={(e) => setQDraft(e.target.value)}
                placeholder={dataset === "flex" ? "e.g. 193F001, C01" : dataset === "bass2" ? "e.g. M5, SIBAL" : "e.g. S1"} />
            </Field>
          </form>
          <Loadable state={list} rows={6}>
            {(d) => (
              <div className="flex flex-col gap-4" id="more-filters">
                {[...cfg.cats.filter((c) => primary.includes(c)), "__more__", ...cfg.cats.filter((c) => !primary.includes(c))].map((c) => {
                  if (c === "__more__") return (
                    <button key="more" type="button" aria-expanded={showMore} aria-controls="more-filters" onClick={() => setMoreOpen(!showMore)}
                      className="order-last -mb-1 text-left text-[13.5px] text-link hover:underline" data-testid="more-filters">{showMore ? "Hide extra filters" : "Show all filters"}</button>
                  );
                  const extra = !primary.includes(c);
                  const facet = d.facets[c] as { value: string; count: number }[] | undefined;
                  const f = d.fields.find((x) => x.name === c);
                  if (!facet) return null;
                  return (
                    <div key={c} hidden={extra && !showMore} className={extra ? "order-last" : ""}>
                    <Field label={f?.label ?? c} htmlFor={`f-${c}`}>
                      <select id={`f-${c}`} className={inputCls} value={sp.get(`f_${c}`) ?? ""}
                        onChange={(e) => update({ [`f_${c}`]: e.target.value || null })}>
                        <option value="">All</option>
                        {facet.map((v) => <option key={v.value ?? "null"} value={v.value ?? ""}>{v.value ?? "(none)"} ({v.count})</option>)}
                      </select>
                    </Field>
                    </div>
                  );
                })}
                {cfg.nums.map((n) => {
                  const facet = d.facets[n] as { min: number; max: number } | undefined;
                  const f = d.fields.find((x) => x.name === n);
                  return (
                    <fieldset key={n} className={`text-sm ${primary.includes(n) ? "" : "order-last"}`} hidden={!primary.includes(n) && !showMore}>
                      <legend className="text-text-2">{f?.label} {f?.unit ? `(${f.unit})` : ""}</legend>
                      <div className="mt-1 flex gap-2">
                        <input aria-label={`${f?.label} minimum`} className={`${inputCls} w-full`} type="number" step="any"
                          placeholder={facet ? fmt(facet.min) : "min"} defaultValue={sp.get(`min_${n}`) ?? ""}
                          key={`min-${n}-${sp.get(`min_${n}`)}`}
                          onBlur={(e) => update({ [`min_${n}`]: e.target.value || null })}
                          onKeyDown={(e) => e.key === "Enter" && update({ [`min_${n}`]: (e.target as HTMLInputElement).value || null })} />
                        <input aria-label={`${f?.label} maximum`} className={`${inputCls} w-full`} type="number" step="any"
                          placeholder={facet ? fmt(facet.max) : "max"} defaultValue={sp.get(`max_${n}`) ?? ""}
                          key={`max-${n}-${sp.get(`max_${n}`)}`}
                          onBlur={(e) => update({ [`max_${n}`]: e.target.value || null })}
                          onKeyDown={(e) => e.key === "Enter" && update({ [`max_${n}`]: (e.target as HTMLInputElement).value || null })} />
                      </div>
                    </fieldset>
                  );
                })}
                {cfg.has?.map((h) => {
                  const cur = (sp.get("has") ?? "").split("|").filter(Boolean);
                  const on = cur.includes(h.field);
                  return (
                    <label key={h.field} className="order-last flex items-center gap-2 text-sm" hidden={!showMore}>
                      <input type="checkbox" checked={on} onChange={() => {
                        const nx = on ? cur.filter((x) => x !== h.field) : [...cur, h.field];
                        update({ has: nx.join("|") || null });
                      }} />
                      {h.label}
                    </label>
                  );
                })}
              </div>
            )}
          </Loadable>
        </Panel>

        <div className="min-w-0">
          <div className="mb-3">
            <FilterChips
              chips={[...activeFilters, ...(sp.get("q") ? ["q"] : [])].map((k) => {
                const v = sp.get(k) ?? "";
                const name = k.replace(/^(f_|min_|max_)/, "");
                const label = list.data?.fields.find((x) => x.name === name)?.label ?? name;
                if (k === "q") return { key: k, label: `Search: ${v}` };
                if (k === "has") return { key: k, label: `Has numeric: ${v.split("|").join(", ")}` };
                if (k.startsWith("min_")) return { key: k, label: `${label} ≥ ${v}` };
                if (k.startsWith("max_")) return { key: k, label: `${label} ≤ ${v}` };
                return { key: k, label: `${label}: ${v.split("|").join(" or ")}` };
              })}
              onRemove={(k) => update({ [k]: null })}
              onClear={() => switchDataset(dataset)} />
          </div>
          <Loadable state={list} rows={10}>
            {(d) => (
              <Panel title={`${d.total.toLocaleString()} ${d.total === 1 ? "row" : "rows"}`}
                aside={
                  <span className="flex items-center gap-2">
                    <label htmlFor="ps" className="sr-only">Rows per page</label>
                    <select id="ps" className={inputCls} value={pageSize} onChange={(e) => update({ page_size: e.target.value })}>
                      {[20, 50, 100].map((n) => <option key={n} value={n}>{n} per page</option>)}
                    </select>
                  </span>
                }>
                {selected.length > 0 && (
                  <div className="mb-3 flex flex-wrap items-center gap-3 rounded-md border border-flame/40 bg-flame/10 px-3 py-2 text-sm">
                    <span>{selected.length} selected (max 5)</span>
                    <Link href={`/intelligence/compare?uids=${selected.join(",")}`} className="font-semibold">Compare selected</Link>
                    <button className="text-text-2 hover:text-text" onClick={() => setSelected(() => [])}>Clear</button>
                  </div>
                )}
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[13px]">
                  <span className="text-text-3">{allCols ? "Showing every recorded field." : "Showing the key fields."}</span>
                  <button type="button" aria-pressed={allCols} onClick={() => update({ cols: allCols ? null : "all" }, false)} className="text-link hover:underline" data-testid="all-columns">
                    {allCols ? "Show key fields only" : "Show all columns"}</button>
                </div>
                {d.items.length === 0 ? (
                  <Empty title="No rows match these filters">Widen a numeric range or reset the filters.</Empty>
                ) : (
                  <div className="max-h-[70vh] overflow-auto rounded-md border border-line">
                    <table className="data nowrap">
                      <thead>
                        <tr>
                          <th scope="col"><span className="sr-only">Select for comparison</span></th>
                          <th scope="col">
                            <button onClick={() => toggleSort("experiment_uid")} className="font-semibold">Source row{sort === "experiment_uid" ? (order === "asc" ? " ▲" : " ▼") : ""}</button>
                          </th>
                          {Object.keys(d.items[0].fields).filter((c) => allCols || (KEY_COLS[dataset] ?? []).includes(c)).map((c) => {
                            const f = d.fields.find((x) => x.name === c);
                            return (
                              <th key={c} scope="col" className={f?.kind === "numeric" ? "num" : ""} title={f?.source_header ? `Source column: ${f.source_header}` : f?.note ?? undefined}>
                                <button onClick={() => toggleSort(c)} className="font-semibold">
                                  {f?.label ?? c}{f?.unit ? <span className="font-normal text-text-3"> ({f.unit})</span> : null}
                                  {sort === c ? (order === "asc" ? " ▲" : " ▼") : ""}
                                </button>
                              </th>
                            );
                          })}
                          <th scope="col">Flags</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.items.map((it) => (
                          <tr key={it.experiment_uid}>
                            <td>
                              <input type="checkbox" aria-label={`Select ${it.display_id} for comparison`}
                                checked={selected.includes(it.experiment_uid)} onChange={() => toggleSel(it.experiment_uid)}
                                disabled={!selected.includes(it.experiment_uid) && selected.length >= 5} />
                            </td>
                            <td><Link href={expHref(it.experiment_uid)} className="font-semibold">{it.display_id}</Link>
                              <span className="block text-xs text-text-3">row {it.source_row}</span></td>
                            {Object.entries(it.fields).filter(([c]) => allCols || (KEY_COLS[dataset] ?? []).includes(c)).map(([c, v]) => {
                              const f = d.fields.find((x) => x.name === c);
                              const kindCol = it.value_kinds?.[c];
                              return (
                                <td key={c} className={f?.kind === "numeric" ? "num" : ""}>
                                  {fmt(v)}{v === null && kindCol ? <Kind kind={kindCol} /> : null}
                                </td>
                              );
                            })}
                            <td>
                              <span className="flex flex-wrap gap-1">
                                {(["critical", "warning"] as const).map((s) => it.flags[s] ? <Severity key={s} level={s} count={it.flags[s]} /> : null)}
                                {!it.flags.critical && !it.flags.warning ? <span className="text-xs text-text-3">{it.flags.info ? `${it.flags.info} info` : "none"}</span> : null}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <Pager page={d.page} pages={d.pages} onPage={(p) => update({ page: String(p) }, false)} />
                  <Button variant="ghost" onClick={list.reload}>Refresh</Button>
                </div>
                <p className="mt-3 text-[13px] text-text-3">
                  Download these rows: <a href={`/api/v1/exports/experiments.csv?${exportParams.toString()}&variant=normalized`}>Export filtered (normalized)</a>{" · "}
                  <a href={`/api/v1/exports/experiments.csv?${exportParams.toString()}&variant=original`}>Export filtered (original cells)</a>
                </p>
              </Panel>
            )}
          </Loadable>
        </div>
      </div>
    </>
  );
}
