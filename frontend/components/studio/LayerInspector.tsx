"use client";

import Link from "next/link";
import { Icon } from "@/components/icons";
import { AnimatePresence, DUR, EASE, motion } from "@/components/motion";
import { copilotHref } from "@/lib/lab-copilot";
import type { LabScene } from "@/lib/lab-models";
import { BASIS_LABEL, MODES, NO_VALIDATED_MODEL, type Basis, type Mode } from "@/lib/lab-scientific-metadata";

export function BasisBadge({ basis }: { basis: Basis }) {
  const b = BASIS_LABEL[basis];
  return <span title={b.note} className={`inline-flex items-center rounded border px-1.5 py-px text-[11.5px] font-medium ${b.cls}`}>{b.label}</span>;
}

/**
 * Every component of the scene as keyboard-operable rows: select (focuses the camera and dims the rest),
 * show / hide, isolate the selection, show all. The selected component is explained with its provenance.
 */
export default function LayerInspector({ scene, mode, selected, onSelect, hidden, setHidden, isolate, setIsolate, record, unavailable = [] }: {
  scene: LabScene; mode: Mode; selected: string | null; onSelect: (id: string | null) => void;
  hidden: string[]; setHidden: (h: string[]) => void; isolate: boolean; setIsolate: (v: boolean) => void;
  record: { uid: string; label: string } | null;
  /** Components not drawn in the current state (e.g. soot for methanol), with the reason. */
  unavailable?: { id: string; reason: string }[];
}) {
  const comp = scene.components.find((c) => c.id === selected) ?? null;
  const why = (id: string) => unavailable.find((u) => u.id === id)?.reason;
  return (
    <div className="flex flex-col gap-4" data-testid="lab-explain">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12.5px] font-medium text-text-3" id="layer-list-label">Layers: select to focus, or hide</p>
        <div className="flex gap-1.5">
          <button type="button" aria-pressed={isolate} disabled={!selected} onClick={() => setIsolate(!isolate)} data-testid="isolate"
            className={`press rounded-full border px-2.5 py-0.5 text-[12px] disabled:opacity-40 ${isolate ? "border-flame bg-flame/15 text-text" : "border-line-strong text-text-2 hover:text-text"}`}>Isolate selected</button>
          <button type="button" onClick={() => { setHidden([]); setIsolate(false); }} data-testid="show-all"
            className="press rounded-full border border-line-strong px-2.5 py-0.5 text-[12px] text-text-2 hover:text-text">Show all</button>
        </div>
      </div>
      <ul className="flex flex-col gap-1" aria-labelledby="layer-list-label">
        {scene.components.map((c) => {
          const on = c.id === selected;
          const off = hidden.includes(c.id);
          const na = why(c.id);
          return (
            <li key={c.id} className={`flex items-center gap-2 rounded-lg border px-2 py-1 ${on ? "border-flame/70 bg-flame/[0.08]" : "border-line/70"}`}>
              <button type="button" aria-pressed={on} onClick={() => onSelect(on ? null : c.id)} data-component={c.id}
                className={`press min-w-0 flex-1 text-left text-[13.5px] ${on ? "font-medium text-text" : off ? "text-text-3 line-through" : "text-text-2 hover:text-text"}`}>
                {c.label}
                {na && <span className="ml-1.5 text-[11.5px] font-normal text-text-3 no-underline">({na})</span>}
              </button>
              <span className="hidden sm:inline"><BasisBadge basis={c.basis} /></span>
              <button type="button" aria-pressed={!off} aria-label={`${off ? "Show" : "Hide"} ${c.label}`} data-layer-toggle={c.id}
                onClick={() => setHidden(off ? hidden.filter((h) => h !== c.id) : [...hidden, c.id])}
                className={`press rounded-md border px-1.5 py-0.5 text-[11.5px] ${off ? "border-line-strong text-text-3" : "border-data/50 text-data"}`}>{off ? "Hidden" : "Shown"}</button>
            </li>
          );
        })}
      </ul>

      <div aria-live="polite" className="min-h-[110px]">
        <AnimatePresence mode="wait" initial={false}>
          {comp ? (
            <motion.article key={comp.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              transition={{ duration: DUR.base, ease: EASE }} className="rounded-xl border border-line/80 bg-ink/60 p-4" data-testid="component-detail">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="subhead text-[17px]">{comp.label}</h3>
                <BasisBadge basis={comp.basis} />
              </div>
              <p className="mt-2 text-[14px] leading-relaxed text-text">{comp.summary}</p>
              <p className="mt-2 text-[13px] leading-relaxed text-text-2"><span className="text-text-3">What is confirmed and what is drawn: </span>{comp.provenance}</p>
              <ul className="mt-3 flex flex-col gap-1 text-[13px]">
                {comp.sources.map((s) => (
                  <li key={s.href + s.label}><a href={s.href} target={s.external ? "_blank" : undefined} rel="noreferrer" className="inline-flex items-start gap-1">
                    <Icon name="documents" size={14} className="mt-0.5 shrink-0" />{s.label}</a></li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Link href={copilotHref(scene, comp, record)} data-testid="ask-ai"
                  className="press inline-flex min-h-9 items-center gap-2 rounded-lg border border-electric/60 bg-electric/10 px-3.5 text-sm text-text no-underline hover:border-electric hover:no-underline">
                  <Icon name="assistant" />Ask AI about this
                </Link>
                <span className="text-[12px] text-text-3">Opens Research Copilot with a draft question. Nothing is sent until you press Ask.</span>
              </div>
            </motion.article>
          ) : (
            <motion.p key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-xl border border-dashed border-line-strong px-4 py-4 text-sm text-text-2">
              Select a layer here or click it in the 3D view. The camera moves to it, other layers fade, and its explanation and NASA sources appear here.
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <details className="rounded-xl border border-line/80 p-3 text-[13px] leading-relaxed text-text-2">
        <summary className="cursor-pointer text-text">How to read this view</summary>
        <dl className="mt-2 flex flex-col gap-2">
          {(Object.keys(MODES) as Mode[]).map((m) => (
            <div key={m}><dt className={`font-medium ${m === mode ? "text-flame" : "text-text"}`}>{MODES[m].label}{m === mode ? " (current)" : ""}</dt><dd>{MODES[m].note}</dd></div>
          ))}
        </dl>
        <p className="mt-3 flex flex-wrap gap-1.5">{(Object.keys(BASIS_LABEL) as Basis[]).map((b) => <span key={b} className="inline-flex items-center gap-1.5"><BasisBadge basis={b} /><span className="text-[12px] text-text-3">{BASIS_LABEL[b].note}.</span></span>)}</p>
        <p className="mt-3 text-[12.5px] text-text-3">{NO_VALIDATED_MODEL}</p>
      </details>
    </div>
  );
}
