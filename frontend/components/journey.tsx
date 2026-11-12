"use client";

// "Discover SpaceFire" journey card (Phase 9). An inline, non-modal card that appears only while the URL carries a
// `journey` step; it never covers the 3D scene. Back / Next / End are links or URL updates, so browser history,
// reloads and deep links all work. Keyboard: focus moves to the step heading when the step changes.
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import {
  isStep, isTopic, JOURNEY_STEPS, journeyHref, nextStep, prevStep, stepNumber, TOPIC_OF_PAGE, TOPICS, type JourneyStep, type Topic,
} from "@/lib/journey";

export function useJourney(): { step: JourneyStep | null; topic: Topic | null } {
  const sp = useSearchParams();
  const pathname = usePathname();
  const s = sp.get("journey");
  const t = sp.get("topic");
  return { step: isStep(s) ? s : null, topic: isTopic(t) ? t : TOPIC_OF_PAGE[pathname] ?? null };
}

/** Navigate to a journey step. On the same page the other parameters (record, mode, component) are kept. */
export function useJourneyNav() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  return (step: JourneyStep, topic: Topic | null) => {
    const href = journeyHref(step, topic);
    const url = new URL(href, window.location.origin);
    if (url.pathname === pathname && url.pathname !== "/") {
      const n = new URLSearchParams(sp.toString());
      url.searchParams.forEach((v, k) => n.set(k, v));
      if (!url.searchParams.has("view") && n.get("view") === "nasa") n.delete("view");
      router.replace(`${pathname}?${n.toString()}${url.hash}`, { scroll: false });
      requestAnimationFrame(() => document.getElementById(url.hash.slice(1))?.scrollIntoView({ block: "start" }));
    } else {
      router.push(href);
    }
  };
}

/** Leave the journey: drop its parameters and stay on the current page. */
export function useEndJourney() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  return () => {
    const n = new URLSearchParams(sp.toString());
    n.delete("journey"); n.delete("topic");
    if (n.get("from") === "journey") n.delete("from");
    const q = n.toString();
    router.replace(`${pathname}${q ? `?${q}` : ""}`, { scroll: false });
  };
}

export function JourneyProgress({ step }: { step: JourneyStep }) {
  const n = stepNumber(step);
  return (
    <div className="flex items-center gap-3">
      <p className="text-[12px] font-medium text-electric">Discover SpaceFire · step {n} of {JOURNEY_STEPS.length}</p>
      <div role="progressbar" aria-label="Journey progress" aria-valuemin={1} aria-valuemax={JOURNEY_STEPS.length} aria-valuenow={n}
        aria-valuetext={`Step ${n} of ${JOURNEY_STEPS.length}`} className="flex flex-1 gap-1" data-testid="journey-progress">
        {JOURNEY_STEPS.map((s, i) => <span key={s} className={`h-1 flex-1 rounded-full ${i < n ? "bg-electric" : "bg-line-strong/70"}`} />)}
      </div>
    </div>
  );
}

export function JourneyCard({ step, topic, title, children, task, done, onAction, actionLabel, hideNext = false, className = "" }: {
  step: JourneyStep; topic: Topic | null; title: string; children?: ReactNode; task?: string; done?: boolean;
  onAction?: () => void; actionLabel?: string; hideNext?: boolean; className?: string;
}) {
  const head = useRef<HTMLHeadingElement>(null);
  const go = useJourneyNav();
  const end = useEndJourney();
  useEffect(() => { head.current?.focus({ preventScroll: true }); }, [step]);
  const prev = prevStep(step);
  const next = nextStep(step);
  return (
    <section aria-labelledby="journey-title" data-testid="journey-card" data-step={step}
      onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); end(); } }}
      className={`rounded-xl border border-electric/50 bg-[linear-gradient(160deg,rgba(91,140,255,0.13),rgba(10,20,36,0.94)_60%)] p-4 ${className}`}>
      <JourneyProgress step={step} />
      <h2 id="journey-title" ref={head} tabIndex={-1} className="subhead mt-2.5 text-[18px] focus:outline-none">{title}</h2>
      {children && <div className="mt-1 max-w-[70ch] text-[14px] leading-relaxed text-text-2">{children}</div>}
      {task && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className={`flex items-start gap-2 py-1 text-[13.5px] ${done ? "text-ok" : "text-text"}`} aria-live="polite" data-testid="journey-task">
            <span aria-hidden>{done ? "✓" : "→"}</span><span>{done ? "Done. " : "Try it: "}{task}</span>
          </p>
          {onAction && !done && (
            <button type="button" onClick={onAction} data-testid="journey-action"
              className="press inline-flex min-h-9 items-center rounded-lg border border-electric/60 px-3 text-[13.5px] text-text hover:bg-electric/10">{actionLabel ?? "Do it for me"}</button>
          )}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {prev && (
          <button type="button" onClick={() => go(prev, topic)} className="press inline-flex min-h-9 items-center rounded-lg border border-line-strong px-3 text-sm text-text">Back</button>
        )}
        {next && !hideNext && (
          <button type="button" onClick={() => go(next, topic)} data-testid="journey-next"
            className="press inline-flex min-h-9 items-center gap-1 rounded-lg bg-electric px-3.5 text-sm font-semibold text-void">Next<Icon name="chevron" size={14} /></button>
        )}
        <button type="button" onClick={end} data-testid="journey-exit" className="press ml-auto inline-flex min-h-9 items-center rounded-lg px-2.5 text-[13px] text-text-3 hover:text-text">End the journey</button>
      </div>
    </section>
  );
}

/** Step 7: where to go next. */
export function JourneyFinish({ topic }: { topic: Topic | null }) {
  const others = (Object.keys(TOPICS) as Topic[]).filter((t) => t !== topic);
  return (
    <JourneyCard step="next" topic={topic} title="Keep exploring">
      <p>You have seen a model, compared it with NASA evidence and drafted a question. Where next?</p>
      <ul className="mt-2 flex flex-col gap-1.5 text-[14px]" data-testid="journey-finish">
        <li><Link href="/">Return Home</Link></li>
        {others.map((t) => <li key={t}><Link href={journeyHref("model", t)}>Explore {TOPICS[t].label.toLowerCase()} ({TOPICS[t].source})</Link></li>)}
        {topic && <li><Link href={`${TOPICS[topic].page}#data`}>View the detailed {TOPICS[topic].source} measurements</Link></li>}
      </ul>
    </JourneyCard>
  );
}
