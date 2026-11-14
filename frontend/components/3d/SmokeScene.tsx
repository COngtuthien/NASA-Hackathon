"use client";

// SAME smoke path, an ORIGINAL simplified schematic (not a reproduction of the SAME engineering drawings).
// Documented in the SAME Final Science Report and ICES decks: a heated sample on a carousel, a smoke duct, an aging
// chamber with a piston, a diluter, and moment instruments (P-Trak = number, ionization = first moment, two DustTraks
// with 1 µm and 10 µm cut-offs = mass) plus the Space Shuttle (ionization) and ISS (light-scattering) detectors.
// Layout, sizes, colours and particle motion are illustrative. Particles are not to scale and no trajectory,
// velocity or size distribution is computed: measured particle statistics are shown in the panel, not here.
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Annotation } from "@/components/3d/ScientificAnnotations";
import { Arrow, seeded, useCursorReset, useDotTexture } from "@/components/3d/sceneUtils";

export type SmokeSceneProps = {
  stage: number;            // 1 heating · 2 formation · 3 transport · 4 aging · 5 sampling · 6 detection
  aged: boolean;
  material: string;
  animate: boolean;
  labels: boolean;
  selected: string | null;
  onSelect: (id: string) => void;
};

type V3 = [number, number, number];
const SAMPLE: V3 = [-4.6, 0, 0];
const DUCT_IN: V3 = [-4.0, 0, 0];
const CHAMBER: V3 = [-0.6, 0, 0];
const CH_TOP: V3 = [-0.6, 1.3, 0];
const DILUTER: V3 = [1.6, 1.3, 0];
const INSTR: Record<string, V3> = {
  ptrak: [3.6, 2.1, 0], ion: [3.6, 1.3, 0], dustA: [3.6, 0.5, 0], dustB: [3.6, -0.3, 0], sts: [1.6, -1.3, 0], iss: [3.0, -1.3, 0],
};
const PATHS: Record<number, V3[]> = {
  2: [SAMPLE, [-4.3, 0.15, 0], DUCT_IN],
  3: [DUCT_IN, [-2.5, 0, 0], [-1.4, 0, 0], CHAMBER],
  5: [CH_TOP, [0.4, 1.3, 0], DILUTER, [2.6, 1.3, 0], INSTR.ion],
};

