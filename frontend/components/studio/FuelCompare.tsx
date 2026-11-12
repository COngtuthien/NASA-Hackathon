"use client";

// Compare Fuels: pick a FLEX test for each fuel and see their recorded conditions side by side. Candidates for the
// second fuel are ranked by how closely their recorded conditions match the first test. Display tolerances below
// are SpaceFire's choice for flagging differences, not a statistical criterion. No conclusion about which fuel
// burns faster is drawn from two tests.
import Link from "next/link";
import { useMemo } from "react";
import { Segmented } from "@/components/ui";
import { expHref, fmt, qs, useApi } from "@/lib/api";
import { FUELS, type FuelId } from "@/lib/flex-fuels";

export type FlexRow = { experiment_uid: string; display_id: string; fields: Record<string, unknown> };
type ListResp = { total: number; items: FlexRow[] };

export const TOL = { x_o2: 0.01, d0_mm: 0.25, pressure_atm: 0.1, x_co2: 0.02, x_he: 0.02 } as const;
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Which recorded conditions differ between two FLEX rows beyond the display tolerances. */
export function mismatches(a: FlexRow, b: FlexRow): string[] {
  const out: string[] = [];
  for (const [k, tol] of Object.entries(TOL)) {
    const x = num(a.fields[k]), y = num(b.fields[k]);
    if (x === null || y === null) out.push(k);
    else if (Math.abs(x - y) > tol + 1e-9) out.push(k);
  }
  if (a.fields.diluent !== b.fields.diluent) out.push("diluent");
  return out;
}

function distance(a: FlexRow, b: FlexRow): number {
  let d = a.fields.diluent === b.fields.diluent ? 0 : 3;
  for (const [k, tol] of Object.entries(TOL)) {
    const x = num(a.fields[k]), y = num(b.fields[k]);
    d += x === null || y === null ? 3 : Math.abs(x - y) / tol;
  }
  return d;
}

const ROWS: { key: string; label: string; unit?: string; cond?: boolean }[] = [
  { key: "fuel", label: "Fuel" },
  { key: "pressure_atm", label: "Pressure", unit: "atm", cond: true },
  { key: "diluent", label: "Diluent", cond: true },
  { key: "x_o2", label: "Initial O₂", unit: "mole fraction", cond: true },
  { key: "x_co2", label: "CO₂ (header 'CO')", unit: "mole fraction", cond: true },
  { key: "x_he", label: "He", unit: "mole fraction", cond: true },
  { key: "d0_mm", label: "Initial diameter D₀", unit: "mm", cond: true },
  { key: "k_mm2_s", label: "Burning-rate constant K", unit: "mm²/s" },
  { key: "burn_time_s", label: "Burn time", unit: "s" },
  { key: "dext_mm", label: "Extinction diameter", unit: "mm" },
  { key: "test_end", label: "Test end" },
];

