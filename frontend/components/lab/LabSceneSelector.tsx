"use client";

import { Icon } from "@/components/icons";
import { DUR, EASE, motion } from "@/components/motion";
import { SCENES, type SceneId } from "@/lib/lab-models";

const ICON: Record<SceneId, string> = { flex: "droplet", bass: "solid", saffire: "fire" };

/** Three experiences as a radio group: arrow keys move between them (roving focus), Enter/Space or click selects. */
export default function LabSceneSelector({ value, onChange }: { value: SceneId; onChange: (id: SceneId) => void }) {
  function onKey(e: React.KeyboardEvent, i: number) {
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = SCENES[(i + d + SCENES.length) % SCENES.length];
    onChange(next.id);
    requestAnimationFrame(() => document.getElementById(`lab-scene-${next.id}`)?.focus());
  }
  return (
    <div role="radiogroup" aria-label="Choose an experiment to explore" className="grid grid-cols-3 gap-2">
      {SCENES.map((s, i) => {
        const on = s.id === value;
        return (
          <button key={s.id} id={`lab-scene-${s.id}`} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1}
            onClick={() => onChange(s.id)} onKeyDown={(e) => onKey(e, i)}
            className={`press relative flex items-start gap-3 overflow-hidden rounded-xl border px-2.5 py-2 text-left sm:px-3.5 sm:py-3 ${
              on ? "border-flame/70 text-text" : "border-line/80 bg-panel/60 text-text-2 hover:border-line-strong hover:text-text"}`}>
            {on && <motion.span layoutId="lab-scene-active" aria-hidden className="absolute inset-0 bg-[linear-gradient(140deg,rgba(255,138,61,0.16),rgba(16,30,51,0.85)_60%)]"
              transition={{ duration: DUR.base, ease: EASE }} />}
            <span className={`relative mt-0.5 hidden h-8 w-8 shrink-0 place-items-center rounded-lg border sm:grid ${on ? "border-flame/60 text-flame" : "border-line-strong text-text-3"}`}>
              <Icon name={ICON[s.id]} size={17} />
            </span>
            <span className="relative min-w-0">
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className="subhead text-[13px] leading-tight sm:text-[15.5px]">{s.title}</span>
                <span className="text-[11.5px] text-text-3">{s.source}<span className="hidden sm:inline"> · {s.inv}</span></span>
              </span>
              <span className="mt-0.5 hidden text-[12.5px] leading-snug text-text-3 sm:block">{s.scale}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
