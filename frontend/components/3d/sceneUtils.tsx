"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";

/** Soft round sprite for particle dots (generated once, disposed with the scene). */
export function useDotTexture() {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.45, "rgba(255,255,255,0.85)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

/** A straight arrow from `from` to `to` (shaft + cone head). */
export function Arrow({ from, to, color, opacity = 1, radius = 0.05, head = 0.35 }: {
  from: THREE.Vector3Tuple; to: THREE.Vector3Tuple; color: string; opacity?: number; radius?: number; head?: number;
}) {
  const { mid, quat, len } = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const dir = b.clone().sub(a);
    const l = dir.length();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return { mid: a.clone().add(b).multiplyScalar(0.5), quat: q, len: l };
  }, [from, to]);
  const shaft = Math.max(len - head, 0.001);
  if (opacity <= 0.01) return null;
  return (
    <group position={mid} quaternion={quat}>
      <mesh position={[0, -head / 2, 0]} raycast={() => null}>
        <cylinderGeometry args={[radius, radius, shaft, 10]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
      </mesh>
      <mesh position={[0, len / 2 - head / 2, 0]} raycast={() => null}>
        <coneGeometry args={[radius * 3, head, 14]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
      </mesh>
    </group>
  );
}

/**
 * Click picking for nested parts (a flame shell encloses the droplet). Picks the most specific tagged part among
 * everything under the pointer, by the given priority order.
 */
export function pickPart(e: ThreeEvent<MouseEvent>, priority: string[]): string | null {
  const parts = new Set<string>();
  for (const i of e.intersections) {
    let o: THREE.Object3D | null = i.object;
    while (o) {
      if (o.userData?.part) { parts.add(o.userData.part as string); break; }
      o = o.parent;
    }
  }
  return priority.find((p) => parts.has(p)) ?? null;
}

export const hoverCursor = {
  onPointerOver: (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); document.body.style.cursor = "pointer"; },
  onPointerOut: () => { document.body.style.cursor = ""; },
};

/** Reset the cursor if the scene unmounts while hovered. */
export function useCursorReset() {
  useEffect(() => () => { document.body.style.cursor = ""; }, []);
}

/** Deterministic pseudo-random numbers, so particle layouts are identical between visits. */
export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
