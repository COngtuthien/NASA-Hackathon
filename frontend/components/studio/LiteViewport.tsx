"use client";

// Viewport for the Phase 13 studios (Gaseous Flame, Smoke Detection). Loaded client-only in its own chunk with
// three.js; reuses the lab's canvas (on-demand rendering, adaptive resolution, context-loss handling, disposal
// counters) and camera controls (orbit + zoom, no pan, reset).
import { useFrame } from "@react-three/fiber";
import { lazy, Suspense, useEffect, type Ref } from "react";
import SceneCanvas from "@/components/3d/SceneCanvas";
import type { CameraApi, CameraHome } from "@/components/3d/ScientificCameraControls";
import { labStats } from "@/components/3d/webgl";
import type { GasSceneProps } from "@/components/3d/GasFlameScene";
import type { SmokeSceneProps } from "@/components/3d/SmokeScene";
import type { TimelineStore } from "@/lib/timeline";

const GasFlameScene = lazy(() => import("@/components/3d/GasFlameScene"));
const SmokeScene = lazy(() => import("@/components/3d/SmokeScene"));

export type LiteScene = { key: "gas"; props: GasSceneProps } | { key: "smoke"; props: SmokeSceneProps };

function Lights() {
  return (
    <>
      <ambientLight intensity={0.4} color="#9fb6d9" />
      <directionalLight position={[4, 6, 5]} intensity={1.1} color="#dfe8ff" />
      <directionalLight position={[-6, 2, -4]} intensity={0.5} color="#5b8cff" />
      <hemisphereLight args={["#2a3f66", "#05080f", 0.4]} />
    </>
  );
}

/** Advances a guided timeline with the render loop, so it moves only while the scene is actually rendering. */
function TimelineDriver({ store }: { store: TimelineStore }) {
  useFrame((_, dt) => { if (store.get().playing) store.tick(Math.min(dt, 0.1)); });
  return null;
}

function Mounted({ id }: { id: string }) {
  useEffect(() => {
    const s = labStats();
    s.sceneLoads[id] = (s.sceneLoads[id] ?? 0) + 1;
  }, [id]);
  return null;
}

export default function LiteViewport({ scene, home, animate, cameraRef, onContextLost, label, timeline }: {
  scene: LiteScene; home: CameraHome; animate: boolean; cameraRef: Ref<CameraApi>; onContextLost: () => void; label: string;
  timeline?: TimelineStore | null;
}) {
  return (
    <SceneCanvas home={home} animate={animate} cameraRef={cameraRef} onContextLost={onContextLost} label={label}>
      <Lights />
      {timeline && <TimelineDriver store={timeline} />}
      <Suspense fallback={null}>
        {scene.key === "gas" ? <GasFlameScene {...scene.props} /> : <SmokeScene {...scene.props} />}
        <Mounted id={scene.key} />
      </Suspense>
    </SceneCanvas>
  );
}
