"use client";

// Phase 11: the immersive (fullscreen) studio. The studio <section> itself becomes the fullscreen element, so the
// one WebGL canvas, the scene, the timeline store and every piece of state stay mounted: nothing is re-created when
// entering or leaving. This file holds the fullscreen hook, the auto-hide wiring (lib/auto-hide.ts) and the overlay
// UI (top bar, playback bar, explanation overlay).
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { Icon } from "@/components/icons";
import { Prov } from "@/components/ui";
import { AUTO_HIDE_MS, CHROME_SELECTOR, createAutoHide, type AutoHide } from "@/lib/auto-hide";
import type { GravityStage, StageInfo } from "@/lib/stages";
import { goToStage, stageAt, useTimeline, type Stage, type TimelineStore } from "@/lib/timeline";

// ------------------------------------------------------------------------------------------- fullscreen --------

export type FsMode = "off" | "native" | "fallback";

type WebkitDoc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void; webkitFullscreenEnabled?: boolean };
type WebkitEl = HTMLElement & { webkitRequestFullscreen?: () => void };

const fsElement = () => document.fullscreenElement ?? (document as WebkitDoc).webkitFullscreenElement ?? null;

function exitNative() {
  const d = document as WebkitDoc;
  try {
    if (document.exitFullscreen) return document.exitFullscreen().catch(() => undefined);
    d.webkitExitFullscreen?.();
  } catch { /* already out of fullscreen */ }
  return undefined;
}

/**
 * Native fullscreen (Fullscreen API) on the studio element, with an in-page expanded fallback when the API is
 * missing or the browser refuses. `notice` says so honestly instead of pretending fullscreen worked.
 */
export function useFullscreen(ref: RefObject<HTMLElement | null>) {
  const [mode, setMode] = useState<FsMode>("off");
  const [notice, setNotice] = useState<string | null>(null);
  const modeRef = useRef<FsMode>("off");
  useEffect(() => { modeRef.current = mode; }, [mode]);

  useEffect(() => {
    const el = ref.current;
    const onChange = () => {
      const fs = fsElement();
      if (fs && fs === el) { setMode("native"); setNotice(null); }
      else if (modeRef.current === "native") setMode("off");      // Esc, browser UI, F11, another element
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
      if (el && fsElement() === el) void exitNative();            // leaving the page while fullscreen
    };
  }, [ref]);

  // The expanded fallback covers the page; the page behind it must not scroll.
  useEffect(() => {
    if (mode !== "fallback") return;
    const h = document.documentElement;
    const prev = h.style.overflow;
    h.style.overflow = "hidden";
    return () => { h.style.overflow = prev; };
  }, [mode]);

  const enter = useCallback(async () => {
    const el = ref.current as WebkitEl | null;
    if (!el) return;
    const d = document as WebkitDoc;
    const supported = (document.fullscreenEnabled ?? d.webkitFullscreenEnabled ?? false) && (!!el.requestFullscreen || !!el.webkitRequestFullscreen);
    if (!supported) {
      setMode("fallback");
      setNotice("Fullscreen isn't available in this browser, so the 3D view is expanded to fill the window instead.");
      return;
    }
    const standard = typeof el.requestFullscreen === "function";
    try {
      if (standard) await el.requestFullscreen({ navigationUI: "hide" });
      else el.webkitRequestFullscreen?.();
      if (fsElement() === el) { setMode("native"); setNotice(null); }
      else if (standard) throw new Error("not fullscreen");
      // (prefixed WebKit: the change event confirms asynchronously)
    } catch {
      setMode("fallback");
      setNotice("The browser declined fullscreen, so the 3D view is expanded to fill the window instead.");
    }
  }, [ref]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 8000);
    return () => clearTimeout(t);
  }, [notice]);

  const exit = useCallback(() => {
    if (modeRef.current === "native" || (ref.current && fsElement() === ref.current)) void exitNative();
    setMode("off");
    setNotice(null);
  }, [ref]);

  return { mode, active: mode !== "off", notice, enter, exit };
}

// ------------------------------------------------------------------------------------------- auto-hide ---------

const ImmersiveCtx = createContext<AutoHide | null>(null);
export const ImmersiveProvider = ImmersiveCtx.Provider;

