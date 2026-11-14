"use client";

// Phase 13: Gaseous Flame Dynamics. One shared ACME section with three clearly separated investigation tabs
// (CFI-G = quantitative; Flame Design = conditions + published findings; BRE = day log + report findings),
// and the Gaseous Flame Studio (conceptual 3D; measured radii drawn only for a selected CFI-G Table 3 event).
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { AskSuggestions } from "@/components/ask-suggestions";
import { DocLink, EvidenceTag, type EvidenceKind } from "@/components/evidence-tag";
import { MediaPanelBlock } from "@/components/media";
import LiteStudio from "@/components/studio/LiteStudio";
import { Field, inputCls, PageHeader, Segmented } from "@/components/ui";
import { fmt, useApi } from "@/lib/api";
import CfigSection, { OUTCOME_COLOR, type CfigResp, type CoolFlame } from "@/components/views/gas/CfigSection";
import { BreSection, FlameDesignSection } from "@/components/views/gas/FlameDesignBre";

const TABS: [string, string, string, string][] = [
  ["cfig", "Cool Flames with Gases", "ACME CFI-G · PSI-159", "Per-test outcomes"],
  ["flame-design", "Flame Design", "ACME Flame Design · PSI-10", "Conditions + findings"],
  ["bre", "Burning Rate Emulator", "ACME BRE · PSI-20", "Day log + findings"],
];
const DOC = "psi-159-reports-finalrpt-acme-cfi-g";
const FD_DOC = "psi-10-reports-finalrpt-acmeflamedesign";

const PARTS: Record<string, { title: string; kind: EvidenceKind; text: React.ReactNode }> = {
  burner: { title: "Porous spherical burner", kind: "measured", text: <>A sintered porous sphere 0.25 inch (6.35 mm) in diameter, drawn to scale (Flame Design <DocLink id={FD_DOC} page={24}>Table 1 note, p.24</DocLink>). CFI-G used the Flame Design burners (<DocLink id={DOC} page={4}>CFI-G report p.4</DocLink>).</> },
  tube: { title: "Supply tube", kind: "guided", text: "Gas reaches the sphere through a supply tube. Normal flames: fuel (with or without N₂). Inverse flames: O₂/N₂. Length and thickness are illustrative." },
  flame: { title: "Hot diffusion flame", kind: "guided", text: "A thin reaction zone where outflowing and ambient reactants meet by diffusion. In microgravity, with no buoyant plume, it is close to spherical. Its drawn colour and flicker are illustrative; its radius is measured only for a selected Table 3 event." },
  coolflame: { title: "Cool diffusion flame", kind: "guided", text: "After a hot flame extinguishes by radiation, a low-temperature (cool) flame can persist much closer to the burner. CFI-G observed this only for 30 % n-butane normal flames at 2.03 bar. Cool flames are barely luminous; the pale shell is a false-colour illustration (NASA shows intensified camera images converted to blue)." },
  ambient: { title: "Ambient atmosphere", kind: "illustration", text: "Normal flames: O₂/N₂ around the burner. Inverse flames: fuel/N₂. Dots show which reactant is where; their motion is not a velocity and no concentration field is computed." },
};

