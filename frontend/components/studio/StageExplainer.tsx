"use client";

// Phase 10 stage storytelling. The explainer is a pure view of the active stage, which the studio derives from the
// one timeline store (FLEX, BASS-II) or the walkthrough step (SAFFIRE-I). Default: stage title, one sentence and one
// key idea. On request: why it happens (with the basis of every statement), the NASA sources and limits, and, in the
// Earth vs microgravity view, what differs and why.
import { memo, useId, useState, type ReactNode } from "react";
import { MediaFigure } from "@/components/media";
import { Prov } from "@/components/ui";
import type { SourceRef } from "@/lib/lab-scientific-metadata";
import type { GravityStage, StageInfo, WalkStep } from "@/lib/stages";

function Toggle({ open, onClick, controls, children, testId }: { open: boolean; onClick: () => void; controls: string; children: ReactNode; testId?: string }) {
  return (
    <button type="button" aria-expanded={open} aria-controls={controls} onClick={onClick} data-testid={testId}
      className={`press inline-flex min-h-9 items-center rounded-lg border px-3 text-[13px] ${open ? "border-electric/70 bg-electric/10 text-text" : "border-line-strong text-text-2 hover:text-text"}`}>
      {children}
    </button>
  );
}

function Sources({ list }: { list: SourceRef[] }) {
  return (
    <ul className="flex flex-col gap-0.5 text-[12.5px]">
      {list.map((s) => <li key={s.href + s.label}><a href={s.href} target={s.external ? "_blank" : undefined} rel="noreferrer">{s.label}</a></li>)}
    </ul>
  );
}

/** Body shared by timeline stages and walkthrough steps. */
function StageBody({ info, extra, onInspect, selected, follow, setFollow, footer }: {
  info: StageInfo; extra?: ReactNode; onInspect: (id: string) => void; selected: string | null;
  follow: boolean; setFollow: (v: boolean) => void; footer?: ReactNode;
}) {
  const [why, setWhy] = useState(false);
  const [ev, setEv] = useState(false);
  const id = useId();
  const absent = selected ? info.absent?.[selected] : undefined;
  return (
    <>
      <p className="mt-1 text-[13.5px] text-text"><span className="text-text-3">Key idea: </span>{info.insight}</p>
      {absent && <p className="mt-1.5 rounded-md border border-line-strong/70 bg-ink/50 px-2.5 py-1.5 text-[12.5px] text-text-2" data-testid="stage-absent">{absent}</p>}
      {extra}
      <p className="sr-only">In the 3D view: {info.a11y}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Toggle open={why} onClick={() => setWhy(!why)} controls={`${id}-why`} testId="stage-why">Why does this happen?</Toggle>
        <Toggle open={ev} onClick={() => setEv(!ev)} controls={`${id}-ev`} testId="stage-evidence">View NASA evidence</Toggle>
        <button type="button" onClick={() => onInspect(info.inspect.id)} data-testid="stage-inspect"
          className="press inline-flex min-h-9 items-center rounded-lg border border-line-strong px-3 text-[13px] text-text-2 hover:border-electric hover:text-text">{info.inspect.label}</button>
        <label className="ml-auto inline-flex min-h-9 items-center gap-1.5 text-[12.5px] text-text-3">
          <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} className="accent-[var(--flame)]" data-testid="stage-follow" />
          Camera follows the stage
        </label>
      </div>
      <div id={`${id}-why`} hidden={!why} className="mt-2 rounded-lg border border-line/60 bg-ink/40 p-3 text-[13.5px] leading-relaxed text-text-2" data-testid="stage-why-body">
        <p>{info.why}</p>
        <ul className="mt-2 flex flex-col gap-1 text-[12.5px]" aria-label="Basis of these statements">
          {info.basis.map((b) => <li key={b.text} className="flex items-start gap-2"><Prov kind={b.kind} /><span>{b.text}</span></li>)}
        </ul>
      </div>
      <div id={`${id}-ev`} hidden={!ev} className="mt-2 rounded-lg border border-line/60 bg-ink/40 p-3 text-[13px] text-text-2" data-testid="stage-evidence-body">
        <Sources list={info.sources} />
        <p className="mt-2 text-[12.5px] text-text-3">Limits: {info.limits}</p>
      </div>
      {footer}
    </>
  );
}

