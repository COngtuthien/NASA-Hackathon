"use client";

import { lazy, Suspense, useEffect } from "react";
import type { BassSceneProps, FlexSceneProps, SaffireSceneProps } from "@/components/3d/types";
import { labStats } from "@/components/3d/webgl";
import type { SceneId } from "@/lib/lab-models";

// Each scene is its own chunk, fetched only when selected; only one is mounted at a time.
const DropletCombustionScene = lazy(() => import("@/components/3d/DropletCombustionScene"));
const FlameSpreadScene = lazy(() => import("@/components/3d/FlameSpreadScene"));
const SpacecraftFireScene = lazy(() => import("@/components/3d/SpacecraftFireScene"));

export type InteractiveSceneProps =
  | { id: "flex"; props: FlexSceneProps }
  | { id: "bass"; props: BassSceneProps }
  | { id: "saffire"; props: SaffireSceneProps };

function Mounted({ id }: { id: SceneId }) {
  useEffect(() => {
    const s = labStats();
    s.sceneLoads[id] = (s.sceneLoads[id] ?? 0) + 1;
  }, [id]);
  return null;
}

/** Studio lighting shared by all scenes: cool key and rim, low ambient. Flames add their own warm point light. */
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

export default function InteractiveScene(s: InteractiveSceneProps) {
  return (
    <>
      <Lights />
      <Suspense fallback={null}>
        <Mounted id={s.id} />
        {s.id === "flex" && <DropletCombustionScene {...s.props} />}
        {s.id === "bass" && <FlameSpreadScene {...s.props} />}
        {s.id === "saffire" && <SpacecraftFireScene {...s.props} />}
      </Suspense>
    </>
  );
}