function GasStudio() {
  const [config, setConfig] = useState<"normal" | "inverse">("normal");
  const [regime, setRegime] = useState<"hot" | "cool">("hot");
  const [compare, setCompare] = useState(false);
  const [eventId, setEventId] = useState("");
  const [testId, setTestId] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [labels, setLabels] = useState(true);
  const [animate, setAnimate] = useState(true);
  const cf = useApi<CfigResp>("/gasflames/cfig");
  const events: CoolFlame[] = cf.data?.cool_flames ?? [];
  const ev = events.find((e) => e.record_id === eventId) ?? null;
  const test = cf.data?.tests.find((t) => t.test_id === testId) ?? null;
  const effConfig = ev ? "normal" : config;
  const measured = ev ? { hot_mm: ev.r_hot_mm, cool_mm: ev.r_cool_mm, label: `${ev.test_id}${ev.sub_event ? `-${ev.sub_event}` : ""}` } : null;
  const measuredLabel = ev ? `Measured radii drawn to scale: ${measured!.label}, hot ${ev.r_hot_mm} mm${ev.r_cool_mm ? `, cool ${ev.r_cool_mm} mm` : ", cool radius not measured"} (Table 3, p.46)` : null;
  const legend = useMemo(() => [
    { color: effConfig === "normal" ? "#ffb547" : "#4fd1e8", label: effConfig === "normal" ? "Fuel leaving the burner" : "O₂/N₂ leaving the burner" },
    { color: effConfig === "normal" ? "#4fd1e8" : "#ffb547", label: effConfig === "normal" ? "Ambient O₂ (diffusing in)" : "Ambient fuel (diffusing in)" },
    { color: "#5f9bff", label: regime === "hot" ? "Hot flame shell" : "Cool flame shell (false colour)" },
    ...(regime === "cool" && ev ? [{ color: "#ffb547", label: "Measured hot-flame radius (dashed)", dashed: true }] : []),
  ], [effConfig, regime, ev]);
  const part = selected ? PARTS[selected] : null;
  return (
    <LiteStudio id="gas" kicker="Gaseous Flame Studio" title="A spherical diffusion flame on a porous burner"
      intro={<>Rotate a gas-fed spherical flame, switch between <b>normal</b> and <b>inverse</b> arrangements and between the <b>hot</b> and <b>cool</b> regimes,
        then pick a measured CFI-G cool-flame event to see its radii drawn to scale.</>}
      scene={{ key: "gas", props: { config: effConfig, regime, compare: compare && !ev, measured, animate, labels, selected, onSelect: setSelected } }}
      home={compare && !ev ? { position: [0, 0.8, 9.5], target: [0, 0, 0], min: 3, max: 18 } : { position: [0, 0.6, 6], target: [0, 0, 0], min: 1.6, max: 14 }}
      legend={legend} labels={labels} onLabels={setLabels} animate={animate} onAnimate={setAnimate} measuredLabel={measuredLabel}
      onReset={() => { setConfig("normal"); setRegime("hot"); setCompare(false); setEventId(""); setTestId(""); setSelected(null); }}
      banner={<>{ev ? <>Burner and radii to scale (1 unit = 10 mm) <EvidenceTag kind="measured" /></> : <>Flame size illustrative <EvidenceTag kind="illustration" /></>}{" "}
        · arrangement <EvidenceTag kind="guided" /></>}
      textAlternative="A small porous sphere on a supply tube sits at the centre. Gas flows out of the sphere in all directions; in a normal flame this is fuel, in an inverse flame it is an oxygen and nitrogen mixture. Around it, a translucent spherical flame shell marks where the outflowing and ambient reactants meet. In the cool-flame view a fainter, smaller shell is shown instead; for a selected measured event the earlier hot-flame radius is drawn as a dashed circle."
      controls={
        <div className="flex flex-col gap-3 rounded-xl border border-line/70 bg-panel/60 p-3" data-testid="gas-controls">
          <Segmented label="Arrangement" value={effConfig} onChange={(v) => { setConfig(v as "normal" | "inverse"); setEventId(""); }}
            options={[["normal", "Normal (fuel out)"], ["inverse", "Inverse (oxidizer out)"]]} />
          <Segmented label="Regime" value={regime} onChange={(v) => setRegime(v as "hot" | "cool")} options={[["hot", "Hot flame"], ["cool", "Cool flame"]]} />
          <label className="flex items-center gap-2 text-[13.5px] text-text-2"><input type="checkbox" className="accent-[var(--flame)]" checked={compare && !ev} disabled={!!ev}
            onChange={(e) => setCompare(e.target.checked)} data-testid="gas-compare" />Side by side: normal vs inverse</label>
          <Field label="Draw a measured CFI-G cool-flame event (Table 3)" htmlFor="gas-event">
            <select id="gas-event" className={inputCls} value={eventId} onChange={(e) => { setEventId(e.target.value); if (e.target.value) setRegime("cool"); }} data-testid="gas-event">
              <option value="">None: conceptual size</option>
              {events.map((e) => <option key={e.record_id} value={e.record_id}>{e.test_id}{e.sub_event ? `-${e.sub_event}` : ""} · hot {e.r_hot_mm} mm · cool {e.r_cool_mm ?? "n/m"} mm</option>)}
            </select></Field>
          <p className="text-[12px] text-text-3">Changing arrangement, regime or test never changes the drawn flame size unless a Table 3 event is selected; its radii apply to that event&apos;s condition only (30 % n-butane, 2.03 bar).</p>
        </div>}
      explanation={<>
          <div className="rounded-xl border border-line/70 bg-panel/60 p-3 text-[13.5px] leading-relaxed text-text-2" data-testid="gas-explain">
            <p className="font-medium text-text">{effConfig === "normal" ? "Normal flame" : "Inverse flame"} · {regime === "hot" ? "hot regime" : "cool regime"}</p>
            <p className="mt-1">{effConfig === "normal"
              ? "Fuel flows out of the burner and meets oxygen diffusing in from the surroundings; soot, if any, forms inside the flame."
              : "Oxidizer flows out of the burner into a fuel-laden atmosphere, so the flame is effectively inside out (soot forms outside it)."}{" "}
              {regime === "hot" ? "Without buoyancy the flame grows slowly; it can extinguish by radiative heat loss." :
                "A cool flame is a low-temperature reaction zone (peak temperatures of cool diffusion flames are 500–1000 K, CFI-G report p.24); CFI-G found it only after a hot flame extinguished radiatively."}</p>
            <p className="mt-1 text-[12.5px]">Sources: <DocLink id={DOC} page={3}>CFI-G report p.3</DocLink>, <DocLink id={DOC} page={24}>p.24</DocLink>, <DocLink id={DOC} page={44}>p.44</DocLink>; <DocLink id={FD_DOC} page={26}>Flame Design p.26</DocLink>.</p>
          </div>
          {part && <div className="rounded-xl border border-electric/50 bg-electric/[0.06] p-3 text-[13.5px] text-text-2" data-testid="gas-part">
            <p className="flex flex-wrap items-center gap-2 font-medium text-text">{part.title} <EvidenceTag kind={part.kind} /></p><p className="mt-1">{part.text}</p></div>}
      </>}
      evidence={<>
          <div className="rounded-xl border border-line/70 bg-panel/60 p-3 text-[13.5px]" data-testid="gas-test-inspect">
            <Field label="Inspect an actual CFI-G test (values only; geometry unchanged)" htmlFor="gas-test">
              <select id="gas-test" className={inputCls} value={testId} onChange={(e) => setTestId(e.target.value)}>
                <option value="">Choose a test…</option>
                {(cf.data?.tests ?? []).map((t) => <option key={t.record_id} value={t.test_id}>{t.test_id} · {t.configuration} · {t.fuel_raw}</option>)}
              </select></Field>
            {test && <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[13px]">
              <dt className="text-text-3">Configuration</dt><dd>{test.configuration}</dd>
              <dt className="text-text-3">Fuel</dt><dd>{test.fuel_raw}</dd>
              <dt className="text-text-3">O₂ (mole fraction)</dt><dd>{fmt(test.x_o2)}</dd>
              <dt className="text-text-3">Pressure</dt><dd>{fmt(test.p_bar)} bar</dd>
              <dt className="text-text-3">Outcome</dt><dd><span className="inline-block h-2 w-2 rounded-full" style={{ background: OUTCOME_COLOR[test.outcome] }} /> {cf.data?.outcome_labels[test.outcome]}</dd>
              <dt className="text-text-3">Burn time</dt><dd>{test.burn_time_s === null ? "–" : `${test.censored ? "≥ " : ""}${fmt(test.burn_time_s)} s`}</dd>
            </dl>}
          </div>
      </>}
    />
  );
}

