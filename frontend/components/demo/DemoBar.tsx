"use client";

// Phase 15: the Guided Demo bar. Shown on every page while a demo runs; it navigates between real routes and keeps
// the chosen scenario. It sits below fullscreen studios (z-index 70 < 80), so it never covers a fullscreen scene.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { EXPLORE, JOURNEYS, SCENARIO_ORDER, setDemo, stepHref, stepsFor, useDemo, type DemoScenario } from "@/lib/demo";

const STEP_NOTES: Record<number, (s: DemoScenario) => string[]> = {
  1: () => ["Why fire behaves differently in microgravity, what SpaceFire integrates, and what it cannot conclude."],
  2: (s) => [`Four research scenarios. This demo follows ${JOURNEYS[s].letter}: ${JOURNEYS[s].label}. Pick another below if you like.`],
  3: (s) => JOURNEYS[s].notes[3],
  4: (s) => JOURNEYS[s].notes[4],
  5: () => [`The question is only pre-filled: pressing Ask sends it (Gemini if configured, otherwise evidence only).`,
    `Try an unsupported one too, e.g. “Can SpaceFire certify that an untested polymer is safe?”: it abstains without calling the model.`],
};

const EXPLORE_NOTES: Record<number, (s: DemoScenario) => string[]> = {
  1: (s) => [`Five domains group the ten NASA investigations. This guide follows ${EXPLORE[s].domain}; pick another below.`],
  2: (s) => [EXPLORE[s].notes[2], "Each collection shows its evidence level: measured, conditions only, figure data, day summary or metadata."],
  3: (s) => [EXPLORE[s].notes[3], "Filters come from the fields this collection really has."],
  4: (s) => [EXPLORE[s].notes[4]],
  5: (s) => [`Open ${EXPLORE[s].viz.label}: the record seen in its scientific context.`],
  6: () => ["The question is only pre-filled; nothing is sent until you press Ask."],
};

