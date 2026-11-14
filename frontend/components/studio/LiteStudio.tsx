"use client";

// Studio shell for the Phase 13 3D scenes (Gaseous Flame, Smoke Detection). One WebGL canvas per page, loaded lazily.
// Phase 15 brings it to the same control set as the original studios: Play/Pause, Reset (documented starting state),
// Reset camera, orbit/zoom, Fullscreen (native, with an expanded fallback; Escape exits), Hide/Show controls with a
// floating restore button, and Labels / Explanation / Evidence toggles. A static view and graceful WebGL failure stay,
// and everything drawn keeps a visible evidence classification. Scientific panels are passed in by the page.
import dynamic from "next/dynamic";
import { Component, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { LegendItem } from "@/components/3d/ModelLegend";
import ModelLegend from "@/components/3d/ModelLegend";
import type { CameraApi, CameraHome } from "@/components/3d/ScientificCameraControls";
import { hasWebGL } from "@/components/3d/webgl";
import { Icon } from "@/components/icons";
import { useMedia } from "@/components/motion";
import { useFullscreen } from "@/components/studio/immersive";
import type { LiteScene } from "@/components/studio/LiteViewport";
import TimelineBar from "@/components/studio/TimelineBar";
import { goToStage, useTimelineValue, type Stage, type TimelineStore } from "@/lib/timeline";

/** A guided, ILLUSTRATIVE stage sequence for the studio (Phase 16), driven by the same store as the FLEX timeline. */
export type StudioGuide = { store: TimelineStore; stages: Stage[]; title: string; caveat: string; startLabel: string; explainer?: ReactNode };

const LiteViewport = dynamic(() => import("@/components/studio/LiteViewport"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-text-2" role="status">Loading the 3D studio…</div>,
});

let webglCache: boolean | null = null;
const webglSnapshot = () => (webglCache ??= hasWebGL());
const noSubscribe = () => () => {};

class Boundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export { EVIDENCE, EvidenceTag, type EvidenceKind } from "@/components/evidence-tag";

const NULL_STORE: TimelineStore = { get: () => ({ p: 0, playing: false, speed: 1, active: false }), set: () => {}, tick: () => {},
  subscribe: () => () => {}, duration: 1 };

export const CONCEPTUAL_NOTICE = "Conceptual 3D educational visualization; experimental values are displayed separately where available.";

export function Btn({ label, onClick, children, testid, pressed }: { label: string; onClick: () => void; children: ReactNode; testid?: string; pressed?: boolean }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} data-testid={testid} aria-pressed={pressed}
      className={`press inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-lg border px-2 text-[12.5px] backdrop-blur-md ${
        pressed ? "border-electric/70 bg-electric/15 text-text" : "border-line-strong/80 bg-void/70 text-text-2 hover:border-flame/70 hover:text-text"}`}>
      {children}
    </button>
  );
}

/** One toggle in the studio's secondary toolbar (Key, Labels, Explanation, Evidence). */
function Toggle({ label, on, onClick, testid, icon }: { label: string; on: boolean; onClick: () => void; testid?: string; icon?: string }) {
  return (
    <Btn label={`${on ? "Hide" : "Show"} ${label.toLowerCase()}`} onClick={onClick} testid={testid} pressed={on}>
      {icon && <Icon name={icon} size={14} />}{label}
    </Btn>
  );
}

