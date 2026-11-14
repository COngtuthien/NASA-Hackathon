"use client";

// Phase 13: Smoke & Fire Detection (SAME, PSI-102). Report-derived particle sizes (Table 1, verified), the 47-test
// flight log (Appendix A, verified), instrument explanations, and the Smoke Detection Studio (conceptual 3D).
// Raw 1 Hz telemetry is inventoried but not plotted: its semantics are unresolved (see the deferred notice).
import { useMemo, useState, useSyncExternalStore } from "react";
import { AskSuggestions } from "@/components/ask-suggestions";
import { Disclosure } from "@/components/disclosure";
import { DocLink, EvidenceTag, type EvidenceKind } from "@/components/evidence-tag";
import Plot, { baseLayout, CAT } from "@/components/Plot";
import LiteStudio, { Btn } from "@/components/studio/LiteStudio";
import { Callout, Loadable, PageHeader, Segmented } from "@/components/ui";
import { useApi } from "@/lib/api";
import { FlagRules } from "@/components/views/gas/CfigSection";

type Size = { record_id: string; material: string; material_label: string; aged: boolean; aging_s: number; dg_nm: number; d10_nm: number; d30_nm: number;
  sigma_g: number; page_pdf: number; verification: string };
type Alt = { record_id: string; material: string; aged: boolean; source_label: string; flight: string; original_unit: string; source_table: string;
  page_pdf: number | null; source_file: string; dg_nm?: number | null; d10_nm?: number | null; d30_nm?: number | null; sigma_g?: number;
  dusttrak_b_over_a?: number; pct_larger_than_1g?: number | null; verification: string };
type Log = { test_number: number | null; gmt_day: number | null; sample: string | null; sample_printed: string | null; reheat: boolean | null;
  carousel: number | null; position: number | null; record_time_printed: string | null; comment: string | null; kind: string; flags: string[] };
type SameResp = { particle_sizes: Size[]; other_sources: Alt[]; flight_log: Log[];
  log_summary: { tests: number; operation_rows: number; by_sample: Record<string, number>; gmt_days: number[] };
  telemetry: { workbooks: number; by_folder: Record<string, number>; status: string; reason: string; description: string };
  notes: string[]; flag_rules: { rule_id: string; severity: string; category: string; status: string; n: number; example: string }[] };

const DOC = "same-final-science-report-03-18-10-with-papers-attached";
const MATERIALS: [string, string][] = [["kapton", "Kapton"], ["teflon", "Teflon"], ["silicone", "Silicone rubber"], ["lampwick", "Lamp wick (cellulose)"]];
const SAMPLE_LABEL: Record<string, string> = { kapton: "Kapton", teflon: "Teflon", silicone: "Silicone", lampwick: "Lamp wick", dbp: "DBP" };
const STAGES: [string, string, string][] = [
  ["Material heating", "A wire coil heats the sample until it pyrolyzes (no flame). Heating time and temperature were set per test.", "guided"],
  ["Smoke formation", "Vapour from the overheated material condenses into fine liquid and solid smoke particles near the sample.", "guided"],
  ["Particle transport", "Air carries the smoke along the duct into the aging chamber. Particle motion here is illustrative, not a velocity.", "illustration"],
  ["Particle aging", "Held in the aging chamber, particles coagulate: fewer, larger particles. Measured result: average sizes grow after 720 s of aging (see the chart).", "guided"],
  ["Instrument sampling", "A piston pushes aged smoke through a diluter to the moment instruments: P-Trak (number), ionization (first moment) and two DustTraks (mass, 1 µm and 10 µm cut-offs).", "guided"],
  ["Detector observation", "The same smoke reaches a Space Shuttle ionization detector and an ISS light-scattering detector, to see which sizes each one notices.", "guided"],
];
const PARTS: Record<string, { title: string; kind: EvidenceKind; text: string }> = {
  sample: { title: "Heated sample", kind: "guided", text: "Kapton, Teflon, silicone rubber, cellulose lamp wick or dibutyl phthalate (DBP) on a wick, heated by a wire coil on a sample carousel (Final Science Report). Shape and colour are illustrative." },
  chamber: { title: "Aging chamber", kind: "guided", text: "Holds smoke so particles can grow by coagulation before sampling; a piston then delivers it to the instruments. Volume and proportions are illustrative." },
  duct: { title: "Smoke duct", kind: "illustration", text: "Carries smoke from the sample to the aging chamber. Diameter and length are illustrative." },
  diluter: { title: "Diluter", kind: "guided", text: "Dilutes the smoke so the instruments stay in range (Final Science Report)." },
  ptrak: { title: "P-Trak", kind: "guided", text: "Counts particles: the zeroth moment of the size distribution." },
  ion: { title: "Ionization sensor", kind: "guided", text: "Responds in proportion to the first moment (diameter-weighted)." },
  dustA: { title: "DustTrak A", kind: "guided", text: "Mass concentration (third moment) for particles below a 1 µm cut-off." },
  dustB: { title: "DustTrak B", kind: "guided", text: "Mass concentration with a 10 µm cut-off; the B/A ratio shows how much mass is in particles above 1 µm." },
  sts: { title: "Space Shuttle smoke detector", kind: "guided", text: "Dual-chamber ionization detector, most sensitive to small (sub-micron) particles." },
  iss: { title: "ISS smoke detector", kind: "guided", text: "Light-scattering (laser-diode) detector, most sensitive to larger particles; the authors report reduced detection performance for Kapton and Teflon smoke (ICES 2013, slide 28)." },
};

