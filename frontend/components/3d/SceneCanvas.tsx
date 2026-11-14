"use client";

import { PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import ScientificCameraControls, { type CameraApi, type CameraHome } from "@/components/3d/ScientificCameraControls";
import { labStats } from "@/components/3d/webgl";

// drei's <Html> (the 3D part labels) appends its own nodes beside the canvas and removes them in a cleanup. When a
// page is swapped quickly (client navigation during a view transition) that node can already be detached, and the
// cleanup throws "removeChild: not a child of this node", an error with no effect on the new page. Phase 15 guards
// exactly that case (the standard workaround from React issue #11538): removing a node that is not a child is a no-op.
// Installed once, only in the lazily loaded 3D bundle.
type GuardedNode = typeof Node.prototype & { __sfSafeRemove?: boolean };
if (typeof Node !== "undefined" && !(Node.prototype as GuardedNode).__sfSafeRemove) {
  const original = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) return child;
    return original.call(this, child) as T;
  };
  (Node.prototype as GuardedNode).__sfSafeRemove = true;
}

/** Counts rendered frames (diagnostics and Play/Pause tests). Costs one integer increment per frame. */
function FrameCounter() {
  useFrame(() => { const s = labStats(); s.frames = (s.frames ?? 0) + 1; });
  return null;
}

/**
 * One WebGL canvas for the lab. It renders continuously only while decorative motion is on, the viewport is on
 * screen and the tab is visible; otherwise it renders on demand (after a control or camera change). Resolution
 * adapts to the device and drops when frame rate falls. Context loss is reported to the parent, which shows a
 * restore option; R3F disposes the renderer, geometries and materials on unmount.
 */
export default function SceneCanvas({ home, animate, children, cameraRef, onContextLost, label }: {
  home: CameraHome; animate: boolean; children: ReactNode; cameraRef: Ref<CameraApi>;
  onContextLost: () => void; label: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [onScreen, setOnScreen] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);
  const [dprMax, setDprMax] = useState(1.75);
  const lost = useRef(onContextLost);
  const alive = useRef(false);
  useEffect(() => { lost.current = onContextLost; }, [onContextLost]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { rootMargin: "40px" });
    io.observe(el);
    const vis = () => setTabVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", vis);
    return () => { io.disconnect(); document.removeEventListener("visibilitychange", vis); };
  }, []);

  useEffect(() => {
    const s = labStats();
    s.mounts += 1;
    s.live += 1;
    alive.current = true;
    return () => { alive.current = false; s.live -= 1; s.disposed += 1; };
  }, []);

  const frameloop = !onScreen || !tabVisible ? "never" : animate ? "always" : "demand";

  return (
    <div ref={wrap} className="absolute inset-0" data-frameloop={frameloop}>
      <Canvas
        frameloop={frameloop}
        dpr={[1, dprMax]}
        camera={{ fov: 38, near: 0.01, far: 5000, position: home.position }}
        gl={{ antialias: true, alpha: true, powerPreference: "default" }}
        aria-label={label}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
          gl.domElement.addEventListener("webglcontextlost", (e) => {
            // R3F force-loses the context when it disposes the renderer on unmount: not a failure.
            if (!alive.current) return;
            e.preventDefault();
            labStats().contextLost += 1;
            lost.current();
          }, { once: true });
        }}
      >
        <PerformanceMonitor onDecline={() => setDprMax(1)} onIncline={() => setDprMax(1.75)} flipflops={3} />
        <ScientificCameraControls ref={cameraRef} home={home} damping={animate} />
        <FrameCounter />
        {children}
      </Canvas>
    </div>
  );
}
