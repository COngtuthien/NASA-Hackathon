"use client";

// Glossary terms (Phase 9). A dotted-underlined term opens a small, non-modal definition on click, tap, Enter or
// Space; Escape closes it and returns focus, as does a click outside. The popover is kept inside the viewport.
// Used sparingly (a few terms per page); the full list lives on Methodology (#glossary).
import Link from "next/link";
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Disclosure } from "@/components/disclosure";
import { GLOSSARY, GLOSSARY_BY_ID } from "@/lib/glossary";

export function Term({ id, children }: { id: string; children?: ReactNode }) {
  const g = GLOSSARY_BY_ID[id];
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLSpanElement>(null);
  const popId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  // keep the popover inside the viewport (16 px gutter)
  useLayoutEffect(() => {
    const p = pop.current;
    if (!open || !p) return;
    // shift with `left` (a layout property), so the unshifted box never widens the page on mobile
    const anchor = wrap.current!.getBoundingClientRect().left;
    const vw = document.documentElement.clientWidth;
    const w = p.offsetWidth;
    let x = 0;
    if (anchor + w > vw - 16) x = vw - 16 - w - anchor;
    if (anchor + x < 16) x = 16 - anchor;
    p.style.left = `${x}px`;
  }, [open]);

  if (!g) return <>{children}</>;
  return (
    <span ref={wrap} className="relative inline">
      <button ref={btn} type="button" aria-expanded={open} aria-controls={popId} onClick={() => setOpen(!open)} data-testid="glossary-term"
        className="cursor-help text-inherit underline decoration-text-3 decoration-dotted underline-offset-4 hover:decoration-text">
        {children ?? g.term}<span className="sr-only"> (definition)</span>
      </button>
      <span ref={pop} id={popId} role="dialog" aria-label={`${g.term}: definition`} hidden={!open} data-testid="glossary-popover"
        className="absolute left-0 top-full z-50 mt-2 block w-[min(320px,calc(100vw-32px))] rounded-xl border border-line-strong bg-panel p-3 text-left text-[13.5px] font-normal leading-relaxed text-text-2 shadow-2xl">
        <span className="block font-semibold text-text">{g.term}</span>
        <span className="mt-1 block">{g.short}</span>
        {g.caveat && <span className="mt-1.5 block text-[12.5px] text-text-3"><span className="text-warn">Note: </span>{g.caveat}</span>}
        <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12.5px]">
          {g.source && <a href={g.source.href} target={g.source.external ? "_blank" : undefined} rel="noreferrer">{g.source.label}</a>}
          <Link href={`/methodology#glossary-${g.id}`}>All terms</Link>
        </span>
      </span>
    </span>
  );
}

/** The full glossary, for Methodology. Each term has its own anchor so popovers can link to it. */
export function GlossaryList() {
  return (
    <Disclosure id="glossary" anchors={GLOSSARY.map((g) => `glossary-${g.id}`)} title="Glossary" action="Show the glossary"
      summary={`${GLOSSARY.length} terms used across SpaceFire, in plain language, with their caveats.`}>
      <dl className="grid gap-4 md:grid-cols-2">
        {GLOSSARY.map((g) => (
          <div key={g.id} id={`glossary-${g.id}`} className="scroll-mt-36">
            <dt className="subhead text-[15.5px]">{g.term}</dt>
            <dd className="mt-1 text-[14px] leading-relaxed text-text-2">{g.short}</dd>
            {g.caveat && <dd className="mt-1 text-[13px] text-text-3">Note: {g.caveat}</dd>}
            {g.source && <dd className="mt-1 text-[13px]"><a href={g.source.href} target={g.source.external ? "_blank" : undefined} rel="noreferrer">{g.source.label}</a></dd>}
          </div>
        ))}
      </dl>
    </Disclosure>
  );
}
