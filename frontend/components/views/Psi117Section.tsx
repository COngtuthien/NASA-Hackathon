"use client";

// Phase 13: PSI-117 cool-flame evidence on the FLEX page. Experimental series are published figure data (digitized
// points); model series come from the authors' 1-D sphero-symmetric droplet model. Nothing is joined to FLEX rows.
import { useMemo, useState } from "react";
import { Disclosure } from "@/components/disclosure";
import { DocLink, EvidenceTag } from "@/components/evidence-tag";
import Plot, { baseLayout, CAT } from "@/components/Plot";
import { Callout, Field, inputCls, Loadable } from "@/components/ui";
import { useApi } from "@/lib/api";
import { FlagRules } from "@/components/views/gas/CfigSection";

type Fig = { id: string; title: string; file: string; note?: string; n_series: number };
type Series = { series_id: string; role: string; evidence_class: string; label: string; x_var: string; x_unit: string; x_unit_status: string;
  y_var: string; y_unit: string; y_unit_status: string; y_unit_note: string; x_unit_note: string; note: string | null;
  conditions: Record<string, string>; x: number[]; y: number[]; n: number; source_file: string; source_columns: string;
  flagged_points: { negative_x: number[]; negative_y: number[]; zero_y: number[] }; role_basis: string };
type Resp = { figures: Fig[]; figure: string | null; series: Series[]; excluded_series: { series_id: string; label: string; reason: string; n: number }[];
  roles: Record<string, string>; counts: Record<string, number>; flag_rules: { rule_id: string; severity: string; category: string; status: string; n: number; example: string }[] };

const GROUPS: [string, string[]][] = [
  ["Extinction diameter", ["ext-vs-p", "ext-vs-d0", "mst-dext"]],
  ["Burning rate", ["kavg"]],
  ["Droplet & flame history (1 atm)", ["burn-d2", "burn-df", "burn-q"]],
  ["Effect of pressure (0.5 vs 5 atm)", ["p-flame", "p-radiance", "p-tmax"]],
  ["Three-stage burning (FLEX 1268 conditions)", ["3s-d2", "3s-df", "3s-dfr", "3s-q", "3s-cf", "3s-model-d", "3s-model-k", "3s-model-tmax"]],
  ["Sub-millimetre droplets (model only)", ["submm-d2", "submm-tmax", "submm-k", "submm-sto"]],
];
const FUEL_COLOR: Record<string, string> = { C7: CAT[0], C10: CAT[1], C12: CAT[2] };
const SLIDES_EXT = "psi-117-presentations-extinction-characteristics-tfarouk";
const SLIDES_3S = "psi-117-presentations-three-stage-cool-flame-tfarouk";
const SEM = "psi-117-presentations-psi-users-group-cool-flames-in-space-03302026";

/** Experiment and model of the same physical group share a colour: fuel, then pressure, then case, then hot/cool. */
function groupKey(s: Series): string {
  const fuel = s.series_id.match(/G-(C\d+)-/)?.[1];
  if (fuel) return fuel;
  const p = s.label.match(/(\d+(?:\.\d+)?) atm/)?.[1];
  if (p) return `${p} atm`;
  if (/oscillatory|stable/i.test(s.label)) return s.label.match(/oscillatory|stable/i)![0].toLowerCase();
  if (/radiance (I|II)\b|series [12]|HWFM|peak-peak/.test(s.label)) return s.label;
  return s.y_var.includes("cool") ? "cool" : "hot";
}
function groupColor(s: Series, keys: string[]): string {
  const k = groupKey(s);
  return FUEL_COLOR[k] ?? CAT[Math.max(0, keys.indexOf(k)) % 4];
}

const unitText = (u: string, st: string) => (st === "unknown" ? "unit not stated" : st === "dimensionless" ? "–" : st === "inferred" ? `${u}, inferred` : u);

