"use client";

// SAFFIRE-I conceptual arrangement, drawn in metres. Confirmed by NASA sources: a sample card in the middle of a
// large flow duct; fans at the top of the duct and flow straighteners at the bottom (air drawn upward); a sample of
// about 0.4 m × 0.94 m (Operations document); 20 cm/s flow; two cameras; thermocouples, two radiometers, O₂/CO₂/
// pressure sensors and two anemometers (ISA-Tab); an enclosure of about 0.5 × 1 × 1.3 m (NASA Glenn caption).
// Illustrative: how those enclosure dimensions map to these axes, the duct cross-section, every component position,
// fan count, and the moving flame band (no flame position, speed or ignition location is in the local data).
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { approach, flameMaterialArgs, flameU } from "@/components/3d/flameMaterial";
import { Annotation } from "@/components/3d/ScientificAnnotations";
import { Arrow, hoverCursor, pickPart, seeded, useCursorReset, useDotTexture } from "@/components/3d/sceneUtils";
import type { SaffireSceneProps } from "@/components/3d/types";

const ENC = { w: 0.5, h: 1.3, d: 1.0 };      // NASA Glenn: ~0.5 m wide, ~1 m deep, ~1.3 m long (axis mapping assumed)
const SAMPLE = { w: 0.4, h: 0.94 };            // Operations document: ~0.4 m wide by 0.94 m tall
const DUCT = { w: 0.46, d: 0.42 };             // illustrative duct cross-section
const N_AIR = 260;
const PRIORITY = ["sensors", "cameras", "fans", "straighteners", "flame", "sample", "duct", "enclosure"];

type Pts = THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;

function Selectable({ part, selected, children, position }: { part: string; selected: string | null; children: React.ReactNode; position?: THREE.Vector3Tuple }) {
  return (
    <group position={position} userData={{ part }} {...hoverCursor}>
      {children}
      {selected === part && <pointLight color="#5b8cff" intensity={0.6} distance={0.6} />}
    </group>
  );
}