const noSubscribe = () => () => {};

function SmokeStudio({ data, initialMaterial }: { data: SameResp | null; initialMaterial: string }) {
  const [stage, setStage] = useState(1);
  const [aged, setAged] = useState(false);
  const [materialChoice, setMaterial] = useState<string | null>(null);
  const material = materialChoice ?? initialMaterial;
  const [labels, setLabels] = useState(true);
  const [animate, setAnimate] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const row = data?.particle_sizes.find((s) => s.material === material && s.aged === aged) ?? null;
  const part = selected ? PARTS[selected] : null;
  return (
    <LiteStudio id="smoke" kicker="Smoke Detection Studio" title="Following smoke from an overheated material to the detectors"
      intro={<>Step through the six stages of a SAME test: heat a material, form smoke, carry it, age it, and sample it with the instruments and the two spacecraft smoke detectors.</>}
      scene={{ key: "smoke", props: { stage, aged, material, animate, labels, selected, onSelect: setSelected } }}
      home={{ position: [0, 1.6, 10.5], target: [-0.4, 0.3, 0], min: 4, max: 20 }}
      legend={[{ color: "#c9d3e2", label: "Fresh smoke particles (not to scale)" }, { color: "#d8c6a8", label: "Aged smoke: fewer, larger (illustration)" },
        { color: "#4fd1e8", label: "Air flow" }, { color: "#ff8a3d", label: "Heater coil" }]}
      labels={labels} onLabels={setLabels} animate={animate} onAnimate={setAnimate}
      onReset={() => { setStage(1); setAged(false); setMaterial(null); setSelected(null); }}
      banner={<>Original simplified schematic: instrument list <EvidenceTag kind="guided" />, layout and particles <EvidenceTag kind="illustration" /></>}
      measuredLabel={row ? `Measured for ${row.material_label}, ${aged ? "aged 720 s" : "fresh"}: Dg ${row.dg_nm} nm, mean ${row.d10_nm} nm (Table 1, p.27)` : null}
      textAlternative="A schematic smoke path from left to right: a small heated sample with a glowing coil, a smoke duct, a vertical aging chamber with a piston, a diluter, and six instrument boxes: a particle counter, an ionization sensor, two dust monitors with 1 and 10 micrometre cut-offs, and the Space Shuttle and ISS smoke detectors. Dots representing smoke particles move through the stage that is selected."
      // Stages are stepped by the user (they are not a timed sequence), so nothing advances while the animation is paused.
      extraToolbar={<>
        <Btn label="Previous stage" onClick={() => setStage((s) => (s === 1 ? 6 : s - 1))} testid="smoke-prev"><span aria-hidden>‹</span> Stage</Btn>
        <Btn label="Next stage" onClick={() => setStage((s) => (s % 6) + 1)} testid="smoke-next">Next stage <span aria-hidden>›</span></Btn>
      </>}
      controls={
        <div className="flex flex-col gap-3 rounded-xl border border-line/70 bg-panel/60 p-3" data-testid="smoke-controls">
          <div role="radiogroup" aria-label="Stage" className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-2">
            {STAGES.map(([t], i) => (
              <button key={t} type="button" role="radio" aria-checked={stage === i + 1} onClick={() => setStage(i + 1)} data-testid={`smoke-stage-${i + 1}`}
                className={`press rounded-lg border px-2 py-1.5 text-left text-[12.5px] ${stage === i + 1 ? "border-flame bg-flame/[0.1] text-text" : "border-line-strong/70 text-text-2 hover:text-text"}`}>
                <span className="text-text-3">{i + 1}.</span> {t}</button>))}
          </div>
          <Segmented label="Sample material" value={material} onChange={setMaterial} options={[...MATERIALS, ["dbp", "DBP"]]} />
          <Segmented label="Smoke age" value={aged ? "aged" : "fresh"} onChange={(v) => setAged(v === "aged")} options={[["fresh", "Fresh"], ["aged", "Aged 720 s"]]} />
        </div>}
      explanation={<>
          <div className="rounded-xl border border-line/70 bg-panel/60 p-3 text-[13.5px] leading-relaxed text-text-2" data-testid="smoke-stage-text">
            <p className="flex flex-wrap items-center gap-2 font-medium text-text">Stage {stage}: {STAGES[stage - 1][0]} <EvidenceTag kind={STAGES[stage - 1][2] as EvidenceKind} /></p>
            <p className="mt-1">{STAGES[stage - 1][1]}</p>
          </div>
          {part && <div className="rounded-xl border border-electric/50 bg-electric/[0.06] p-3 text-[13.5px] text-text-2" data-testid="smoke-part">
            <p className="flex flex-wrap items-center gap-2 font-medium text-text">{part.title} <EvidenceTag kind={part.kind} /></p><p className="mt-1">{part.text}</p></div>}
      </>}
      evidence={<>
          <div className="rounded-xl border border-line/70 bg-panel/60 p-3 text-[13.5px]" data-testid="smoke-measured">
            <p className="flex flex-wrap items-center gap-2 font-medium text-text">Measured particle sizes <EvidenceTag kind="derived" /></p>
            {row ? <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[13px]">
              <dt className="text-text-3">Geometric mean</dt><dd>{row.dg_nm} nm</dd>
              <dt className="text-text-3">Arithmetic mean</dt><dd>{row.d10_nm} nm</dd>
              <dt className="text-text-3">Diameter of average mass</dt><dd>{row.d30_nm} nm</dd>
              <dt className="text-text-3">σg</dt><dd>{row.sigma_g}</dd></dl>
              : <p className="mt-1 text-text-3">{material === "dbp" ? "DBP was flown but has no row in Final Science Report Table 1." : "Loading…"}</p>}
            <p className="mt-1 text-[12px] text-text-3">Moment-method results (log-normal assumption), <DocLink id={DOC} page={27}>Table 1, p.27</DocLink>. Particle dots in the scene are not drawn to these sizes.</p>
          </div>
      </>}
    />
  );
}

