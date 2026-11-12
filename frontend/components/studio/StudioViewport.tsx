"use client";

// The studio's 3D viewport: loaded on the client only, in its own chunk with three.js. One canvas per page; the
// comparison views render two scenes into the same canvas (SplitView), so a page never holds two WebGL contexts.
import { useFrame } from "@react-three/fiber";
import { lazy, Suspense, useCallback, useEffect, useId, useState, type KeyboardEvent, type ReactNode } from "react";
import ModelLegend, { type LegendItem } from "@/components/3d/ModelLegend";
import SceneCanvas from "@/components/3d/SceneCanvas";
import SceneFallback from "@/components/3d/SceneFallback";
import type { CameraApi } from "@/components/3d/ScientificCameraControls";
import SplitView from "@/components/3d/SplitView";
import type { BassSceneProps, FlexSceneProps, SaffireSceneProps } from "@/components/3d/types";
import { hasWebGL, labStats } from "@/components/3d/webgl";
import { Icon } from "@/components/icons";
import { SCENE_BY_ID, type SceneId } from "@/lib/lab-models";
import { MODES, type Mode } from "@/lib/lab-scientific-metadata";
import { CAMERA_HOME } from "@/lib/studio-camera";
import type { TimelineStore } from "@/lib/timeline";

const DropletCombustionScene = lazy(() => import("@/components/3d/DropletCombustionScene"));
const FlameSpreadScene = lazy(() => import("@/components/3d/FlameSpreadScene"));
const SpacecraftFireScene = lazy(() => import("@/components/3d/SpacecraftFireScene"));

export type AnySceneProps = FlexSceneProps | BassSceneProps | SaffireSceneProps;

function Scene({ id, props }: { id: SceneId; props: AnySceneProps }) {
  if (id === "flex") return <DropletCombustionScene {...(props as FlexSceneProps)} />;
  if (id === "bass") return <FlameSpreadScene {...(props as BassSceneProps)} />;
  return <SpacecraftFireScene {...(props as SaffireSceneProps)} />;
}

function Mounted({ id }: { id: SceneId }) {
  useEffect(() => {
    const s = labStats();
    s.sceneLoads[id] = (s.sceneLoads[id] ?? 0) + 1;
  }, [id]);
  return null;
}

/** Advances the illustrative timeline from the render loop (only while it is playing). */
function TimelineDriver({ store }: { store: TimelineStore }) {
  useFrame((_, dt) => { if (store.get().playing) store.tick(Math.min(dt, 0.1)); });
  return null;
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.35} color="#9fb6d9" />
      <directionalLight position={[4, 6, 5]} intensity={1.15} color="#dfe8ff" />
      <directionalLight position={[-6, 2, -4]} intensity={0.55} color="#5b8cff" />
      <hemisphereLight args={["#2a3f66", "#05080f", 0.4]} />
    </>
  );
}

function CamButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      className="press grid h-9 w-9 place-items-center rounded-lg border border-line-strong/80 bg-void/70 text-text-2 backdrop-blur-md hover:border-flame/70 hover:text-text">
      {children}
    </button>
  );
}

export type StudioViewportProps = {
  sceneId: SceneId;
  mode: Mode;
  animate: boolean;
  measuredLabel: string | null;
  onStatic: () => void;
  /** Receives the camera API once the canvas is ready (and null when it unmounts). */
  cameraRef: (api: CameraApi | null) => void;
  /** One scene, or two scenes side by side sharing one camera. */
  single?: AnySceneProps;
  split?: { left: AnySceneProps; right: AnySceneProps; leftLabel: string; rightLabel: string; note?: string };
  legend: LegendItem[];
  timeline: TimelineStore | null;
  presets?: { id: string; label: string; onSelect: () => void }[];
};

