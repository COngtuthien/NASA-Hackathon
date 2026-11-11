"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment, useState, type FormEvent } from "react";
import { Button, Callout, Empty, Field, inputCls, Loadable, PageHeader, Panel } from "@/components/ui";
import { expHref, fmt, qs, useApi } from "@/lib/api";
import { canonical } from "@/lib/routes";

type Part = { field: string; a: unknown; b: unknown; weight: number; distance: number | null; used: boolean; contribution?: number };
type Res = { experiment_uid: string; display_id: string; similarity: number; fields_compared: number; parts: Part[];
  explanation: string; outcome_preview: Record<string, unknown> };
type Resp = { supported: boolean; explanation?: string; compare_url?: string; method?: string; dataset?: string;
  features?: { field: string; kind: string; weight: number; transform: string | null; range: number | null }[];
  excluded_outcomes?: string[]; note?: string; results: Res[]; query_values?: Record<string, unknown> };

const COND: Record<string, { name: string; label: string; type: "num" | "cat"; options?: string[] }[]> = {
  flex: [
    { name: "fuel", label: "Fuel", type: "cat", options: ["Methanol", "Heptane"] },
    { name: "diluent", label: "Diluent", type: "cat", options: ["CO2", "He", "N2-only"] },
    { name: "x_o2", label: "Initial O₂ (mole fraction)", type: "num" }, { name: "x_co2", label: "Initial CO₂ (mole fraction)", type: "num" },
    { name: "x_he", label: "Initial He (mole fraction)", type: "num" }, { name: "pressure_atm", label: "Pressure (atm)", type: "num" },
    { name: "d0_mm", label: "Initial droplet diameter (mm)", type: "num" },
  ],
  bass2: [
    { name: "material_class", label: "Material class", type: "cat", options: ["PMMA thin film", "PMMA slab", "PMMA rod (clear)", "PMMA rod (black)", "PMMA sphere section", "SIBAL fabric", "Nomex III fabric", "Japan wax candle"] },
    { name: "o2_initial", label: "Initial O₂ (% by volume)", type: "num" }, { name: "thickness_mm", label: "Thickness (mm)", type: "num" },
    { name: "diameter_mm", label: "Rod diameter (mm)", type: "num" }, { name: "width_cm", label: "Width (cm)", type: "num" },
  ],
};