export default function DemoBar() {
  const d = useDemo();
  const router = useRouter();
  const [notesOpen, setNotesOpen] = useState(true);
  if (!d.active) return null;
  const j = JOURNEYS[d.scenario];
  const explore = d.mode === "explore";
  const steps = stepsFor(d.mode);
  const last = steps.length;
  const go = (step: number, scenario: DemoScenario = d.scenario) => {
    const s = Math.min(last, Math.max(1, step));
    setDemo({ active: true, step: s, scenario, mode: d.mode });
    router.push(stepHref(s, scenario, d.mode));
  };
  const info = steps[d.step - 1];
  const notes = explore ? EXPLORE_NOTES[d.step](d.scenario) : STEP_NOTES[d.step](d.scenario);
  const pickScenario = explore ? d.step === 1 : d.step === 2;
  return (
    <>
      <div aria-hidden className="h-56 md:h-44" />
      <aside aria-label={explore ? "Guided exploration" : "Guided demo"} data-testid="demo-bar" data-step={d.step} data-scenario={d.scenario} data-mode={d.mode ?? "demo"}
        className="fixed inset-x-2 bottom-2 z-[70] mx-auto max-w-[900px] rounded-2xl border border-flame/50 bg-ink/95 p-3 shadow-[0_10px_40px_rgba(0,0,0,0.45)] backdrop-blur-md md:inset-x-4 md:p-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-flame">{explore ? `Guided exploration · ${EXPLORE[d.scenario].domain}` : `Guided demo · ${j.letter}`}</p>
          <ol className="flex items-center gap-1" aria-label="Demo steps">
            {steps.map((s) => (
              <li key={s.n}>
                <button type="button" onClick={() => go(s.n)} aria-current={s.n === d.step ? "step" : undefined} title={s.title}
                  aria-label={`Step ${s.n}: ${s.title}`} data-testid={`demo-dot-${s.n}`}
                  className={`grid h-7 w-7 place-items-center rounded-full border text-[12px] ${s.n === d.step ? "border-flame bg-flame text-flame-ink" : s.n < d.step ? "border-flame/60 text-text" : "border-line-strong text-text-3"}`}>{s.n}</button>
              </li>
            ))}
          </ol>
          <h2 className="min-w-0 flex-1 text-[15px] font-semibold text-text" data-testid="demo-step-title">Step {d.step} of {last} · {info.title}</h2>
          <button type="button" onClick={() => setNotesOpen(!notesOpen)} aria-expanded={notesOpen} className="text-[12.5px] text-link hover:underline">
            {notesOpen ? "Hide notes" : "Show notes"}</button>
        </div>
        {notesOpen && (
          <div className="mt-2 text-[13.5px] leading-relaxed text-text-2" data-testid="demo-notes">
            <ul className="list-disc pl-5">{notes.map((t) => <li key={t}>{t}</li>)}</ul>
            {d.step >= 3 && <p className="mt-1 text-[12.5px]"><b className="text-text">Evidence:</b> {j.evidence} <b className="text-warn">Limit:</b> {j.limitation}</p>}
            {!explore && d.step === 3 && <p className="mt-1 text-[12.5px]">Then show the charts: <a href={j.charts.href} className="text-link" data-testid="demo-charts">{j.charts.label}</a>.</p>}
            {pickScenario && (
              <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label={explore ? "Domain" : "Demo scenario"}>
                {SCENARIO_ORDER.map((s) => (
                  <button key={s} type="button" role="radio" aria-checked={s === d.scenario} data-testid={`demo-scenario-${s}`}
                    onClick={() => { setDemo({ ...d, scenario: s }); if (explore) router.push(stepHref(d.step, s, "explore")); }}
                    className={`press rounded-full border px-2.5 py-1 text-[12.5px] ${s === d.scenario ? "border-flame bg-flame/15 text-text" : "border-line-strong text-text-2 hover:text-text"}`}>
                    {explore ? EXPLORE[s].domain : `${JOURNEYS[s].letter}. ${JOURNEYS[s].label}`}</button>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => go(d.step - 1)} disabled={d.step === 1} data-testid="demo-prev"
            className="press inline-flex min-h-9 items-center gap-1 rounded-lg border border-line-strong px-3 text-[13.5px] text-text disabled:opacity-40">
            <Icon name="chevron" size={14} className="rotate-180" />Previous</button>
          {d.step < last ? (
            <button type="button" onClick={() => go(d.step + 1)} data-testid="demo-next"
              className="press glow-flame inline-flex min-h-9 items-center gap-1 rounded-lg bg-flame px-3.5 text-[13.5px] font-semibold text-flame-ink">
              Next: {steps[d.step].title}<Icon name="chevron" size={14} /></button>
          ) : (
            <button type="button" onClick={() => go(1)} data-testid="demo-restart-end"
              className="press inline-flex min-h-9 items-center gap-1 rounded-lg bg-flame px-3.5 text-[13.5px] font-semibold text-flame-ink">
              <Icon name="restart" size={14} />{explore ? "Restart exploration" : "Restart demo"}</button>
          )}
          <span className="ml-auto flex flex-wrap gap-2">
            {!explore && <button type="button" onClick={() => go(2)} data-testid="demo-skip" className="text-[13px] text-link hover:underline">Skip to Explorer</button>}
            <button type="button" onClick={() => go(1)} data-testid="demo-restart" className="text-[13px] text-link hover:underline">Restart</button>
            <button type="button" onClick={() => setDemo(null)} data-testid="demo-exit"
              className="press inline-flex min-h-8 items-center gap-1 rounded-lg border border-line-strong px-2.5 text-[13px] text-text-2 hover:text-text">
              <Icon name="close" size={13} />{explore ? "Exit guide" : "Exit demo"}</button>
          </span>
        </div>
      </aside>
    </>
  );
}

/** Button that starts the demo at step 1 (Home and Explorer entry pages). */
export function StartDemoButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  return (
    <button type="button" data-testid="start-demo" onClick={() => { setDemo({ active: true, step: 1, scenario: "gaseous-flames", mode: "demo" }); router.push("/demo"); }}
      className={`press inline-flex min-h-11 items-center gap-2 rounded-lg border border-flame/60 bg-flame/10 px-4 text-[15px] font-medium text-text hover:bg-flame/20 ${className}`}>
      <Icon name="play" size={16} />Start guided demo</button>
  );
}

/** Combustion Explorer: start the six-step guided exploration (Phase 16). */
export function StartExploreButton({ scenario = "gaseous-flames" as DemoScenario }: { scenario?: DemoScenario }) {
  const router = useRouter();
  return (
    <button type="button" data-testid="start-explore" onClick={() => { setDemo({ active: true, step: 1, scenario, mode: "explore" }); router.push(stepHref(1, scenario, "explore")); }}
      className="press inline-flex min-h-10 items-center gap-2 rounded-lg border border-flame/60 bg-flame/10 px-3.5 text-[14px] font-medium text-text hover:bg-flame/20">
      <Icon name="play" size={15} />Start guided exploration</button>
  );
}

/** Research-to-Safety scenario: start the guided demo journey at its evidence step (Phase 16). */
export function StartScenarioGuide({ scenario, className = "" }: { scenario: DemoScenario; className?: string }) {
  const router = useRouter();
  return (
    <button type="button" data-testid={`start-guide-${scenario}`} onClick={() => { setDemo({ active: true, step: 3, scenario, mode: "demo" }); router.push(stepHref(3, scenario, "demo")); }}
      className={`press inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-flame/60 px-3 text-[13.5px] text-text hover:bg-flame/10 ${className}`}>
      <Icon name="play" size={14} />Start guided exploration</button>
  );
}
