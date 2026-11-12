"use client";

// BASS-II flame spread, drawn in centimetres. Confirmed (Summary Report PDF p.12–13, 64): the 7.6 × 7.6 × 17 cm
// duct, fan with flow restrictors upstream, honeycomb straightener and screen, front window (video via mirror),
// still camera looking down on a flat sample, radiometer in the downstream top back corner, hot-wire igniter,
// and the sample geometry ranges. Illustrative: sample length, holder shape, igniter position, flame shape and the
// travelling front (its speed is not a measured spread rate).
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { approach, flameMaterialArgs, flameU } from "@/components/3d/flameMaterial";
import { Annotation } from "@/components/3d/ScientificAnnotations";
import { Arrow, hoverCursor, pickPart, seeded, useCursorReset, useDotTexture } from "@/components/3d/sceneUtils";
import type { BassSceneProps } from "@/components/3d/types";

const DUCT = 7.6;          // cm, outer cross-section (documented)
const LEN = 17;            // cm, test section length (documented)
const WALL = 0.22;         // cm, illustrative
const SAMPLE_LEN = 10;     // cm, illustrative
const N_AIR = 220;
const PRIORITY = ["igniter", "radiometer", "sample", "flame", "holder", "straightener", "fan", "duct"];

type Pts = THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;

function Wall({ pos, size, part, glass = false, dim = false }: { pos: THREE.Vector3Tuple; size: THREE.Vector3Tuple; part: string; glass?: boolean; dim?: boolean }) {
  return (
    <mesh position={pos} userData={{ part }} {...hoverCursor}>
      <boxGeometry args={size} />
      {glass ? <meshPhysicalMaterial color="#9fc3ff" roughness={0.05} metalness={0} transparent opacity={0.08} depthWrite={false} />
        : <meshStandardMaterial color="#1c2230" metalness={0.5} roughness={0.45} transparent={dim} opacity={dim ? 0.35 : 1} />}
    </mesh>
  );
}