/** Keep the immersive chrome shown while `on` (e.g. an open popover). No-op outside the immersive studio. */
export function useImmersiveHold(key: string, on: boolean) {
  const ctl = useContext(ImmersiveCtx);
  useEffect(() => {
    if (!ctl) return;
    ctl.hold(key, on);
    return () => ctl.hold(key, false);
  }, [ctl, key, on]);
}

declare global {
  interface Window {
    /** Test override of the inactivity timeout (ms). Production uses AUTO_HIDE_MS. */
    __SPACEFIRE_AUTOHIDE_MS?: number;
    __spacefireImmersive?: { visible: () => boolean; pending: () => number; holds: () => string[]; timeout: number };
  }
}

const INTERNAL_HOLDS = ["press", "hover", "focus", "select"];

/**
 * Wires real user input on the immersive root to the auto-hide controller. Visibility is applied straight to the DOM
 * (`data-chrome` on the root, `inert` on hidden chrome items), so showing and hiding never re-renders React and
 * never touches the 3D scene. Timers and listeners are removed when immersive mode ends or the studio unmounts.
 */
export function useImmersiveChrome(root: RefObject<HTMLElement | null>, active: boolean): AutoHide {
  const [ctl] = useState(() => createAutoHide({
    timeout: typeof window !== "undefined" && typeof window.__SPACEFIRE_AUTOHIDE_MS === "number" ? window.__SPACEFIRE_AUTOHIDE_MS : AUTO_HIDE_MS,
  }));

  useEffect(() => {
    window.__spacefireImmersive = { visible: () => ctl.visible, pending: ctl.pending, holds: ctl.holds, timeout: ctl.timeout };
  }, [ctl]);

  useEffect(() => {
    const el = root.current;
    if (!el || !active) return;
    const items = () => el.querySelectorAll<HTMLElement>("[data-chrome-item]");
    const apply = (v: boolean) => {
      el.setAttribute("data-chrome", v ? "shown" : "hidden");
      items().forEach((n) => { n.inert = !v; });
      // never leave focus on a control that just became hidden
      const a = document.activeElement;
      if (!v && a instanceof HTMLElement && a.closest("[data-chrome-item]")) el.focus({ preventScroll: true });
    };

    let keyboard = false;
    let lastX = NaN, lastY = NaN;
    const pointers = new Set<number>();
    let gesture = false;
    let tap: { x: number; y: number; t: number; wasVisible: boolean } | null = null;

    const inPanel = (t: EventTarget | null) => t instanceof Element && !!t.closest(CHROME_SELECTOR);
    const syncFocus = () => {
      const a = document.activeElement;
      ctl.hold("focus", keyboard && a instanceof Element && el.contains(a) && inPanel(a));
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      if (e.clientX === lastX && e.clientY === lastY) return;     // synthetic moves (layout, scroll) are not activity
      lastX = e.clientX; lastY = e.clientY;
      ctl.hold("hover", e.target instanceof Element && !!e.target.closest("[data-hover-hold]"));
      ctl.activity();
    };
    const onLeave = (e: PointerEvent) => { if (e.pointerType === "mouse") ctl.hold("hover", false); };
    const onDown = (e: PointerEvent) => {
      keyboard = false;
      syncFocus();
      const wasVisible = ctl.visible;
      pointers.add(e.pointerId);
      if (pointers.size > 1) gesture = true;                       // pinch / two-finger gestures never toggle
      tap = e.pointerType === "touch" && pointers.size === 1 && !inPanel(e.target) ? { x: e.clientX, y: e.clientY, t: e.timeStamp, wasVisible } : null;
      if (e.target instanceof HTMLSelectElement) ctl.hold("select", true);
      ctl.hold("press", true);
    };
    const onUp = (e: PointerEvent) => {
      if (!pointers.delete(e.pointerId)) return;
      if (pointers.size > 0) return;
      ctl.hold("press", false);
      const t = tap;
      tap = null;
      const wasGesture = gesture;
      gesture = false;
      if (t && !wasGesture && e.type === "pointerup" && Math.hypot(e.clientX - t.x, e.clientY - t.y) < 12 && e.timeStamp - t.t < 400 && t.wasVisible) {
        ctl.hide();                                                  // a quick tap on the scene dismisses the chrome
      } else ctl.activity();
    };
    const onWheel = () => ctl.activity();
    const onKey = () => {
      keyboard = true;
      ctl.activity();                                                // reveals (and un-inerts) before Tab moves focus
      syncFocus();
    };
    const onFocusIn = () => syncFocus();
    const onFocusOut = (e: FocusEvent) => {
      if (e.target instanceof HTMLSelectElement) ctl.hold("select", false);
      queueMicrotask(syncFocus);
    };
    const onChange = (e: Event) => {
      if (e.target instanceof HTMLSelectElement) { ctl.hold("select", false); ctl.hold("press", false); ctl.activity(); }
    };
    const onVisibility = () => ctl.setPaused(document.visibilityState === "hidden");

    const unsub = ctl.subscribe(apply);
    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("pointerdown", onDown, { capture: true });
    window.addEventListener("pointerup", onUp, { capture: true });
    window.addEventListener("pointercancel", onUp, { capture: true });
    el.addEventListener("wheel", onWheel, { passive: true });
    document.addEventListener("keydown", onKey, { capture: true });
    el.addEventListener("focusin", onFocusIn);
    el.addEventListener("focusout", onFocusOut);
    el.addEventListener("change", onChange, { capture: true });
    document.addEventListener("visibilitychange", onVisibility);
    ctl.setEnabled(true);
    apply(ctl.visible);
    return () => {
      unsub();
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("pointerdown", onDown, { capture: true });
      window.removeEventListener("pointerup", onUp, { capture: true });
      window.removeEventListener("pointercancel", onUp, { capture: true });
      el.removeEventListener("wheel", onWheel);
      document.removeEventListener("keydown", onKey, { capture: true });
      el.removeEventListener("focusin", onFocusIn);
      el.removeEventListener("focusout", onFocusOut);
      el.removeEventListener("change", onChange, { capture: true });
      document.removeEventListener("visibilitychange", onVisibility);
      for (const k of INTERNAL_HOLDS) ctl.hold(k, false);
      ctl.setPaused(false);
      ctl.setEnabled(false);                                         // clears the pending timer, chrome shown
      el.setAttribute("data-chrome", "shown");
      items().forEach((n) => { n.inert = false; });
    };
  }, [root, active, ctl]);

  return ctl;
}

