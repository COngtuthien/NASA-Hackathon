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
 * Keyboard and screen-reader route to everything the 3D view shows: every component is a button here, and the
 * selected one is explained with its provenance and sources.
 */
export default function LabExplanationPanel({ scene, mode, selected, onSelect, record }: {
  scene: LabScene; mode: Mode; selected: string | null; onSelect: (id: string | null) => void;
  record: { uid: string; label: string } | null;
}) {
  const comp = scene.components.find((c) => c.id === selected) ?? null;
  return (
    <div className="flex flex-col gap-5" data-testid="lab-explain">
      <div>
        <p className="text-[12.5px] font-medium text-text-3" id="comp-list-label">Components (select to inspect)</p>
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-labelledby="comp-list-label">
          {scene.components.map((c) => {
            const on = c.id === selected;
            return (
              <li key={c.id}>
                <button type="button" aria-pressed={on} onClick={() => onSelect(on ? null : c.id)} data-component={c.id}
                  className={`press rounded-full border px-3 py-1 text-[13px] ${on ? "border-flame bg-flame text-flame-ink font-medium" : "border-line-strong/80 text-text-2 hover:border-flame/60 hover:text-text"}`}>
                  {c.label}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div aria-live="polite" className="min-h-[120px]">
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
            <motion.p key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-xl border border-dashed border-line-strong px-4 py-5 text-sm text-text-2">
              Select a component, either here or by clicking it in the 3D view, to see what it is, what is confirmed by NASA sources and what is drawn for illustration.
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <section aria-labelledby="mode-h" className="rounded-xl border border-line/80 p-4 text-[13px] leading-relaxed text-text-2">
        <h3 id="mode-h" className="subhead text-[15px] text-text">How to read this view</h3>
        <dl className="mt-2 flex flex-col gap-2">
          {(Object.keys(MODES) as Mode[]).map((m) => (
            <div key={m}><dt className={`font-medium ${m === mode ? "text-flame" : "text-text"}`}>{MODES[m].label}{m === mode ? " (current)" : ""}</dt><dd>{MODES[m].note}</dd></div>
          ))}
        </dl>
        <p className="mt-3 flex flex-wrap gap-1.5">{(Object.keys(BASIS_LABEL) as Basis[]).map((b) => <span key={b} className="inline-flex items-center gap-1.5"><BasisBadge basis={b} /><span className="text-[12px] text-text-3">{BASIS_LABEL[b].note}.</span></span>)}</p>
        <p className="mt-3 text-[12.5px] text-text-3">{NO_VALIDATED_MODEL}</p>
        <p className="mt-2 text-[12.5px]"><Link href={scene.phenomenonHref}>Full analysis: {scene.phenomenonTitle}</Link> · <Link href="/methodology">Methodology</Link></p>
      </section>
    </div>
  );
}