export default function GasFlamesView() {
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const tab = TABS.some(([t]) => t === sp.get("tab")) ? sp.get("tab")! : "cfig";
  const setTab = (t: string) => {
    const n = new URLSearchParams();
    n.set("tab", t);
    router.replace(`${path}?${n.toString()}#investigations`, { scroll: false });
  };
  const inv = tab === "cfig" ? "PSI-159" : tab === "flame-design" ? "PSI-10" : "PSI-20";
  return (
    <>
      <PageHeader kicker="Gas flames · ACME" title="Gaseous Flame Dynamics"
        lead={<>What happens to a gas flame when nothing makes hot gas rise? NASA&apos;s ACME experiments burned gaseous fuels on porous burners aboard the ISS: spherical flames that grow, cool, and sometimes turn into barely visible cool flames.</>}
        source={{ source: "ACME CFI-G · Flame Design · BRE", inv: "PSI-159" }}
        sections={[{ id: "studio", label: "3D studio" }, { id: "investigations", label: "Investigations" }, { id: "ask", label: "Ask" }]} />
      <GasStudio />
      <section aria-labelledby="gas-footage-title" className="mt-6 rounded-2xl border border-line/60 bg-panel/50 p-4 md:p-5" data-testid="gas-footage">
        <h2 id="gas-footage-title" className="subhead text-[18px]">NASA footage from a CFI-G test</h2>
        <p className="mt-1 max-w-[72ch] text-[14px] text-text-2">Real experiment video, not a visualization. It loads only when you press play and has no sound.</p>
        <div className="mt-3 max-w-[640px]">
          <MediaPanelBlock id="cfi-g-cool-flame-video"
            caveat="NASA public footage of one CFI-G test; NASA gives no test number, so it is not tied to a data row. The 3D studio above is not reconstructed from it." />
        </div>
      </section>
      <div className="h-8" />
      <section id="investigations" className="scroll-mt-36" aria-labelledby="inv-title">
        <h2 id="inv-title" className="subhead text-[22px] md:text-[26px]">Three ACME investigations, three kinds of evidence</h2>
        <p className="mt-1 max-w-[70ch] text-[15px] text-text-2">They share the ACME hardware in the Combustion Integrated Rack but ask different questions, and the downloaded data support different analyses. They are never pooled.</p>
        <div role="tablist" aria-label="ACME investigation" className="mt-4 flex flex-wrap gap-2" data-testid="gas-tabs">
          {TABS.map(([id, label, src, ev]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} data-testid={`tab-${id}`}
              className={`press flex flex-col items-start rounded-xl border px-4 py-2.5 text-left ${tab === id ? "border-flame bg-flame/[0.08] shadow-[0_0_0_1px_var(--flame)]" : "border-line hover:border-line-strong"}`}>
              <span className="font-medium text-text">{label}</span><span className="text-[12px] text-text-3">{src} · {ev}</span>
            </button>))}
        </div>
        <div role="tabpanel" className="mt-5">
          {tab === "cfig" && <CfigSection />}
          {tab === "flame-design" && <FlameDesignSection />}
          {tab === "bre" && <BreSection />}
        </div>
      </section>
      <div id="ask" className="mt-8 scroll-mt-36">
        <AskSuggestions ctx={{ inv: inv as "PSI-159" | "PSI-10" | "PSI-20" }} className="rounded-xl border border-line/60 bg-panel/40 p-4" />
      </div>
    </>
  );
}
