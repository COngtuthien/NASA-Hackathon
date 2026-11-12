"use client";

import { OrbitControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { labStats } from "@/components/3d/webgl";

export type CameraHome = { position: [number, number, number]; target: [number, number, number]; min: number; max: number };

export type CameraApi = {
  reset: () => void;
  rotate: (azimuth: number, polar: number) => void;
  zoom: (factor: number) => void;
};

/**
 * Orbit + zoom around the scene's subject. No panning, so the subject can never be lost off-screen.
 * The imperative API backs the on-screen buttons and keyboard shortcuts.
 */
const ScientificCameraControls = forwardRef<CameraApi, { home: CameraHome; damping: boolean }>(function ScientificCameraControls({ home, damping }, ref) {
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const size = useThree((s) => s.size);
  const key = `${home.position.join(",")}|${home.target.join(",")}`;
  // camera position for diagnostics and tests (rounded; cheap)
  const report = useCallback(() => { labStats().camera = camera.position.toArray().map((v) => Math.round(v * 1000) / 1000); }, [camera]);

  // Move to the scene's home view whenever the scene (its home) changes, and remember it for reset().
  useEffect(() => {
    // back off on narrow (portrait) viewports so the whole subject stays in frame
    const aspect = size.width > 0 && size.height > 0 ? size.width / size.height : 1;
    const k = THREE.MathUtils.clamp(0.85 / aspect, 1, 1.8);
    const t = new THREE.Vector3(...home.target);
    camera.position.copy(new THREE.Vector3(...home.position).sub(t).multiplyScalar(k).add(t));
    camera.lookAt(t);
    const c = controls.current;
    if (c) {
      c.target.set(...home.target);
      c.update();
      c.saveState();
    }
    report();
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useImperativeHandle(ref, () => ({
    reset: () => {
      const c = controls.current;
      if (c) {
        // drop any damping momentum first, or the camera keeps drifting after the reset
        const d = c.enableDamping;
        c.enableDamping = false;
        c.update();
        c.reset();
        c.enableDamping = d;
      }
      report();
      invalidate();
    },
    rotate: (az, pol) => {
      const c = controls.current;
      if (!c) return;
      const offset = new THREE.Vector3().subVectors(camera.position, c.target);
      const sph = new THREE.Spherical().setFromVector3(offset);
      sph.theta -= az;
      sph.phi = THREE.MathUtils.clamp(sph.phi - pol, 0.08, Math.PI - 0.08);
      offset.setFromSpherical(sph);
      camera.position.copy(c.target).add(offset);
      camera.lookAt(c.target);
      c.update();
      report();
      invalidate();
    },
    zoom: (f) => {
      const c = controls.current as unknown as { dollyIn?: (s: number) => void; dollyOut?: (s: number) => void; update: () => void } | null;
      if (!c) return;
      // OrbitControls naming: dollyOut moves the camera closer (zoom in), dollyIn moves it away
      if (f > 1) c.dollyOut?.(f); else c.dollyIn?.(1 / f);
      c.update();
      report();
      invalidate();
    },
  }), [invalidate, camera, report]);

  return (
    <OrbitControls ref={controls} makeDefault onChange={report} enablePan={false} enableDamping={damping} dampingFactor={0.09}
      minDistance={home.min} maxDistance={home.max} rotateSpeed={0.7} zoomSpeed={0.8} />
  );
});

export default ScientificCameraControls;