export default function SimilarView() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const uid = sp.get("uid");
  const mode = sp.get("mode") ?? (uid ? "uid" : "conditions");
  const ds = sp.get("dataset") ?? (uid ? uid.split(":")[0] : "flex");
  const condQuery = new URLSearchParams();
  for (const c of COND[ds] ?? []) { const v = sp.get(c.name); if (v) condQuery.set(c.name, v); }
  const path = mode === "uid" && uid ? `/experiments/${encodeURIComponent(uid)}/similar?k=10${sp.get("same") ? "&same_category=true" : ""}`
    : condQuery.toString() ? `/similar/${ds}/query?${condQuery.toString()}&k=10` : null;
  const res = useApi<Resp>(path);
  const [uidDraft, setUidDraft] = useState(uid ?? "");
  const [cond, setCond] = useState<Record<string, string>>(Object.fromEntries((COND[ds] ?? []).map((c) => [c.name, sp.get(c.name) ?? ""])));
  const [open, setOpen] = useState<string | null>(null);

  function submitUid(e: FormEvent) {
    e.preventDefault();
    const v = uidDraft.trim();
    if (v) router.replace(`${pathname}${qs({ uid: v, mode: "uid" })}`);
  }
  function submitCond(e: FormEvent) {
    e.preventDefault();
    router.replace(`${pathname}${qs({ mode: "conditions", dataset: ds, ...cond })}`);
  }

  return (
    <>
      <PageHeader kicker="Experiment Intelligence" title="Find similar experiments"
        lead="Finds the tests with the closest initial conditions within the same investigation. Outcomes (burn time, extinction diameter, final gases) are never used to measure similarity." />
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <div className="flex flex-col gap-5">
          <Panel title="Start from a test">
            <form onSubmit={submitUid} className="flex flex-col gap-2">
              <Field label="Canonical ID (e.g. flex:145, bass2:31)" htmlFor="suid"><input id="suid" className={inputCls} value={uidDraft} onChange={(e) => setUidDraft(e.target.value)} /></Field>
              <Button type="submit">Find similar</Button>
            </form>
            <p className="mt-2 text-xs text-text-3">Or use “Find similar tests” on any experiment page.</p>
          </Panel>
          <Panel title="Or describe conditions">
            <div role="tablist" className="mb-3 flex gap-2">
              {[["flex", "FLEX"], ["bass2", "BASS-II"]].map(([k, l]) => (
                <button key={k} role="tab" aria-selected={ds === k} onClick={() => router.replace(`${pathname}${qs({ mode: "conditions", dataset: k })}`)}
                  className={`rounded-md border px-3 py-1 text-sm ${ds === k ? "border-flame bg-flame/15" : "border-line-strong text-text-2"}`}>{l}</button>
              ))}
            </div>
            <form onSubmit={submitCond} className="flex flex-col gap-2">
              {(COND[ds] ?? []).map((c) => (
                <Field key={c.name} label={c.label} htmlFor={`c-${c.name}`}>
                  {c.type === "cat" ? (
                    <select id={`c-${c.name}`} className={inputCls} value={cond[c.name] ?? ""} onChange={(e) => setCond({ ...cond, [c.name]: e.target.value })}>
                      <option value="">Any</option>{c.options!.map((o) => <option key={o}>{o}</option>)}</select>
                  ) : <input id={`c-${c.name}`} type="number" step="any" className={inputCls} value={cond[c.name] ?? ""} onChange={(e) => setCond({ ...cond, [c.name]: e.target.value })} />}
                </Field>
              ))}
              <Button type="submit" variant="primary">Search conditions</Button>
            </form>
          </Panel>
        </div>
        <div className="min-w-0">
          {!path ? <Empty title="Pick a test or enter conditions">Example: <Link href="/intelligence/similar?uid=flex:145&mode=uid">tests similar to FLEX C01M201</Link>.</Empty> : (
            <Loadable state={res} rows={8}>
              {(d) => !d.supported ? (
                <Callout tone="warn">{d.explanation} <Link href={canonical(d.compare_url ?? "/intelligence/compare")}>Open the comparison</Link>.</Callout>
              ) : (
                <div className="flex flex-col gap-5">
                  <Panel title={mode === "uid" ? <>Closest to <Link href={expHref(uid!)}>{uid}</Link></> : "Closest to your conditions"} aside={`${d.results.length} results`}>
                    <div className="overflow-x-auto">
                      <table className="data">
                        <thead><tr><th>Test</th><th className="num">Similarity</th><th>Why</th><th className="num">Fields compared</th><th>Outcomes (context only)</th></tr></thead>
                        <tbody>{d.results.map((r) => (
                          <Fragment key={r.experiment_uid}>
                            <tr key={r.experiment_uid}>
                              <td><Link href={expHref(r.experiment_uid)}>{r.display_id}</Link></td>
                              <td className="num text-data">{fmt(r.similarity)}</td>
                              <td className="text-sm">{r.explanation} <button className="text-link" onClick={() => setOpen(open === r.experiment_uid ? null : r.experiment_uid)} aria-expanded={open === r.experiment_uid}>{open === r.experiment_uid ? "Hide" : "Breakdown"}</button></td>
                              <td className="num">{r.fields_compared}</td>
                              <td className="text-xs text-text-3">{Object.entries(r.outcome_preview).map(([k, v]) => `${k}: ${fmt(v)}`).join(", ")}</td>
                            </tr>
                            {open === r.experiment_uid && (
                              <tr key={r.experiment_uid + "-b"}><td colSpan={5}>
                                <table className="data"><thead><tr><th>Field</th><th>Query</th><th>This test</th><th className="num">Weight</th><th className="num">Distance</th><th className="num">Contribution</th></tr></thead>
                                  <tbody>{r.parts.map((p) => <tr key={p.field}><td>{p.field}</td><td>{fmt(p.a)}</td><td>{fmt(p.b)}</td><td className="num">{p.weight}</td>
                                    <td className="num">{p.used ? fmt(p.distance) : "not compared"}</td><td className="num">{p.used ? fmt(p.contribution) : "—"}</td></tr>)}</tbody></table>
                              </td></tr>
                            )}
                          </Fragment>
                        ))}</tbody>
                      </table>
                    </div>
                  </Panel>
                  <Panel title="Method">
                    <p className="text-sm text-text-2">{d.method}</p>
                    <p className="mt-2 text-sm">Features and weights: {d.features?.map((f) => `${f.field} (${f.kind}, w=${f.weight}${f.transform ? `, ${f.transform}` : ""})`).join("; ")}</p>
                    <p className="mt-1 text-sm">Never used: {d.excluded_outcomes?.join(", ")}. {d.note}</p>
                  </Panel>
                </div>
              )}
            </Loadable>
          )}
        </div>
      </div>
    </>
  );
}