function along(path: V3[], f: number): V3 {
  const segs = path.length - 1;
  const x = Math.min(segs - 1e-6, Math.max(0, f * segs));
  const i = Math.floor(x), t = x - i;
  const a = path[i], b = path[i + 1];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function place(arr: Float32Array, base: Float32Array, stage: number, t: number, n: number) {
  for (let i = 0; i < n; i++) {
    const ph = base[i * 4], jx = base[i * 4 + 1], jy = base[i * 4 + 2], jz = base[i * 4 + 3];
    let p: V3;
    if (stage === 1) p = [SAMPLE[0] + jx * 0.05, -9, 0];                  // hidden below view while heating
    else if (stage === 4) {                                                // slowly mixing inside the chamber
      const a = ph * Math.PI * 2 + t * 0.15 * (0.5 + jx);
      p = [CHAMBER[0] + Math.cos(a) * 0.62 * (0.3 + Math.abs(jy)), CHAMBER[1] + jz * 1.1, Math.sin(a) * 0.62 * (0.3 + Math.abs(jy))];
    } else if (stage === 6) {
      const keys = Object.keys(INSTR);
      const k = INSTR[keys[i % keys.length]];
      const a = ph * Math.PI * 2 + t * 0.4;
      p = [k[0] + Math.cos(a) * 0.18, k[1] + Math.sin(a) * 0.12, k[2] + jz * 0.1];
    } else {
      const f = (ph + t * 0.12) % 1;
      const q = along(PATHS[stage], f);
      p = [q[0] + jx * 0.1, q[1] + jy * 0.1, q[2] + jz * 0.1];
    }
    arr[i * 3] = p[0]; arr[i * 3 + 1] = p[1]; arr[i * 3 + 2] = p[2];
  }
}

function Smoke({ stage, aged, animate }: { stage: number; aged: boolean; animate: boolean }) {
  const tex = useDotTexture();
  const n = aged && stage >= 4 ? 120 : 260;            // illustration of coagulation: fewer, larger particles
  const base = useMemo(() => {
    const rnd = seeded(41);
    const b = new Float32Array(260 * 4);
    for (let i = 0; i < 260; i++) b.set([rnd(), rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1], i * 4);
    return b;
  }, []);
  const positions = useMemo(() => {
    const a = new Float32Array(n * 3);
    place(a, base, stage, 0, n);
    return a;
  }, [base, stage, n]);
  const ref = useRef<THREE.Points>(null);
  const t = useRef(0);
  useFrame((_, dt) => {
    if (!animate || !ref.current) return;
    t.current += Math.min(dt, 0.1);
    const attr = ref.current.geometry.attributes.position as THREE.BufferAttribute;
    place(attr.array as Float32Array, base, stage, t.current, n);
    attr.needsUpdate = true;
  });
  if (stage === 1) return null;
  return (
    <points ref={ref} key={`${stage}-${n}`} raycast={() => null}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial map={tex} color={aged && stage >= 4 ? "#d8c6a8" : "#c9d3e2"} size={aged && stage >= 4 ? 0.16 : 0.08}
        sizeAttenuation transparent opacity={0.8} depthWrite={false} />
    </points>
  );
}

function Box({ id, pos, size, color, label, on, selected, onSelect, labels, note }: {
  id: string; pos: V3; size: V3; color: string; label: string; on: boolean; selected: string | null;
  onSelect: (id: string) => void; labels: boolean; note?: string;
}) {
  return (
    <group position={pos}>
      <mesh userData={{ part: id }} onClick={(e) => { e.stopPropagation(); onSelect(id); }}>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} emissive={on ? color : "#000000"} emissiveIntensity={on ? 0.55 : 0}
          roughness={0.6} metalness={0.3} transparent opacity={selected && selected !== id ? 0.45 : 1} />
      </mesh>
      {labels && <Annotation position={[0, size[1] / 2 + 0.22, 0]} label={label} id={id} selected={selected === id} onSelect={onSelect} note={note} />}
    </group>
  );
}

function Tube({ from, to, r = 0.12, color = "#6b7a92" }: { from: V3; to: V3; r?: number; color?: string }) {
  const { mid, quat, len } = useMemo(() => {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
    const d = b.clone().sub(a);
    return { mid: a.clone().add(b).multiplyScalar(0.5), len: d.length(),
      quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()) };
  }, [from, to]);
  return (
    <mesh position={mid} quaternion={quat} raycast={() => null}>
      <cylinderGeometry args={[r, r, len, 20, 1, true]} />
      <meshStandardMaterial color={color} transparent opacity={0.35} side={THREE.DoubleSide} roughness={0.4} metalness={0.2} />
    </mesh>
  );
}

