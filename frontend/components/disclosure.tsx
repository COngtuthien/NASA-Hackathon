"use client";

// Progressive disclosure (Phase 8). Three levels across the site:
//   Level 1 Discover: headings, a short explanation, media, a takeaway or two (always visible).
//   Level 2 Explore:  interactive controls, focused charts, comparisons (visible when the user engages).
//   Level 3 Research: full values, raw fields, tables, calculations, methods, sources (behind an explicit,
//                     specific affordance such as "Show raw values" or "View methodology").
// Collapsed content stays mounted but `hidden`, so it is removed from the accessibility tree while filters, selections
// and loaded data survive closing and reopening. A section opens itself when the URL hash points at it.
import Link from "next/link";
import { useEffect, useId, useState, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { Prov } from "@/components/ui";

/**
 * Open when the URL hash names this section, one of its declared inner anchors (content that may render only after
 * its data loads), or any element already inside it; then scroll the target into view once it exists.
 */
function useHashOpen(id: string | undefined, anchors: string[], setOpen: (v: boolean) => void) {
  const key = anchors.join("|");
  useEffect(() => {
    if (!id) return;
    const inner = key ? key.split("|") : [];
    const check = () => {
      const h = decodeURIComponent(window.location.hash.slice(1));
      if (!h) return;
      const target = document.getElementById(h);
      const own = document.getElementById(id);
      if (h === id || inner.includes(h) || (target && own && own.contains(target))) {
        setOpen(true);
        let tries = 0;
        const scroll = () => {
          const t = document.getElementById(h);
          if (t) t.scrollIntoView({ block: "start" });
          else if (tries++ < 40) setTimeout(scroll, 150);
        };
        requestAnimationFrame(scroll);
      }
    };
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, [id, key, setOpen]);
}

/**
 * A titled section whose body is revealed on request. `action` names what opening does ("Show the gas balance"),
 * never a generic "More". `summary` (Level 1) stays visible while closed.
 */
export function Disclosure({ id, title, action, summary, children, defaultOpen = false, level = "research", badge, className = "", anchors = [] }: {
  id?: string; title: ReactNode; action: string; summary?: ReactNode; children: ReactNode; defaultOpen?: boolean;
  level?: "explore" | "research"; badge?: ReactNode; className?: string;
  /** Anchors inside the body (e.g. old section ids) that should open this disclosure when linked to. */
  anchors?: string[];
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  useHashOpen(id, anchors, setOpen);
  return (
    <section id={id} className={`scroll-mt-36 rounded-2xl border border-line/60 bg-panel/50 ${className}`} data-disclosure={open ? "open" : "closed"}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 py-4 md:px-5">
        <div className="min-w-0 max-w-[72ch]">
          <h2 className="subhead flex flex-wrap items-center gap-2 text-[18px]">{title}{badge}</h2>
          {summary && <div className="mt-1 text-[14.5px] leading-relaxed text-text-2">{summary}</div>}
        </div>
        <button type="button" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen(!open)}
          className={`press inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-[13.5px] ${
            level === "explore" ? "border-flame/50 text-text hover:border-flame" : "border-line-strong text-text-2 hover:border-electric/70 hover:text-text"}`}>
          {open ? "Hide" : action}
          <Icon name="chevron" size={14} className={`transition-transform duration-200 ${open ? "-rotate-90" : "rotate-90"}`} />
        </button>
      </div>
      <div id={bodyId} hidden={!open} className="border-t border-line/50 px-4 pb-5 pt-4 md:px-5">{children}</div>
    </section>
  );
}

/** An inline "show more" for a short explanation: one sentence visible, the rest on request. */
export function ReadMore({ children, more, label = "Read the full explanation" }: { children: ReactNode; more: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div>
      <div>{children}</div>
      <div id={id} hidden={!open} className="mt-2">{more}</div>
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}
        className="mt-1.5 text-[13px] text-link hover:underline">{open ? "Show less" : label}</button>
    </div>
  );
}

export type Source = { label: string; href: string; external?: boolean };

/**
 * A short scientific takeaway. The claim and its basis are always visible; the rationale, values, sources and
 * limits open on request.
 */
export function Takeaway({ title, kind, children, sources = [], limits }: {
  title: ReactNode; kind: string; children?: ReactNode; sources?: Source[]; limits?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const hasMore = !!children || sources.length > 0 || !!limits;
  return (
    <li className="flex flex-col gap-1.5 rounded-xl border border-line/60 bg-ink/40 p-4" data-testid="takeaway">
      <p className="text-[15.5px] leading-snug text-text">{title}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Prov kind={kind} />
        {hasMore && (
          <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)} className="text-[13px] text-link hover:underline">
            {open ? "Hide the evidence" : "Why we say this"}
          </button>
        )}
      </div>
      {hasMore && (
        <div id={id} hidden={!open} className="mt-1 flex flex-col gap-2 border-t border-line/50 pt-2 text-[13.5px] leading-relaxed text-text-2">
          {children}
          {limits && <p><span className="text-text-3">Limits: </span>{limits}</p>}
          {sources.length > 0 && (
            <ul className="flex flex-col gap-0.5 text-[13px]">
              {sources.map((s) => <li key={s.href + s.label}>{s.href.startsWith("/") && !s.href.startsWith("/api/") && !s.external
                ? <Link href={s.href}>{s.label}</Link> : <a href={s.href} target={s.external ? "_blank" : undefined} rel="noreferrer">{s.label}</a>}</li>)}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

/** A compact group of key measurements: label, exact value with unit, and provenance. */
export function MeasureGroup({ items, label }: { items: { label: string; value: ReactNode; prov?: string; note?: ReactNode }[]; label?: string }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3" aria-label={label}>
      {items.map((m) => (
        <div key={m.label} className="min-w-0">
          <dt className="text-[12.5px] text-text-3">{m.label}</dt>
          <dd className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[16px] font-medium text-text">{m.value}{m.prov && <Prov kind={m.prov} />}</dd>
          {m.note && <dd className="mt-0.5 text-[12px] leading-snug text-text-3">{m.note}</dd>}
        </div>
      ))}
    </dl>
  );
}

/** A concise, visible data-quality notice with a specific link to the details. */
export function QualityNotice({ children, href, linkLabel = "View the data-quality flags", tone = "warn" }: {
  children: ReactNode; href?: string; linkLabel?: string; tone?: "warn" | "info";
}) {
  return (
    <div role="note" className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-[14px] ${tone === "warn" ? "border-warn/40 bg-warn/[0.05]" : "border-info/40 bg-info/[0.05]"}`}>
      <Icon name="alert" size={17} className={`mt-0.5 shrink-0 ${tone === "warn" ? "text-warn" : "text-info"}`} />
      <div className="min-w-0 text-text-2">
        {children}
        {href && <> {href.startsWith("#") ? <a href={href}>{linkLabel}</a> : <Link href={href}>{linkLabel}</Link>}</>}
      </div>
    </div>
  );
}

/** Section heading used inside long pages: a short title and at most one sentence. */
export function SectionIntro({ id, kicker, title, lead, children }: { id?: string; kicker?: string; title: string; lead?: ReactNode; children?: ReactNode }) {
  return (
    <div id={id} className="scroll-mt-36">
      {kicker && <p className="kicker mb-2">{kicker}</p>}
      <h2 className="subhead text-[22px] md:text-[26px]">{title}</h2>
      {lead && <p className="mt-2 max-w-[65ch] text-[15.5px] leading-relaxed text-text-2">{lead}</p>}
      {children}
    </div>
  );
}
