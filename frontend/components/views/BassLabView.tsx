"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import Plot, { baseLayout, CAT } from "@/components/Plot";
import { Callout, Field, inputCls, Loadable, PageHeader, Panel, Prov } from "@/components/ui";
import { expHref, fmt, qs, useApi } from "@/lib/api";

type Rec = { experiment_uid: string; test_id: string; pi: string; material_class: string; geometry: string; o2_initial: number | null;
  o2_final: number | null; co2_initial: number | null; co2_final: number | null; co_initial: number | null; co_final: number | null;
  delta_o2: number | null; delta_co2: number | null; delta_co: number | null; flags: string[]; raw: Record<string, string>;
  air_raw: string; fan_raw: string; air_tokens: string[]; flow_restrictor: number | null };
type Resp = { summary: Record<string, number | null>; by_material_class: { material_class: string; n: number; slope_co2_per_o2: number | null; median_o2_consumed: number | null }[];
  records: Rec[]; formula: string; reference: { label: string; ratio: number; applies_to: string }; limitations: string[] };

// Four validated hue slots; more classes fold into "Fabric, wax and other". Rod color is a marker shape, not a hue.
const GROUPS: { name: string; match: (c: string) => boolean }[] = [
  { name: "PMMA thin film", match: (c) => c === "PMMA thin film" },
  { name: "PMMA slab", match: (c) => c === "PMMA slab" },
  { name: "PMMA rod or sphere", match: (c) => c.startsWith("PMMA rod") || c.startsWith("PMMA sphere") },
  { name: "Fabric, wax and other", match: () => true },
];