/** Earth vs microgravity for the active stage, with a stage-specific "Why are they different?". */
function GravityBlock({ g, open, setOpen, showImage }: { g: GravityStage; open: boolean; setOpen: (v: boolean) => void; showImage: boolean }) {
  const id = useId();
  return (
    <div className="mt-2 rounded-lg border border-line/70 bg-ink/40 p-3" data-testid="gravity-stage">
      <p className="text-[12px] font-medium text-warn">Conceptual comparison — not paired Earth and ISS measurements.</p>
      <dl className="mt-2 grid gap-2 text-[13px] sm:grid-cols-2">
        <div><dt className="text-[12px] font-semibold uppercase tracking-wide text-text-3">Earth (1 g)</dt><dd className="mt-0.5 text-text-2" data-testid="gravity-earth">{g.earth}</dd></div>
        <div><dt className="text-[12px] font-semibold uppercase tracking-wide text-text-3">Microgravity</dt><dd className="mt-0.5 text-text-2" data-testid="gravity-micro">{g.micro}</dd></div>
      </dl>
      <div className="mt-2">
        <Toggle open={open} onClick={() => setOpen(!open)} controls={`${id}-d`} testId="why-different">Why are they different?</Toggle>
      </div>
      <div id={`${id}-d`} hidden={!open} className="mt-2 text-[13px] leading-relaxed text-text-2" data-testid="why-different-body">
        <p className="text-text">{g.differ}</p>
        <p className="mt-1.5">{g.detail}</p>
        <p className="mt-1.5 text-[12.5px] text-text-3">Highlighted in both views: the conceptual transport and flame regions this explanation is about. Arrows and particles show direction, not measured velocities.</p>
        <div className="mt-2"><Sources list={g.sources} /></div>
        {showImage && (
          <div className="mt-3 max-w-[220px]">
            <MediaFigure id="flex-1g-vs-microgravity" aspect="3 / 4" fit="contain" compact sizes="220px"
              caption="Real NASA photographs: a droplet flame aboard the ISS (top) and on Earth (bottom). They show the shape difference; NASA does not state their fuel or test, and they are not a paired FLEX measurement." />
          </div>
        )}
      </div>
    </div>
  );
}

export type ExplainerProps = {
  stageId: string | null;
  order: string[];
  info: Record<string, StageInfo>;
  onStart: () => void;
  onInspect: (id: string) => void;
  selected: string | null;
  follow: boolean;
  setFollow: (v: boolean) => void;
  /** Stage-specific lines for the current context (fuel, selected test, comparison). */
  extra?: ReactNode;
  gravity?: GravityStage | null;
  whyDifferent?: boolean;
  setWhyDifferent?: (v: boolean) => void;
  idleHint: string;
};

/** Timeline-driven explainer (FLEX, BASS-II). Re-renders when the stage or its context changes, not every frame. */
export const StageExplainer = memo(function StageExplainer(p: ExplainerProps) {
  const info = p.stageId ? p.info[p.stageId] : null;
  if (!info) {
    return (
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[13px] text-text-2" data-testid="stage-explainer" data-stage="none">
        <p data-testid="timeline-stage" aria-live="polite">{p.idleHint}</p>
        <button type="button" onClick={p.onStart} data-testid="stage-start"
          className="press inline-flex min-h-9 items-center rounded-lg border border-flame/60 px-3 text-[13px] text-text hover:bg-flame/10">Start at stage 1</button>
      </div>
    );
  }
  const n = p.order.indexOf(info.id) + 1;
  return (
    <div className="mt-2 border-t border-line/60 pt-2" data-testid="stage-explainer" data-stage={info.id}>
      <p className="text-[13.5px] leading-snug text-text-2" aria-live="polite" data-testid="timeline-stage">
        <span className="text-[12px] font-medium text-flame">Stage {n} of {p.order.length}</span>{" — "}
        <b className="text-[14.5px] text-text">{info.title}</b>
        <span className="sr-only">.</span> <span className="mt-0.5 block">{info.summary}</span>
      </p>
      <StageBody info={info} onInspect={p.onInspect} selected={p.selected} follow={p.follow} setFollow={p.setFollow}
        extra={<>{p.extra}{p.gravity && p.setWhyDifferent && (
          <GravityBlock g={p.gravity} open={!!p.whyDifferent} setOpen={p.setWhyDifferent} showImage={info.id === "burning" || info.id === "regression"} />)}</>} />
    </div>
  );
});