export default function StudioViewport({ sceneId, mode, animate, measuredLabel, onStatic, cameraRef, single, split, legend, timeline, presets }: StudioViewportProps) {
  const [webgl] = useState(hasWebGL);
  const [lost, setLost] = useState(0);
  const [restoreKey, setRestoreKey] = useState(0);
  const [cam, setCam] = useState<CameraApi | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const helpId = useId();
  const s = SCENE_BY_ID[sceneId];
  const onLost = useCallback(() => setLost((n) => n + 1), []);

  // keep both the parent's ref and a local handle for the toolbar
  const bindCam = useCallback((api: CameraApi | null) => {
    setCam(api);
    cameraRef(api);
  }, [cameraRef]);

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (!cam) return;
    const step = e.shiftKey ? 0.35 : 0.12;
    const map: Record<string, () => void> = {
      ArrowLeft: () => cam.rotate(-step, 0), ArrowRight: () => cam.rotate(step, 0),
      ArrowUp: () => cam.rotate(0, step), ArrowDown: () => cam.rotate(0, -step),
      "+": () => cam.zoom(1.15), "=": () => cam.zoom(1.15), "-": () => cam.zoom(1 / 1.15), _: () => cam.zoom(1 / 1.15),
      "0": () => cam.reset(), Home: () => cam.reset(),
    };
    const fn = map[e.key];
    if (fn) { e.preventDefault(); fn(); }
  }

  const failed = !webgl || lost > 0;

  return (
    <div className="relative h-full w-full overflow-hidden" data-testid="lab-viewport" data-scene={sceneId} data-view={split ? "split" : "single"}>
      {failed ? (
        <SceneFallback scene={s} reason={!webgl ? "no-webgl" : "context-lost"}
          onRetry={webgl ? () => { setLost(0); setRestoreKey((k) => k + 1); } : undefined} />
      ) : (
        <div tabIndex={0} role="group" aria-roledescription="3D viewer" aria-label={`${s.title} 3D view. ${s.textAlternative}`} aria-describedby={helpId}
          onKeyDown={onKey} className="absolute inset-0 focus-visible:outline-offset-[-3px]" data-testid="lab-canvas-host">
          <SceneCanvas key={restoreKey} home={CAMERA_HOME[sceneId]} animate={animate} cameraRef={bindCam} onContextLost={onLost}
            label={`${s.title} interactive 3D model`}>
            <Lights />
            {timeline && <TimelineDriver store={timeline} />}
            <Suspense fallback={null}>
              <Mounted id={sceneId} />
              {split ? <SplitView left={<Scene id={sceneId} props={split.left} />} right={<Scene id={sceneId} props={split.right} />} />
                : single ? <Scene id={sceneId} props={single} /> : null}
            </Suspense>
          </SceneCanvas>
          <p id={helpId} className="sr-only">Use the arrow keys to rotate, plus and minus to zoom, and 0 to reset the view. All components are also listed as buttons in the Layers panel.</p>
        </div>
      )}

      {/* split captions */}
      {split && !failed && (
        <>
          <div aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 z-20 w-px bg-line-strong/80" />
          <div className="pointer-events-none absolute left-0 right-0 top-[64px] z-30 grid grid-cols-2 px-3 text-center" data-testid="split-captions" aria-label="Both views share one camera">
            <p className="mx-auto rounded-full border border-line-strong/80 bg-void/80 px-3 py-0.5 text-[12.5px] font-medium text-text backdrop-blur-md">{split.leftLabel}</p>
            <p className="mx-auto rounded-full border border-line-strong/80 bg-void/80 px-3 py-0.5 text-[12.5px] font-medium text-text backdrop-blur-md">{split.rightLabel}</p>
          </div>
          {split.note && <p className="absolute bottom-[60px] left-1/2 z-30 w-[min(92%,560px)] -translate-x-1/2 rounded-md bg-void/80 px-2.5 py-1 text-center text-[11.5px] text-text-2 backdrop-blur-md md:bottom-[64px]" data-testid="split-note">{split.note}</p>}
        </>
      )}

      {/* mode banner: always visible so the scene can never be mistaken for measured output */}
      <div className="pointer-events-none absolute left-3 right-3 top-3 z-30 flex flex-wrap items-start justify-between gap-2">
        <p data-testid="mode-banner" className={`max-w-[46ch] rounded-lg border px-2.5 py-1.5 text-[12px] font-medium leading-snug backdrop-blur-md ${
          mode === "conceptual" ? "border-warn/50 bg-void/75 text-warn" : "border-data/50 bg-void/75 text-data"}`}>
          {MODES[mode].banner}{mode === "evidence" && measuredLabel && <span className="mt-0.5 block font-normal text-text-2">Drawn to measured size: {measuredLabel}</span>}
        </p>
        <span className="rounded-full border border-line-strong/70 bg-void/70 px-2.5 py-0.5 text-[11.5px] text-text-2 backdrop-blur-md">{s.scale}</span>
      </div>

      {!failed && (
        <>
          {presets && presets.length > 0 && (
            <div className="absolute left-3 top-[86px] z-30 flex max-w-[60%] flex-wrap gap-1.5" role="toolbar" aria-label="Camera presets">
              {presets.map((p) => (
                <button key={p.id} type="button" onClick={p.onSelect}
                  className="press rounded-full border border-line-strong/80 bg-void/75 px-2.5 py-1 text-[12px] text-text-2 backdrop-blur-md hover:border-electric hover:text-text">{p.label}</button>
              ))}
            </div>
          )}
          <div className="absolute bottom-3 left-3 z-30 flex flex-col items-start gap-1.5">
            {legendOpen && <div className="max-w-[230px]" id={`${helpId}-legend`}><ModelLegend items={legend} /></div>}
            <button type="button" aria-expanded={legendOpen} aria-controls={`${helpId}-legend`} onClick={() => setLegendOpen((o) => !o)}
              className="press rounded-lg border border-line-strong/80 bg-void/70 px-2.5 py-1 text-[12px] text-text-2 backdrop-blur-md hover:text-text">
              {legendOpen ? "Hide key" : "Colour key"}
            </button>
          </div>
          <div className="absolute bottom-3 right-3 z-30 flex flex-col items-end gap-2">
            {!split && (
              <p className="hidden rounded-md bg-void/70 px-2 py-1 text-[11.5px] text-text-3 backdrop-blur-md md:block">
                Drag to rotate · Scroll or pinch to zoom · Select a component to inspect
              </p>
            )}
            <div className="flex gap-1.5" role="toolbar" aria-label="Camera">
              <CamButton label="Rotate left" onClick={() => cam?.rotate(-0.3, 0)}><Icon name="chevron" className="rotate-180" /></CamButton>
              <CamButton label="Rotate right" onClick={() => cam?.rotate(0.3, 0)}><Icon name="chevron" /></CamButton>
              <CamButton label="Zoom in" onClick={() => cam?.zoom(1.25)}><span aria-hidden className="text-lg leading-none">+</span></CamButton>
              <CamButton label="Zoom out" onClick={() => cam?.zoom(1 / 1.25)}><span aria-hidden className="text-lg leading-none">−</span></CamButton>
              <button type="button" onClick={() => cam?.reset()}
                className="press inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong/80 bg-void/70 px-2.5 text-[12.5px] text-text backdrop-blur-md hover:border-flame/70">
                Reset camera
              </button>
              <button type="button" onClick={onStatic}
                className="press hidden h-9 items-center rounded-lg border border-line-strong/80 bg-void/70 px-2.5 text-[12.5px] text-text-2 backdrop-blur-md hover:border-flame/70 hover:text-text sm:inline-flex">
                Static view
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