// ------------------------------------------------------------------------------------------- UI ----------------

function BarButton({ label, onClick, pressed, expanded, controls, icon, children, testId, showLabel = "sm" }: {
  label: string; onClick: () => void; pressed?: boolean; expanded?: boolean; controls?: string; icon: string; children?: ReactNode; testId?: string;
  showLabel?: "always" | "sm" | "never";
}) {
  const on = pressed ?? expanded ?? false;
  return (
    <button type="button" onClick={onClick} aria-pressed={pressed} aria-expanded={expanded} aria-controls={controls} data-testid={testId}
      aria-label={showLabel === "always" ? undefined : label} title={label}
      className={`press inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-[13px] backdrop-blur-md ${
        on ? "border-flame/80 bg-flame/20 text-text" : "border-line-strong/80 bg-void/70 text-text-2 hover:border-flame/60 hover:text-text"}`}>
      <Icon name={icon} size={17} />
      {showLabel !== "never" && <span className={showLabel === "sm" ? "hidden sm:inline" : ""}>{children ?? label}</span>}
    </button>
  );
}

/** Top bar: what is shown (investigation, mode) and the independent toggles. Auto-hides. */
export function ImmersiveTopBar({ title, source, modeLabel, modeTone, context, controlsOpen, onControls, explainOpen, onExplain, labelsOn, onLabels,
  onExit, panelId, explainId }: {
  title: string; source: string; modeLabel: string; modeTone: "warn" | "data"; context?: string | null;
  controlsOpen: boolean; onControls: () => void; explainOpen: boolean; onExplain: () => void; labelsOn: boolean; onLabels: () => void;
  onExit: () => void; panelId: string; explainId: string;
}) {
  return (
    <div data-chrome-item data-hover-hold data-testid="fs-topbar"
      className="sf-chrome absolute left-0 right-[var(--fs-right,0px)] top-0 z-[60] flex flex-wrap items-start gap-2 bg-[linear-gradient(180deg,rgba(5,10,20,0.88),rgba(5,10,20,0.55)_60%,transparent)] px-3 pb-8 pt-3 md:px-4">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-text"><span className="text-text-3">{source} · </span>{title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
          <span data-testid="fs-mode" className={`rounded-full border px-2 py-px font-medium ${modeTone === "warn" ? "border-warn/60 text-warn" : "border-data/60 text-data"}`}>{modeLabel}</span>
          {context && <span className="min-w-0 max-w-full truncate text-text-2" title={context} data-testid="fs-context">{context}</span>}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5" role="toolbar" aria-label="Fullscreen studio">
        <BarButton label="Controls" icon="sliders" expanded={controlsOpen} controls={panelId} onClick={onControls} testId="fs-controls" />
        <BarButton label="Explanations" icon="info" expanded={explainOpen} controls={explainId} onClick={onExplain} testId="fs-explain" />
        <BarButton label="Part labels" icon="tag" pressed={labelsOn} onClick={onLabels} testId="fs-labels" />
        <BarButton label="Exit fullscreen" icon="fullscreen-exit" onClick={onExit} testId="fs-exit" />
      </div>
    </div>
  );
}