export default function FuelCompare({ left, right, setLeft, setRight, o2, d0, recA, recB, setRecA, setRecB }: {
  left: FuelId; right: FuelId; setLeft: (f: FuelId) => void; setRight: (f: FuelId) => void; o2: number; d0: number;
  recA: string | null; recB: string | null; setRecA: (u: string | null) => void; setRecB: (u: string | null) => void;
}) {
  const listA = useApi<ListResp>(`/experiments${qs({ dataset: "flex", f_fuel: left, min_x_o2: (o2 - 0.03).toFixed(3), max_x_o2: (o2 + 0.03).toFixed(3),
    min_d0_mm: (d0 - 0.75).toFixed(2), max_d0_mm: (d0 + 0.75).toFixed(2), sort: "x_o2", page_size: 30 })}`);
  const a = listA.data?.items.find((r) => r.experiment_uid === recA) ?? null;
  const ao2 = num(a?.fields.x_o2) ?? o2, ad0 = num(a?.fields.d0_mm) ?? d0;
  const listB = useApi<ListResp>(`/experiments${qs({ dataset: "flex", f_fuel: right, min_x_o2: (ao2 - 0.05).toFixed(3), max_x_o2: (ao2 + 0.05).toFixed(3),
    min_d0_mm: (ad0 - 1).toFixed(2), max_d0_mm: (ad0 + 1).toFixed(2), page_size: 100 })}`);
  const ranked = useMemo(() => {
    const items = listB.data?.items ?? [];
    return a ? [...items].sort((p, q) => distance(a, p) - distance(a, q)).slice(0, 8) : items.slice(0, 8);
  }, [listB.data, a]);
  const b = ranked.find((r) => r.experiment_uid === recB) ?? listB.data?.items.find((r) => r.experiment_uid === recB) ?? null;
  const diff = a && b ? mismatches(a, b) : [];

  return (
    <div className="flex flex-col gap-4" data-testid="fuel-compare">
      <div className="grid gap-3 sm:grid-cols-2">
        <Segmented label="Left view" value={left} onChange={(v) => { setLeft(v as FuelId); setRecA(null); setRecB(null); }} options={[["Heptane", "n-Heptane"], ["Methanol", "Methanol"]]} />
        <Segmented label="Right view" value={right} onChange={(v) => { setRight(v as FuelId); setRecB(null); }} options={[["Heptane", "n-Heptane"], ["Methanol", "Methanol"]]} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {[left, right].map((f, i) => (
          <div key={i} className="rounded-lg border border-line/80 p-2.5 text-[12.5px] text-text-2">
            <p className="font-medium text-text">{FUELS[f].label} <span className="text-text-3">{FUELS[f].formula}</span></p>
            <p className="mt-0.5">{FUELS[f].visual}</p>
          </div>
        ))}
      </div>

      <section aria-labelledby="fc-a">
        <h3 id="fc-a" className="subhead text-[14.5px]">1 · Pick a {FUELS[left].label} test</h3>
        <p className="text-[12px] text-text-3">Near O₂ {o2.toFixed(2)} ± 0.03 and D₀ {d0.toFixed(1)} ± 0.75 mm (set in Explore).</p>
        <ul className="mt-1.5 grid max-h-[180px] grid-cols-1 gap-1 overflow-y-auto pr-1" data-testid="compare-list-a">
          {(listA.data?.items ?? []).map((r) => (
            <li key={r.experiment_uid}>
              <button type="button" aria-pressed={recA === r.experiment_uid} onClick={() => { setRecA(recA === r.experiment_uid ? null : r.experiment_uid); setRecB(null); }}
                className={`press flex w-full justify-between gap-2 rounded-lg border px-2.5 py-1 text-left text-[12.5px] ${recA === r.experiment_uid ? "border-data bg-data/10 text-text" : "border-line/80 text-text-2 hover:border-data/50"}`}>
                <span className="font-medium">{r.display_id}</span>
                <span className="text-text-3">O₂ {fmt(r.fields.x_o2)} · D₀ {fmt(r.fields.d0_mm)} mm · {fmt(r.fields.pressure_atm)} atm · {String(r.fields.diluent)}</span>
              </button>
            </li>
          ))}
          {listA.data && listA.data.items.length === 0 && <li className="text-[12.5px] text-text-2">No {FUELS[left].label} test near these settings. Adjust O₂ or D₀ in Explore.</li>}
        </ul>
      </section>

      <section aria-labelledby="fc-b">
        <h3 id="fc-b" className="subhead text-[14.5px]">2 · Pick a {FUELS[right].label} test{a ? ` closest to ${a.display_id}` : ""}</h3>
        <p className="text-[12px] text-text-3">{a ? "Ranked by recorded conditions (pressure, diluent, O₂, CO₂, He, D₀)." : "Pick a test above first to rank these by matching conditions."}</p>
        <ul className="mt-1.5 grid max-h-[180px] grid-cols-1 gap-1 overflow-y-auto pr-1" data-testid="compare-list-b">
          {ranked.map((r) => {
            const mm = a ? mismatches(a, r).length : null;
            return (
              <li key={r.experiment_uid}>
                <button type="button" aria-pressed={recB === r.experiment_uid} onClick={() => setRecB(recB === r.experiment_uid ? null : r.experiment_uid)}
                  className={`press flex w-full justify-between gap-2 rounded-lg border px-2.5 py-1 text-left text-[12.5px] ${recB === r.experiment_uid ? "border-data bg-data/10 text-text" : "border-line/80 text-text-2 hover:border-data/50"}`}>
                  <span className="font-medium">{r.display_id}</span>
                  <span className="text-text-3">O₂ {fmt(r.fields.x_o2)} · D₀ {fmt(r.fields.d0_mm)} mm · {String(r.fields.diluent)}{mm !== null && <> · <span className={mm ? "text-warn" : "text-ok"}>{mm ? `${mm} differ` : "matched"}</span></>}</span>
                </button>
              </li>
            );
          })}
          {listB.data && ranked.length === 0 && <li className="text-[12.5px] text-text-2">No {FUELS[right].label} test within ±0.05 O₂ and ±1 mm D₀ of the first test.</li>}
        </ul>
      </section>

      {a && b && (
        <section aria-labelledby="fc-t" data-testid="compare-table">
          <h3 id="fc-t" className="subhead text-[14.5px]">3 · Recorded values side by side</h3>
          <p className={`mt-1 rounded-lg border px-2.5 py-1.5 text-[12.5px] ${diff.length ? "border-warn/60 text-warn" : "border-ok/60 text-ok"}`} data-testid="compare-verdict">
            {diff.length ? `Not a controlled comparison: ${diff.length} recorded condition${diff.length > 1 ? "s" : ""} differ beyond the display tolerances (highlighted).`
              : "Recorded conditions match within the display tolerances. This is still two single tests, not a controlled study."}
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="data">
              <thead><tr><th>Field</th><th><Link href={expHref(a.experiment_uid)}>{a.display_id}</Link></th><th><Link href={expHref(b.experiment_uid)}>{b.display_id}</Link></th></tr></thead>
              <tbody>
                {ROWS.map((row) => {
                  const off = row.cond && diff.includes(row.key);
                  return (
                    <tr key={row.key} data-mismatch={off ? "true" : undefined}>
                      <td className="text-text-2">{row.label}{row.unit ? ` (${row.unit})` : ""}{off && <span className="ml-1 text-warn">≠</span>}</td>
                      <td className={off ? "font-semibold text-warn" : ""}>{fmt(a.fields[row.key])}</td>
                      <td className={off ? "font-semibold text-warn" : ""}>{fmt(b.fields[row.key])}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[12px] text-text-3">
            Display tolerances: O₂ ±{TOL.x_o2}, D₀ ±{TOL.d0_mm} mm, pressure ±{TOL.pressure_atm} atm, CO₂ and He ±{TOL.x_co2}; diluent must be equal. All values exactly as recorded (K in mm²/s, raw header ‘Burning rate; mm’).
            No conclusion about which fuel burns faster is drawn from two tests: K also depends on D₀, diluent and pressure, and FLEX&apos;s test design was adaptive, not randomized.
          </p>
        </section>
      )}
    </div>
  );
}