export default function BassLabView() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const pi = sp.get("pi") ?? "";
  const g = useApi<Resp>(`/analytics/bass/gases${qs({ pi })}`);

  const plot = useMemo(() => {
    if (!g.data) return null;
    const pts = g.data.records.filter((r) => r.delta_o2 !== null && r.delta_co2 !== null && !r.flags.includes("o2_unphysical"));
    const used = new Set<string>();
    const data: unknown[] = GROUPS.map((grp, i) => {
      const s = pts.filter((r) => !used.has(r.experiment_uid) && grp.match(r.material_class));
      s.forEach((r) => used.add(r.experiment_uid));
      return { type: "scatter", mode: "markers", name: `${grp.name} (n=${s.length})`, x: s.map((r) => -(r.delta_o2 as number)),
        y: s.map((r) => r.delta_co2), customdata: s.map((r) => r.experiment_uid),
        text: s.map((r) => `${r.test_id}: ${r.material_class}, PI ${r.pi}`),
        hovertemplate: "<b>%{text}</b><br>O₂ consumed %{x:.2f} %-points<br>CO₂ produced %{y:.2f} %-points<extra></extra>",
        marker: { color: CAT[i], size: 9, symbol: s.map((r) => (r.material_class.includes("black") ? "square" : r.material_class.includes("clear") ? "triangle-up" : "circle")),
          line: { color: "#101E33", width: 1.5 } } };
    });
    const xmax = Math.max(1, ...pts.map((r) => -(r.delta_o2 as number)));
    data.push({ type: "scatter", mode: "lines", name: `PMMA complete combustion, slope 5/6`, x: [0, xmax], y: [0, xmax * g.data.reference.ratio],
      line: { color: "#E6EDF7", dash: "dash", width: 1.5 }, hoverinfo: "skip" });
    return { data, layout: baseLayout("O₂ consumed, initial − final (% by volume, points)", "CO₂ produced, final − initial (% by volume, points)"), n: pts.length };
  }, [g.data]);

  return (
    <>
      <PageHeader title="BASS-II solid-fuel lab"
        lead="Small solid samples burned in a flow duct inside the ISS Microgravity Science Glovebox. Oxygen, CO₂ and CO were read once before and once after each burn, for the whole ~250 L chamber. These are endpoints, not time series." />
      <div className="mb-5 flex flex-wrap items-end gap-3 rounded-lg border border-line bg-panel p-4">
        <Field label="Principal investigator" htmlFor="bpi">
          <select id="bpi" className={inputCls} value={pi} onChange={(e) => router.replace(`${pathname}${qs({ pi: e.target.value })}`, { scroll: false })}>
            <option value="">All PIs</option>{["Bhattacharjee", "Ferkul", "Miller", "Olson", "Fernandez-Pello", "T'ien"].map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>
        <p className="max-w-[60ch] text-sm text-text-3">Each PI used one material family, geometry and flow direction, so differences between PIs are confounded. Compare within a PI where possible.</p>
      </div>
      <Loadable state={g} rows={10}>
        {(d) => (
          <div className="flex flex-col gap-5">
            <Panel title="Oxygen consumed vs CO₂ produced" aside={plot ? `n = ${plot.n} tests with both endpoints; ${d.summary.n_excluded_unphysical} excluded as unphysical` : undefined}>
              <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
                <div>{plot && <Plot data={plot.data} layout={plot.layout} height={400} ariaLabel="Scatter of oxygen consumed versus CO2 produced per BASS-II test"
                  onPointClick={(u) => router.push(expHref(String(u)))} />}
                  <p className="mt-1 text-xs text-text-3">Marker shape: triangle = clear rod, square = black rod, circle = other. Click a point to open the test.</p></div>
                <div className="text-sm">
                  <h3 className="subhead text-[15px]">Result <Prov kind="COMPUTED" /></h3>
                  <p className="mt-1">Slope ΔCO₂ / O₂ consumed: <b className="text-data">{fmt(d.summary.slope_co2_per_o2_above_resolution)}</b> for {d.summary.n_fit_above_resolution} tests with &gt; 0.2 point O₂ drop
                    (all {d.summary.n_fit}: {fmt(d.summary.slope_co2_per_o2_all)}, Pearson r = {fmt(d.summary.pearson_r)}).</p>
                  <p className="mt-1 text-text-2">Reference: {d.reference.label} gives {fmt(d.reference.ratio)} mol CO₂ per mol O₂; applies to {d.reference.applies_to}.</p>
                  <table className="data mt-3"><thead><tr><th>Material</th><th className="num">n</th><th className="num">Slope</th></tr></thead>
                    <tbody>{d.by_material_class.map((m) => <tr key={m.material_class}><td>{m.material_class}</td><td className="num">{m.n}</td><td className="num">{fmt(m.slope_co2_per_o2)}</td></tr>)}</tbody></table>
                  <p className="mt-1 text-xs text-text-3">Rows with O₂ drop &gt; 0.2 points only. n below ~5 is not meaningful.</p>
                  <p className="mt-2"><span className="raw">{d.formula}</span></p>
                </div>
              </div>
              <div className="mt-4"><Callout><ul className="list-disc pl-5">{d.limitations.map((l) => <li key={l}>{l}</li>)}</ul></Callout></div>
            </Panel>
            <Panel title="Per-test gas endpoints and flow history" aside={`${d.records.length} tests`}>
              <div className="max-h-[60vh] overflow-auto">
                <table className="data">
                  <thead><tr><th>Test</th><th>Material</th><th className="num">O₂ i→f (%)</th><th className="num">ΔO₂</th><th className="num">CO₂ i→f (%)</th><th className="num">ΔCO₂</th><th className="num">CO i→f (ppm)</th><th>Air display (cm/s, stages as recorded)</th><th>Notes</th></tr></thead>
                  <tbody>{d.records.map((r) => (
                    <tr key={r.experiment_uid}>
                      <td><Link href={expHref(r.experiment_uid)}>{r.test_id}</Link><span className="block text-xs text-text-3">{r.pi}</span></td>
                      <td className="text-sm">{r.material_class}</td>
                      <td className="num">{fmt(r.o2_initial)} → {r.o2_final === null ? <span className="raw">{r.raw.o2_final || "blank"}</span> : fmt(r.o2_final)}</td>
                      <td className="num">{fmt(r.delta_o2)}</td>
                      <td className="num">{fmt(r.co2_initial)} → {r.co2_final === null ? <span className="raw">{r.raw.co2_final || "blank"}</span> : fmt(r.co2_final)}</td>
                      <td className="num">{fmt(r.delta_co2)}</td>
                      <td className="num">{r.co_initial === null ? <span className="raw">{r.raw.co_initial || "blank"}</span> : fmt(r.co_initial)} → {r.co_final === null ? <span className="raw">{r.raw.co_final || "blank"}</span> : fmt(r.co_final)}</td>
                      <td>{r.air_raw ? <span className="raw">{r.air_raw}</span> : <span className="text-text-3">blank</span>}</td>
                      <td className="text-xs text-warn">{r.flags.filter((f) => !f.startsWith("co_not")).join(", ")}</td>
                    </tr>))}</tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-text-3">Non-numeric gas cells (none, OR, over, &gt;500, blank) are shown as recorded and never converted to numbers. Velocity is never inferred from Fan display. Report tables: <Link href={`/evidence?q=${encodeURIComponent("BASS-II Table 5.1")}`}>Table 5.1 (Miller)</Link>, <Link href={`/evidence?q=${encodeURIComponent("Table 7.1 SIBAL")}`}>Table 7.1 (T&apos;ien)</Link>.</p>
            </Panel>
          </div>
        )}
      </Loadable>
    </>
  );
}