/** The honest "fullscreen was declined / unavailable" message: a short-lived toast, never over the explanation. */
export function ImmersiveNotice({ text }: { text: string | null }) {
  return (
    <p role="status" aria-live="polite" data-testid="fs-notice" hidden={!text}
      className="pointer-events-none absolute left-1/2 top-[92px] z-[65] w-[min(92%,520px)] -translate-x-1/2 rounded-lg border border-warn/50 bg-void/90 px-3 py-2 text-center text-[12.5px] text-warn shadow-lg backdrop-blur-md sm:bottom-[118px] sm:top-auto">
      {text}
    </p>
  );
}

const ctrl = "press inline-flex h-10 min-w-10 items-center justify-center rounded-lg border border-line-strong/80 bg-void/60 px-2 text-[13px] text-text-2 hover:border-flame/60 hover:text-text disabled:opacity-40";

/** Compact playback bar for an illustrative timeline (FLEX, BASS-II): the same store as the timeline below the page. */
export function ImmersivePlayback({ store, stages, caveat }: { store: TimelineStore; stages: Stage[]; caveat: string }) {
  const t = useTimeline(store);
  const id = useId();
  const stage = stageAt(stages, t.p);
  const idx = stages.findIndex((s) => s.id === stage.id);
  const pct = Math.round(t.p * 100);
  const play = () => (t.p >= 1 ? store.set({ p: 0, playing: true, active: true }) : store.set({ playing: !t.playing, active: true }));
  return (
    <div data-chrome-item data-hover-hold data-testid="fs-playback" role="group" aria-label="Playback"
      className="sf-chrome absolute bottom-0 left-0 right-[var(--fs-right,0px)] z-[60] bg-[linear-gradient(0deg,rgba(5,10,20,0.92),rgba(5,10,20,0.6)_65%,transparent)] px-3 pb-3 pt-8 md:px-4">
      <div className="relative">
        <div aria-hidden className="flex h-1.5 overflow-hidden rounded-full bg-raised/80">
          {stages.map((s) => (
            <span key={s.id} className={`h-full border-r border-ink last:border-r-0 ${t.active && s.id === stage.id ? "bg-flame/80" : "bg-line-strong/70"}`} style={{ width: `${(s.to - s.from) * 100}%` }} />
          ))}
        </div>
        <label htmlFor={`${id}-r`} className="sr-only">Illustrative progress (percent of the conceptual sequence)</label>
        <input id={`${id}-r`} type="range" min={0} max={100} step={1} value={pct} data-testid="fs-scrub"
          onChange={(e) => store.set({ p: Number(e.target.value) / 100, playing: false, active: true })}
          aria-valuetext={`${pct} percent, stage: ${stage.label}`} className="mt-1 block h-5 w-full cursor-pointer accent-[var(--flame)]" />
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={play} data-testid="fs-play" aria-label={t.playing ? "Pause" : t.p >= 1 ? "Replay" : "Play"}
          className="press inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-lg bg-flame px-3 text-[13.5px] font-semibold text-flame-ink">
          <Icon name={t.playing ? "pause" : t.p >= 1 ? "restart" : "play"} size={17} />
          <span className="hidden sm:inline">{t.playing ? "Pause" : t.p >= 1 ? "Replay" : "Play"}</span>
        </button>
        <button type="button" onClick={() => store.set({ p: 0, playing: false, active: true })} aria-label="Restart" title="Restart" className={ctrl} data-testid="fs-restart">
          <Icon name="restart" size={17} />
        </button>
        <button type="button" onClick={() => goToStage(store, stages, t.active ? idx - 1 : 0)} disabled={t.active && idx === 0} aria-label="Previous stage" title="Previous stage" className={ctrl} data-testid="fs-prev">‹</button>
        <button type="button" onClick={() => goToStage(store, stages, t.active ? idx + 1 : 0)} disabled={t.active && idx === stages.length - 1} aria-label="Next stage" title="Next stage" className={ctrl} data-testid="fs-next">›</button>
        <p className="order-first w-full truncate px-1 text-[13px] text-text sm:order-none sm:w-auto sm:min-w-0 sm:flex-1" aria-live="polite" data-testid="fs-stage">
          {t.active ? <><span className="text-flame">Stage {idx + 1}/{stages.length}</span> · {stage.label}</> : <span className="text-text-2">Timeline off: press Play</span>}
        </p>
        <span className="hidden text-[11.5px] text-warn md:inline" data-testid="fs-caveat">{caveat}</span>
        <label className="flex items-center gap-1 text-[12px] text-text-2">
          <span className="sr-only sm:not-sr-only">Speed</span>
          <select value={t.speed} onChange={(e) => store.set({ speed: Number(e.target.value) })} data-testid="fs-speed" aria-label="Playback speed"
            className="h-10 rounded-lg border border-line-strong/80 bg-void/70 px-1.5 text-[12.5px] text-text">
            {[0.5, 1, 2].map((v) => <option key={v} value={v}>{v}×</option>)}
          </select>
        </label>
      </div>
      <p className="mt-1 text-[11px] text-warn md:hidden">{caveat}</p>
    </div>
  );
}

