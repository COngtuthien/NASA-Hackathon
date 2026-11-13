"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { Icon } from "@/components/icons";
import { DUR, EASE, motion } from "@/components/motion";
import type { TourStep } from "@/lib/tours";

/**
 * A non-modal guided exploration card. The studio applies each step's effects (selection, camera, state); this
 * component only presents the step, its progress and controls. Nothing advances on its own.
 */
export default function GuidedTour({ steps, index, onIndex, onClose, taskDone }: {
  steps: TourStep[]; index: number; onIndex: (i: number) => void; onClose: () => void; taskDone: (id: string) => boolean;
}) {
  const head = useRef<HTMLHeadingElement>(null);
  const step = steps[index];
  const last = index === steps.length - 1;

  // move focus to the step heading so screen readers announce it and keyboard users stay in the tour
  useEffect(() => { head.current?.focus(); }, [index]);

  function onKey(e: KeyboardEvent<HTMLElement>) {
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
    else if (e.key === "ArrowRight" && !last) { e.preventDefault(); onIndex(index + 1); }
    else if (e.key === "ArrowLeft" && index > 0) { e.preventDefault(); onIndex(index - 1); }
  }

  const done = step.task ? taskDone(step.task.id) : false;

  return (
    <section role="region" aria-label="Guided exploration" onKeyDown={onKey} data-testid="guided-tour"
      className="pointer-events-auto w-full rounded-xl border border-electric/50 bg-[linear-gradient(160deg,var(--tint-cool),color-mix(in_srgb,var(--panel)_96%,transparent)_55%)] p-4 shadow-[0_18px_50px_-20px_var(--shadow)] backdrop-blur-md">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] font-medium text-electric">Guided exploration · step {index + 1} of {steps.length}</p>
        <button type="button" onClick={onClose} className="rounded p-1 text-text-3 hover:text-text" aria-label="Skip the guided exploration"><Icon name="close" size={16} /></button>
      </div>
      <ol aria-hidden className="mt-2 flex gap-1">
        {steps.map((s, i) => <li key={s.id} className={`h-1 flex-1 rounded-full ${i <= index ? "bg-electric" : "bg-line-strong/70"}`} />)}
      </ol>
      {/* the new step mounts immediately (no exit wait), so focus can move to its heading */}
      <motion.div key={step.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DUR.base, ease: EASE }}>
          <h3 ref={head} tabIndex={-1} className="subhead mt-3 text-[17px] focus:outline-none" data-testid="tour-title">{step.title}</h3>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-text-2">{step.body}</p>
          {step.task && (
            <p className={`mt-2 flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-[13px] ${done ? "border-ok/60 text-ok" : "border-flame/50 text-text"}`} data-testid="tour-task" aria-live="polite">
              <span aria-hidden>{done ? "✓" : "→"}</span><span>{done ? "Done. " : "Your turn: "}{step.task.prompt}</span>
            </p>
          )}
          {step.sources && step.sources.length > 0 && (
            <ul className="mt-2 flex flex-col gap-0.5 text-[12px]">
              {step.sources.map((s) => <li key={s.href + s.label}><a href={s.href} target={s.external ? "_blank" : undefined} rel="noreferrer">{s.label}</a></li>)}
            </ul>
          )}
      </motion.div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => onIndex(index - 1)} disabled={index === 0}
          className="press inline-flex min-h-9 items-center rounded-lg border border-line-strong px-3 text-sm text-text disabled:opacity-40">Back</button>
        {last ? (
          <button type="button" onClick={onClose} className="press inline-flex min-h-9 items-center rounded-lg bg-electric px-3.5 text-sm font-semibold text-void">Finish</button>
        ) : (
          <button type="button" onClick={() => onIndex(index + 1)} data-testid="tour-next"
            className="press inline-flex min-h-9 items-center gap-1 rounded-lg bg-electric px-3.5 text-sm font-semibold text-void">Next<Icon name="chevron" size={14} /></button>
        )}
        <button type="button" onClick={() => onIndex(0)} className="press inline-flex min-h-9 items-center rounded-lg px-2.5 text-[13px] text-text-2 hover:text-text">Restart</button>
        <button type="button" onClick={onClose} className="press ml-auto inline-flex min-h-9 items-center rounded-lg px-2.5 text-[13px] text-text-3 hover:text-text">Skip tour</button>
      </div>
    </section>
  );
}
