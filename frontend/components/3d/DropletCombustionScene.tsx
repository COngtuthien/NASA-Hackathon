"use client";

// FLEX droplet combustion, drawn in millimetres. Conceptual by design: the flame sits at a fixed 4× the droplet
// radius, the 1 g teardrop is a qualitative shape, and nothing (size, colour, motion) is computed from a burn
// model. In evidence mode the droplet and its extinction diameter are drawn at the selected test's measured
// D₀ and D_ext; the flame shell stays conceptual and is dimmed.
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { approach, flameMaterialArgs, flameU } from "@/components/3d/flameMaterial";
import { Annotation, Leader } from "@/components/3d/ScientificAnnotations";
import { Arrow, hoverCursor, pickPart, seeded, useCursorReset, useDotTexture } from "@/components/3d/sceneUtils";
import type { FlexSceneProps } from "@/components/3d/types";

export const FLAME_RADIUS_FACTOR = 4;
const PRIORITY = ["droplet", "soot", "flame", "ambient"];

/** JS mirror of the shader's teardrop deformation (without flicker), for particles. */
function deform(x: number, y: number, z: number, s: number): [number, number, number] {
  const up = Math.max(y, 0);
  const t = up >= 1 ? 1 : up * up * (3 - 2 * up);
  const taper = 1 - s * 0.5 * t;
  const ny = (y > 0 ? y * (1 + s * 1.5) : y * (1 - s * 0.22)) + s * 0.32;
  return [x * taper, ny, z * taper];
}

const N_SOOT = 520;
const N_AMB = 300;
const N_FUEL = 90;
const N_OX = 110;
const N_BUOY = 160;
const C_O2 = new THREE.Color("#4fd1e8");
const C_OTHER = new THREE.Color("#5d6b83");

type Pts = THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;

function makeSeeds() {
  const r = seeded(69);
  const sphere = () => {
    const u = r() * 2 - 1, th = r() * Math.PI * 2, sq = Math.sqrt(1 - u * u);
    return { x: sq * Math.cos(th), y: u, z: sq * Math.sin(th) };
  };
  return {
    soot: Array.from({ length: N_SOOT }, () => ({ ...sphere(), rad: 0.38 + r() * 0.42, sp: 0.2 + r() * 0.5 })),
    amb: Array.from({ length: N_AMB }, (_, i) => ({ ...sphere(), rad: 1.45 + r() * 1.6, ph: r() * 6.28, rank: (i + 0.5) / N_AMB })),
    fuel: Array.from({ length: N_FUEL }, () => ({ ...sphere(), ph: r() })),
    ox: Array.from({ length: N_OX }, () => ({ ...sphere(), ph: r() })),
    buoy: Array.from({ length: N_BUOY }, () => ({ th: r() * Math.PI * 2, r0: 0.55 + r() * 1.5, ph: r() })),
  };
}

