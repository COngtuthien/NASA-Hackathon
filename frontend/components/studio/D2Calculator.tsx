"use client";

// Idealized d²-law calculation for ONE FLEX test: D(t)² = D₀² − K·t (Liu et al. 2013, PDF p.2).
// The line uses only the test's recorded D₀ (mm) and K (mm²/s; raw header "Burning rate; mm") and stops at the
// idealized burnout time t* = D₀²/K: it is never extrapolated to negative D², and t* is not an extinction time.
// The consistency numbers (t_est, ratio, inclusion and exclusion reasons) come from the backend's d²-law check
// (/analytics/flex/d2?uid=…), the same analysis as on the rest of the page. No intermediate points are drawn.
import { Loadable } from "@/components/ui";
import { fmt, useApi } from "@/lib/api";
import { SOURCES } from "@/lib/lab-scientific-metadata";

type D2Record = { experiment_uid: string; identifier: string; test_end: string; d0_mm: number | null; dext_mm: number | null;
  k_mm2_s: number | null; burn_time_s: number | null; included: boolean; reasons: string[]; assumptions: string[];
  d_end_mm?: number; t_est_s?: number; ratio?: number };
type D2One = { record: D2Record; formula: string; label: string };

export function d2Line(d0: number, k: number) {
  const tStar = (d0 * d0) / k;
  return { tStar, at: (t: number) => (t >= 0 && t <= tStar ? d0 * d0 - k * t : null) };
}

function Chart({ d0, k, burnTime, dEnd }: { d0: number; k: number; burnTime: number | null; dEnd: number | null }) {
  const { tStar } = d2Line(d0, k);
  const W = 340, H = 190, L = 44, B = 30, T = 14, Rr = 12;
  const xMax = Math.max(tStar, burnTime ?? 0) * 1.08;
  const yMax = d0 * d0 * 1.05;
  const x = (t: number) => L + (t / xMax) * (W - L - Rr);
  const y = (v: number) => H - B - (v / yMax) * (H - B - T);
  const ticks = (max: number) => {
    const p = Math.pow(10, Math.floor(Math.log10(max)));
    const step = max / p > 5 ? 2 * p : max / p > 2 ? p : p / 2;
    return Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => Number((i * step).toPrecision(6)));
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img"
      aria-label={`Idealized line from D squared ${fmt(d0 * d0)} square millimetres at t = 0 to zero at ${fmt(tStar)} seconds${burnTime !== null ? `; recorded burn time ${fmt(burnTime)} seconds` : ""}.`}>
      {ticks(xMax).map((t) => <g key={`x${t}`}><line x1={x(t)} x2={x(t)} y1={T} y2={H - B} className="stroke-[var(--chart-grid)]" /><text x={x(t)} y={H - B + 13} fontSize="9.5" className="fill-text-3" textAnchor="middle">{fmt(t)}</text></g>)}
      {ticks(yMax).map((v) => <g key={`y${v}`}><line x1={L} x2={W - Rr} y1={y(v)} y2={y(v)} className="stroke-[var(--chart-grid)]" /><text x={L - 5} y={y(v) + 3} fontSize="9.5" className="fill-text-3" textAnchor="end">{fmt(v)}</text></g>)}
      <text x={(L + W - Rr) / 2} y={H - 3} fontSize="10" className="fill-text-2" textAnchor="middle">t (s)</text>
      <text x={11} y={(T + H - B) / 2} fontSize="10" className="fill-text-2" textAnchor="middle" transform={`rotate(-90 11 ${(T + H - B) / 2})`}>D² (mm²)</text>
      <line x1={x(0)} y1={y(d0 * d0)} x2={x(tStar)} y2={y(0)} className="stroke-flame" strokeWidth="2" />
      <circle cx={x(tStar)} cy={y(0)} r="3" className="fill-flame" />
      {burnTime !== null && <line x1={x(burnTime)} x2={x(burnTime)} y1={T} y2={H - B} className="stroke-data" strokeDasharray="4 3" />}
      {burnTime !== null && dEnd !== null && <circle cx={x(burnTime)} cy={y(dEnd * dEnd)} r="4" fill="none" className="stroke-data" strokeWidth="1.8" />}
    </svg>
  );
}

