"use client";

/* eslint-disable @next/next/no-img-element -- media are pre-sized WebP variants from the NASA media registry */
// Research-to-Safety Explorer entry page (Phase 14; visual-first redesign in Phase 16). Four scenario cards with a
// verified NASA image or a labelled original schematic, one sentence each, Explore and guided exploration. The
// ranking method sits behind "How the ranking works". Everything comes from /api/v1/explorer/scenarios.
import Link from "next/link";
import { StartDemoButton, StartScenarioGuide } from "@/components/demo/DemoBar";
import { Icon } from "@/components/icons";
import { Loadable, PageHeader } from "@/components/ui";
import { useApi } from "@/lib/api";
import { setDemo, useDemo, type DemoScenario } from "@/lib/demo";
import { MEDIA_BY_ID } from "@/lib/scientific-media";
import type { ScenarioList } from "./types";

const CARD: Record<string, { short: string; media: string | null; credit: string }> = {
  "flame-spread": { short: "How fast flames creep over cabin materials in slow airflow.", media: "bass2-flame-gmt203", credit: "NASA image: BASS-II flame over acrylic" },
  "gaseous-flames": { short: "When gas flames ignite, persist, become cool flames or go out.", media: "cfi-g-cool-flame-video", credit: "NASA video frame from a CFI-G test" },
  "smoke-detection": { short: "How smoke from overheated materials grows and reaches detectors.", media: null, credit: "Original schematic, not a photo" },
  "droplet-extinction": { short: "How fuel droplets burn, and when their flames go out.", media: "flex-1g-vs-microgravity", credit: "NASA image: droplet flame in orbit vs on Earth" },
};

function CardImage({ id }: { id: string }) {
  const c = CARD[id];
  const m = c?.media ? MEDIA_BY_ID[c.media] : null;
  if (!m) {
    return (
      <div className="relative h-36 overflow-hidden rounded-t-2xl bg-[radial-gradient(circle_at_25%_75%,rgba(255,140,60,0.4),transparent_45%),linear-gradient(135deg,#0b1424,#152238)]" data-testid={`card-image-${id}`}>
        <svg viewBox="0 0 300 140" className="absolute inset-0 h-full w-full" aria-hidden>
          <rect x="22" y="96" width="40" height="10" rx="2" fill="#ff8a3d" opacity="0.8" />
          {Array.from({ length: 34 }).map((_, i) => <circle key={i} cx={50 + ((i * 41) % 190)} cy={25 + ((i * 29) % 80)} r={1.6 + (i % 4) * 0.9} fill="#c9d3e2" opacity={0.3 + (i % 3) * 0.18} />)}
          <rect x="248" y="40" width="34" height="50" rx="5" fill="none" stroke="#4fd1e8" strokeWidth="2.5" />
        </svg>
        <span className="absolute bottom-1.5 left-2 rounded bg-black/55 px-1 text-[11px] text-white/85">{c?.credit}</span>
      </div>
    );
  }
  const v = m.poster ?? m.variants[m.variants.length > 1 ? 1 : 0];
  return (
    <div className="relative h-36 overflow-hidden rounded-t-2xl bg-black" data-testid={`card-image-${id}`}>
      <img src={v.src} alt={m.alt} width={v.width} height={v.height} className="h-full w-full object-cover" loading="lazy" decoding="async" />
      <span className="absolute bottom-1.5 left-2 rounded bg-black/55 px-1 text-[11px] text-white/85">{c.credit} · {m.credit}</span>
    </div>
  );
}

export default function ExplorerHome() {
  const d = useApi<ScenarioList>("/explorer/scenarios");
  const demo = useDemo();
  return (
    <>
      <PageHeader kicker="Research-to-Safety Explorer" title="Explore Spacecraft Fire Science"
        lead="Choose a question. Explore NASA evidence, scientific charts and interactive 3D."
        actions={<StartDemoButton />} />
      <Loadable state={d} rows={8}>{(x) => (
        <div className="flex flex-col gap-6">
          <p className="text-[13px] text-text-3" data-testid="explorer-disclaimer"><Icon name="info" size={13} className="mr-1 inline -translate-y-px" />{x.disclaimer}</p>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Research scenarios">
            {x.scenarios.map((s) => {
              const on = demo.active && demo.scenario === s.id;
              return (
                <li key={s.id} className={`flex flex-col overflow-hidden rounded-2xl border bg-panel/70 ${on ? "border-flame ring-1 ring-flame/50" : "border-line/70"}`}>
                  <Link href={`/safety-explorer/${s.id}`} data-testid={`scenario-card-${s.id}`} data-selected={on ? "true" : undefined}
                    onClick={() => { if (demo.active) setDemo({ active: true, step: 3, scenario: s.id as DemoScenario, mode: "demo" }); }}
                    className="lift group flex flex-1 flex-col no-underline hover:no-underline">
                    <CardImage id={s.id} />
                    <div className="flex flex-1 flex-col gap-2 p-4">
                      <h2 className="flex items-center gap-2 text-[17px] font-semibold leading-snug text-text"><Icon name={s.icon} size={17} className="text-flame" />{s.title}</h2>
                      <p className="text-[14px] leading-relaxed text-text-2" data-testid="card-short">{CARD[s.id]?.short}</p>
                      <p className="mt-auto flex items-center justify-between gap-2 text-[12.5px]">
                        <span className="rounded border border-data/60 px-1.5 py-px text-data">{s.primary.short_name}</span>
                        <span className="inline-flex items-center gap-1 font-medium text-text group-hover:text-flame">Explore<Icon name="chevron" size={14} /></span>
                      </p>
                    </div>
                  </Link>
                  <div className="border-t border-line/60 px-4 py-2.5"><StartScenarioGuide scenario={s.id as DemoScenario} className="w-full justify-center" /></div>
                </li>
              );
            })}
          </ul>
          <details className="rounded-2xl border border-line/60 bg-panel/50 p-4" data-testid="ranking-explainer">
            <summary className="cursor-pointer text-[15px] font-semibold text-text">How the ranking works</summary>
            <p className="mt-2 max-w-[72ch] text-[14px] text-text-2">Each investigation gets three separate measures, combined with fixed weights. It is never a fire-danger or safety score.</p>
            <dl className="mt-3 grid gap-4 text-[14px] md:grid-cols-3">
              <div className="border-l-2 border-flame/60 pl-3"><dt className="font-semibold text-text">Relevance · weight {x.ranking.weights.relevance}</dt>
                <dd className="mt-1 text-text-2">Does the study cover the topic (from its own NASA text), was it flown, and its role.</dd></div>
              <div className="border-l-2 border-data/60 pl-3"><dt className="font-semibold text-text">Evidence strength · weight {x.ranking.weights.evidence}</dt>
                <dd className="mt-1 text-text-2">From {x.ranking.evidence_points.measured_outcomes.label} ({x.ranking.evidence_points.measured_outcomes.points}) to {x.ranking.evidence_points.metadata_only.label} ({x.ranking.evidence_points.metadata_only.points}); indirect evidence counts half.</dd></div>
              <div className="border-l-2 border-electric/60 pl-3"><dt className="font-semibold text-text">Applicability · weight {x.ranking.weights.applicability}</dt>
                <dd className="mt-1 text-text-2">Do recorded conditions match your filters? Unrecorded conditions are not counted against a study.</dd></div>
            </dl>
          </details>
        </div>
      )}</Loadable>
    </>
  );
}
