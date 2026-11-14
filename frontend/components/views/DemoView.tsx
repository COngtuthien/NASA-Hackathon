"use client";

// Phase 15: Guided Demo, step 1 ("The challenge"). Short, source-linked framing, live counts from the API, and the
// choice of demo journey. The demo bar (components/demo/DemoBar.tsx) carries the navigation.
import Link from "next/link";
import { MediaFigure } from "@/components/media";
import { Icon } from "@/components/icons";
import { Callout } from "@/components/ui";
import { useApi } from "@/lib/api";
import { JOURNEYS, SCENARIO_ORDER, setDemo, stepHref, useDemo } from "@/lib/demo";

type Registry = { items: { investigation_id: string; readiness: string }[] };
type Graph = { nodes: number; edges: number };

export default function DemoView() {
  const d = useDemo();
  const reg = useApi<Registry>("/registry");
  const g = useApi<Graph>("/graph/summary");
  const withData = reg.data?.items.filter((i) => ["quantitative", "curated_tables", "figure_data", "conditions_only"].includes(i.readiness)).length;
  return (
    <div className="flex flex-col gap-6" data-testid="demo-intro">
      <header className="grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <p className="kicker mb-2">Guided demo · Step 1 of 5</p>
          <h1 className="display text-[30px] md:text-[42px]">Why fire is different in space</h1>
          <p className="mt-3 max-w-[62ch] text-[17px] leading-relaxed text-text-2">
            In microgravity hot gas does not rise, so there is no buoyant flow to feed or carry a flame. Flames become slow,
            near-spherical and governed by diffusion and by the cabin&apos;s ventilation airflow (<a href="/api/v1/documents/bass-ii-summary-report/file#page=27" target="_blank" rel="noreferrer">BASS-II Summary Report, p.27</a>).
            A spacecraft is a closed cabin with no escape, so fire behaviour and early smoke detection must be understood in advance.
          </p>
        </div>
        <MediaFigure id="bass2-flame-gmt203" compact eager aspect="4 / 3" caption="A real BASS-II flame aboard the ISS." />
      </header>
      <section className="grid gap-4 md:grid-cols-3" aria-label="What SpaceFire brings together">
        <div className="rounded-2xl border border-line/60 bg-panel/50 p-4">
          <p className="text-[28px] font-semibold text-data" data-testid="demo-count-investigations">{reg.data ? reg.data.items.length : "…"}</p>
          <p className="text-[14px] text-text-2">NASA Physical Sciences investigations{withData !== undefined ? `, ${withData} with downloaded test data or verified report tables` : ""}.</p>
        </div>
        <div className="rounded-2xl border border-line/60 bg-panel/50 p-4">
          <p className="text-[28px] font-semibold text-data" data-testid="demo-count-graph">{g.data ? g.data.edges.toLocaleString("en-US") : "…"}</p>
          <p className="text-[14px] text-text-2">source-backed links in the knowledge graph{g.data ? `, between ${g.data.nodes.toLocaleString("en-US")} experiments, documents, materials and findings` : ""}.</p>
        </div>
        <div className="rounded-2xl border border-line/60 bg-panel/50 p-4">
          <p className="text-[28px] font-semibold text-data">5</p>
          <p className="text-[14px] text-text-2">interactive 3D studios, plus a Research Copilot that cites every statement.</p>
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-ok/40 bg-ok/[0.04] p-4">
          <h2 className="subhead text-[16px]">What SpaceFire can do</h2>
          <ul className="mt-2 list-disc pl-5 text-[14px] text-text-2">
            <li>Find the NASA investigations behind a research question and rank them by relevance.</li>
            <li>Show what was actually measured, with the CSV row or report page.</li>
            <li>Explain the physics in 3D, labelled as conceptual where it is.</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-warn/40 bg-warn/[0.04] p-4">
          <h2 className="subhead text-[16px]">What it cannot do</h2>
          <ul className="mt-2 list-disc pl-5 text-[14px] text-text-2">
            <li>Predict fire probability or certify a material as safe.</li>
            <li>Give values for conditions that were never tested.</li>
            <li>Turn conceptual 3D scenes into simulations.</li>
          </ul>
        </div>
      </section>
      <section aria-labelledby="demo-pick">
        <h2 id="demo-pick" className="subhead mb-3 text-[18px]">Choose the demo journey</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {SCENARIO_ORDER.map((s) => {
            const j = JOURNEYS[s];
            const on = d.active && d.scenario === s;
            return (
              <li key={s}>
                <button type="button" aria-pressed={on} data-testid={`demo-pick-${s}`}
                  onClick={() => setDemo({ active: true, step: d.active ? d.step : 1, scenario: s })}
                  className={`press flex h-full w-full flex-col gap-1 rounded-xl border p-3 text-left ${on ? "border-flame bg-flame/[0.08]" : "border-line/70 bg-panel/50 hover:border-flame/60"}`}>
                  <span className="text-[12px] font-semibold uppercase tracking-wide text-text-3">Demo {j.letter}{s === "gaseous-flames" ? " · default" : ""}</span>
                  <span className="text-[15.5px] font-semibold text-text">{j.label}</span>
                  <span className="text-[13px] italic text-text-2">“{j.question}”</span>
                </button>
              </li>
            );
          })}
        </ul>
        {!d.active ? (
          <button type="button" data-testid="demo-begin" onClick={() => setDemo({ active: true, step: 1, scenario: "gaseous-flames" })}
            className="press glow-flame mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-flame px-4 text-[15px] font-semibold text-flame-ink">
            <Icon name="play" size={16} />Begin the guided demo</button>
        ) : (
          <p className="mt-3 text-[13.5px] text-text-3">Use <b className="text-text">Next</b> in the demo bar, or <Link href={stepHref(2, d.scenario)}>go straight to the Explorer</Link>.</p>
        )}
      </section>
      <Callout tone="info">Everything in the demo is the real application and real NASA data. Nothing is sent to the AI service unless you press Ask in the Copilot.</Callout>
    </div>
  );
}
