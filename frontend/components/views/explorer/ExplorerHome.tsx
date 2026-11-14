"use client";

// Phase 14: Research-to-Safety Explorer entry page. Four research scenarios, how the ranking works, and the
// research-support (not certification) notice. Everything shown comes from /api/v1/explorer/scenarios.
import Link from "next/link";
import { StartDemoButton } from "@/components/demo/DemoBar";
import { Icon } from "@/components/icons";
import { Callout, Loadable, PageHeader } from "@/components/ui";
import { useApi } from "@/lib/api";
import { setDemo, useDemo, type DemoScenario } from "@/lib/demo";
import type { ScenarioList } from "./types";

export default function ExplorerHome() {
  const d = useApi<ScenarioList>("/explorer/scenarios");
  const demo = useDemo();
  return (
    <>
      <PageHeader kicker="Research-to-Safety Explorer" title="Research-to-Safety Explorer"
        lead={<>Start from a research question about spacecraft fire, not from an investigation name. SpaceFire finds the NASA investigations that bear on it, ranks them by research relevance, and shows what was actually measured, and what was not.</>}
        actions={<StartDemoButton />} />
      <Loadable state={d} rows={8}>{(x) => (
        <div className="flex flex-col gap-8">
          <Callout tone="warn"><span data-testid="explorer-disclaimer">{x.disclaimer}</span></Callout>
          <section aria-labelledby="scen-title">
            <h2 id="scen-title" className="subhead mb-3 text-[20px]">Choose a research scenario</h2>
            <ul className="grid gap-4 md:grid-cols-2">
              {x.scenarios.map((s) => (
                <li key={s.id}>
                  <Link href={`/safety-explorer/${s.id}`} data-testid={`scenario-card-${s.id}`} data-selected={demo.active && demo.scenario === s.id ? "true" : undefined}
                    onClick={() => { if (demo.active) setDemo({ active: true, step: 3, scenario: s.id as DemoScenario }); }}
                    className={`lift hairline-top group flex h-full flex-col gap-3 rounded-2xl border p-5 no-underline hover:border-flame/60 hover:no-underline ${
                      demo.active && demo.scenario === s.id ? "border-flame bg-flame/[0.07] ring-1 ring-flame/50" : "border-line/70 bg-panel/70"}`}>
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 place-items-center rounded-xl border border-line-strong/70 bg-ink/60 text-flame"><Icon name={s.icon} size={20} /></span>
                      <div className="min-w-0">
                        <p className="text-[12.5px] uppercase tracking-wide text-text-3">{s.domain}</p>
                        <h3 className="text-[18px] font-semibold leading-snug text-text">{s.title}</h3>
                      </div>
                    </div>
                    <p className="text-[15px] italic leading-relaxed text-text">&ldquo;{s.question}&rdquo;</p>
                    <p className="text-[14px] leading-relaxed text-text-2">{s.summary}</p>
                    <div className="mt-auto flex flex-wrap items-center gap-1.5 text-[12.5px]">
                      <span className="rounded border border-data/60 px-1.5 py-px text-data">{s.primary.short_name} · {s.primary.investigation_id}</span>
                      {s.supporting.map((p) => (
                        <span key={p.investigation_id} className="rounded border border-line-strong/70 px-1.5 py-px text-text-2">{p.short_name}</span>
                      ))}
                      <span className="ml-auto inline-flex items-center gap-1 font-medium text-text group-hover:text-flame">Explore<Icon name="chevron" size={14} /></span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="rank-title" data-testid="ranking-explainer" className="rounded-2xl border border-line/60 bg-panel/50 p-5">
            <h2 id="rank-title" className="subhead text-[18px]">How the ranking works</h2>
            <p className="mt-1 max-w-[72ch] text-[14.5px] leading-relaxed text-text-2">Each investigation gets three separate, explainable measures. The ranking score combines them with fixed weights. It is never a fire-danger or safety score.</p>
            <dl className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="border-l-2 border-flame/60 pl-3"><dt className="font-semibold text-text">Relevance <span className="text-text-3">· weight {x.ranking.weights.relevance}</span></dt>
                <dd className="mt-1 text-[14px] text-text-2">How closely the study matches the question: whether it studies the scenario&apos;s phenomenon (from its own NASA metadata or documents), microgravity flight vs ground, and its role.</dd></div>
              <div className="border-l-2 border-data/60 pl-3"><dt className="font-semibold text-text">Evidence strength <span className="text-text-3">· weight {x.ranking.weights.evidence}</span></dt>
                <dd className="mt-1 text-[14px] text-text-2">The strongest kind of evidence actually downloaded, from {x.ranking.evidence_points.measured_outcomes.label} ({x.ranking.evidence_points.measured_outcomes.points}) down to {x.ranking.evidence_points.metadata_only.label} ({x.ranking.evidence_points.metadata_only.points}). Indirect evidence counts half.</dd></div>
              <div className="border-l-2 border-electric/60 pl-3"><dt className="font-semibold text-text">Applicability <span className="text-text-3">· weight {x.ranking.weights.applicability}</span></dt>
                <dd className="mt-1 text-[14px] text-text-2">Whether recorded experimental conditions match your filters. Conditions an investigation never recorded are left out, not counted against it.</dd></div>
            </dl>
          </section>
        </div>
      )}</Loadable>
    </>
  );
}