export default function SmokeView() {
  const d = useApi<SameResp>("/smoke/same");
  // ?material= (e.g. from the Research-to-Safety Explorer) preselects a Table 1 material; anything else is ignored.
  // Read without useSearchParams so the page stays statically prerendered (the server snapshot is the default).
  const search = useSyncExternalStore(noSubscribe, () => window.location.search, () => "");
  const urlMat = new URLSearchParams(search).get("material");
  const initialMaterial = MATERIALS.some(([m]) => m === urlMat) ? (urlMat as string) : "kapton";
  const [matChoice, setMat] = useState<string | null>(null);
  const mat = matChoice ?? initialMaterial;
  const [logSample, setLogSample] = useState("");
  const charts = useMemo(() => {
    if (!d.data) return null;
    const sel = d.data.particle_sizes.filter((s) => s.material === mat);
    const metrics: [keyof Size, string][] = [["dg_nm", "Geometric mean"], ["d10_nm", "Arithmetic mean"], ["d30_nm", "Diameter of average mass"]];
    const one = [false, true].map((aged, i) => {
      const r = sel.find((s) => s.aged === aged);
      return { type: "bar", name: aged ? "Aged 720 s" : "Fresh", x: metrics.map((m) => m[1]), y: metrics.map((m) => (r ? r[m[0]] : null)),
        marker: { color: CAT[i ? 1 : 0] }, hovertemplate: "%{x}: %{y} nm<extra>" + (aged ? "aged" : "fresh") + "</extra>" };
    });
    const all = [false, true].map((aged, i) => {
      const rows = MATERIALS.map(([m]) => d.data!.particle_sizes.find((s) => s.material === m && s.aged === aged));
      return { type: "bar", name: aged ? "Aged 720 s" : "Fresh", x: MATERIALS.map(([, l]) => l), y: rows.map((r) => r?.d10_nm ?? null),
        error_y: { type: "data", visible: false }, marker: { color: CAT[i ? 1 : 0] }, hovertemplate: "%{x}: mean %{y} nm<extra></extra>" };
    });
    return { one, all };
  }, [d.data, mat]);
  return (
    <>
      <PageHeader kicker="Smoke & fire detection · SAME" title="Smoke & Fire Detection"
        lead={<>Before a spacecraft fire flames, overheated materials make smoke. SAME measured how big those smoke particles are in microgravity, how they grow as smoke ages, and which spacecraft smoke detectors notice them.</>}
        source={{ source: "SAME", inv: "PSI-102" }}
        sections={[{ id: "studio", label: "3D studio" }, { id: "sizes", label: "Particle sizes" }, { id: "log", label: "Flight log" }, { id: "instruments", label: "Instruments" }, { id: "limits", label: "Limits" }]} />
      <SmokeStudio data={d.data} initialMaterial={initialMaterial} />
      <div className="h-8" />
      <Loadable state={d} rows={8}>{(x) => (
        <div className="flex flex-col gap-5">
          <section id="sizes" className="scroll-mt-36 rounded-2xl border border-line/60 bg-panel/50 p-4 md:p-5" data-testid="same-sizes">
            <h2 className="subhead flex flex-wrap items-center gap-2 text-[20px]">Smoke particle sizes, fresh vs aged <EvidenceTag kind="derived" /></h2>
            <p className="mt-1 max-w-[72ch] text-[14.5px] text-text-2">Results of the SAME flight tests (Final Science Report <DocLink id={DOC} page={27}>Table 1, p.27</DocLink>): moment-method statistics, in nanometres, for smoke from four materials, before and after 720 s of aging.
              These are derived from instrument signals with a log-normal assumption; they are not direct sizings of individual particles.</p>
            <div className="mt-3"><Segmented label="Material" value={mat} onChange={setMat} options={MATERIALS} /></div>
            {charts && <div className="mt-3 grid gap-4 xl:grid-cols-2">
              <div data-testid="chart-same-material"><Plot data={charts.one} layout={{ ...baseLayout("", "Diameter (nm)"), barmode: "group" }} height={320}
                ariaLabel={`Fresh and aged smoke particle diameters for ${mat}`} /></div>
              <div data-testid="chart-same-all"><Plot data={charts.all} layout={{ ...baseLayout("", "Arithmetic mean diameter (nm)"), barmode: "group" }} height={320}
                ariaLabel="Arithmetic mean smoke particle diameter by material, fresh and aged" /></div>
            </div>}
            <div className="mt-3 overflow-x-auto"><table className="w-full text-[13.5px]" data-testid="same-size-table"><thead><tr className="text-left text-text-3"><th>Material</th><th>Smoke</th><th>Geometric mean (nm)</th><th>Arithmetic mean (nm)</th><th>Diam. of average mass (nm)</th><th>σg</th></tr></thead>
              <tbody>{x.particle_sizes.map((s) => <tr key={s.record_id} className={`border-t border-line/40 ${s.material === mat ? "bg-flame/[0.06]" : ""}`}><td className="py-1">{s.material_label}</td><td>{s.aged ? "aged 720 s" : "fresh"}</td><td>{s.dg_nm}</td><td>{s.d10_nm}</td><td>{s.d30_nm}</td><td>{s.sigma_g}</td></tr>)}</tbody></table></div>
            <Disclosure id="same-sources" className="mt-4" title="The same quantities in other SAME documents" action="Compare the sources"
              summary="Other SAME papers and the ICES 2012 deck print different values for the same materials (successive analyses; ICES 2012 also covers the SAME-2 reflight). All are kept with their source; none is averaged.">
              <div className="overflow-x-auto"><table className="w-full text-[13px]" data-testid="same-other-sources"><thead><tr className="text-left text-text-3"><th>Source</th><th>Material</th><th>Smoke</th><th>Dg (nm)</th><th>Mean (nm)</th><th>DAM (nm)</th><th>Other</th></tr></thead>
                <tbody>{x.other_sources.map((o) => <tr key={o.record_id} className="border-t border-line/40"><td className="py-1">{o.source_label}{o.page_pdf ? <> · <DocLink id={DOC} page={o.page_pdf}>p.{o.page_pdf}</DocLink></> : null}</td>
                  <td>{o.material}</td><td>{o.aged ? "aged" : "fresh"}</td><td>{o.dg_nm ?? "–"}</td><td>{o.d10_nm ?? "–"}</td><td>{o.d30_nm ?? "–"}</td>
                  <td>{o.dusttrak_b_over_a !== undefined ? `DustTrak B/A ${o.dusttrak_b_over_a}` : o.pct_larger_than_1g !== undefined ? `${o.pct_larger_than_1g ?? "–"} % larger than 1 g` : o.sigma_g !== undefined ? `σg ${o.sigma_g}` : ""}</td></tr>)}</tbody></table></div>
            </Disclosure>
          </section>
          <section id="log" className="scroll-mt-36 rounded-2xl border border-line/60 bg-panel/50 p-4 md:p-5" data-testid="same-log">
            <h2 className="subhead flex flex-wrap items-center gap-2 text-[20px]">Flight-test log (2007) <EvidenceTag kind="log" /></h2>
            <p className="mt-1 text-[14.5px] text-text-2">{x.log_summary.tests} tests on GMT days {x.log_summary.gmt_days[0]}–{x.log_summary.gmt_days.at(-1)} of 2007, plus {x.log_summary.operation_rows} carousel operations (<DocLink id={DOC} page={33}>Appendix A, p.33</DocLink>).</p>
            <div className="mt-3"><Segmented label="Sample" value={logSample} onChange={setLogSample}
              options={[["", `All (${x.log_summary.tests})`], ...Object.entries(x.log_summary.by_sample).map(([k, n]) => [k, `${SAMPLE_LABEL[k]} (${n})`] as [string, string])]} /></div>
            <div className="mt-3 max-h-[380px] overflow-auto"><table className="w-full text-[13px]" data-testid="same-log-table"><thead className="sticky top-0 bg-panel"><tr className="text-left text-text-3"><th>Test</th><th>GMT day</th><th>Sample</th><th>Heating</th><th>Carousel (pos.)</th><th>Record time (as printed)</th><th>Comment</th></tr></thead>
              <tbody>{x.flight_log.filter((r) => !logSample || r.sample === logSample || (r.kind !== "test" && !logSample)).map((r, i) => (
                <tr key={i} className={`border-t border-line/40 ${r.kind !== "test" ? "text-text-3" : ""}`}><td className="py-1">{r.test_number ?? "op."}</td><td>{r.gmt_day ?? "–"}</td>
                  <td>{r.sample ? SAMPLE_LABEL[r.sample] : "–"}</td><td>{r.reheat === null ? "–" : r.reheat ? "Reheat" : "Initial"}</td>
                  <td>{r.carousel ? `${r.carousel} (${r.position})` : "–"}</td><td><span className="raw">{r.record_time_printed ?? "–"}</span>{r.flags.length > 0 && <span className="ml-1 text-[11.5px] text-warn" title={r.flags.join(", ")}>◆</span>}</td><td>{r.comment ?? ""}</td></tr>))}</tbody></table></div>
            <p className="mt-2 text-[12px] text-text-3">◆ record time printed with a typo or an impossible seconds value; kept as printed. Record-time units and clock reference are not defined in the report.</p>
          </section>
          <section id="instruments" className="scroll-mt-36 rounded-2xl border border-line/60 bg-panel/50 p-4 md:p-5" data-testid="same-instruments">
            <h2 className="subhead flex flex-wrap items-center gap-2 text-[20px]">How SAME sized smoke without imaging it <EvidenceTag kind="report" /></h2>
            <div className="mt-2 grid gap-4 text-[14.5px] leading-relaxed text-text-2 lg:grid-cols-2">
              <p>Each instrument responds to a different <b className="text-text">moment</b> of the size distribution: the P-Trak counts particles (zeroth moment), an ionization sensor responds to the first moment, and DustTraks weigh mass (third moment).
                Assuming a log-normal distribution, ratios of these moments give the geometric mean diameter and spread (<DocLink id={DOC} page={15}>Final Science Report pp.15–19</DocLink>).</p>
              <p>Why it matters: the <b className="text-text">Space Shuttle</b> detector (ionization) is most sensitive to small particles, the <b className="text-text">ISS</b> detector (light scattering) to larger ones. The authors report reduced ISS-detector performance for the small Kapton and Teflon smoke (<DocLink id="same-ices-2013-07-15-final-as-presented">ICES 2013, slide 28</DocLink>),
                while for silicone rubber and lamp wick almost half the particle mass was above 1 µm (<DocLink id={DOC} page={28}>Final Science Report p.28</DocLink>). SpaceFire shows these as reported findings; it does not rank detector sensitivity or predict detection.</p>
            </div>
          </section>
          <section id="limits" className="scroll-mt-36 flex flex-col gap-3">
            <Callout tone="warn"><span data-testid="same-telemetry-deferred"><b>Raw telemetry not plotted.</b> The {x.telemetry.workbooks} SAME &ldquo;Analyzed data&rdquo; workbooks hold 1 Hz housekeeping exports (detector volts, particle counts, mass concentration). They are inventoried but not charted: {x.telemetry.reason}</span></Callout>
            <Disclosure id="same-limits" title="Scientific limitations (SAME)" action="Show the limitations" summary="Units, sources and what these results cannot tell you.">
              <div className="grid gap-4 lg:grid-cols-2"><ul className="list-disc pl-5 text-[14px] text-text-2">{x.notes.map((n) => <li key={n}>{n}</li>)}
                <li>Report-derived particle sizes (Table 1) and raw instrument signals are different things; only the former is charted.</li></ul><FlagRules rules={x.flag_rules} /></div>
            </Disclosure>
          </section>
        </div>)}</Loadable>
      <div className="mt-8"><AskSuggestions ctx={{ inv: "PSI-102" }} className="rounded-xl border border-line/60 bg-panel/40 p-4" /></div>
    </>
  );
}