export default function Psi117Section() {
  const [fig, setFig] = useState("ext-vs-p");
  const list = useApi<Resp>("/flex/psi117");
  const d = useApi<Resp>(`/flex/psi117?figure=${encodeURIComponent(fig)}`);
  const plot = useMemo(() => {
    if (!d.data || !d.data.series.length) return null;
    const out: unknown[] = [];
    const keys = [...new Set(d.data.series.map(groupKey))];
    d.data.series.forEach((s) => {
      const color = groupColor(s, keys);
      const bad = new Set([...s.flagged_points.negative_y]);
      const zero = new Set(s.flagged_points.zero_y);
      const idx = s.x.map((_, k) => k).filter((k) => !bad.has(k) && !zero.has(k));
      const exp = s.role === "experiment";
      const trace: Record<string, unknown> = { type: "scatter", mode: exp ? "markers" : "lines", name: `${s.label}${exp ? " · published figure data" : " · model"}`,
        x: idx.map((k) => s.x[k]), y: idx.map((k) => s.y[k]), hovertemplate: `${s.label}<br>%{x:.4g}, %{y:.4g}<extra></extra>` };
      if (exp) trace.marker = { color, size: 7, symbol: s.y_var.includes("cool") ? "circle-open" : "circle", line: { color, width: 1.5 } };
      else trace.line = { color, width: 2, dash: s.role === "model_only_quantity" ? "dash" : s.y_var.includes("cool") ? "dot" : "solid" };
      out.push(trace);
      if (zero.size) out.push({ type: "scatter", mode: "markers", name: `${s.label} · zero value (meaning undefined)`, x: [...zero].map((k) => s.x[k]),
        y: [...zero].map((k) => s.y[k]), marker: { color, symbol: "x-thin-open", size: 9, line: { color, width: 1.5 } }, hovertemplate: "zero value: meaning not documented<extra></extra>" });
      if (bad.size) out.push({ type: "scatter", mode: "markers", name: `${s.label} · negative (digitization artefact)`, x: [...bad].map((k) => s.x[k]),
        y: [...bad].map((k) => s.y[k]), marker: { color: "#FF6B6B", symbol: "x", size: 8 }, hovertemplate: "negative value of a non-negative quantity: flagged<extra></extra>" });
    });
    const s0 = d.data.series[0];
    const yv = [...new Set(d.data.series.map((s) => s.y_var))];
    const yTitle = yv.length === 1 ? yv[0] : yv.map((v) => v.replace(/^(hot|cool)-flame /, "")).filter((v, k, a) => a.indexOf(v) === k).join(" / ");
    return { data: out, layout: baseLayout(`${s0.x_var} (${unitText(s0.x_unit, s0.x_unit_status)})`, `${yTitle} (${unitText(s0.y_unit, s0.y_unit_status)})`) };
  }, [d.data]);
  const figInfo = list.data?.figures.find((f) => f.id === fig);
  return (
    <section id="psi117" className="scroll-mt-36 flex flex-col gap-4" data-testid="psi117-section">
      <div>
        <h2 className="subhead flex flex-wrap items-center gap-2 text-[22px] md:text-[26px]">Cool flames: model vs experiment (PSI-117)</h2>
        <p className="mt-1 max-w-[72ch] text-[15px] text-text-2">PSI-117, a NASA ground investigation, built droplet-combustion models and tested them against FLEX flight data. Its published figure data let you compare measured and modelled
          extinction diameters, burning rates and burn histories for n-heptane, n-decane and n-dodecane, including the three-stage hot → warm → cool burning seen in FLEX test 1268.</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-line/60 bg-panel/50 p-4 text-[14px] leading-relaxed text-text-2 lg:col-span-2">
          <p><b className="text-text">What a cool flame is.</b> Large n-alkane droplets can keep burning after the visible (hot) flame goes out from radiative heat loss: a low-temperature reaction zone
            sits much closer to the droplet and burns slowly and nearly invisibly. At higher pressure a droplet can pass through three stages, hot, then warm, then cool (<DocLink id={SLIDES_3S} page={15}>three-stage slides p.15–22</DocLink>; <DocLink id={SEM} page={7}>PSI seminar p.7</DocLink>).</p>
          <p className="mt-2 flex flex-wrap items-center gap-2"><EvidenceTag kind="digitized" /> experimental points <EvidenceTag kind="model" /> 1-D sphero-symmetric model (lines; dashed = model-only quantity such as peak temperature)</p>
        </div>
        <Callout tone="warn"><span data-testid="psi117-caveat">Not FLEX rows and not 3D CFD. PSI-117 refers to FLEX tests by numbers (e.g. 1268) that have no key in SpaceFire&apos;s FLEX table, so its points are shown here, separately, and never merged. The model is 1-D; no 3-D or OpenFOAM output is in the NASA download.</span></Callout>
      </div>
      <div className="rounded-xl border border-line/60 bg-panel/40 p-3">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Figure" htmlFor="psi117-fig">
            <select id="psi117-fig" className={`${inputCls} min-w-[320px]`} value={fig} onChange={(e) => setFig(e.target.value)} data-testid="psi117-figure">
              {GROUPS.map(([g, ids]) => <optgroup key={g} label={g}>{ids.map((id) => <option key={id} value={id}>{list.data?.figures.find((f) => f.id === id)?.title ?? id}</option>)}</optgroup>)}
            </select></Field>
        </div>
        <Loadable state={d} rows={6}>{(x) => (
          <div className="mt-3" data-testid="psi117-chart" data-figure={fig}>
            <h3 className="subhead text-[15px]">{figInfo?.title}</h3>
            {plot && <Plot data={plot.data} layout={plot.layout} height={400} ariaLabel={`PSI-117 figure: ${figInfo?.title ?? fig}`} />}
            {figInfo?.note && <p className="text-[12.5px] text-warn">{figInfo.note}</p>}
            <ul className="mt-2 flex flex-col gap-1 text-[12.5px] text-text-3" data-testid="psi117-series-list">
              {x.series.map((s) => <li key={s.series_id}><span className="text-text-2">{s.label}</span> ({s.role.replaceAll("_", " ")}, n = {s.n}) · {s.source_file.split("/").pop()} {s.source_columns}
                {(s.y_unit_status === "inferred" || s.y_unit_status === "unknown") && <span className="text-warn"> · y unit {s.y_unit_status}: {s.y_unit_note}</span>}</li>)}
            </ul>
            <p className="mt-1 text-[12.5px] text-text-3">Conditions (ReadMe): {Object.entries(x.series[0]?.conditions ?? {}).map(([k, v]) => `${k} ${v}`).join(" · ")}</p>
          </div>)}</Loadable>
      </div>
      <Disclosure id="psi117-limits" title="Data provenance and limits (PSI-117)" action="Show provenance and limits"
        summary="Which series are measured vs modelled, which units are inferred, and what was excluded.">
        <Loadable state={list} rows={4}>{(x) => (
          <div className="grid gap-4 lg:grid-cols-2" data-testid="psi117-provenance">
            <div className="text-[14px] text-text-2">
              <ul className="list-disc pl-5">{Object.entries(x.roles).map(([k, v]) => <li key={k}><b className="text-text">{k.replaceAll("_", " ")}</b>: {v}</li>)}</ul>
              <p className="mt-2">{x.counts.plotted_points} points from {x.counts.files} CSV files; excluded series: {x.excluded_series.map((e) => `${e.label} (${e.n} points: ${e.reason})`).join("; ")}.</p>
              <p className="mt-2">Extinction-diameter unit (mm) is documented in the <DocLink id={SLIDES_EXT} page={9}>extinction slides p.9</DocLink>; several time and burning-rate units are inferred and flagged.</p>
            </div>
            <FlagRules rules={x.flag_rules} limit={10} />
          </div>)}</Loadable>
      </Disclosure>
    </section>
  );
}

export function Flex2Context() {
  return (
    <section id="flex2" className="scroll-mt-36 rounded-2xl border border-line/60 bg-panel/40 p-4 md:p-5" data-testid="flex2-context">
      <h2 className="subhead flex flex-wrap items-center gap-2 text-[18px]">What came next: FLEX-2 (PSI-68) <EvidenceTag kind="report" /></h2>
      <p className="mt-1 max-w-[72ch] text-[14.5px] leading-relaxed text-text-2">FLEX-2 reused the same droplet apparatus to study bi-component and surrogate fuels (n-decane, ethanol and mixtures),
        droplets in slow flows and droplet pairs, at 0.5–3 atm and 0.17–0.30 O₂ (<DocLink id="flex-2-srd-final" page={33}>FLEX-2 Science Requirements, Table 2 p.33</DocLink>).
        Only requirements, metadata and a test-matrix envelope were downloaded: <b className="text-text">there are no FLEX-2 measurements in SpaceFire</b>, so no FLEX-2 chart is shown.</p>
    </section>
  );
}
