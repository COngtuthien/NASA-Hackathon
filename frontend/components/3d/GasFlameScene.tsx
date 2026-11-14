"use client";

// ACME spherical diffusion flame on a porous spherical burner (CFI-G / Flame Design), drawn at 1 unit = 10 mm.
// Evidence classes: burner diameter 6.35 mm (0.25-inch sphere, Flame Design final report PDF p24; CFI-G reused the
// Flame Design burners, CFI-G final report PDF p4) and the reactant arrangement (normal vs inverse) are documented;
// flame shells are ILLUSTRATIVE except when a CFI-G Table 3 event is selected, where the hot- and cool-flame radii
// are drawn at their measured values for that event's condition only. Colours, flicker and particle motion are
// illustrations; nothing here simulates transport, chemistry or heat transfer.
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { approach, flameMaterialArgs, flameU } from "@/components/3d/flameMaterial";
import { Annotation } from "@/components/3d/ScientificAnnotations";
import { Arrow, seeded, useCursorReset, useDotTexture } from "@/components/3d/sceneUtils";

export const MM = 0.1;                       // scene units per millimetre
export const BURNER_DIAMETER_MM = 6.35;      // 0.25-inch porous sphere (documented)
export const ILLUSTRATIVE_HOT_MM = 15;       // illustrative only
export const ILLUSTRATIVE_COOL_MM = 6;       // illustrative only

export type GasSceneProps = {
  config: "normal" | "inverse";
  regime: "hot" | "cool";
  compare: boolean;
  /** Measured radii from CFI-G final report Table 3 (normal n-butane flames at 2.03 bar), or null. */
  measured: { hot_mm: number; cool_mm: number | null; label: string } | null;
  animate: boolean;
  labels: boolean;
  selected: string | null;
  onSelect: (id: string) => void;
};

const FUEL = "#ffb547";
const OXY = "#4fd1e8";

function fill(arr: Float32Array, base: { dirs: Float32Array; phase: Float32Array }, t: number, inward: boolean, rMin: number, rMax: number) {
  for (let i = 0; i < base.phase.length; i++) {
    let f = (base.phase[i] + t * 0.06) % 1;
    if (inward) f = 1 - f;
    const r = rMin + (rMax - rMin) * f;
    arr[i * 3] = base.dirs[i * 3] * r;
    arr[i * 3 + 1] = base.dirs[i * 3 + 1] * r;
    arr[i * 3 + 2] = base.dirs[i * 3 + 2] * r;
  }
}

function Particles({ inward, color, count, rMin, rMax, animate, seed }: {
  inward: boolean; color: string; count: number; rMin: number; rMax: number; animate: boolean; seed: number;
}) {
  const tex = useDotTexture();
  const ref = useRef<THREE.Points>(null);
  const base = useMemo(() => {
    const rnd = seeded(seed);
    const dirs = new Float32Array(count * 3);
    const phase = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      dirs.set([s * Math.cos(th), u, s * Math.sin(th)], i * 3);
      phase[i] = rnd();
    }
    return { dirs, phase };
  }, [count, seed]);
  const t = useRef(0);
  const positions = useMemo(() => {
    const out = new Float32Array(count * 3);
    fill(out, base, 0, inward, rMin, rMax);
    return out;
  }, [count, base, inward, rMin, rMax]);
  useFrame((_, dt) => {
    if (!animate || !ref.current) return;
    t.current += Math.min(dt, 0.1);
    const attr = ref.current.geometry.attributes.position as THREE.BufferAttribute;
    fill(attr.array as Float32Array, base, t.current, inward, rMin, rMax);
    attr.needsUpdate = true;
  });
  return (
    <points ref={ref} raycast={() => null}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial map={tex} color={color} size={0.07} sizeAttenuation transparent opacity={0.75} depthWrite={false} />
    </points>
  );
}

function Shell({ radius, base, tip, intensity, animate, part, onSelect }: {
  radius: number; base: string; tip: string; intensity: number; animate: boolean; part: string; onSelect: (id: string) => void;
}) {
  const args = useMemo(() => flameMaterialArgs(base, tip, intensity), [base, tip, intensity]);
  const mat = useRef<THREE.ShaderMaterial>(null);
  const grp = useRef<THREE.Group>(null);
  const r = useRef({ value: radius });
  useFrame((s, dt) => {
    const u = flameU(mat.current);
    if (u) u.uTime.value = animate ? s.clock.elapsedTime : 0;
    approach(r.current, radius, dt, 5);
    grp.current?.scale.setScalar(r.current.value);
  });
  return (
    <group ref={grp} scale={radius} userData={{ part }} onClick={(e) => { e.stopPropagation(); onSelect(part); }}>
      <mesh>
        <sphereGeometry args={[1, 64, 48]} />
        <shaderMaterial ref={mat} args={[args]} />
      </mesh>
    </group>
  );
}

function DashedRing({ radius, color }: { radius: number; color: string }) {
  const geo = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [radius]);
  const line = useMemo(() => {
    const l = new THREE.Line(geo, new THREE.LineDashedMaterial({ color, dashSize: 0.08, gapSize: 0.06, transparent: true, opacity: 0.85 }));
    l.computeLineDistances();
    return l;
  }, [geo, color]);
  return <primitive object={line} />;
}

