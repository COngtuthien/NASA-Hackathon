"use client";

// The 3D viewport (loaded on the client only, in its own chunk with three.js). It owns the WebGL capability
// check, context-loss recovery, camera buttons, keyboard camera control and the always-visible mode banner.
import { useCallback, useId, useRef, useState, type KeyboardEvent } from "react";
import InteractiveScene, { type InteractiveSceneProps } from "@/components/3d/InteractiveScene";
import ModelLegend, { type LegendItem } from "@/components/3d/ModelLegend";
import SceneCanvas from "@/components/3d/SceneCanvas";
import SceneFallback from "@/components/3d/SceneFallback";
import type { CameraApi, CameraHome } from "@/components/3d/ScientificCameraControls";
import { hasWebGL } from "@/components/3d/webgl";
import { Icon } from "@/components/icons";
import { SCENE_BY_ID } from "@/lib/lab-models";
import { MODES, type Mode } from "@/lib/lab-scientific-metadata";

export const CAMERA_HOME: Record<string, CameraHome> = {
  // FLEX in millimetres, BASS-II in centimetres, SAFFIRE-I in metres
  flex: { position: [17, 7.5, 31], target: [0, 1.5, 0], min: 6, max: 120 },
  bass: { position: [-2, 19, 44], target: [-3, -0.8, 0], min: 6, max: 110 },
  saffire: { position: [2.1, 1.25, 2.6], target: [0, 0.05, 0], min: 0.8, max: 7 },
};

export const LEGEND: Record<string, LegendItem[]> = {
  flex: [
    { color: "#5b8cff", label: "Flame envelope (conceptual)" },
    { color: "#ffb547", label: "Fuel vapour, outward" },
    { color: "#4fd1e8", label: "O₂ (dots, inward arrows)" },
    { color: "#5d6b83", label: "N₂ and diluent" },
    { color: "#c47a2c", label: "Soot (heptane)" },
  ],
  bass: [
    { color: "#4fd1e8", label: "Airflow direction" },
    { color: "#ff8a3d", label: "Flame (illustrative)" },
    { color: "#ffb547", label: "Flame-front travel" },
    { color: "#3b2a22", label: "Burned region (illustrative)" },
  ],
  saffire: [
    { color: "#4fd1e8", label: "Airflow (bottom → top)" },
    { color: "#ffb547", label: "Flame-spread direction (CSV)" },
    { color: "#c9b48a", label: "SIBAL sample card" },
    { color: "#5b8cff", label: "Selected component" },
  ],
};

function CamButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      className="press grid h-9 w-9 place-items-center rounded-lg border border-line-strong/80 bg-void/70 text-text-2 backdrop-blur-md hover:border-flame/70 hover:text-text">
      {children}
    </button>
  );
}

export default function LabViewport({ scene, mode, animate, measuredLabel, onStatic }: {
  scene: InteractiveSceneProps; mode: Mode; animate: boolean; measuredLabel: string | null; onStatic: () => void;
}) {
  const [webgl] = useState(hasWebGL);
  const [lost, setLost] = useState(0);
  const [restoreKey, setRestoreKey] = useState(0);
  const cam = useRef<CameraApi>(null);
  const helpId = useId();
  const s = SCENE_BY_ID[scene.id];
  const onLost = useCallback(() => setLost((n) => n + 1), []);

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const c = cam.current;
    if (!c) return;
    const step = e.shiftKey ? 0.35 : 0.12;
    const map: Record<string, () => void> = {
      ArrowLeft: () => c.rotate(-step, 0), ArrowRight: () => c.rotate(step, 0),
      ArrowUp: () => c.rotate(0, step), ArrowDown: () => c.rotate(0, -step),
      "+": () => c.zoom(1.15), "=": () => c.zoom(1.15), "-": () => c.zoom(1 / 1.15), _: () => c.zoom(1 / 1.15),
      "0": () => c.reset(), Home: () => c.reset(),
    };
    const fn = map[e.key];
    if (fn) { e.preventDefault(); fn(); }
  }

  const banner = MODES[mode].banner;
  const failed = !webgl || lost > 0;

  return (
    <div className="relative h-full w-full overflow-hidden" data-testid="lab-viewport" data-scene={scene.id}>
      {failed ? (
        <SceneFallback scene={s} reason={!webgl ? "no-webgl" : "context-lost"}
          onRetry={webgl ? () => { setLost(0); setRestoreKey((k) => k + 1); } : undefined} />
      ) : (
        <div tabIndex={0} role="group" aria-roledescription="3D viewer" aria-label={`${s.title} 3D view. ${s.textAlternative}`} aria-describedby={helpId}
          onKeyDown={onKey} className="absolute inset-0 focus-visible:outline-offset-[-3px]" data-testid="lab-canvas-host">
          <SceneCanvas key={restoreKey} home={CAMERA_HOME[scene.id]} animate={animate} cameraRef={cam} onContextLost={onLost}
            label={`${s.title} interactive 3D model`}>
            <InteractiveScene {...scene} />
          </SceneCanvas>
          <p id={helpId} className="sr-only">Use the arrow keys to rotate, plus and minus to zoom, and 0 to reset the view. All components are also listed as buttons in the Explain panel.</p>
        </div>
      )}

      {/* mode banner: always visible so the scene can never be mistaken for measured output */}
      <div className="pointer-events-none absolute left-3 right-3 top-3 z-30 flex flex-wrap items-start justify-between gap-2">
        <p data-testid="mode-banner" className={`max-w-[46ch] rounded-lg border px-2.5 py-1.5 text-[12px] font-medium leading-snug backdrop-blur-md ${
          mode === "conceptual" ? "border-warn/50 bg-void/75 text-warn" : "border-data/50 bg-void/75 text-data"}`}>
          {banner}{mode === "evidence" && measuredLabel && <span className="mt-0.5 block font-normal text-text-2">Drawn to measured size: {measuredLabel}</span>}
        </p>
        <span className="rounded-full border border-line-strong/70 bg-void/70 px-2.5 py-0.5 text-[11.5px] text-text-2 backdrop-blur-md">{s.scale}</span>
      </div>

      {!failed && (
        <>
          <div className="absolute bottom-3 left-3 z-30 hidden max-w-[220px] md:block"><ModelLegend items={LEGEND[scene.id]} /></div>
          <div className="absolute bottom-3 right-3 z-30 flex flex-col items-end gap-2">
            <p className="hidden rounded-md bg-void/70 px-2 py-1 text-[11.5px] text-text-3 backdrop-blur-md sm:block">
              Drag to rotate · Scroll or pinch to zoom · Select a component to inspect
            </p>
            <div className="flex gap-1.5" role="toolbar" aria-label="Camera">
              <CamButton label="Rotate left" onClick={() => cam.current?.rotate(-0.3, 0)}><Icon name="chevron" className="rotate-180" /></CamButton>
              <CamButton label="Rotate right" onClick={() => cam.current?.rotate(0.3, 0)}><Icon name="chevron" /></CamButton>
              <CamButton label="Zoom in" onClick={() => cam.current?.zoom(1.25)}><span aria-hidden className="text-lg leading-none">+</span></CamButton>
              <CamButton label="Zoom out" onClick={() => cam.current?.zoom(1 / 1.25)}><span aria-hidden className="text-lg leading-none">−</span></CamButton>
              <button type="button" onClick={() => cam.current?.reset()}
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
