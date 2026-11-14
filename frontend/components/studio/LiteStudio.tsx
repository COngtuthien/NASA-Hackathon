"use client";

// Studio shell for the Phase 13 3D scenes. One WebGL canvas per page, loaded lazily. Provides orbit/zoom, reset,
// labels, motion, fullscreen (native, with an expanded fallback), a static view, graceful WebGL failure and a visible
// evidence classification for everything drawn. Scientific panels are passed in by the page.
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

export const CONCEPTUAL_NOTICE = "Conceptual 3D educational visualization; experimental values are displayed separately where available.";

function Btn({ label, onClick, children, testid, pressed }: { label: string; onClick: () => void; children: ReactNode; testid?: string; pressed?: boolean }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} data-testid={testid} aria-pressed={pressed}
      className={`press inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-lg border px-2 text-[12.5px] backdrop-blur-md ${
        pressed ? "border-electric/70 bg-electric/15 text-text" : "border-line-strong/80 bg-void/70 text-text-2 hover:border-flame/70 hover:text-text"}`}>
      {children}
    </button>
  );
}

export default function LiteStudio({ id, title, kicker, intro, scene, home, legend, banner, measuredLabel, textAlternative,
  controls, panel, labels, onLabels, animate, onAnimate, extraToolbar }: {
  id: string; title: string; kicker: string; intro: ReactNode; scene: LiteScene; home: CameraHome; legend: LegendItem[];
  /** Short line in the viewport naming what is drawn and how it is classified. */ banner: ReactNode;
  measuredLabel?: string | null; textAlternative: string; controls: ReactNode; panel: ReactNode;
  labels: boolean; onLabels: (v: boolean) => void; animate: boolean; onAnimate: (v: boolean) => void; extraToolbar?: ReactNode;
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
  const motion = animate && !reduce;

  const fallback = (reason: string) => (
    <div className="flex h-full flex-col items-center justify-center gap-3 overflow-auto p-5 text-center" data-testid="scene-fallback">
      <p className="text-[13px] font-medium text-warn">{reason}</p>
      <p className="max-w-[60ch] text-[13.5px] leading-relaxed text-text-2">{textAlternative}</p>
      <p className="text-[12px] text-text-3">Description of a conceptual schematic; not data.</p>
      <button type="button" onClick={() => { setFailed(null); setStaticView(false); }}
        className="press rounded-lg border border-line-strong bg-raised px-3 py-1.5 text-sm text-text hover:border-flame/70">Try the 3D view</button>
    </div>
  );

  return (
    <section id="studio" ref={section} aria-labelledby={`${id}-title`} data-testid="lite-studio" data-studio={id}
      data-fullscreen={fs.mode}
      className={fs.active ? "theme-dark fixed inset-0 z-[80] m-0 flex h-[100dvh] w-full flex-col overflow-auto bg-void p-3" : "scroll-mt-36"}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-[70ch]">
          <p className="kicker">{kicker}</p>
          <h2 id={`${id}-title`} className="subhead text-[22px] md:text-[26px]">{title}</h2>
          <div className="mt-1 text-[14.5px] leading-relaxed text-text-2">{intro}</div>
        </div>
      </div>
      <p className="mb-3 rounded-lg border border-flame/40 bg-flame/[0.06] px-3 py-2 text-[13px] text-text" data-testid="conceptual-notice">
        <Icon name="info" size={14} className="mr-1.5 inline -translate-y-px" />{CONCEPTUAL_NOTICE}
      </p>
      <div className={`grid gap-4 ${fs.active ? "flex-1" : ""} lg:grid-cols-[minmax(0,1fr)_360px]`}>
        <div data-testid="lite-viewport-box" className={`theme-dark relative overflow-hidden rounded-xl border border-line/70 bg-[radial-gradient(120%_90%_at_50%_45%,rgba(30,52,90,0.55),rgba(5,10,20,0.98)_70%)] ${
          fs.active ? "min-h-[60vh]" : "h-[440px] md:h-[520px]"}`}>
          {webgl === false ? fallback("This browser or device does not provide WebGL, so the 3D view is replaced by a description.")
            : failed ? fallback(failed === "context-lost" ? "The graphics context was lost and could not be restored." : "The 3D scene failed to load.")
              : staticView ? fallback("Static view selected. The 3D scene is not loaded.")
                : webgl && (
                  <Boundary fallback={fallback("The 3D scene failed to load.")}>
                    <div className="absolute inset-0" data-testid="lite-canvas-host" tabIndex={0} role="application"
                      aria-label={`${title}: use arrow keys to rotate, plus and minus to zoom, 0 to reset`}
                      onKeyDown={(e) => {
                        const c = cam.current;
                        if (!c) return;
                        if (e.key === "ArrowLeft") c.rotate(-0.15, 0); else if (e.key === "ArrowRight") c.rotate(0.15, 0);
                        else if (e.key === "ArrowUp") c.rotate(0, -0.12); else if (e.key === "ArrowDown") c.rotate(0, 0.12);
                        else if (e.key === "+" || e.key === "=") c.zoom(1.2); else if (e.key === "-") c.zoom(1 / 1.2);
                        else if (e.key === "0") c.reset(); else return;
                        e.preventDefault();
                      }}>
                      <LiteViewport scene={scene} home={home} animate={motion} cameraRef={cam} label={title}
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
          <div className="absolute bottom-3 left-3 z-30 flex flex-col items-start gap-1.5">
            {legendOpen && <div className="max-w-[240px]"><ModelLegend items={legend} /></div>}
            <span className="flex gap-1.5">
              <Btn label={legendOpen ? "Hide key" : "Show key"} onClick={() => setLegendOpen(!legendOpen)} pressed={legendOpen}>Key</Btn>
              <Btn label={labels ? "Hide labels" : "Show labels"} onClick={() => onLabels(!labels)} testid="labels-toggle" pressed={labels}>
                <Icon name="tag" size={14} />Labels</Btn>
            </span>
          </div>
          <div className="absolute bottom-3 right-3 z-30 flex flex-wrap justify-end gap-1.5" role="toolbar" aria-label="Camera and view">
            <Btn label="Rotate left" onClick={() => cam.current?.rotate(-0.3, 0)}><Icon name="chevron" className="rotate-180" /></Btn>
            <Btn label="Rotate right" onClick={() => cam.current?.rotate(0.3, 0)}><Icon name="chevron" /></Btn>
            <Btn label="Zoom in" onClick={() => cam.current?.zoom(1.25)} testid="zoom-in"><span aria-hidden className="text-lg leading-none">+</span></Btn>
            <Btn label="Zoom out" onClick={() => cam.current?.zoom(1 / 1.25)} testid="zoom-out"><span aria-hidden className="text-lg leading-none">−</span></Btn>
            <Btn label="Reset view" onClick={() => cam.current?.reset()} testid="studio-reset"><Icon name="restart" size={14} />Reset</Btn>
            <Btn label={animate ? "Pause motion" : "Play motion"} onClick={() => onAnimate(!animate)} testid="motion-toggle" pressed={animate}>
              <Icon name={animate ? "pause" : "play"} size={14} /></Btn>
            {extraToolbar}
            <Btn label={fs.active ? "Exit fullscreen" : "Fullscreen"} onClick={() => (fs.active ? fs.exit() : void fs.enter())} testid="studio-fullscreen" pressed={fs.active}>
              <Icon name="fullscreen" size={14} /></Btn>
            <Btn label={staticView ? "Load 3D view" : "Static view"} onClick={() => setStaticView(!staticView)} testid="static-toggle">2D</Btn>
          </div>
          {fs.notice && <p className="absolute left-1/2 top-14 z-40 -translate-x-1/2 rounded-lg border border-warn/60 bg-void/90 px-3 py-1.5 text-[12.5px] text-text">{fs.notice}</p>}
        </div>
        <div className="flex min-w-0 flex-col gap-3" data-testid="studio-panel">
          {controls}
          {panel}
        </div>
      </div>
    </section>
  );
}
