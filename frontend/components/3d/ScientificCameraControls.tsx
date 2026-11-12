"use client";

import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { labStats } from "@/components/3d/webgl";

export type CameraHome = { position: [number, number, number]; target: [number, number, number]; min: number; max: number };

/** A camera move: look at `target`; either from `position`, or keep the current direction at `distance`. */
export type CameraShot = { target: [number, number, number]; position?: [number, number, number]; distance?: number };

export type CameraApi = {
  reset: () => void;
  rotate: (azimuth: number, polar: number) => void;
  zoom: (factor: number) => void;
  /** Smoothly move to a shot (instant when `smooth` is false, e.g. reduced motion). */
  fly: (shot: CameraShot, smooth: boolean) => void;
};

type Tween = { fromP: THREE.Vector3; toP: THREE.Vector3; fromT: THREE.Vector3; toT: THREE.Vector3; t: number; dur: number };

/**
 * Orbit + zoom around the scene's subject. No panning, so the subject can never be lost off-screen.
 * The imperative API backs the on-screen buttons, keyboard shortcuts, component focus and camera presets.
 */
const ScientificCameraControls = forwardRef<CameraApi, { home: CameraHome; damping: boolean }>(function ScientificCameraControls({ home, damping }, ref) {
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const size = useThree((s) => s.size);
  const tween = useRef<Tween | null>(null);
  const key = `${home.position.join(",")}|${home.target.join(",")}`;
  // camera position for diagnostics and tests (rounded; cheap)
  const report = useCallback(() => { labStats().camera = camera.position.toArray().map((v) => Math.round(v * 1000) / 1000); }, [camera]);

  // Move to the scene's home view whenever the scene (its home) changes, and remember it for reset().
  useEffect(() => {
    // back off on narrow (portrait) viewports so the whole subject stays in frame
    const aspect = size.width > 0 && size.height > 0 ? size.width / size.height : 1;
    const k = THREE.MathUtils.clamp(0.85 / aspect, 1, 1.8);
    const t = new THREE.Vector3(...home.target);
    tween.current = null;
    camera.position.copy(new THREE.Vector3(...home.position).sub(t).multiplyScalar(k).add(t));
    camera.lookAt(t);
    const c = controls.current;
    if (c) {
      c.target.copy(t);
      c.update();
      c.saveState();
    }
    report();
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useFrame((_, dt) => {
    const tw = tween.current, c = controls.current;
    if (!tw || !c) return;
    tw.t = Math.min(1, tw.t + dt / tw.dur);
    const e = 1 - Math.pow(1 - tw.t, 3);             // ease-out cubic
    camera.position.lerpVectors(tw.fromP, tw.toP, e);
    c.target.lerpVectors(tw.fromT, tw.toT, e);
    c.update();
    report();
    if (tw.t >= 1) tween.current = null;
    else invalidate();
  });

  useImperativeHandle(ref, () => ({
    reset: () => {
      const c = controls.current;
      tween.current = null;
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
      tween.current = null;
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
      tween.current = null;
      // OrbitControls naming: dollyOut moves the camera closer (zoom in), dollyIn moves it away
      if (f > 1) c.dollyOut?.(f); else c.dollyIn?.(1 / f);
      c.update();
      report();
      invalidate();
    },
    fly: (shot, smooth) => {
      const c = controls.current;
      if (!c) return;
      const toT = new THREE.Vector3(...shot.target);
      let toP: THREE.Vector3;
      if (shot.position) toP = new THREE.Vector3(...shot.position);
      else {
        const dir = new THREE.Vector3().subVectors(camera.position, c.target).normalize();
        toP = toT.clone().add(dir.multiplyScalar(shot.distance ?? camera.position.distanceTo(c.target)));
      }
      if (!smooth) {
        tween.current = null;
        camera.position.copy(toP);
        c.target.copy(toT);
        c.update();
        report();
        invalidate();
        return;
      }
      tween.current = { fromP: camera.position.clone(), toP, fromT: c.target.clone(), toT, t: 0, dur: 0.9 };
      invalidate();
    },
  }), [invalidate, camera, report]);

  return (
    <OrbitControls ref={controls} makeDefault onChange={report} onStart={() => { tween.current = null; }} enablePan={false}
      enableDamping={damping} dampingFactor={0.09} minDistance={home.min} maxDistance={home.max} rotateSpeed={0.7} zoomSpeed={0.8} />
  );
});

export default ScientificCameraControls;