/** SAFFIRE-I: walkthrough steps (topics, not intervals of the burn). */
export function ImmersiveWalkBar({ steps, index, setIndex }: { steps: { id: string; title: string }[]; index: number | null; setIndex: (i: number | null) => void }) {
  return (
    <div data-chrome-item data-hover-hold data-testid="fs-playback" role="group" aria-label="Walkthrough"
      className="sf-chrome absolute bottom-0 left-0 right-[var(--fs-right,0px)] z-[60] bg-[linear-gradient(0deg,rgba(5,10,20,0.92),rgba(5,10,20,0.6)_65%,transparent)] px-3 pb-3 pt-8 md:px-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => setIndex(index === null ? 0 : index - 1)} disabled={index === 0} aria-label="Previous step" title="Previous step" className={ctrl} data-testid="fs-prev">‹</button>
        <ol className="flex flex-wrap gap-1" aria-label="Walkthrough steps">
          {steps.map((s, i) => (
            <li key={s.id}>
              <button type="button" onClick={() => setIndex(i)} aria-current={i === index ? "step" : undefined} title={s.title} aria-label={`Step ${i + 1}: ${s.title}`}
                className={`press h-10 min-w-10 rounded-lg border px-2 text-[13px] ${i === index ? "border-flame bg-flame/20 text-text" : "border-line-strong/80 bg-void/60 text-text-2 hover:text-text"}`}>{i + 1}</button>
            </li>
          ))}
        </ol>
        <button type="button" onClick={() => setIndex(index === null ? 0 : Math.min(steps.length - 1, index + 1))} disabled={index === steps.length - 1} aria-label="Next step" title="Next step" className={ctrl} data-testid="fs-next">›</button>
        <p className="order-first w-full truncate px-1 text-[13px] text-text sm:order-none sm:w-auto sm:min-w-0 sm:flex-1" aria-live="polite" data-testid="fs-stage">
          {index === null ? <span className="text-text-2">Walkthrough: press › to start</span> : <><span className="text-flame">Step {index + 1}/{steps.length}</span> · {steps[index].title}</>}
        </p>
        <span className="text-[11.5px] text-warn" data-testid="fs-caveat">Explanatory steps — not a timeline of the burn</span>
      </div>
    </div>
  );
}

/**
 * The floating scientific explanation for the active stage or step. Not part of the auto-hiding chrome: once opened
 * it stays until the visitor closes it, so text never disappears mid-read. Content comes from lib/stages.ts (the
 * same entries as the explainer below the viewport), with its basis and sources.
 */
