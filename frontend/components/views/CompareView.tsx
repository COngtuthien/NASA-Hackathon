"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { BarChart } from "@/components/charts";
import { CAT } from "@/components/Plot";
import { Button, Callout, Empty, ErrorState, Field, inputCls, PageHeader, Panel, Severity, Skeleton } from "@/components/ui";
import { DATASETS, datasetOf, expHref, fmt, useApi } from "@/lib/api";

type CmpField = { name: string; label: string; unit: string | null; kind: string; comparison: string; values: unknown[];
  value_kinds?: (string | null)[]; delta_vs_first?: (number | null)[]; ratio_vs_first?: (number | null)[]; n?: number;
  same?: boolean; note?: string; source_header?: string | null };
type Cmp = {
  mode: string; compatible: boolean; dataset?: string; experiments: { experiment_uid: string; display_id: string;
    investigation: string; source_row: number }[]; fields: CmpField[]; chartable_fields?: string[];
  warnings: string[]; quality_flags?: Record<string, { rule_id: string; severity: string; description: string }[]>;
  investigations?: { investigation_id: string; title: string; fuel_system: string; scale: string; description: string }[];
};
type Hit = { experiment_uid: string; display_id: string; source_row: number };

export default function CompareView() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const uids = useMemo(() => (sp.get("uids") ?? "").split(",").map((s) => s.trim()).filter(Boolean), [sp]);
  const cmp = useApi<Cmp>(uids.length >= 2 ? "/experiments/compare" : null, { uids });
  const { data, error, loading } = cmp;
  const [cfChoice, setChartField] = useState<string>("");
  const chartField = data?.chartable_fields?.includes(cfChoice) ? cfChoice : data?.chartable_fields?.[0] ?? "";

  function setUids(next: string[]) {
    router.replace(`${pathname}?uids=${next.join(",")}`, { scroll: false });
  }


  const ds = uids.length ? datasetOf(uids[0]) : "flex";
  const [addDsOverride, setAddDs] = useState<string | null>(null);
  const addDs = addDsOverride ?? ds;
  const [q, setQ] = useState("");
  const [query, setQuery] = useState<string | null>(null);
  const hits = useApi<{ items: Hit[] }>(query !== null ? `/experiments?dataset=${addDs}&q=${encodeURIComponent(query)}&page_size=8` : null);

  function search(e: FormEvent) {
    e.preventDefault();
    setQuery(q.trim());
  }

  const field = data?.fields.find((f) => f.name === chartField);

  return (
    <>
      <PageHeader kicker="Experiment Intelligence" title="Compare experiments"
        lead="Put 2 to 5 tests side by side. Numeric deltas and charts appear only for tests from the same investigation; mixing investigations gives a qualitative comparison instead." />

      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <Panel title={`Selected (${uids.length}/5)`}>
          {uids.length === 0 ? <p className="text-sm text-text-2">Nothing selected yet. Add tests below, or tick rows in the <Link href="/experiments">explorer</Link>.</p> : (
            <ul className="mb-4 flex flex-col gap-1.5 text-sm">
              {uids.map((u) => (
                <li key={u} className="flex items-center justify-between gap-2">
                  <Link href={expHref(u)}>{data?.experiments.find((e) => e.experiment_uid === u)?.display_id ?? u}</Link>
                  <button className="text-text-3 hover:text-crit" aria-label={`Remove ${u}`} onClick={() => setUids(uids.filter((x) => x !== u))}>Remove</button>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={search} className="flex flex-col gap-2">
            <Field label="Add from" htmlFor="addds">
              <select id="addds" className={inputCls} value={addDs} onChange={(e) => setAddDs(e.target.value)}>
                {DATASETS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
              </select>
            </Field>
            <Field label="Test ID or text" htmlFor="addq">
              <input id="addq" className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. M4, C01M201, S2" />
            </Field>
            <Button type="submit" disabled={uids.length >= 5}>Find</Button>
          </form>
          {query !== null && (
            <div className="mt-3">
              {hits.loading ? <Skeleton rows={3} /> : hits.error ? <ErrorState error={hits.error} /> :
                hits.data && hits.data.items.length === 0 ? <p className="text-sm text-text-2">No match for “{query}”.</p> : (
                  <ul className="flex flex-col gap-1 text-sm">
                    {hits.data?.items.map((h) => (
                      <li key={h.experiment_uid} className="flex items-center justify-between">
                        <span>{h.display_id} <span className="text-text-3">row {h.source_row}</span></span>
                        <button className="text-link disabled:opacity-40" disabled={uids.includes(h.experiment_uid) || uids.length >= 5}
                          onClick={() => setUids([...uids, h.experiment_uid])}>Add</button>
                      </li>
                    ))}
                  </ul>
                )}
            </div>
          )}
        </Panel>

        <div className="min-w-0">
          {uids.length < 2 ? (
            <Empty title="Select at least two tests">Example: <Link href="/intelligence/compare?uids=bass2:31,bass2:30">BASS-II M5 vs M4</Link> or <Link href="/intelligence/compare?uids=saffire1:S1,saffire1:S2">SAFFIRE-I S1 vs S2</Link>.</Empty>
          ) : error ? <ErrorState error={error} onRetry={cmp.reload} /> : loading && !data ? <Skeleton rows={10} /> : data && (
            data.mode !== "same_investigation" ? (
              <div className="flex flex-col gap-4">
                <Callout tone="warn">
                  <p className="font-semibold text-text">These tests come from different investigations, so no shared numeric axis is shown.</p>
                  <ul className="mt-1 list-disc pl-5">{data.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
                </Callout>
                <div className="grid gap-4 md:grid-cols-2">
                  {data.investigations?.map((i) => (
                    <Panel key={i.investigation_id} title={i.title}>
                      <p className="text-sm text-text-2">{i.fuel_system}, {i.scale}</p>
                      <p className="mt-2 text-sm">{i.description}</p>
                      <ul className="mt-2 text-sm">
                        {data.experiments.filter((e) => e.investigation === (i.investigation_id === "PSI-69" ? "FLEX" : i.investigation_id === "PSI-25" ? "BASS-II" : "SAFFIRE-I")).map((e) =>
                          <li key={e.experiment_uid}><Link href={expHref(e.experiment_uid)}>{e.display_id}</Link></li>)}
                      </ul>
                    </Panel>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {data.warnings.map((w) => <Callout key={w}>{w}</Callout>)}
                <Panel title="Chart a shared field" aside={field ? `n = ${field.n} of ${data.experiments.length}` : undefined}>
                  {data.chartable_fields && data.chartable_fields.length > 0 ? (
                    <>
                      <Field label="Field" htmlFor="cf">
                        <select id="cf" className={`${inputCls} max-w-xs`} value={chartField} onChange={(e) => setChartField(e.target.value)}>
                          {data.chartable_fields.map((c) => {
                            const f = data.fields.find((x) => x.name === c);
                            return <option key={c} value={c}>{f?.label}{f?.unit ? ` (${f.unit})` : ""}</option>;
                          })}
                        </select>
                      </Field>
                      {field && (
                        <BarChart x={data.experiments.map((e) => e.display_id)}
                          series={[{ name: field.label, y: field.values.map((v) => (typeof v === "number" ? v : NaN)), color: CAT[0] }]}
                          xTitle="Test" yTitle={`${field.label}${field.unit ? ` (${field.unit})` : ""}`}
                          ariaLabel={`Bar chart of ${field.label} for the selected tests`} height={300} />
                      )}
                      {field?.values.some((v) => typeof v !== "number") && <p className="text-xs text-text-3">Missing bars are tests without a numeric value for this field.</p>}
                    </>
                  ) : <p className="text-sm text-text-2">These tests share no numeric field with values.</p>}
                </Panel>
                <Panel title="Side by side">
                  <div className="overflow-x-auto">
                    <table className="data">
                      <thead><tr><th>Field</th>{data.experiments.map((e) => <th key={e.experiment_uid} className="num"><Link href={expHref(e.experiment_uid)}>{e.display_id}</Link></th>)}<th>Same?</th></tr></thead>
                      <tbody>
                        {data.fields.map((f) => (
                          <tr key={f.name}>
                            <th scope="row" className="!static !bg-transparent !border-b !border-line !font-normal !text-text-2">{f.label}{f.unit ? ` (${f.unit})` : ""}</th>
                            {f.values.map((v, i) => (
                              <td key={i} className={f.comparison === "numeric" ? "num" : ""}>
                                {fmt(v)}
                                {f.delta_vs_first && i > 0 && f.delta_vs_first[i] !== null && f.delta_vs_first[i] !== 0 && (
                                  <span className="block text-xs text-text-3">Δ {f.delta_vs_first[i]! > 0 ? "+" : ""}{fmt(f.delta_vs_first[i])} vs first</span>)}
                                {v === null && f.value_kinds?.[i] && <span className="block text-xs text-text-3">{f.value_kinds[i]}</span>}
                              </td>
                            ))}
                            <td className="text-sm text-text-3">{f.same === undefined ? "" : f.same ? "same" : "differs"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
                {data.quality_flags && Object.keys(data.quality_flags).length > 0 && (
                  <Panel title="Quality warnings on these tests">
                    <ul className="flex flex-col gap-2 text-sm">
                      {Object.entries(data.quality_flags).flatMap(([u, fl]) => fl.map((f) => (
                        <li key={u + f.rule_id}><Severity level={f.severity} /> <b>{data.experiments.find((e) => e.experiment_uid === u)?.display_id}</b>: {f.description}</li>
                      )))}
                    </ul>
                  </Panel>
                )}
              </div>
            )
          )}
        </div>
      </div>
    </>
  );
}
