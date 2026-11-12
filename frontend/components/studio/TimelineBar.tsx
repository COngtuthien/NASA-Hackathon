"use client";

import { useId, type ReactNode } from "react";
import { goToStage, stageAt, useTimeline, type Stage, type TimelineStore } from "@/lib/timeline";

/**
 * Play / pause / replay / scrub / speed for an ILLUSTRATIVE sequence. The axis is normalized progress, never seconds
 * of a test; a measured duration (if any) is shown separately by the caller as `measured`.
 */
export default function TimelineBar({ store, stages, title, caveat, measured, children }: {
  store: TimelineStore; stages: Stage[]; title: string; caveat: string; measured?: ReactNode;
  /** Stage explanation (Phase 10). Passed as a stable element, so it re-renders on stage changes only. */
  children?: ReactNode;
}) {
  const t = useTimeline(store);
  const id = useId();
  const stage = stageAt(stages, t.p);
  const pct = Math.round(t.p * 100);
  const idx = stages.findIndex((s) => s.id === stage.id);

  function play() {
    if (t.p >= 1) store.set({ p: 0, playing: true, active: true });
    else store.set({ playing: !t.playing, active: true });
  }

  return (
    <section aria-labelledby={`${id}-t`} className="rounded-xl border border-line/80 bg-ink/60 p-3" data-testid="timeline">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`${id}-t`} className="subhead text-[14.5px]">{title}</h3>
        <p className="rounded border border-warn/50 px-1.5 py-px text-[11.5px] font-medium text-warn" data-testid="timeline-caveat">{caveat}</p>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" onClick={play} data-testid="timeline-play" aria-label={t.playing ? "Pause" : t.p >= 1 ? "Replay" : "Play"}
          className="press inline-flex h-9 min-w-[76px] items-center justify-center gap-1.5 rounded-lg bg-flame px-3 text-sm font-semibold text-flame-ink">
          {t.playing ? "Pause" : t.p >= 1 ? "Replay" : "Play"}
        </button>
        <button type="button" onClick={() => store.set({ p: 0, playing: false, active: true })} data-testid="timeline-reset"
          className="press inline-flex h-9 items-center rounded-lg border border-line-strong px-3 text-sm text-text-2 hover:text-text">Restart</button>
        <span className="inline-flex rounded-lg border border-line-strong" role="group" aria-label="Step through the stages">
          <button type="button" onClick={() => goToStage(store, stages, t.active ? idx - 1 : 0)} disabled={t.active && idx === 0} data-testid="stage-prev"
            aria-label="Previous stage" className="press inline-flex h-9 items-center px-2.5 text-sm text-text-2 hover:text-text disabled:opacity-40">‹ Prev</button>
          <button type="button" onClick={() => goToStage(store, stages, t.active ? idx + 1 : 0)} disabled={t.active && idx === stages.length - 1} data-testid="stage-next"
            aria-label="Next stage" className="press inline-flex h-9 items-center border-l border-line-strong px-2.5 text-sm text-text-2 hover:text-text disabled:opacity-40">Next ›</button>
        </span>
        <label className="flex items-center gap-1.5 text-[12.5px] text-text-2">Speed
          <select value={t.speed} onChange={(e) => store.set({ speed: Number(e.target.value) })} data-testid="timeline-speed"
            className="min-h-8 rounded-md border border-line-strong bg-ink px-1.5 text-[12.5px] text-text">
            {[0.5, 1, 2].map((v) => <option key={v} value={v}>{v}×</option>)}
          </select>
        </label>
        {t.active && (
          <button type="button" onClick={() => store.set({ active: false, playing: false })}
            className="press ml-auto inline-flex h-9 items-center rounded-lg px-2.5 text-[12.5px] text-text-3 hover:text-text">Exit timeline</button>
        )}
      </div>
      <div className="relative mt-3">
        <div aria-hidden className="flex h-1.5 overflow-hidden rounded-full bg-raised">
          {stages.map((s) => (
            <span key={s.id} className={`h-full border-r border-ink last:border-r-0 ${s.id === stage.id && t.active ? "bg-flame/70" : "bg-line-strong/60"}`}
              style={{ width: `${(s.to - s.from) * 100}%` }} />
          ))}
        </div>
        <label htmlFor={`${id}-r`} className="sr-only">Illustrative progress (percent of the conceptual sequence)</label>
        <input id={`${id}-r`} type="range" min={0} max={100} step={1} value={pct} data-testid="timeline-scrub"
          onChange={(e) => store.set({ p: Number(e.target.value) / 100, playing: false, active: true })}
          aria-valuetext={`${pct} percent, stage: ${stage.label}`} className="mt-1 w-full accent-[var(--flame)]" />
        <ol className="mt-0.5 flex text-[10.5px] text-text-3" aria-label="Stages">
          {stages.map((s) => (
            <li key={s.id} style={{ width: `${(s.to - s.from) * 100}%` }} className="min-w-0">
              <button type="button" onClick={() => store.set({ p: s.from + 0.001, playing: false, active: true })} aria-current={s.id === stage.id && t.active ? "step" : undefined}
                className={`block min-h-6 w-full truncate text-left hover:text-text ${s.id === stage.id && t.active ? "font-medium text-flame" : ""}`} title={s.label}>{s.label}</button>
            </li>
          ))}
        </ol>
      </div>
      {children ?? (
        <p className="mt-2 text-[13px] leading-snug text-text-2" aria-live="polite" data-testid="timeline-stage">
          <b className="text-text">{t.active ? stage.label : "Timeline off"}:</b> {t.active ? stage.text : "Press Play or drag the slider to step through the conceptual sequence."}
        </p>
      )}
      {measured && <div className="mt-2 border-t border-line/70 pt-2 text-[12.5px] text-text-2">{measured}</div>}
    </section>
  );
}