export default function D2Calculator({ uid }: { uid: string }) {
  const st = useApi<D2One>(`/analytics/flex/d2?uid=${encodeURIComponent(uid)}`);
  return (
    <Loadable state={st} rows={4}>
      {({ record: r }) => {
        const d0 = r.d0_mm, k = r.k_mm2_s;
        const valid = d0 !== null && k !== null && d0 > 0 && k > 0;
        return (
          <section aria-labelledby="d2-h" className={`rounded-xl border p-3 ${valid ? "border-flame/40 bg-flame/[0.04]" : "border-dashed border-line-strong"}`} data-testid="d2-calc">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 id="d2-h" className="subhead text-[14.5px]">d²-law for test {r.identifier}</h3>
              <span className="rounded border border-flame/60 px-1.5 py-px text-[11.5px] font-medium text-flame" data-testid="d2-label">Idealized calculation — assumptions apply</span>
            </div>
            {!valid ? (
              <p className="mt-1 text-[13px] text-text-2">Not available: the calculation needs a recorded initial diameter D₀ and a positive burning-rate constant K, and this test lacks {d0 === null || d0 <= 0 ? "D₀" : "a usable K"}.</p>
            ) : (
              <>
                <p className="mt-1 font-mono text-[12.5px] text-text">D(t)² = D₀² − K·t, for 0 ≤ t ≤ D₀²/K</p>
                <Chart d0={d0} k={k} burnTime={r.burn_time_s} dEnd={r.included && r.d_end_mm !== undefined ? r.d_end_mm : null} />
                <ul className="mt-1 flex flex-col gap-1 text-[12.5px] text-text-2">
                  <li><span className="mr-1 inline-block h-0.5 w-4 bg-flame align-middle" />Idealized line from the recorded D₀ = {fmt(d0)} mm and K = {fmt(k)} mm²/s. It reaches zero at t* = D₀²/K = <b className="text-text" data-testid="d2-tstar">{fmt(d2Line(d0, k).tStar)} s</b> <span className="text-text-3">(computed; an idealized burnout time, not an extinction time)</span>.</li>
                  {r.burn_time_s !== null && <li><span className="mr-1 inline-block w-4 border-t border-dashed border-data align-middle" />Recorded burn time: <b className="text-data">{fmt(r.burn_time_s)} s</b> <span className="text-text-3">(measured; test end: {r.test_end})</span>.</li>}
                  {r.included ? (
                    <li><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full border-2 border-data align-middle" />The page&apos;s consistency check uses an end diameter of {fmt(r.d_end_mm)} mm{r.assumptions.length ? ` (${r.assumptions.join("; ")})` : " (the recorded visible-flame extinction diameter)"}.
                      Idealized time to reach it: <b className="text-text">{fmt(r.t_est_s)} s</b>; recorded ÷ idealized = <b className="text-text" data-testid="d2-ratio">{fmt(r.ratio)}</b> <span className="text-text-3">(computed)</span>. The circle marks two recorded end values, not a measured trajectory.</li>
                  ) : (
                    <li className="text-warn">Excluded from the consistency check: {r.reasons.join("; ")}.</li>
                  )}
                </ul>
              </>
            )}
            <details className="mt-2 text-[12px] text-text-3">
              <summary className="cursor-pointer text-text-2">Assumptions and limits</summary>
              <ul className="mt-1 list-disc pl-4">
                <li>Classical theory: quasi-steady, spherically symmetric burning, no soot or radiation effects, constant K (<a href={SOURCES.liuP2.href} target="_blank" rel="noreferrer">Liu et al., PDF p.2</a>). Real droplets deviate: K can depend on D₀, and soot and radiation matter for large droplets.</li>
                <li>K is the test&apos;s recorded burning-rate constant, read as mm²/s (raw header &apos;Burning rate; mm&apos;, flag FLEX-UNIT-K).</li>
                <li>Not a simulation or prediction of this test, and not a validated model. FLEX extinction happens at a finite diameter, so the line&apos;s end is never an extinction time.</li>
              </ul>
            </details>
          </section>
        );
      }}
    </Loadable>
  );
}