export default function SmokeScene({ stage, aged, material, animate, labels, selected, onSelect }: SmokeSceneProps) {
  useCursorReset();
  const heat = stage <= 2;
  const coil = useRef<THREE.MeshStandardMaterial>(null);
  useFrame((s) => {
    if (coil.current) coil.current.emissiveIntensity = heat ? 0.9 + (animate ? Math.sin(s.clock.elapsedTime * 4) * 0.25 : 0) : 0.05;
  });
  const sampleColor = { kapton: "#c98a2b", teflon: "#e9e6df", silicone: "#7f8fa3", lampwick: "#d9c79d", dbp: "#b9c7a0" }[material] ?? "#aaaaaa";
  return (
    <group>
      {/* heated sample on its carousel position */}
      <mesh position={SAMPLE} rotation={[0, 0, Math.PI / 2]} userData={{ part: "sample" }} onClick={(e) => { e.stopPropagation(); onSelect("sample"); }}>
        <cylinderGeometry args={[0.13, 0.13, 0.7, 20]} />
        <meshStandardMaterial color={sampleColor} roughness={0.7} />
      </mesh>
      <mesh position={SAMPLE} rotation={[0, Math.PI / 2, 0]} raycast={() => null}>
        <torusGeometry args={[0.2, 0.03, 10, 40]} />
        <meshStandardMaterial ref={coil} color="#ff8a3d" emissive="#ff5a1f" emissiveIntensity={0.9} />
      </mesh>
      {/* smoke duct and air flow */}
      <Tube from={[-5.1, 0, 0]} to={[-1.4, 0, 0]} r={0.32} />
      <Arrow from={[-5.4, 0.55, 0]} to={[-4.4, 0.55, 0]} color="#4fd1e8" radius={0.02} head={0.15} opacity={0.8} />
      {/* aging chamber with piston */}
      <mesh position={CHAMBER} userData={{ part: "chamber" }} onClick={(e) => { e.stopPropagation(); onSelect("chamber"); }}>
        <cylinderGeometry args={[0.9, 0.9, 2.2, 40, 1, true]} />
        <meshStandardMaterial color="#8fa3c0" transparent opacity={stage === 4 ? 0.32 : 0.2} side={THREE.DoubleSide}
          emissive={stage === 4 ? "#4fd1e8" : "#000000"} emissiveIntensity={stage === 4 ? 0.18 : 0} />
      </mesh>
      <mesh position={[CHAMBER[0], -1.0, 0]} raycast={() => null}>
        <cylinderGeometry args={[0.86, 0.86, 0.08, 40]} />
        <meshStandardMaterial color="#5d6b83" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* sampling path */}
      <Tube from={CH_TOP} to={[0.4, 1.3, 0]} r={0.07} />
      <Tube from={[0.4, 1.3, 0]} to={[1.3, 1.3, 0]} r={0.07} />
      <Tube from={[1.9, 1.3, 0]} to={[3.1, 1.3, 0]} r={0.06} />
      <Tube from={[2.8, 2.1, 0]} to={[2.8, -0.3, 0]} r={0.05} />
      <Tube from={[0.2, -1.1, 0]} to={[3.4, -1.1, 0]} r={0.05} />
      <Box id="diluter" pos={DILUTER} size={[0.6, 0.45, 0.45]} color="#7f92ad" label="Diluter" on={stage === 5} selected={selected} onSelect={onSelect} labels={labels} />
      <Box id="ptrak" pos={INSTR.ptrak} size={[0.7, 0.45, 0.45]} color="#22a6bf" label="P-Trak (particle number)" on={stage >= 5} selected={selected} onSelect={onSelect} labels={labels} />
      <Box id="ion" pos={INSTR.ion} size={[0.7, 0.45, 0.45]} color="#a07ceb" label="Ionization (1st moment)" on={stage >= 5} selected={selected} onSelect={onSelect} labels={labels} />
      <Box id="dustA" pos={INSTR.dustA} size={[0.7, 0.45, 0.45]} color="#d87830" label="DustTrak A (1 µm cut-off)" on={stage >= 5} selected={selected} onSelect={onSelect} labels={labels} />
      <Box id="dustB" pos={INSTR.dustB} size={[0.7, 0.45, 0.45]} color="#d87830" label="DustTrak B (10 µm cut-off)" on={stage >= 5} selected={selected} onSelect={onSelect} labels={labels} />
      <Box id="sts" pos={INSTR.sts} size={[0.6, 0.4, 0.4]} color="#56a93b" label="Space Shuttle detector (ionization)" on={stage === 6} selected={selected} onSelect={onSelect} labels={labels} />
      <Box id="iss" pos={INSTR.iss} size={[0.6, 0.4, 0.4]} color="#f5c451" label="ISS detector (light scattering)" on={stage === 6} selected={selected} onSelect={onSelect} labels={labels} />
      <Smoke stage={stage} aged={aged} animate={animate} />
      {labels && (
        <>
          <Annotation position={[SAMPLE[0], 0.6, 0]} label="Heated sample (wire coil)" id="sample" selected={selected === "sample"} onSelect={onSelect} />
          <Annotation position={[CHAMBER[0], 1.55, 0]} label="Aging chamber (piston)" id="chamber" selected={selected === "chamber"} onSelect={onSelect} />
          <Annotation position={[-2.8, -0.6, 0]} label="Smoke duct" id="duct" selected={selected === "duct"} onSelect={onSelect} />
        </>
      )}
    </group>
  );
}