export default function SpacecraftFireScene({ state, measured, common, animate, mode, selected, onSelect }: SaffireSceneProps) {
  useCursorReset();
  const invalidate = useThree((s) => s.invalidate);
  const dot = useDotTexture();
  const flowDir = (mode === "evidence" && measured?.flow ? measured.flow : state.burn === "S1" ? "Concurrent" : "Opposed").toLowerCase();
  const concurrent = flowDir.startsWith("concurrent");
  const ex = state.exploded ? 1 : 0;

  const flameArgs = useMemo(() => flameMaterialArgs("#3f6bff", "#ffa040", 1), []);
  const air = useMemo(() => {
    const r = seeded(98);
    return { seeds: Array.from({ length: N_AIR }, () => ({ x: (r() - 0.5) * (DUCT.w - 0.04), z: (r() - 0.5) * (DUCT.d - 0.04), ph: r() })), pos: new Float32Array(N_AIR * 3) };
  }, []);

  // source boxes for the outline edges (created once, disposed with the scene)
  const boxes = useMemo(() => ({
    enc: new THREE.BoxGeometry(ENC.w, ENC.h, ENC.d), duct: new THREE.BoxGeometry(DUCT.w, ENC.h - 0.3, DUCT.d),
    card: new THREE.BoxGeometry(SAMPLE.w + 0.03, SAMPLE.h + 0.03, 0.012),
  }), []);
  useEffect(() => () => Object.values(boxes).forEach((b) => b.dispose()), [boxes]);
  const flameMat = useRef<THREE.ShaderMaterial>(null);
  const flameRef = useRef<THREE.Group>(null);
  const burnRef = useRef<THREE.Mesh>(null);
  const airPts = useRef<Pts>(null);
  const fansRef = useRef<THREE.Group>(null);
  const live = useRef({ time: 0, ex: { value: ex }, cut: { value: state.cutaway ? 1 : 0 }, front: { value: 0.4 }, transport: { value: common.transport ? 1 : 0 } });
  const shell = useRef<THREE.MeshStandardMaterial[]>([]);
  const parts = useRef<Record<string, THREE.Group | null>>({});

  useEffect(() => { invalidate(); }, [invalidate, ex, state.cutaway, concurrent, common.transport, common.annotations, selected, animate, mode]);

  useFrame((_, dt) => {
    const L = live.current;
    let moving = false;
    moving = approach(L.ex, ex, dt, 4) || moving;
    moving = approach(L.cut, state.cutaway ? 1 : 0, dt, 5) || moving;
    moving = approach(L.transport, common.transport ? 1 : 0, dt, 6) || moving;
    if (animate) L.time += dt;
    const e = L.ex.value;

    // exploded view offsets
    const P = parts.current;
    P.fans?.position.set(0, ENC.h / 2 - 0.12 + e * 0.32, 0);
    P.straighteners?.position.set(0, -ENC.h / 2 + 0.14 - e * 0.32, 0);
    P.cameras?.position.set(0, 0, e * 0.35);
    P.sensors?.position.set(e * 0.3, 0, 0);
    P.front?.position.set(0, 0, ENC.d / 2 + e * 0.45);
    for (const m of shell.current) if (m) m.opacity = 0.9 - L.cut.value * 0.8;
    if (fansRef.current && animate) fansRef.current.children.forEach((c) => { c.rotation.y += dt * 2.2; });

    // illustrative flame band moving with (concurrent) or against (opposed) the upward flow
    const span = SAMPLE.h * 0.8;
    const target = animate ? (L.time * 0.035) % 1 : 0.4;
    if (animate) L.front.value = target; else moving = approach(L.front, target, dt, 5) || moving;
    const y = concurrent ? -span / 2 + L.front.value * span : span / 2 - L.front.value * span;
    const fu = flameU(flameMat.current);
    if (fu) {
      fu.uTime.value = L.time;
      fu.uFlicker.value = animate ? 1 : 0;
      fu.uStretch.value = concurrent ? 0.8 : 0.15;
      fu.uIntensity.value = (selected === "flame" ? 1.35 : 1) * (mode === "evidence" ? 0.6 : 1);
    }
    if (flameRef.current) {
      flameRef.current.position.set(0, concurrent ? y + 0.02 : y - 0.01, 0);
      flameRef.current.scale.set(SAMPLE.w * 0.56, concurrent ? 0.07 : 0.035, 0.05);
    }
    if (burnRef.current) {
      const start = concurrent ? -SAMPLE.h / 2 : SAMPLE.h / 2;
      const len = Math.abs(y - start);
      burnRef.current.position.y = (y + start) / 2;
      burnRef.current.scale.y = Math.max(len, 0.001);
    }
    const a = airPts.current;
    if (a) {
      const attr = a.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < N_AIR; i++) {
        const s = air.seeds[i];
        attr.setXYZ(i, s.x, -ENC.h / 2 + 0.2 + ((s.ph + L.time * 0.09) % 1) * (ENC.h - 0.4), s.z);
      }
      attr.needsUpdate = true;
      a.material.opacity = 0.6 * L.transport.value;
    }
    if (moving && !animate) invalidate();
  });

  const A = common.annotations;
  const shellMat = (i: number, color = "#e9edf2") => (
    <meshStandardMaterial ref={(m) => { if (m) shell.current[i] = m; }} color={color} metalness={0.15} roughness={0.55} transparent opacity={state.cutaway ? 0.1 : 0.9}
      depthWrite={false} side={THREE.DoubleSide} />
  );
  const sel = (p: string) => selected === p;

  return (
    <group onClick={(e) => { e.stopPropagation(); const p = pickPart(e, PRIORITY); if (p) onSelect(p); }}>
      {/* enclosure shell (conceptual) */}
      <Selectable part="enclosure" selected={selected}>
        <mesh position={[0, 0, -ENC.d / 2]}><planeGeometry args={[ENC.w, ENC.h]} />{shellMat(0)}</mesh>
        <mesh position={[-ENC.w / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[ENC.d, ENC.h]} />{shellMat(1)}</mesh>
        <mesh position={[ENC.w / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[ENC.d, ENC.h]} />{shellMat(2)}</mesh>
        <mesh position={[0, ENC.h / 2, 0]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[ENC.w, ENC.d]} />{shellMat(3)}</mesh>
        <mesh position={[0, -ENC.h / 2, 0]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[ENC.w, ENC.d]} />{shellMat(4)}</mesh>
        <group ref={(g) => { parts.current.front = g; }} position={[0, 0, ENC.d / 2]}>
          <mesh><planeGeometry args={[ENC.w, ENC.h]} />{shellMat(5)}</mesh>
        </group>
        <lineSegments raycast={() => null}>
          <edgesGeometry args={[boxes.enc]} />
          <lineBasicMaterial color={sel("enclosure") ? "#5b8cff" : "#8fa3c2"} transparent opacity={0.7} />
        </lineSegments>
        {/* avionics box (operations: experiment avionics), position illustrative */}
        <mesh position={[0, -ENC.h / 2 + 0.07, -ENC.d / 2 + 0.16]}><boxGeometry args={[0.36, 0.1, 0.22]} /><meshStandardMaterial color="#39424f" metalness={0.4} roughness={0.5} /></mesh>
      </Selectable>

      {/* flow duct around the sample (cross-section illustrative) */}
      <Selectable part="duct" selected={selected}>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * DUCT.w / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[DUCT.d, ENC.h - 0.3]} />
            <meshPhysicalMaterial color={sel("duct") ? "#5b8cff" : "#a8c4ec"} transparent opacity={0.1} roughness={0.1} depthWrite={false} side={THREE.DoubleSide} /></mesh>
        ))}
        <mesh position={[0, 0, -DUCT.d / 2]}><planeGeometry args={[DUCT.w, ENC.h - 0.3]} />
          <meshPhysicalMaterial color={sel("duct") ? "#5b8cff" : "#a8c4ec"} transparent opacity={0.08} roughness={0.1} depthWrite={false} side={THREE.DoubleSide} /></mesh>
        <lineSegments raycast={() => null}>
          <edgesGeometry args={[boxes.duct]} />
          <lineBasicMaterial color={sel("duct") ? "#5b8cff" : "#4fd1e8"} transparent opacity={0.35} />
        </lineSegments>
      </Selectable>

      {/* SIBAL sample card in the middle of the duct (size from the Operations document) */}
      <Selectable part="sample" selected={selected}>
        <mesh><planeGeometry args={[SAMPLE.w, SAMPLE.h]} />
          <meshStandardMaterial color="#c9b48a" roughness={0.95} side={THREE.DoubleSide} emissive={sel("sample") ? "#ff8a3d" : "#000000"} emissiveIntensity={0.2} /></mesh>
        <lineSegments raycast={() => null}>
          <edgesGeometry args={[boxes.card]} />
          <lineBasicMaterial color="#8a93a6" />
        </lineSegments>
      </Selectable>
      <mesh ref={burnRef} position={[0, 0, 0.002]} raycast={() => null}>
        <boxGeometry args={[SAMPLE.w, 1, 0.003]} />
        <meshStandardMaterial color="#2b2622" roughness={1} transparent opacity={0.85} />
      </mesh>
      <group ref={flameRef} userData={{ part: "flame" }} {...hoverCursor}>
        <mesh><sphereGeometry args={[1, 48, 32]} /><shaderMaterial ref={flameMat} args={[flameArgs]} /></mesh>
      </group>
      <pointLight color="#ff9a4a" intensity={0.12} distance={0.5} decay={2} position={[0, 0, 0.12]} />

      {/* fans at the top of the duct (count illustrative) */}
      <group ref={(g) => { parts.current.fans = g; }} userData={{ part: "fans" }} {...hoverCursor}>
        <group ref={fansRef}>
          {[-0.11, 0.11].map((x) => (
            <group key={x} position={[x, 0, 0]}>
              {[0, 1, 2, 3].map((i) => (
                <mesh key={i} rotation={[0, (i * Math.PI) / 2, 0]} position={[0, 0, 0]}><boxGeometry args={[0.16, 0.008, 0.035]} />
                  <meshStandardMaterial color={sel("fans") ? "#5b8cff" : "#7c879b"} metalness={0.6} roughness={0.35} /></mesh>
              ))}
            </group>
          ))}
        </group>
        <mesh rotation={[Math.PI / 2, 0, 0]}><boxGeometry args={[DUCT.w, DUCT.d, 0.03]} /><meshStandardMaterial color="#2a313d" transparent opacity={0.5} wireframe /></mesh>
      </group>

      {/* flow straighteners at the bottom of the module */}
      <group ref={(g) => { parts.current.straighteners = g; }} userData={{ part: "straighteners" }} {...hoverCursor}>
        <mesh><boxGeometry args={[DUCT.w, 0.06, DUCT.d, 14, 1, 12]} /><meshStandardMaterial color={sel("straighteners") ? "#5b8cff" : "#a3adbf"} wireframe /></mesh>
      </group>

      {/* two cameras (count confirmed; positions illustrative) */}
      <group ref={(g) => { parts.current.cameras = g; }} userData={{ part: "cameras" }} {...hoverCursor}>
        {[[-0.14, 0.2], [0.14, -0.22]].map(([x, y], i) => (
          <group key={i} position={[x, y, ENC.d / 2 - 0.12]} rotation={[0, i ? -0.18 : 0.18, 0]}>
            <mesh><boxGeometry args={[0.07, 0.06, 0.1]} /><meshStandardMaterial color={sel("cameras") ? "#5b8cff" : "#2d3442"} metalness={0.5} roughness={0.4} /></mesh>
            <mesh position={[0, 0, -0.06]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.022, 0.026, 0.03, 18]} /><meshStandardMaterial color="#111" metalness={0.8} roughness={0.2} /></mesh>
          </group>
        ))}
      </group>

      {/* diagnostics (list confirmed; positions illustrative) */}
      <group ref={(g) => { parts.current.sensors = g; }} userData={{ part: "sensors" }} {...hoverCursor}>
        {[-0.3, 0, 0.3].map((y) => (
          <mesh key={y} position={[0, y, 0.09]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.003, 0.003, DUCT.w - 0.02, 6]} />
            <meshStandardMaterial color={sel("sensors") ? "#5b8cff" : "#b88a5a"} metalness={0.7} /></mesh>
        ))}
        {[-0.2, 0.25].map((y) => (
          <mesh key={y} position={[DUCT.w / 2 + 0.03, y, 0.08]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.02, 0.02, 0.05, 14]} />
            <meshStandardMaterial color={sel("sensors") ? "#5b8cff" : "#465165"} /></mesh>
        ))}
        {[-0.12, 0.12].map((x) => (
          <mesh key={x} position={[x, -ENC.h / 2 + 0.26, 0]}><sphereGeometry args={[0.015, 12, 10]} /><meshStandardMaterial color={sel("sensors") ? "#5b8cff" : "#d8dee9"} /></mesh>
        ))}
        <mesh position={[-ENC.w / 2 + 0.04, -0.4, 0.25]}><boxGeometry args={[0.04, 0.12, 0.1]} /><meshStandardMaterial color={sel("sensors") ? "#5b8cff" : "#465165"} /></mesh>
      </group>

      {/* airflow */}
      <points ref={airPts} raycast={() => null}>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[air.pos, 3]} /></bufferGeometry>
        <pointsMaterial map={dot} color="#4fd1e8" size={0.014} sizeAttenuation transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0} />
      </points>
      {common.transport && [-0.15, 0.15].map((x) => (
        <Arrow key={x} from={[x, -ENC.h / 2 - 0.25, 0]} to={[x, -ENC.h / 2 - 0.02, 0]} color="#4fd1e8" opacity={0.85} radius={0.006} head={0.05} />
      ))}
      {common.transport && <Arrow from={[0, ENC.h / 2 + 0.02, 0]} to={[0, ENC.h / 2 + 0.25, 0]} color="#4fd1e8" opacity={0.6} radius={0.006} head={0.05} />}
      <Arrow from={[SAMPLE.w / 2 + 0.06, concurrent ? -0.2 : 0.2, 0.05]} to={[SAMPLE.w / 2 + 0.06, concurrent ? 0.2 : -0.2, 0.05]} color="#ffb547" opacity={0.95} radius={0.007} head={0.05} />

      {A && (
        <>
          <Annotation id="enclosure" label="Enclosure (conceptual)" position={[-ENC.w / 2, ENC.h / 2 + 0.06, -ENC.d / 2]} selected={sel("enclosure")} onSelect={onSelect} />
          <Annotation id="sample" label={mode === "evidence" ? "SIBAL card ~0.4 × 0.94 m (document)" : "SIBAL sample card"} tone={mode === "evidence" ? "measured" : "default"}
            position={[-SAMPLE.w / 2 + 0.02, -SAMPLE.h / 2 + 0.08, 0.05]} selected={sel("sample")} onSelect={onSelect} />
          <Annotation id="duct" label="Flow duct" position={[-DUCT.w / 2, 0.35, DUCT.d / 2]} selected={sel("duct")} onSelect={onSelect} />
          <Annotation id="fans" label="Fans (top)" position={[0.18, ENC.h / 2 - 0.05 + ex * 0.32, 0]} selected={sel("fans")} onSelect={onSelect} />
          <Annotation id="straighteners" label="Flow straighteners (bottom)" position={[0.1, -ENC.h / 2 + 0.05 - ex * 0.32, DUCT.d / 2]} selected={sel("straighteners")} onSelect={onSelect} />
          <Annotation id="cameras" label="Cameras C1, C2" position={[-0.14, 0.3, ENC.d / 2 - 0.1 + ex * 0.35]} selected={sel("cameras")} onSelect={onSelect} />
          <Annotation id="sensors" label="Diagnostics" position={[DUCT.w / 2 + 0.1 + ex * 0.3, -0.05, 0.1]} selected={sel("sensors")} onSelect={onSelect} />
          <Annotation id="flame" label={`${concurrent ? "Concurrent" : "Opposed"} spread (${mode === "evidence" && measured ? measured.label : state.burn}, CSV)`} tone="warn"
            position={[SAMPLE.w / 2 + 0.08, concurrent ? 0.28 : -0.28, 0.05]} selected={sel("flame")} onSelect={onSelect} />
          {common.transport && <Annotation id="fans" label="Air 20 cm/s, drawn upward" position={[0, -ENC.h / 2 - 0.32, 0]} selected={false} onSelect={onSelect} />}
        </>
      )}
    </group>
  );
}
