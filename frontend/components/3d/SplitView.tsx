"use client";

// Side-by-side comparison inside ONE canvas: one WebGL context, one camera, two scissored viewports. The left and
// right groups sit at the same world position and are shown alternately for each half, so the camera (and every
// orbit, zoom or reset) is synchronized by construction. Cheaper than two canvases on integrated graphics.
import { useFrame } from "@react-three/fiber";
import { useRef, type ReactNode } from "react";
import type * as THREE from "three";

export default function SplitView({ left, right }: { left: ReactNode; right: ReactNode }) {
  const a = useRef<THREE.Group>(null);
  const b = useRef<THREE.Group>(null);

  // priority 1: this callback renders the frame (R3F skips its own render while a positive-priority frame callback exists)
  useFrame(({ gl, scene, camera, size }) => {
    const cam = camera as THREE.PerspectiveCamera;
    const w = size.width, h = size.height, half = Math.floor(w / 2);
    const aspect = cam.aspect;
    gl.autoClear = false;
    gl.setScissorTest(true);
    gl.clear();
    cam.aspect = half / h;
    cam.updateProjectionMatrix();
    for (const [show, hide, x] of [[a, b, 0], [b, a, half]] as const) {
      if (show.current) show.current.visible = true;
      if (hide.current) hide.current.visible = false;
      gl.setViewport(x, 0, half, h);
      gl.setScissor(x, 0, half, h);
      gl.render(scene, cam);
    }
    if (a.current) a.current.visible = true;
    if (b.current) b.current.visible = true;
    gl.setScissorTest(false);
    gl.setViewport(0, 0, w, h);
    cam.aspect = aspect;
    cam.updateProjectionMatrix();
    gl.autoClear = true;
  }, 1);

  return (
    <>
      <group ref={a}>{left}</group>
      <group ref={b}>{right}</group>
    </>
  );
}