export default function LiteStudio({ id, title, kicker, intro, scene, home, legend, banner, measuredLabel, textAlternative,
  controls, explanation, evidence, labels, onLabels, animate, onAnimate, onReset, extraToolbar, guide }: {
  id: string; title: string; kicker: string; intro: ReactNode; scene: LiteScene; home: CameraHome; legend: LegendItem[];
  /** Short line in the viewport naming what is drawn and how it is classified. */ banner: ReactNode;
  measuredLabel?: string | null; textAlternative: string;
  /** Scientific selectors (arrangement, material, stage...). */ controls: ReactNode;
  /** What the scene shows and why (hidden with "Hide explanation"). */ explanation: ReactNode;
  /** Measured or source-backed values for the current selection (hidden with "Hide evidence"). */ evidence: ReactNode;
  labels: boolean; onLabels: (v: boolean) => void; animate: boolean; onAnimate: (v: boolean) => void;
  /** Restore the page's documented initial scientific state; the studio resets camera and view itself. */ onReset: () => void;
  /** Step controls (e.g. previous / next stage) shown beside Play/Pause. */ extraToolbar?: ReactNode;
  /** Optional guided timeline shown under the viewport. */ guide?: StudioGuide;
}) {
  const section = useRef<HTMLElement>(null);
  const cam = useRef<CameraApi>(null);
  const fs = useFullscreen(section);
  const reduce = useMedia("(prefers-reduced-motion: reduce)");
  // client-only capability check (null during SSR), probed once per page load
  const webgl = useSyncExternalStore(noSubscribe, webglSnapshot, () => null);
  const [failed, setFailed] = useState<null | "context-lost" | "error">(null);
  const [staticView, setStaticView] = useState(false);
  const [legendOpen, setLegendOpen] = useState(true);
  const [controlsShown, setControlsShown] = useState(true);
  const [explainShown, setExplainShown] = useState(true);
  const [evidenceShown, setEvidenceShown] = useState(true);
  // The guide advances only while the scene renders: it renders continuously while the guide plays (also under reduced
  // motion, because the user pressed Play), and pausing the animation pauses the guide.
  const guidePlaying = useTimelineValue(guide?.store ?? NULL_STORE, (t) => t.playing, false);
  const motion = (animate && !reduce) || (!!guide && guidePlaying);
  const setAnimate = (v: boolean) => {
    onAnimate(v);
    if (!v && guide?.store.get().playing) guide.store.set({ playing: false });
  };
  const startGuide = () => {
    if (!guide) return;
    goToStage(guide.store, guide.stages, 0);
    guide.store.set({ playing: true, active: true });
    onAnimate(true);
    if (!controlsShown) setControlsShown(true);
  };
  const panelId = `${id}-studio-panel`;

  const resetAll = () => {
    onReset();
    guide?.store.set({ p: 0, playing: false, active: false });
    onAnimate(true);
    onLabels(true);
    setExplainShown(true);
    setEvidenceShown(true);
    setLegendOpen(true);
    setStaticView(false);
    cam.current?.reset();
  };

  const fallback = (reason: string) => (
    <div className="flex h-full flex-col items-center justify-center gap-3 overflow-auto p-5 text-center" data-testid="scene-fallback">
      <p className="text-[13px] font-medium text-warn">{reason}</p>
      <p className="max-w-[60ch] text-[13.5px] leading-relaxed text-text-2">{textAlternative}</p>
      <p className="text-[12px] text-text-3">Description of a conceptual schematic; not data.</p>
      <button type="button" onClick={() => { setFailed(null); setStaticView(false); }}
        className="press rounded-lg border border-line-strong bg-raised px-3 py-1.5 text-sm text-text hover:border-flame/70">Try the 3D view</button>
    </div>
  );
  const toggleFs = () => (fs.active ? fs.exit() : void fs.enter());
  const fsButton = (
    <Btn label={fs.active ? "Exit fullscreen" : "Fullscreen"} onClick={toggleFs} testid="studio-fullscreen" pressed={fs.active}>
      <Icon name="fullscreen" size={14} />{fs.active ? "Exit" : null}</Btn>
  );

  return (
    <section id="studio" ref={section} aria-labelledby={`${id}-title`} data-testid="lite-studio" data-studio={id}
      data-fullscreen={fs.mode} data-controls={controlsShown ? "shown" : "hidden"}
      onKeyDown={(e) => { if (e.key === "Escape" && fs.mode === "fallback") { e.preventDefault(); fs.exit(); } }}
      className={fs.active ? "theme-dark fixed inset-0 z-[80] m-0 flex h-[100dvh] w-full flex-col overflow-auto bg-void p-3" : "scroll-mt-36"}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-[70ch]">
          <p className="kicker">{kicker}</p>
          <h2 id={`${id}-title`} className="subhead text-[22px] md:text-[26px]">{title}</h2>
          {!fs.active && <div className="mt-1 text-[14.5px] leading-relaxed text-text-2">{intro}</div>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {guide && (
            <button type="button" onClick={startGuide} data-testid="guide-start"
              className="press glow-flame inline-flex min-h-10 items-center gap-2 rounded-lg bg-flame px-4 text-[14px] font-semibold text-flame-ink">
              <Icon name="play" size={15} />{guide.startLabel}</button>
          )}
          <button type="button" onClick={() => setControlsShown(!controlsShown)} aria-expanded={controlsShown} aria-controls={panelId}
            data-testid="lite-toggle-controls"
            className="press inline-flex min-h-10 items-center gap-2 rounded-lg border border-line-strong px-3 text-[13.5px] text-text-2 hover:border-electric hover:text-text">
            <Icon name="panel-right" size={17} />{controlsShown ? "Hide controls" : "Show controls"}
          </button>
          <button type="button" onClick={toggleFs} data-testid="lite-enter-fullscreen"
            className="press inline-flex min-h-10 items-center gap-2 rounded-lg border border-flame/60 px-3 text-[13.5px] text-text hover:bg-flame/10">
            <Icon name="fullscreen" size={17} />{fs.active ? "Exit fullscreen" : "Fullscreen"}
          </button>
        </div>
      </div>
      <p className="mb-3 rounded-lg border border-flame/40 bg-flame/[0.06] px-3 py-2 text-[13px] text-text" data-testid="conceptual-notice">
        <Icon name="info" size={14} className="mr-1.5 inline -translate-y-px" />{CONCEPTUAL_NOTICE}
      </p>
      <div className={`grid gap-4 ${fs.active ? "flex-1" : ""} ${controlsShown ? "lg:grid-cols-[minmax(0,1fr)_360px]" : ""}`}>
        <div className="flex min-w-0 flex-col gap-3">
        <div data-testid="lite-viewport-box" className={`theme-dark relative overflow-hidden rounded-xl border border-line/70 bg-[radial-gradient(120%_90%_at_50%_45%,rgba(30,52,90,0.55),rgba(5,10,20,0.98)_70%)] ${
          fs.active ? "min-h-[60vh]" : "h-[440px] md:h-[520px]"}`}>
          {webgl === false ? fallback("This browser or device does not provide WebGL, so the 3D view is replaced by a description.")
            : failed ? fallback(failed === "context-lost" ? "The graphics context was lost and could not be restored." : "The 3D scene failed to load.")
              : staticView ? fallback("Static view selected. The 3D scene is not loaded.")
                : webgl && (
                  <Boundary fallback={fallback("The 3D scene failed to load.")}>
                    <div className="absolute inset-0" data-testid="lite-canvas-host" tabIndex={0} role="application"
                      aria-label={`${title}: arrow keys rotate, plus and minus zoom, 0 resets the camera, space plays or pauses`}
                      onKeyDown={(e) => {
                        const c = cam.current;
                        if (e.key === " ") { setAnimate(!animate); e.preventDefault(); return; }
                        if (!c) return;
                        if (e.key === "ArrowLeft") c.rotate(-0.15, 0); else if (e.key === "ArrowRight") c.rotate(0.15, 0);
                        else if (e.key === "ArrowUp") c.rotate(0, -0.12); else if (e.key === "ArrowDown") c.rotate(0, 0.12);
                        else if (e.key === "+" || e.key === "=") c.zoom(1.2); else if (e.key === "-") c.zoom(1 / 1.2);
                        else if (e.key === "0") c.reset(); else return;
                        e.preventDefault();
                      }}>
                      <LiteViewport scene={scene} home={home} animate={motion} cameraRef={cam} label={title} timeline={guide?.store ?? null}
                        onContextLost={() => setFailed("context-lost")} />
                    </div>
                  </Boundary>
                )}
          <div className="pointer-events-none absolute left-3 right-3 top-3 z-30 flex flex-wrap items-start justify-between gap-2">
            <p data-testid="evidence-banner" className="max-w-[52ch] rounded-lg border border-line-strong/80 bg-void/80 px-2 py-1 text-[11.5px] leading-snug text-text-2 backdrop-blur-md">
              {banner}
              {measuredLabel && <span className="mt-0.5 block font-medium text-data" data-testid="measured-label">{measuredLabel}</span>}
            </p>
          </div>
          {controlsShown ? (
            // One bottom bar that wraps on narrow screens: what-to-show toggles on the left; playback and camera on
            // the right. Nothing sits over the middle of the scene.
            <div className="pointer-events-none absolute inset-x-3 bottom-3 z-30 flex flex-wrap items-end justify-between gap-1.5">
              <div className="pointer-events-auto flex max-w-full flex-col items-start gap-1.5" data-testid="lite-secondary-toolbar">
                {legendOpen && <div className="max-w-[240px]"><ModelLegend items={legend} /></div>}
                <span className="flex flex-wrap gap-1.5" role="toolbar" aria-label="What to show">
                  <Toggle label="Key" on={legendOpen} onClick={() => setLegendOpen(!legendOpen)} />
                  <Toggle label="Labels" on={labels} onClick={() => onLabels(!labels)} testid="labels-toggle" icon="tag" />
                  <Toggle label="Explanation" on={explainShown} onClick={() => setExplainShown(!explainShown)} testid="explanation-toggle" icon="info" />
                  <Toggle label="Evidence" on={evidenceShown} onClick={() => setEvidenceShown(!evidenceShown)} testid="evidence-toggle" icon="documents" />
                </span>
              </div>
              <div className="pointer-events-auto ml-auto flex max-w-full flex-col items-end gap-1.5">
                <div className="flex flex-wrap justify-end gap-1.5" role="toolbar" aria-label="Playback" data-testid="lite-main-toolbar">
                  <Btn label={animate ? "Pause animation" : "Play animation"} onClick={() => setAnimate(!animate)} testid="motion-toggle" pressed={animate}>
                    <Icon name={animate ? "pause" : "play"} size={14} />{animate ? "Pause" : "Play"}</Btn>
                  {extraToolbar}
                  <Btn label="Reset the studio to its starting state" onClick={resetAll} testid="studio-reset-all"><Icon name="restart" size={14} />Reset</Btn>
                  {fsButton}
                </div>
                <div className="flex flex-wrap justify-end gap-1.5" role="toolbar" aria-label="Camera" data-testid="lite-camera-toolbar">
                  <Btn label="Rotate left" onClick={() => cam.current?.rotate(-0.3, 0)}><Icon name="chevron" className="rotate-180" /></Btn>
                  <Btn label="Rotate right" onClick={() => cam.current?.rotate(0.3, 0)}><Icon name="chevron" /></Btn>
                  <Btn label="Zoom in" onClick={() => cam.current?.zoom(1.25)} testid="zoom-in"><span aria-hidden className="text-lg leading-none">+</span></Btn>
                  <Btn label="Zoom out" onClick={() => cam.current?.zoom(1 / 1.25)} testid="zoom-out"><span aria-hidden className="text-lg leading-none">−</span></Btn>
                  <Btn label="Reset camera" onClick={() => cam.current?.reset()} testid="studio-reset">Reset camera</Btn>
                  <Btn label={staticView ? "Load 3D view" : "Static view"} onClick={() => setStaticView(!staticView)} testid="static-toggle">2D</Btn>
                </div>
              </div>
            </div>
          ) : (
            <div className="absolute bottom-3 right-3 z-30 flex gap-1.5">
              <button type="button" onClick={() => setControlsShown(true)} data-testid="lite-show-controls" aria-controls={panelId}
                className="press inline-flex h-9 items-center gap-1.5 rounded-lg border border-electric/70 bg-void/80 px-3 text-[12.5px] font-medium text-text backdrop-blur-md hover:bg-electric/15">
                <Icon name="panel-right" size={14} />Show controls</button>
              {fsButton}
            </div>
          )}
          {fs.notice && <p className="absolute left-1/2 top-14 z-40 -translate-x-1/2 rounded-lg border border-warn/60 bg-void/90 px-3 py-1.5 text-[12.5px] text-text">{fs.notice}</p>}
        </div>
        {guide && controlsShown && (
          <div data-testid="studio-guide">
            <TimelineBar store={guide.store} stages={guide.stages} title={guide.title} caveat={guide.caveat}>{guide.explainer}</TimelineBar>
          </div>
        )}
        </div>
        <div className="flex min-w-0 flex-col gap-3" data-testid="studio-panel" id={panelId} hidden={!controlsShown}>
          {controls}
          {explainShown && <div data-testid="studio-explanation" className="flex flex-col gap-3">{explanation}</div>}
          {evidenceShown && <div data-testid="studio-evidence" className="flex flex-col gap-3">{evidence}</div>}
          {(!explainShown || !evidenceShown) && (
            <p className="text-[12px] text-text-3">{[!explainShown && "Explanation", !evidenceShown && "Evidence"].filter(Boolean).join(" and ")} hidden. Use the toolbar in the viewport to show {!explainShown && !evidenceShown ? "them" : "it"} again.</p>
          )}
        </div>
      </div>
    </section>
  );
}