export function ExplanationOverlay({ id, info, position, gravity, extra, modeNote, idle, onClose }: {
  id: string; info: StageInfo | null; position: string | null; gravity?: GravityStage | null; extra?: ReactNode; modeNote: string;
  idle: ReactNode; onClose: () => void;
}) {
  const [why, setWhy] = useState(false);
  const [src, setSrc] = useState(false);
  return (
    <aside id={id} aria-label="Scientific explanation" data-immersive-panel data-hover-hold data-testid="fs-explanation" data-stage={info?.id ?? "none"}
      className="absolute inset-x-2 bottom-[180px] z-[55] max-h-[40vh] overflow-y-auto rounded-xl border border-line-strong/70 bg-void/82 p-3 text-[13px] text-text-2 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.9)] backdrop-blur-md sm:inset-x-auto sm:bottom-auto sm:left-4 sm:top-[92px] sm:max-h-[calc(100%-230px)] sm:w-[min(380px,calc(100%-32px))]">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1" aria-live="polite">
          {position && <p className="text-[11.5px] font-medium text-flame">{position}</p>}
          <h3 className="subhead text-[15.5px] leading-snug text-text" data-testid="fs-explain-title">{info ? info.title : "Explanations"}</h3>
        </div>
        <button type="button" onClick={onClose} aria-label="Close explanations" title="Close explanations" data-testid="fs-explain-close"
          className="press -mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-text-2 hover:bg-raised/60 hover:text-text"><Icon name="close" size={16} /></button>
      </div>
      {info ? (
        <>
          <p className="mt-1 leading-snug text-text" data-testid="fs-explain-summary">{info.summary}</p>
          <p className="mt-1.5 leading-snug"><b className="font-medium text-text">Key idea:</b> {info.insight}</p>
          {gravity && (
            <dl className="mt-2 grid gap-1.5 rounded-lg border border-line/70 bg-ink/50 p-2 text-[12.5px]" data-testid="fs-gravity">
              <div><dt className="font-semibold text-text-3">Earth</dt><dd>{gravity.earth}</dd></div>
              <div><dt className="font-semibold text-text-3">Microgravity</dt><dd>{gravity.micro}</dd></div>
              <div><dt className="font-semibold text-text-3">Why they differ</dt><dd className="text-text">{gravity.differ}</dd></div>
            </dl>
          )}
          {extra}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button type="button" aria-expanded={why} onClick={() => setWhy(!why)} data-testid="fs-why"
              className={`press min-h-9 rounded-lg border px-2.5 text-[12.5px] ${why ? "border-electric/70 bg-electric/10 text-text" : "border-line-strong text-text-2 hover:text-text"}`}>Why does this happen?</button>
            <button type="button" aria-expanded={src} onClick={() => setSrc(!src)} data-testid="fs-sources"
              className={`press min-h-9 rounded-lg border px-2.5 text-[12.5px] ${src ? "border-electric/70 bg-electric/10 text-text" : "border-line-strong text-text-2 hover:text-text"}`}>Sources &amp; limits</button>
          </div>
          {why && (
            <div className="mt-2 leading-relaxed" data-testid="fs-why-body">
              <p>{info.why}</p>
              <ul className="mt-1.5 flex flex-col gap-1 text-[12px]" aria-label="Basis of these statements">
                {info.basis.map((b) => <li key={b.text} className="flex items-start gap-2"><Prov kind={b.kind} /><span>{b.text}</span></li>)}
              </ul>
            </div>
          )}
          {src && (
            <div className="mt-2 text-[12.5px]" data-testid="fs-sources-body">
              <ul className="flex flex-col gap-0.5">
                {info.sources.map((s) => <li key={s.href + s.label}><a href={s.href} target={s.external ? "_blank" : undefined} rel="noreferrer">{s.label}</a></li>)}
              </ul>
              <p className="mt-1.5 text-text-3">Limits: {info.limits}</p>
            </div>
          )}
        </>
      ) : <div className="mt-1">{idle}</div>}
      <p className="mt-2 border-t border-line/60 pt-1.5 text-[11.5px] text-text-3" data-testid="fs-mode-note">{modeNote}</p>
    </aside>
  );
}
