"use client";

// Side-by-side comparison inside ONE canvas: one WebGL context, one camera, two scissored viewports. The left and
// right groups sit at the same world position and are shown alternately for each half, so the camera (and every
// orbit, zoom or reset) is synchronized by construction. Cheaper than two canvases on integrated graphics.
import { useFrame } from "@react-three/fiber";
import { useRef, type ReactNode } from "react";
import type * as THREE from "three";

/** `stacked`: first view on top, second below (phones), instead of left and right. */
export default function SplitView({ left, right, stacked = false }: { left: ReactNode; right: ReactNode; stacked?: boolean }) {
  const a = useRef<THREE.Group>(null);
  const b = useRef<THREE.Group>(null);

  // priority 1: this callback renders the frame (R3F skips its own render while a positive-priority frame callback exists)
  useFrame(({ gl, scene, camera, size }) => {
    const cam = camera as THREE.PerspectiveCamera;
    const w = size.width, h = size.height;
    const vw = stacked ? w : Math.floor(w / 2), vh = stacked ? Math.floor(h / 2) : h;
    const aspect = cam.aspect;
    gl.autoClear = false;
    gl.setScissorTest(true);
    gl.clear();
    cam.aspect = vw / vh;
    cam.updateProjectionMatrix();
    // WebGL viewports start at the bottom-left: when stacked, the first view goes in the top half
    const slots = stacked ? [[a, b, 0, vh], [b, a, 0, 0]] as const : [[a, b, 0, 0], [b, a, vw, 0]] as const;
    for (const [show, hide, x, y] of slots) {
      if (show.current) show.current.visible = true;
      if (hide.current) hide.current.visible = false;
      gl.setViewport(x, y, vw, vh);
      gl.setScissor(x, y, vw, vh);
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