export default function FlameSpreadScene({ state, measured, common, animate, mode, selected, onSelect }: BassSceneProps) {
  useCursorReset();
  const invalidate = useThree((s) => s.invalidate);
  const dot = useDotTexture();
  const evidence = mode === "evidence" && measured !== null;
  const { sample, flow } = state;
  const rodLike = sample === "rod";
  // drawn sample dimensions (cm): measured in evidence mode where the CSV has them, else typical documented values
  const width = evidence && measured?.width_cm ? measured.width_cm : 2;
  const thick = sample === "thin-film" ? 0.03 : sample === "fabric" ? 0.05
    : evidence && measured?.thickness_mm ? measured.thickness_mm / 10 : 0.3;
  const rodD = evidence && measured?.diameter_mm ? measured.diameter_mm / 10 : 0.95;
  const stagnation = flow === "stagnation" && rodLike;
  const concurrent = flow === "concurrent";

  const flameArgs = useMemo(() => flameMaterialArgs("#3f6bff", "#ffa040", 1), []);
  const air = useMemo(() => {
    const r = seeded(25);
    return { seeds: Array.from({ length: N_AIR }, () => ({ y: (r() - 0.5) * (DUCT - 1.2), z: (r() - 0.5) * (DUCT - 1.2), ph: r() })), pos: new Float32Array(N_AIR * 3) };
  }, []);

  const ductBox = useMemo(() => new THREE.BoxGeometry(LEN, DUCT, DUCT), []);
  useEffect(() => () => ductBox.dispose(), [ductBox]);
  const flameMat = useRef<THREE.ShaderMaterial>(null);
  const flameRef = useRef<THREE.Group>(null);
  const burnRef = useRef<THREE.Mesh>(null);
  const frontRef = useRef<THREE.Mesh>(null);
  const airPts = useRef<Pts>(null);
  const live = useRef({ time: 0, front: { value: 0.45 }, transport: { value: common.transport ? 1 : 0 } });

  useEffect(() => { invalidate(); }, [invalidate, sample, flow, width, thick, rodD, common.transport, common.annotations, mode, selected, animate, state.showFront]);

  // geometry of the travelling front along x (sample spans -L/2..L/2; air flows toward +x)
  const half = SAMPLE_LEN / 2;
  const frontX = (p: number) => (stagnation ? -half : concurrent ? -half + p * SAMPLE_LEN : half - p * SAMPLE_LEN);

  useFrame((_, dt) => {
    const L = live.current;
    let moving = approach(L.transport, common.transport ? 1 : 0, dt, 6);
    if (animate) L.time += dt;
    const target = state.showFront && animate ? (L.time * 0.045) % 1 : 0.45;
    if (state.showFront && animate) L.front.value = target; else moving = approach(L.front, target, dt, 5) || moving;
    const p = stagnation ? 0 : 0.08 + L.front.value * 0.84;
    const fx = frontX(p);

    // flame: short and hugging the front in opposed flow, trailing downstream in concurrent flow
    const fu = flameU(flameMat.current);
    if (fu) {
      fu.uTime.value = L.time;
      fu.uFlicker.value = animate ? 1 : 0;
      fu.uStretch.value = concurrent ? 0.85 : stagnation ? 0.1 : 0.22;
      fu.uIntensity.value = (selected === "flame" ? 1.8 : 1.4) * (evidence ? 0.7 : 1);
    }
    const g = flameRef.current;
    if (g) {
      const across = rodLike ? rodD / 2 + 0.75 : width / 2 + 0.45;
      const thickness = rodLike ? rodD / 2 + 0.75 : Math.max(0.7, thick * 2 + 0.6);
      if (stagnation) { g.position.set(-half - 0.35, 0, 0); g.rotation.set(0, 0, Math.PI / 2); g.scale.set(thickness, 1, across); }
      else if (concurrent) { g.position.set(fx - 0.4, 0, 0); g.rotation.set(0, 0, -Math.PI / 2); g.scale.set(thickness, 1.9, across); }
      else { g.position.set(fx + 0.5, 0, 0); g.rotation.set(0, 0, Math.PI / 2); g.scale.set(thickness, 1.25, across); }
    }
    // burned region: from the ignition end to the front
    const b = burnRef.current;
    if (b) {
      const start = concurrent ? -half : half;
      const len = Math.abs(fx - start);
      b.visible = !stagnation && len > 0.05;
      b.position.x = (fx + start) / 2;
      b.scale.x = Math.max(len, 0.01);
    }
    if (frontRef.current) { frontRef.current.position.x = fx; frontRef.current.visible = !stagnation && state.showFront; }

    const a = airPts.current;
    if (a) {
      const attr = a.geometry.attributes.position as THREE.BufferAttribute;
      const x0 = -LEN / 2 - 4.5, span = LEN + 6;
      for (let i = 0; i < N_AIR; i++) {
        const s = air.seeds[i];
        attr.setXYZ(i, x0 + ((s.ph + L.time * 0.12) % 1) * span, s.y, s.z);
      }
      attr.needsUpdate = true;
      a.material.opacity = 0.7 * L.transport.value;
    }
    if (moving && !animate) invalidate();
  });

  const A = common.annotations;
  const sampleColor = sample === "fabric" ? "#cdbb93" : sample === "thin-film" ? "#bcd6f2" : "#d9e7f5";
  const sampleSel = selected === "sample";
  const igniterX = concurrent || stagnation ? -half - 0.7 : half + 0.7;
  const inner = DUCT / 2 - WALL;

  return (
    <group onClick={(e) => { e.stopPropagation(); const p = pickPart(e, PRIORITY); if (p) onSelect(p); }}>
      {/* flow duct: dark back and bottom, window front, rail plate on top (still-camera view) */}
      <group>
        <Wall part="duct" pos={[0, 0, -DUCT / 2 + WALL / 2]} size={[LEN, DUCT, WALL]} />
        <Wall part="duct" pos={[0, -DUCT / 2 + WALL / 2, 0]} size={[LEN, WALL, DUCT]} />
        <Wall part="duct" pos={[0, DUCT / 2 - WALL / 2, 0]} size={[LEN, WALL, DUCT]} glass />
        <Wall part="duct" pos={[0, 0, DUCT / 2 - WALL / 2]} size={[LEN, DUCT, WALL]} glass />
        {/* window frames and rounded-corner cue */}
        {[[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([sy, sz]) => (
          <mesh key={`${sy}${sz}`} position={[0, sy * (DUCT / 2 - 0.3), sz * (DUCT / 2 - 0.3)]} rotation={[0, 0, Math.PI / 2]} raycast={() => null}>
            <cylinderGeometry args={[0.3, 0.3, LEN, 12, 1, true]} />
            <meshStandardMaterial color="#1b212b" metalness={0.5} roughness={0.5} transparent opacity={sz > 0 || sy > 0 ? 0.35 : 1} side={THREE.DoubleSide} />
          </mesh>
        ))}
        <lineSegments raycast={() => null}>
          <edgesGeometry args={[ductBox]} />
          <lineBasicMaterial color={selected === "duct" ? "#5b8cff" : "#4a6085"} transparent opacity={0.75} />
        </lineSegments>
        {selected === "duct" && (
          <mesh raycast={() => null}><boxGeometry args={[LEN + 0.05, DUCT + 0.05, DUCT + 0.05]} /><meshBasicMaterial color="#5b8cff" wireframe transparent opacity={0.35} /></mesh>
        )}
      </group>

      {/* upstream: fan housing with restrictor plate, then honeycomb straightener and screen */}
      <group position={[-LEN / 2 - 3.6, 0, 0]} userData={{ part: "fan" }} {...hoverCursor}>
        <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[3.1, 3.1, 4.2, 40, 1, true]} />
          <meshStandardMaterial color={selected === "fan" ? "#2a3a5c" : "#1a1f29"} metalness={0.5} roughness={0.45} side={THREE.DoubleSide} /></mesh>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} rotation={[i * (Math.PI * 2 / 5), 0, 0]} position={[0.2, 0, 0]}><boxGeometry args={[0.12, 2.6, 0.7]} />
            <meshStandardMaterial color="#59647a" metalness={0.6} roughness={0.35} /></mesh>
        ))}
        <mesh position={[0.2, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.55, 0.55, 0.8, 20]} /><meshStandardMaterial color="#3a4458" metalness={0.6} roughness={0.3} /></mesh>
        <mesh position={[-2.05, 0, 0]} rotation={[0, Math.PI / 2, 0]}><ringGeometry args={[1.1, 3.1, 40]} /><meshStandardMaterial color="#2c3444" side={THREE.DoubleSide} /></mesh>
      </group>
      <group position={[-LEN / 2 - 0.75, 0, 0]} userData={{ part: "straightener" }} {...hoverCursor}>
        <mesh><boxGeometry args={[1.1, DUCT - 0.1, DUCT - 0.1, 1, 10, 10]} />
          <meshBasicMaterial color={selected === "straightener" ? "#5b8cff" : "#56627a"} wireframe transparent opacity={selected === "straightener" ? 0.9 : 0.4} /></mesh>
        <mesh position={[0.62, 0, 0]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[DUCT - 0.2, DUCT - 0.2, 16, 16]} />
          <meshBasicMaterial color="#a9b8cd" wireframe transparent opacity={0.15} /></mesh>
      </group>

      {/* sample holder (illustrative): two side rails on a bracket from the back wall */}
      <group userData={{ part: "holder" }} {...hoverCursor}>
        {!rodLike && sample !== "sphere" && [-1, 1].map((s) => (
          <mesh key={s} position={[0, 0, s * (width / 2 + 0.12)]}><boxGeometry args={[SAMPLE_LEN + 1.2, Math.max(thick, 0.1) + 0.24, 0.22]} />
            <meshStandardMaterial color={selected === "holder" ? "#5b8cff" : "#6b7486"} metalness={0.7} roughness={0.3} /></mesh>
        ))}
        <mesh position={[half + 0.9, 0, -inner / 2]}><boxGeometry args={[0.3, 0.3, inner]} />
          <meshStandardMaterial color="#6b7486" metalness={0.7} roughness={0.3} /></mesh>
        {(rodLike || sample === "sphere") && (
          <mesh position={[half + 0.45, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.12, 0.12, 0.9, 12]} />
            <meshStandardMaterial color="#9aa4b8" metalness={0.8} roughness={0.25} /></mesh>
        )}
      </group>

      {/* the sample */}
      <group userData={{ part: "sample" }} {...hoverCursor}>
        {(sample === "thin-film" || sample === "slab" || sample === "fabric") && (
          <mesh><boxGeometry args={[SAMPLE_LEN, thick, width]} />
            <meshPhysicalMaterial color={sampleColor} roughness={sample === "fabric" ? 0.9 : 0.15} clearcoat={sample === "fabric" ? 0 : 0.6}
              transparent opacity={sample === "fabric" ? 1 : 0.75} emissive={sampleSel ? "#ff8a3d" : "#000000"} emissiveIntensity={0.25} /></mesh>
        )}
        {rodLike && (
          <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[rodD / 2, rodD / 2, SAMPLE_LEN, 40]} />
            <meshPhysicalMaterial color="#cfe0f2" roughness={0.12} clearcoat={0.8} transparent opacity={0.8} emissive={sampleSel ? "#ff8a3d" : "#000000"} emissiveIntensity={0.25} /></mesh>
        )}
        {sample === "sphere" && (
          <mesh position={[half - 1.2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <sphereGeometry args={[2, 48, 24, 0, Math.PI * 2, 0, Math.PI / 3]} />
            <meshPhysicalMaterial color="#d9e7f5" roughness={0.15} clearcoat={0.6} transparent opacity={0.85} side={THREE.DoubleSide} emissive={sampleSel ? "#ff8a3d" : "#000000"} emissiveIntensity={0.25} /></mesh>
        )}
      </group>

      {/* burned region and front line (illustrative) */}
      {sample !== "sphere" && (
        <mesh ref={burnRef} raycast={() => null}>
          {rodLike ? <boxGeometry args={[1, rodD * 1.01, rodD * 1.01]} /> : <boxGeometry args={[1, thick + 0.02, width * 1.005]} />}
          <meshStandardMaterial color="#3b2a22" roughness={0.9} transparent opacity={rodLike ? 0.55 : 0.85} />
        </mesh>
      )}
      {sample !== "sphere" && (
        <mesh ref={frontRef} raycast={() => null}>
          <boxGeometry args={[0.08, (rodLike ? rodD : thick) + 0.06, (rodLike ? rodD : width) + 0.06]} />
          <meshBasicMaterial color="#ffb547" />
        </mesh>
      )}

      {/* flame */}
      <group ref={flameRef} userData={{ part: "flame" }} {...hoverCursor}>
        <mesh><sphereGeometry args={[1, 56, 40]} /><shaderMaterial ref={flameMat} args={[flameArgs]} /></mesh>
      </group>
      <pointLight color="#ff9a4a" intensity={10} distance={16} decay={2} position={[0, 1.2, 0]} />
      <pointLight color="#9fb6ff" intensity={5} distance={20} decay={2} position={[0, 2.6, 2.4]} />

      {/* hot-wire igniter (position illustrative) */}
      <group position={[igniterX, 0.1, 0]} userData={{ part: "igniter" }} {...hoverCursor}>
        <mesh rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[0.35, 0.05, 8, 24]} /><meshStandardMaterial color={selected === "igniter" ? "#ff8a3d" : "#c06a3c"} emissive="#ff6a2a" emissiveIntensity={0.4} /></mesh>
        <mesh position={[0, 1.7, -0.6]} rotation={[0.35, 0, 0]}><cylinderGeometry args={[0.05, 0.05, 3.2, 8]} /><meshStandardMaterial color="#8a93a6" metalness={0.8} roughness={0.3} /></mesh>
      </group>

      {/* radiometer: downstream top back corner, looking upstream (documented) */}
      <group position={[LEN / 2 - 0.9, DUCT / 2 - 0.9, -DUCT / 2 + 0.9]} userData={{ part: "radiometer" }} {...hoverCursor}>
        <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.38, 0.38, 1.1, 20]} /><meshStandardMaterial color={selected === "radiometer" ? "#5b8cff" : "#3a4458"} metalness={0.6} roughness={0.3} /></mesh>
        <mesh position={[-0.56, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.24, 0.24, 0.04, 20]} /><meshStandardMaterial color="#7fb2ff" emissive="#4f8dff" emissiveIntensity={0.6} /></mesh>
      </group>

      {/* centimetre scale along the back wall */}
      <group position={[-5, -DUCT / 2 + WALL + 0.02, -DUCT / 2 + WALL + 0.4]}>
        <mesh position={[5, 0, 0]} raycast={() => null}><boxGeometry args={[10, 0.03, 0.06]} /><meshBasicMaterial color="#a9b8cd" /></mesh>
        {Array.from({ length: 11 }, (_, i) => <mesh key={i} position={[i, 0.1, 0]} raycast={() => null}><boxGeometry args={[0.04, i % 5 ? 0.18 : 0.32, 0.04]} /><meshBasicMaterial color="#a9b8cd" /></mesh>)}
      </group>

      {/* airflow */}
      <points ref={airPts} raycast={() => null}>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[air.pos, 3]} /></bufferGeometry>
        <pointsMaterial map={dot} color="#4fd1e8" size={0.16} sizeAttenuation transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0} />
      </points>
      {common.transport && [-2, 0, 2].map((y) => (
        <Arrow key={y} from={[-LEN / 2 - 8.2, y, 0]} to={[-LEN / 2 - 5.9, y, 0]} color="#4fd1e8" opacity={0.85} radius={0.07} head={0.5} />
      ))}
      {common.transport && <Arrow from={[LEN / 2 + 0.4, 0, 0]} to={[LEN / 2 + 3, 0, 0]} color="#4fd1e8" opacity={0.6} radius={0.07} head={0.5} />}
      {state.showFront && !stagnation && (
        <Arrow from={[concurrent ? -1.5 : 1.5, (rodLike ? rodD / 2 : thick / 2) + 1.9, width / 2 + 0.6]} to={[concurrent ? 1.5 : -1.5, (rodLike ? rodD / 2 : thick / 2) + 1.9, width / 2 + 0.6]}
          color="#ffb547" opacity={0.95} radius={0.07} head={0.5} />
      )}

      {A && (
        <>
          <Annotation id="duct" label="Flow duct 7.6 × 7.6 × 17 cm" position={[2, DUCT / 2 + 0.7, -1]} selected={selected === "duct"} onSelect={onSelect} />
          <Annotation id="fan" label="Fan + flow restrictors" position={[-LEN / 2 - 3.6, 3.8, 0]} selected={selected === "fan"} onSelect={onSelect} />
          <Annotation id="straightener" label="Honeycomb + screen" position={[-LEN / 2 - 0.75, -DUCT / 2 - 0.7, 1]} selected={selected === "straightener"} onSelect={onSelect} />
          <Annotation id="sample" tone={evidence ? "measured" : "default"} position={[-3.8, 1.5, -width / 2 - 0.6]} selected={sampleSel} onSelect={onSelect}
            label={evidence ? `Sample · ${measured?.diameter_mm ? `Ø ${measured.diameter_mm} mm` : measured?.width_cm ? `${measured.width_cm} cm wide` : "size not recorded"} (CSV)` : "Solid sample"} />
          <Annotation id="holder" label="Holder (illustrative)" position={[half + 0.9, -1.2, -inner / 2]} selected={selected === "holder"} onSelect={onSelect} />
          <Annotation id="flame" label={stagnation ? "Flame at the rod tip (stagnation)" : concurrent ? "Flame trails downstream (concurrent)" : "Flame creeps upstream (opposed)"}
            position={[stagnation ? -half - 1.5 : 1.5, -2.3, width / 2 + 0.8]} selected={selected === "flame"} onSelect={onSelect} />
          {state.showFront && !stagnation && <Annotation id="flame" label="Illustrative front travel, not a measured rate" tone="warn" position={[0, (rodLike ? rodD / 2 : thick / 2) + 2.6, width / 2 + 0.6]} selected={false} onSelect={onSelect} />}
          <Annotation id="igniter" label="Hot-wire igniter" position={[igniterX, -1.3, 0.8]} selected={selected === "igniter"} onSelect={onSelect} />
          <Annotation id="radiometer" label="Radiometer" position={[LEN / 2 - 0.9, DUCT / 2 + 0.6, -DUCT / 2 + 0.9]} selected={selected === "radiometer"} onSelect={onSelect} />
          {common.transport && <Annotation id="fan" label="Airflow →" position={[-LEN / 2 - 7, 2.9, 0]} selected={false} onSelect={onSelect} />}
          <Annotation id="duct" label="10 cm scale" position={[-5.6, -DUCT / 2 + 0.75, -DUCT / 2 + 0.6]} selected={false} onSelect={() => undefined} />
        </>
      )}
    </group>
  );
}