/** SAFFIRE-I: an explanatory walkthrough. Steps are topics, not intervals of the burn. */
export const SaffireWalkthrough = memo(function SaffireWalkthrough({ steps, index, setIndex, onInspect, selected, follow, setFollow, onFootage }: {
  steps: WalkStep[]; index: number | null; setIndex: (i: number | null) => void; onInspect: (id: string) => void; selected: string | null;
  follow: boolean; setFollow: (v: boolean) => void; onFootage: () => void;
}) {
  const step = index === null ? null : steps[index];
  return (
    <section aria-labelledby="walk-title" className="rounded-xl border border-line/80 bg-ink/60 p-3" data-testid="walkthrough"
      onKeyDown={(e) => {
        if (index === null || (e.target as HTMLElement).tagName === "INPUT") return;
        if (e.key === "ArrowRight" && index < steps.length - 1) { e.preventDefault(); setIndex(index + 1); }
        if (e.key === "ArrowLeft" && index > 0) { e.preventDefault(); setIndex(index - 1); }
      }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="walk-title" className="subhead text-[14.5px]">Experiment walkthrough</h3>
        <p className="rounded border border-warn/50 px-1.5 py-px text-[11.5px] font-medium text-warn">Explanatory steps — not a timeline of the burn</p>
      </div>
      <ol className="mt-2 flex flex-wrap gap-1.5" aria-label="Walkthrough steps">
        {steps.map((s, i) => (
          <li key={s.id}>
            <button type="button" onClick={() => setIndex(i)} aria-current={i === index ? "step" : undefined}
              className={`press min-h-8 rounded-full border px-2.5 text-[12.5px] ${i === index ? "border-flame bg-flame/15 text-text" : "border-line-strong text-text-2 hover:text-text"}`}>
              {i + 1}. {s.title}
            </button>
          </li>
        ))}
      </ol>
      {!step ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[13px] text-text-2">
          <p data-testid="walk-step" aria-live="polite">Five short steps through the experiment, its diagnostics and what the evidence can show.</p>
          <button type="button" onClick={() => setIndex(0)} data-testid="walk-start"
            className="press inline-flex min-h-9 items-center rounded-lg border border-flame/60 px-3 text-[13px] text-text hover:bg-flame/10">Start the walkthrough</button>
        </div>
      ) : (
        <div className="mt-2 border-t border-line/60 pt-2" data-stage={step.id}>
          <p className="text-[13.5px] leading-snug text-text-2" aria-live="polite" data-testid="walk-step">
            <span className="text-[12px] font-medium text-flame">Step {index! + 1} of {steps.length}</span>{" — "}
            <b className="text-[14.5px] text-text">{step.title}</b><span className="sr-only">.</span> <span className="mt-0.5 block">{step.summary}</span>
          </p>
          <StageBody info={step} onInspect={onInspect} selected={selected} follow={follow} setFollow={setFollow}
            extra={step.view === "footage" ? (
              <button type="button" onClick={onFootage} data-testid="walk-footage"
                className="press mt-2 inline-flex min-h-9 items-center rounded-lg border border-data/60 px-3 text-[13px] text-text hover:bg-data/10">Open NASA&apos;s footage</button>
            ) : undefined}
            footer={(
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setIndex(index! - 1)} disabled={index === 0} data-testid="walk-prev"
                  className="press inline-flex min-h-9 items-center rounded-lg border border-line-strong px-3 text-sm text-text disabled:opacity-40">‹ Previous</button>
                <button type="button" onClick={() => setIndex(index! + 1)} disabled={index === steps.length - 1} data-testid="walk-next"
                  className="press inline-flex min-h-9 items-center rounded-lg bg-flame px-3.5 text-sm font-semibold text-flame-ink disabled:opacity-40">Next ›</button>
                <button type="button" onClick={() => setIndex(null)} className="press ml-auto inline-flex min-h-9 items-center rounded-lg px-2.5 text-[12.5px] text-text-3 hover:text-text">Close walkthrough</button>
              </div>
            )} />
        </div>
      )}
    </section>
  );
});