export default function DropletCombustionScene({ state, measured, common, animate, mode, selected, onSelect }: FlexSceneProps) {
  useCursorReset();
  const invalidate = useThree((s) => s.invalidate);
  const evidence = mode === "evidence" && measured !== null;
  const d0 = evidence && measured?.d0_mm ? measured.d0_mm : state.d0;
  const dext = evidence ? measured?.dext_mm ?? null : null;
  const o2 = evidence && typeof measured?.x_o2 === "number" ? measured.x_o2 : state.o2;
  const fuel = evidence && measured?.fuel ? measured.fuel : state.fuel;
  const gravityTarget = evidence ? 0 : state.gravity === "earth" ? 1 : 0;
  const rd = d0 / 2;
  const rf = rd * FLAME_RADIUS_FACTOR;
  const heptane = fuel === "Heptane";

  const dot = useDotTexture();
  const flameArgs = useMemo(() => flameMaterialArgs("#3f7bff", "#ffb23f", 0.95), []);
  const coreArgs = useMemo(() => flameMaterialArgs("#2a5cff", "#ff8a3d", 0.35), []);
  const seeds = useMemo(() => makeSeeds(), []);
  const buf = useMemo(() => ({
    soot: new Float32Array(N_SOOT * 3), amb: new Float32Array(N_AMB * 3), ambCol: new Float32Array(N_AMB * 3),
    fuel: new Float32Array(N_FUEL * 3), ox: new Float32Array(N_OX * 3), buoy: new Float32Array(N_BUOY * 3),
  }), []);

  const flameMat = useRef<THREE.ShaderMaterial>(null);
  const coreMat = useRef<THREE.ShaderMaterial>(null);
  const sootPts = useRef<Pts>(null);
  const ambPts = useRef<Pts>(null);
  const fuelPts = useRef<Pts>(null);
  const oxPts = useRef<Pts>(null);
  const buoyPts = useRef<Pts>(null);
  const light = useRef<THREE.PointLight>(null);
  const dropletRef = useRef<THREE.Mesh>(null);
  const flameRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const rootRef = useRef<THREE.Group>(null);
  // live values eased toward their targets, and the decorative clock
  const live = useRef({ stretch: { value: gravityTarget }, rf: { value: rf }, rd: { value: rd }, o2: { value: o2 }, soot: { value: heptane ? 1 : 0 },
    transport: { value: common.transport ? 1 : 0 }, time: 0, ambO2: -1 });

  // render a frame whenever an input changes (the canvas renders on demand when motion is off)
  useEffect(() => { invalidate(); }, [invalidate, gravityTarget, rf, rd, o2, heptane, common.transport, common.annotations, mode, selected, animate]);

  useFrame((_, dt) => {
    const L = live.current;
    let moving = false;
    moving = approach(L.stretch, gravityTarget, dt, 3) || moving;
    moving = approach(L.rf, rf, dt, 5) || moving;
    moving = approach(L.rd, rd, dt, 5) || moving;
    moving = approach(L.o2, o2, dt, 6) || moving;
    moving = approach(L.soot, heptane ? 1 : 0, dt, 4) || moving;
    moving = approach(L.transport, common.transport ? 1 : 0, dt, 6) || moving;
    if (animate) L.time += dt;
    const t = L.time, s = L.stretch.value, R = L.rf.value, r = L.rd.value;
    const dim = evidence ? 0.45 : 1;

    const fu = flameU(flameMat.current);
    if (fu) {
      fu.uTime.value = t;
      fu.uStretch.value = s;
      fu.uFlicker.value = animate ? 1 : 0;
      fu.uIntensity.value = (heptane ? 1.05 : 0.85) * (selected === "flame" ? 1.35 : 1) * dim;
      fu.uTip.value.set(heptane ? "#ffc04a" : "#ff9a3d");
    }
    const cu = flameU(coreMat.current);
    if (cu) {
      cu.uTime.value = t * 0.8;
      cu.uStretch.value = s;
      cu.uFlicker.value = animate ? 1 : 0;
      cu.uIntensity.value = 0.3 * dim;
    }

    // soot: a loose shell between droplet and flame, swirling slowly (heptane only)
    const soot = sootPts.current;
    if (soot) {
      const a = soot.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < N_SOOT; i++) {
        const p = seeds.soot[i];
        const ang = t * p.sp * 0.35, c = Math.cos(ang), sn = Math.sin(ang);
        const [x, y, z] = deform((p.x * c - p.z * sn) * p.rad, p.y * p.rad, (p.x * sn + p.z * c) * p.rad, s);
        a.setXYZ(i, x * R, y * R, z * R);
      }
      a.needsUpdate = true;
      soot.material.opacity = 0.55 * L.soot.value * (selected === "soot" ? 1.5 : 1);
    }

    // ambient gas: the cyan share equals the O₂ mole fraction (illustrative dots)
    const amb = ambPts.current;
    if (amb) {
      if (Math.abs(L.ambO2 - L.o2.value) > 0.002) {
        L.ambO2 = L.o2.value;
        const col = amb.geometry.attributes.color as THREE.BufferAttribute;
        for (let i = 0; i < N_AMB; i++) {
          const c = seeds.amb[i].rank < L.o2.value ? C_O2 : C_OTHER;
          col.setXYZ(i, c.r, c.g, c.b);
        }
        col.needsUpdate = true;
      }
      const a = amb.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < N_AMB; i++) {
        const p = seeds.amb[i];
        const k = (p.rad + 0.04 * Math.sin(t * 0.6 + p.ph)) * R;
        a.setXYZ(i, p.x * k, p.y * k + s * R * 0.4, p.z * k);
      }
      a.needsUpdate = true;
      amb.material.opacity = selected === "ambient" ? 0.95 : 0.6;
    }

    // transport: microgravity radial diffusion (fuel out, O₂ in) cross-fades with the 1 g buoyant updraft
    const tv = L.transport.value;
    const fp = fuelPts.current;
    if (fp) {
      const a = fp.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < N_FUEL; i++) {
        const p = seeds.fuel[i];
        const rad = r * 1.15 + ((p.ph + t * 0.18) % 1) * (R * 0.92 - r * 1.15);
        a.setXYZ(i, p.x * rad, p.y * rad, p.z * rad);
      }
      a.needsUpdate = true;
      fp.material.opacity = 0.85 * tv * (1 - s);
    }
    const op = oxPts.current;
    if (op) {
      const a = op.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < N_OX; i++) {
        const p = seeds.ox[i];
        const rad = R * 2.3 - ((p.ph + t * 0.12) % 1) * (R * 2.3 - R * 1.06);
        a.setXYZ(i, p.x * rad, p.y * rad, p.z * rad);
      }
      a.needsUpdate = true;
      op.material.opacity = 0.75 * tv * (1 - s);
    }
    const bp = buoyPts.current;
    if (bp) {
      const a = bp.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < N_BUOY; i++) {
        const p = seeds.buoy[i];
        const y = -2.2 * R + ((p.ph + t * 0.16) % 1) * 5.6 * R;
        const k = y < -R ? 1 : 1 - 0.38 * Math.min(1, (y + R) / (3 * R));
        const rr = R * (p.r0 + 0.95) * k;
        a.setXYZ(i, Math.cos(p.th) * rr, y, Math.sin(p.th) * rr);
      }
      a.needsUpdate = true;
      bp.material.opacity = 0.65 * tv * s;
    }

    if (light.current) {
      light.current.position.y = R * 0.92 * s;
      light.current.intensity = (heptane ? 22 : 14) * (1 + (animate ? 0.06 * Math.sin(t * 9.3) * Math.sin(t * 4.1) : 0)) * (R / 6) ** 2 * dim;
    }
    dropletRef.current?.scale.setScalar(r);
    flameRef.current?.scale.setScalar(R);
    coreRef.current?.scale.setScalar(R * 0.62);
    // keep the stretched 1 g flame centred in view
    rootRef.current?.position.set(0, -s * R * 0.95, 0);
    if (moving && !animate) invalidate();
  });

  const earth = gravityTarget === 1;
  const lift = earth ? rf * 0.9 : 0;
  const A = common.annotations;
  const ruler = Math.max(1, Math.round(d0)); // scale bar length in whole millimetres
  const dropSel = selected === "droplet" || selected === "surface";

  return (
    <group ref={rootRef} onClick={(e) => { e.stopPropagation(); const p = pickPart(e, PRIORITY); if (p) onSelect(p); }}>
      {/* droplet: a glossy liquid sphere */}
      <mesh ref={dropletRef} userData={{ part: "droplet" }} {...hoverCursor}>
        <sphereGeometry args={[1, 64, 48]} />
        <meshPhysicalMaterial color={heptane ? "#d9e6ff" : "#cfeaff"} roughness={0.08} metalness={0} clearcoat={1} clearcoatRoughness={0.05}
          transparent opacity={evidence ? 0.38 : 0.94} emissive={dropSel ? "#ff8a3d" : "#1a2a44"} emissiveIntensity={dropSel ? 0.35 : 0.25} />
      </mesh>
      {selected === "surface" && (
        <mesh scale={rd * 1.06} raycast={() => null}>
          <sphereGeometry args={[1, 32, 24]} />
          <meshBasicMaterial color="#ffb547" transparent opacity={0.3} depthWrite={false} wireframe />
        </mesh>
      )}
      {/* measured extinction diameter and initial-diameter ring (evidence mode) */}
      {evidence && dext !== null && dext > 0 && (
        <mesh scale={dext / 2} raycast={() => null}>
          <sphereGeometry args={[1, 48, 32]} />
          <meshStandardMaterial color="#4fd1e8" emissive="#4fd1e8" emissiveIntensity={0.5} transparent opacity={0.85} />
        </mesh>
      )}
      {evidence && (
        <mesh rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
          <torusGeometry args={[rd, Math.max(0.012, rd * 0.012), 8, 96]} />
          <meshBasicMaterial color="#4fd1e8" />
        </mesh>
      )}

      {/* flame envelope: shell + faint inner glow, and the warm light it casts */}
      <mesh ref={flameRef} userData={{ part: "flame" }} {...hoverCursor}>
        <sphereGeometry args={[1, 72, 56]} />
        <shaderMaterial ref={flameMat} args={[flameArgs]} />
      </mesh>
      <mesh ref={coreRef} raycast={() => null}>
        <sphereGeometry args={[1, 40, 30]} />
        <shaderMaterial ref={coreMat} args={[coreArgs]} />
      </mesh>
      <pointLight ref={light} color="#ff9a4a" distance={rf * 6} decay={2} intensity={18} />

      {/* soot shell (heptane) */}
      <points ref={sootPts} userData={{ part: "soot" }}>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[buf.soot, 3]} /></bufferGeometry>
        <pointsMaterial map={dot} color="#c47a2c" size={Math.max(0.1, rd * 0.13)} sizeAttenuation transparent depthWrite={false} opacity={0} />
      </points>

      {/* ambient gas */}
      <points ref={ambPts} userData={{ part: "ambient" }}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[buf.amb, 3]} />
          <bufferAttribute attach="attributes-color" args={[buf.ambCol, 3]} />
        </bufferGeometry>
        <pointsMaterial map={dot} vertexColors size={Math.max(0.2, rf * 0.06)} sizeAttenuation transparent depthWrite={false} opacity={0.6} />
      </points>

      {/* transport indicators */}
      <points ref={fuelPts} raycast={() => null}>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[buf.fuel, 3]} /></bufferGeometry>
        <pointsMaterial map={dot} color="#ffb547" size={Math.max(0.14, rd * 0.22)} sizeAttenuation transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0} />
      </points>
      <points ref={oxPts} raycast={() => null}>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[buf.ox, 3]} /></bufferGeometry>
        <pointsMaterial map={dot} color="#4fd1e8" size={Math.max(0.16, rd * 0.25)} sizeAttenuation transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0} />
      </points>
      <points ref={buoyPts} raycast={() => null}>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[buf.buoy, 3]} /></bufferGeometry>
        <pointsMaterial map={dot} color="#7fd8ff" size={Math.max(0.16, rd * 0.25)} sizeAttenuation transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0} />
      </points>
      {common.transport && !earth && [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([vx, vz], i) => (
        <group key={i}>
          <Arrow from={[vx * rf * 2.5, 0, vz * rf * 2.5]} to={[vx * rf * 1.6, 0, vz * rf * 1.6]} color="#4fd1e8" opacity={0.8} radius={rf * 0.012} head={rf * 0.13} />
          <Arrow from={[vx * rd * 1.4 + vz * rd * 0.6, rd * 0.4, vz * rd * 1.4 + vx * rd * 0.6]} to={[vx * rf * 0.7 + vz * rf * 0.25, rd * 0.4, vz * rf * 0.7 + vx * rf * 0.25]}
            color="#ffb547" opacity={0.85} radius={rf * 0.008} head={rf * 0.09} />
        </group>
      ))}
      {common.transport && earth && [-1, 1].flatMap((sx) => [-1, 1].map((sz) => (
        <Arrow key={`${sx}${sz}`} from={[sx * rf * 1.5, -rf * 1.9, sz * rf * 0.4]} to={[sx * rf * 1.15, rf * 0.6, sz * rf * 0.3]} color="#7fd8ff" opacity={0.5} radius={rf * 0.009} head={rf * 0.13} />
      )))}

      {/* gravity vector (1 g comparison only) */}
      {earth && <Arrow from={[-rf * 2.1, rf * 1.2, 0]} to={[-rf * 2.1, rf * 0.1, 0]} color="#e6edf7" opacity={0.85} radius={rf * 0.016} head={rf * 0.18} />}

      {/* millimetre scale bar */}
      <group position={[-ruler / 2, -rf * 1.25, rf * 0.2]}>
        <mesh position={[ruler / 2, 0, 0]} raycast={() => null}><boxGeometry args={[ruler, rf * 0.012, rf * 0.012]} /><meshBasicMaterial color="#a9b8cd" /></mesh>
        {Array.from({ length: ruler + 1 }, (_, i) => (
          <mesh key={i} position={[i, rf * 0.025, 0]} raycast={() => null}><boxGeometry args={[rf * 0.01, rf * 0.06, rf * 0.01]} /><meshBasicMaterial color="#a9b8cd" /></mesh>
        ))}
      </group>

      {A && (
        <>
          <Annotation id="droplet" label={evidence ? `Droplet D₀ ${d0} mm (measured)` : "Fuel droplet"} tone={evidence ? "measured" : "default"}
            position={[0, -rd * 1.9, 0]} selected={selected === "droplet"} onSelect={onSelect} />
          <Annotation id="surface" label="Fuel surface" position={[rd * 1.9, rd * 1.5, 0]} selected={selected === "surface"} onSelect={onSelect} />
          <Leader from={[rd * 1.9, rd * 1.5, 0]} to={[rd * 0.7, rd * 0.7, 0]} />
          <Annotation id="flame" label={evidence ? "Flame envelope (conceptual)" : "Flame envelope"} position={[rf * 0.95, rf * 0.75 + lift, 0]} selected={selected === "flame"} onSelect={onSelect} />
          {heptane && <Annotation id="soot" label="Soot shell (heptane)" position={[-rf * 0.85, rf * 0.15 + lift * 0.4, 0]} selected={selected === "soot"} onSelect={onSelect} />}
          <Annotation id="ambient" label={`Ambient gas · O₂ ${o2.toFixed(2)}${evidence ? " (recorded)" : ""}`} tone={evidence ? "measured" : "default"}
            position={[-rf * 1.6, -rf * 0.55, 0]} selected={selected === "ambient"} onSelect={onSelect} />
          {common.transport && <Annotation id="transport" label={earth ? "Buoyant updraft (1 g)" : "Fuel out · O₂ in"} position={[rf * 1.9, -rf * 0.55, 0]} selected={selected === "transport"} onSelect={onSelect} />}
          {evidence && dext !== null && dext > 0 && <Annotation id="droplet" label={`D_ext ${dext} mm (measured)`} tone="measured" position={[0, rd * 1.5, rd * 1.2]} selected={false} onSelect={onSelect} />}
          {earth && <Annotation id="transport" label="g (gravity)" position={[-rf * 2.1, rf * 1.45, 0]} selected={false} onSelect={onSelect} />}
          <Annotation id="scale" label={`${ruler} mm scale`} position={[0, -rf * 1.42, rf * 0.2]} selected={false} onSelect={() => undefined} />
        </>
      )}
    </group>
  );
}