function Flame({ config, regime, measured, animate, labels, selected, onSelect, x = 0, caption }: Omit<GasSceneProps, "compare"> & { x?: number; caption?: string }) {
  const burnerR = (BURNER_DIAMETER_MM / 2) * MM;
  const hotR = (measured ? measured.hot_mm : ILLUSTRATIVE_HOT_MM) * MM;
  const coolR = (measured?.cool_mm ?? (measured ? null : ILLUSTRATIVE_COOL_MM)) == null ? null
    : (measured ? measured.cool_mm! : ILLUSTRATIVE_COOL_MM) * MM;
  const out = config === "normal" ? FUEL : OXY;
  const amb = config === "normal" ? OXY : FUEL;
  const flameR = regime === "hot" ? hotR : (coolR ?? hotR * 0.4);
  const sel = (id: string) => selected === id;
  return (
    <group position={[x, 0, 0]}>
      {/* burner + supply tube */}
      <mesh userData={{ part: "burner" }} onClick={(e) => { e.stopPropagation(); onSelect("burner"); }}>
        <sphereGeometry args={[burnerR, 40, 30]} />
        <meshStandardMaterial color={sel("burner") ? "#d9b38c" : "#a08060"} roughness={0.85} metalness={0.25} />
      </mesh>
      <mesh position={[0, -1.6, 0]} userData={{ part: "tube" }} onClick={(e) => { e.stopPropagation(); onSelect("tube"); }}>
        <cylinderGeometry args={[0.06, 0.06, 2.6, 16]} />
        <meshStandardMaterial color="#8a96a8" roughness={0.5} metalness={0.6} />
      </mesh>
      {/* reactant leaving the burner */}
      <Particles inward={false} color={out} count={140} rMin={burnerR * 1.05} rMax={flameR * 0.96} animate={animate} seed={7 + x} />
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2;
        const d: [number, number, number] = [Math.cos(a), Math.sin(a) * 0.9, Math.sin(a) * 0.3];
        return <Arrow key={i} from={[d[0] * burnerR * 1.4, d[1] * burnerR * 1.4, d[2] * burnerR * 1.4]}
          to={[d[0] * flameR * 0.7, d[1] * flameR * 0.7, d[2] * flameR * 0.7]} color={out} opacity={0.75} radius={0.012} head={0.08} />;
      })}
      {/* ambient reactant diffusing toward the flame */}
      <Particles inward color={amb} count={220} rMin={flameR * 1.04} rMax={Math.max(hotR, flameR) * 2.1} animate={animate} seed={19 + x} />
      {/* flame shells */}
      {regime === "hot"
        ? <Shell radius={hotR} base={config === "normal" ? "#4f8dff" : "#5f9bff"} tip="#ffb547" intensity={1.0} animate={animate} part="flame" onSelect={onSelect} />
        : coolR !== null
          ? <Shell radius={coolR} base="#9fc6ff" tip="#c6dcff" intensity={0.38} animate={animate} part="coolflame" onSelect={onSelect} />
          : null}
      {regime === "cool" && measured && <DashedRing radius={hotR} color="#ffb547" />}
      {labels && (
        <>
          <Annotation position={[0, burnerR + 0.25, 0]} label="Porous spherical burner (6.35 mm)" id="burner" selected={sel("burner")} onSelect={onSelect} tone="measured" />
          <Annotation position={[0, -2.2, 0]} label={config === "normal" ? "Fuel supply" : "O₂/N₂ supply"} id="tube" selected={sel("tube")} onSelect={onSelect} />
          <Annotation position={[flameR * 0.72 + 0.35, flameR * 0.72 + 0.35, 0]} label={regime === "hot" ? (measured ? "Hot flame (measured radius)" : "Hot flame (illustrative size)")
            : coolR === null ? "Cool-flame radius not measured" : measured ? "Cool flame (measured radius)" : "Cool flame (illustrative size)"}
            id={regime === "hot" ? "flame" : "coolflame"} selected={sel(regime === "hot" ? "flame" : "coolflame")} onSelect={onSelect}
            tone={measured ? "measured" : "default"} />
          <Annotation position={[-Math.max(hotR, flameR) * 1.5, -0.5, 0]} label={config === "normal" ? "Ambient O₂/N₂" : "Ambient fuel/N₂"} id="ambient" selected={sel("ambient")} onSelect={onSelect} />
          {caption && <Annotation position={[0, Math.max(hotR, flameR) + 0.55, 0]} label={caption} id={`cap-${config}`} selected={false} onSelect={() => {}} />}
        </>
      )}
    </group>
  );
}

export default function GasFlameScene(p: GasSceneProps) {
  useCursorReset();
  if (p.compare) {
    return (
      <group>
        <Flame {...p} config="normal" x={-2.3} caption="Normal: fuel out of the burner" />
        <Flame {...p} config="inverse" measured={null} x={2.3} caption="Inverse: oxidizer out of the burner" />
      </group>
    );
  }
  return <Flame {...p} />;
}
