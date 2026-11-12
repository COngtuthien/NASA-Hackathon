"use client";

// FLEX droplet combustion, drawn in millimetres. Conceptual by design: the flame sits at a fixed 4× the droplet
// radius (real standoff varies, Liu et al. PDF p.8), the 1 g teardrop is a qualitative shape, and the burn timeline
// is an illustrative sequence on a normalized axis (not a test's clock). In evidence mode the droplet and its
// extinction diameter are drawn at the selected test's measured D₀ and D_ext; the flame shell stays conceptual.
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { approach, flameMaterialArgs, flameU } from "@/components/3d/flameMaterial";
import { Annotation } from "@/components/3d/ScientificAnnotations";
import { Arrow, hoverCursor, pickPart, seeded, useCursorReset, useDotTexture } from "@/components/3d/sceneUtils";
import { labelShown, layerView, type FlexSceneProps } from "@/components/3d/types";

export const FLAME_RADIUS_FACTOR = 4;
const PRIORITY = ["droplet", "surface", "soot", "vapour", "flame", "ambient", "oxygen"];

/** JS mirror of the shader's teardrop deformation (without flicker), for particles. */
function deform(x: number, y: number, z: number, s: number): [number, number, number] {
  const up = Math.max(y, 0);
  const t = up >= 1 ? 1 : up * up * (3 - 2 * up);
  const taper = 1 - s * 0.5 * t;
  const ny = (y > 0 ? y * (1 + s * 1.5) : y * (1 - s * 0.22)) + s * 0.32;
  return [x * taper, ny, z * taper];
}

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * Illustrative state of the conceptual burn sequence at normalized progress p (see lib/timeline FLEX_STAGES).
 * Regression follows the d²-law SHAPE ((D/D₀)² falling linearly) purely as an illustration; it is not fitted to
 * any test and the end size is arbitrary.
 */
export function flexStage(p: number) {
  const needles = 1 - smooth(0.015, 0.07, p);             // needles retract while the droplet is formed
  const igniter = smooth(0.06, 0.1, p) * (1 - smooth(0.17, 0.24, p));
  const glow = smooth(0.09, 0.13, p) * (1 - smooth(0.17, 0.2, p));
  const flame = smooth(0.12, 0.2, p) * (1 - smooth(0.86, 0.97, p));
  const q = Math.min(1, Math.max(0, (p - 0.2) / 0.66));
  const size = Math.sqrt(1 - 0.82 * q);
  return { needles, igniter, glow, flame, size };
}

const N_SOOT = 420;
const N_AMB = 240;
const N_FUEL = 80;
const N_OX = 90;
const N_BUOY = 120;
const C_O2 = new THREE.Color("#4fd1e8");
const C_OTHER = new THREE.Color("#5d6b83");

type Pts = THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
type Mat = THREE.Material & { opacity: number };

function makeSeeds() {
  const r = seeded(69);
  const sphere = () => {
    const u = r() * 2 - 1, th = r() * Math.PI * 2, sq = Math.sqrt(1 - u * u);
    return { x: sq * Math.cos(th), y: u, z: sq * Math.sin(th) };
  };
  return {
    soot: Array.from({ length: N_SOOT }, () => ({ ...sphere(), rad: 0.42 + r() * 0.36, sp: 0.2 + r() * 0.5 })),
    amb: Array.from({ length: N_AMB }, (_, i) => ({ ...sphere(), rad: 1.45 + r() * 1.6, ph: r() * 6.28, rank: (i + 0.5) / N_AMB })),
    fuel: Array.from({ length: N_FUEL }, () => ({ ...sphere(), ph: r() })),
    ox: Array.from({ length: N_OX }, () => ({ ...sphere(), ph: r() })),
    buoy: Array.from({ length: N_BUOY }, () => ({ th: r() * Math.PI * 2, r0: 0.55 + r() * 1.5, ph: r() })),
  };
}

export default function DropletCombustionScene(props: FlexSceneProps) {
  const { state, measured, common, animate, mode, selected, onSelect, interactive, timeline } = props;
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
  const hover = interactive ? hoverCursor : {};

  // layer visibility and emphasis under hide / isolate / selection
  const L = {
    droplet: layerView(props, "droplet", ["surface"]), surface: layerView(props, "surface", ["droplet"]),
    vapour: layerView(props, "vapour"), flame: layerView(props, "flame"), soot: layerView(props, "soot"),
    oxygen: layerView(props, "oxygen"), ambient: layerView(props, "ambient"),
  };
  // the droplet stays visible (faint) whenever another layer is isolated, as a size reference
  const dropletShown = L.droplet.visible || (props.isolate && !!selected);
  const lv = useRef(L);
  useEffect(() => { lv.current = L; });

  const dot = useDotTexture();
  const flameArgs = useMemo(() => flameMaterialArgs("#5a86dc", "#ffb23f", 0.95), []);
  const coreArgs = useMemo(() => flameMaterialArgs("#2a5cff", "#ff8a3d", 0.35), []);
  const seeds = useMemo(() => makeSeeds(), []);
  const buf = useMemo(() => ({
    soot: new Float32Array(N_SOOT * 3), amb: new Float32Array(N_AMB * 3), ambCol: new Float32Array(N_AMB * 3),
    fuel: new Float32Array(N_FUEL * 3), ox: new Float32Array(N_OX * 3), buoy: new Float32Array(N_BUOY * 3),
  }), []);

  const flameMat = useRef<THREE.ShaderMaterial>(null);
  const coreMat = useRef<THREE.ShaderMaterial>(null);
  const vapourMat = useRef<THREE.MeshBasicMaterial>(null);
  const dropMat = useRef<THREE.MeshPhysicalMaterial>(null);
  const sootPts = useRef<Pts>(null);
  const ambPts = useRef<Pts>(null);
  const fuelPts = useRef<Pts>(null);
  const oxPts = useRef<Pts>(null);
  const buoyPts = useRef<Pts>(null);
  const light = useRef<THREE.PointLight>(null);
  const dropletRef = useRef<THREE.Mesh>(null);
  const flameRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const vapourRef = useRef<THREE.Mesh>(null);
  const rootRef = useRef<THREE.Group>(null);
  const needlesRef = useRef<THREE.Group>(null);
  const ignRef = useRef<THREE.Group>(null);
  const glowMat = useRef<THREE.MeshStandardMaterial>(null);
  const arrowsRef = useRef<THREE.Group>(null);
  // live values eased toward their targets, and the decorative clock
  const live = useRef({ stretch: { value: gravityTarget }, rf: { value: rf }, rd: { value: rd }, o2: { value: o2 }, soot: { value: heptane ? 1 : 0 },
    transport: { value: common.transport ? 1 : 0 }, time: 0, ambO2: -1 });

  // render a frame whenever an input changes (the canvas renders on demand when motion is off)
  useEffect(() => { invalidate(); }, [invalidate, gravityTarget, rf, rd, o2, heptane, common.transport, common.labels, mode, selected, animate, props.hidden, props.isolate]);
  useEffect(() => (timeline ? timeline.subscribe(() => invalidate()) : undefined), [timeline, invalidate]);

  useFrame((_, dt) => {
    const S = live.current;
    const V = lv.current;
    let moving = false;
    moving = approach(S.stretch, gravityTarget, dt, 3) || moving;
    moving = approach(S.rf, rf, dt, 5) || moving;
    moving = approach(S.rd, rd, dt, 5) || moving;
    moving = approach(S.o2, o2, dt, 6) || moving;
    moving = approach(S.soot, heptane ? 1 : 0, dt, 4) || moving;
    moving = approach(S.transport, common.transport ? 1 : 0, dt, 6) || moving;
    if (animate) S.time += dt;
    const t = S.time, s = S.stretch.value;
    // timeline (illustrative): drives droplet size, flame presence, needles and igniters
    const tl = timeline?.get();
    const st = tl?.active ? flexStage(tl.p) : null;
    const r = S.rd.value * (st ? st.size : 1);
    const R = r * FLAME_RADIUS_FACTOR;
    const flameOn = st ? st.flame : 1;
    const dim = evidence ? 0.45 : 1;

    const fu = flameU(flameMat.current);
    if (fu) {
      fu.uTime.value = t;
      fu.uStretch.value = s;
      fu.uFlicker.value = animate ? 1 : 0;
      fu.uIntensity.value = (heptane ? 0.62 : 0.52) * (selected === "flame" ? 1.35 : 1) * dim * flameOn * V.flame.emphasis;
      fu.uTip.value.set(heptane ? "#ffc04a" : "#ff9a3d");
    }
    const cu = flameU(coreMat.current);
    if (cu) {
      cu.uTime.value = t * 0.8;
      cu.uStretch.value = s;
      cu.uFlicker.value = animate ? 1 : 0;
      cu.uIntensity.value = 0.1 * dim * flameOn * V.flame.emphasis;
    }
    if (vapourMat.current) vapourMat.current.opacity = (selected === "vapour" ? 0.16 : 0.05) * flameOn * V.vapour.emphasis;
    if (dropMat.current) dropMat.current.opacity = (evidence ? 0.38 : 0.94) * (V.droplet.visible ? Math.max(V.droplet.emphasis, V.surface.emphasis) : 0.25);

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
      (soot.material as Mat).opacity = 0.55 * S.soot.value * flameOn * V.soot.emphasis * (selected === "soot" ? 1.5 : 1);
    }

    // ambient gas: the cyan share equals the O₂ mole fraction (illustrative dots)
    const amb = ambPts.current;
    if (amb) {
      if (Math.abs(S.ambO2 - S.o2.value) > 0.002) {
        S.ambO2 = S.o2.value;
        const col = amb.geometry.attributes.color as THREE.BufferAttribute;
        for (let i = 0; i < N_AMB; i++) {
          const c = seeds.amb[i].rank < S.o2.value ? C_O2 : C_OTHER;
          col.setXYZ(i, c.r, c.g, c.b);
        }
        col.needsUpdate = true;
      }
      const a = amb.geometry.attributes.position as THREE.BufferAttribute;
      const Ra = S.rd.value * FLAME_RADIUS_FACTOR;
      for (let i = 0; i < N_AMB; i++) {
        const p = seeds.amb[i];
        const k = (p.rad + 0.04 * Math.sin(t * 0.6 + p.ph)) * Ra;
        a.setXYZ(i, p.x * k, p.y * k + s * Ra * 0.4, p.z * k);
      }
      a.needsUpdate = true;
      (amb.material as Mat).opacity = (selected === "ambient" ? 0.95 : 0.55) * V.ambient.emphasis;
    }

    // transport: microgravity radial diffusion (fuel out, O₂ in) cross-fades with the 1 g buoyant updraft
    const tv = S.transport.value * flameOn;
    const fp = fuelPts.current;
    if (fp) {
      const a = fp.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < N_FUEL; i++) {
        const p = seeds.fuel[i];
        const rad = r * 1.15 + ((p.ph + t * 0.18) % 1) * (R * 0.92 - r * 1.15);
        a.setXYZ(i, p.x * rad, p.y * rad, p.z * rad);
      }
      a.needsUpdate = true;
      (fp.material as Mat).opacity = 0.85 * tv * (1 - s) * V.vapour.emphasis;
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
      (op.material as Mat).opacity = 0.75 * tv * (1 - s) * V.oxygen.emphasis;
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
      (bp.material as Mat).opacity = 0.6 * tv * s * V.oxygen.emphasis;
    }
    if (arrowsRef.current) arrowsRef.current.visible = flameOn > 0.5;

    if (light.current) {
      light.current.position.y = R * 0.92 * s;
      light.current.intensity = (heptane ? 22 : 14) * (1 + (animate ? 0.06 * Math.sin(t * 9.3) * Math.sin(t * 4.1) : 0)) * (R / 6) ** 2 * dim * flameOn;
    }
    // MDCA hardware during the timeline: needles (formation) and hot-wire igniters (ignition), documented procedure
    if (needlesRef.current) {
      const n = st ? st.needles : 0;
      needlesRef.current.visible = n > 0.01;
      needlesRef.current.children.forEach((c, i) => { c.position.y = (i ? -1 : 1) * (r * 1.02 + (1 - n) * R * 1.6 + R * 0.45); });
    }
    if (ignRef.current) {
      const g = st ? st.igniter : 0;
      ignRef.current.visible = g > 0.01;
      ignRef.current.children.forEach((c, i) => { c.position.x = (i ? -1 : 1) * (r * 1.6 + (1 - g) * R * 1.4); });
    }
    if (glowMat.current) glowMat.current.emissiveIntensity = 0.2 + 2.6 * (st ? st.glow : 0);

    dropletRef.current?.scale.setScalar(r);
    flameRef.current?.scale.setScalar(R);
    coreRef.current?.scale.setScalar(R * 0.62);
    vapourRef.current?.scale.setScalar(R * 0.82);
    // keep the stretched 1 g flame centred in view
    rootRef.current?.position.set(0, -s * R * 0.95, 0);
    if ((moving || tl?.playing) && !animate) invalidate();
  });

  const earth = gravityTarget === 1;
  const lift = earth ? rf * 0.9 : 0;
  const ruler = Math.max(1, Math.round(d0)); // scale bar length in whole millimetres
  const dropSel = selected === "droplet" || selected === "surface";
  const show = (id: string, primary = false) => labelShown(props, id, primary);

  return (
    <group ref={rootRef} onClick={interactive ? (e) => { e.stopPropagation(); const p = pickPart(e, PRIORITY); if (p) onSelect(p); } : undefined}>
      {/* droplet: a glossy liquid sphere (kept as a faint size reference when another layer is isolated) */}
      <mesh ref={dropletRef} userData={{ part: "droplet" }} visible={dropletShown} {...hover}>
        <sphereGeometry args={[1, 64, 48]} />
        <meshPhysicalMaterial ref={dropMat} color={heptane ? "#d9e6ff" : "#cfeaff"} roughness={0.08} metalness={0} clearcoat={1} clearcoatRoughness={0.05}
          transparent opacity={0.94} emissive={dropSel ? "#ff8a3d" : "#1a2a44"} emissiveIntensity={dropSel ? 0.35 : 0.25} />
      </mesh>
      {L.surface.visible && selected === "surface" && (
        <mesh scale={rd * 1.06} raycast={() => null}>
          <sphereGeometry args={[1, 32, 24]} />
          <meshBasicMaterial color="#ffb547" transparent opacity={0.3} depthWrite={false} wireframe />
        </mesh>
      )}
      {/* fuel vapour region between surface and flame (illustrative gradient) */}
      <mesh ref={vapourRef} userData={{ part: "vapour" }} visible={L.vapour.visible} {...hover}>
        <sphereGeometry args={[1, 40, 30]} />
        <meshBasicMaterial ref={vapourMat} color="#ffb547" transparent opacity={0.05} depthWrite={false} side={THREE.BackSide}
          blending={THREE.CustomBlending} blendSrc={THREE.SrcAlphaFactor} blendDst={THREE.OneFactor} blendSrcAlpha={THREE.ZeroFactor} blendDstAlpha={THREE.OneFactor} />
      </mesh>
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

      {/* MDCA needles and hot-wire igniters (only while the timeline shows formation and ignition) */}
      <group ref={needlesRef} visible={false}>
        {[0, 1].map((i) => (
          <mesh key={i} raycast={() => null}>
            <cylinderGeometry args={[rd * 0.07, rd * 0.07, rf * 0.9, 12]} />
            <meshStandardMaterial color="#c9d3e3" metalness={0.85} roughness={0.25} />
          </mesh>
        ))}
      </group>
      <group ref={ignRef} visible={false}>
        {[0, 1].map((i) => (
          <group key={i}>
            <mesh rotation={[0, 0, Math.PI / 2]} position={[(i ? -1 : 1) * rf * 0.45, 0, 0]} raycast={() => null}>
              <cylinderGeometry args={[rd * 0.035, rd * 0.035, rf * 0.9, 8]} />
              <meshStandardMaterial color="#8a93a6" metalness={0.8} roughness={0.3} />
            </mesh>
            <mesh rotation={[0, Math.PI / 2, 0]} raycast={() => null}>
              <torusGeometry args={[rd * 0.18, rd * 0.04, 8, 20]} />
              <meshStandardMaterial ref={i === 0 ? glowMat : undefined} color="#c06a3c" emissive="#ff6a2a" emissiveIntensity={0.2} />
            </mesh>
          </group>
        ))}
      </group>

      {/* flame envelope: shell + faint inner glow, and the warm light it casts */}
      <mesh ref={flameRef} userData={{ part: "flame" }} visible={L.flame.visible} {...hover}>
        <sphereGeometry args={[1, 72, 56]} />
        <shaderMaterial ref={flameMat} args={[flameArgs]} />
      </mesh>
      <mesh ref={coreRef} visible={L.flame.visible} raycast={() => null}>
        <sphereGeometry args={[1, 40, 30]} />
        <shaderMaterial ref={coreMat} args={[coreArgs]} />
      </mesh>
      <pointLight ref={light} color="#ff9a4a" distance={rf * 6} decay={2} intensity={18} />

      {/* soot shell (heptane: sooting fuel) */}
      <points ref={sootPts} userData={{ part: "soot" }} visible={L.soot.visible && heptane}>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[buf.soot, 3]} /></bufferGeometry>
        <pointsMaterial map={dot} color="#c47a2c" size={Math.max(0.1, rd * 0.13)} sizeAttenuation transparent depthWrite={false} opacity={0} />
      </points>

      {/* ambient gas */}
      <points ref={ambPts} userData={{ part: "ambient" }} visible={L.ambient.visible}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[buf.amb, 3]} />
          <bufferAttribute attach="attributes-color" args={[buf.ambCol, 3]} />
        </bufferGeometry>
        <pointsMaterial map={dot} vertexColors size={Math.max(0.2, rf * 0.06)} sizeAttenuation transparent depthWrite={false} opacity={0.55} />
      </points>

      {/* transport indicators: fuel vapour outward (vapour layer), oxygen inward / buoyant updraft (oxygen layer) */}
      <points ref={fuelPts} raycast={() => null} visible={L.vapour.visible && common.transport}>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[buf.fuel, 3]} /></bufferGeometry>
        <pointsMaterial map={dot} color="#ffb547" size={Math.max(0.14, rd * 0.22)} sizeAttenuation transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0} />
      </points>
      <points ref={oxPts} raycast={() => null} visible={L.oxygen.visible && common.transport}>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[buf.ox, 3]} /></bufferGeometry>
        <pointsMaterial map={dot} color="#4fd1e8" size={Math.max(0.16, rd * 0.25)} sizeAttenuation transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0} />
      </points>
      <points ref={buoyPts} raycast={() => null} visible={L.oxygen.visible && common.transport}>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[buf.buoy, 3]} /></bufferGeometry>
        <pointsMaterial map={dot} color="#7fd8ff" size={Math.max(0.16, rd * 0.25)} sizeAttenuation transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0} />
      </points>
      <group ref={arrowsRef}>
        {common.transport && !earth && [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([vx, vz], i) => (
          <group key={i}>
            {L.oxygen.visible && <Arrow from={[vx * rf * 2.5, 0, vz * rf * 2.5]} to={[vx * rf * 1.6, 0, vz * rf * 1.6]} color="#4fd1e8" opacity={0.8 * L.oxygen.emphasis} radius={rf * 0.012} head={rf * 0.13} />}
            {L.vapour.visible && <Arrow from={[vx * rd * 1.4 + vz * rd * 0.6, rd * 0.4, vz * rd * 1.4 + vx * rd * 0.6]} to={[vx * rf * 0.7 + vz * rf * 0.25, rd * 0.4, vz * rf * 0.7 + vx * rf * 0.25]}
              color="#ffb547" opacity={0.85 * L.vapour.emphasis} radius={rf * 0.008} head={rf * 0.09} />}
          </group>
        ))}
        {common.transport && earth && L.oxygen.visible && [-1, 1].flatMap((sx) => [-1, 1].map((sz) => (
          <Arrow key={`${sx}${sz}`} from={[sx * rf * 1.5, -rf * 1.9, sz * rf * 0.4]} to={[sx * rf * 1.15, rf * 0.6, sz * rf * 0.3]} color="#7fd8ff" opacity={0.5 * L.oxygen.emphasis} radius={rf * 0.009} head={rf * 0.13} />
        )))}
      </group>

      {/* gravity vector (1 g comparison only) */}
      {earth && <Arrow from={[-rf * 2.1, rf * 1.2, 0]} to={[-rf * 2.1, rf * 0.1, 0]} color="#e6edf7" opacity={0.85} radius={rf * 0.016} head={rf * 0.18} />}

      {/* millimetre scale bar */}
      <group position={[-ruler / 2, -rf * 1.25, rf * 0.2]}>
        <mesh position={[ruler / 2, 0, 0]} raycast={() => null}><boxGeometry args={[ruler, rf * 0.012, rf * 0.012]} /><meshBasicMaterial color="#a9b8cd" /></mesh>
        {Array.from({ length: ruler + 1 }, (_, i) => (
          <mesh key={i} position={[i, rf * 0.025, 0]} raycast={() => null}><boxGeometry args={[rf * 0.01, rf * 0.06, rf * 0.01]} /><meshBasicMaterial color="#a9b8cd" /></mesh>
        ))}
      </group>

      {show("droplet", true) && <Annotation id="droplet" label={evidence ? `Droplet D₀ ${d0} mm (measured)` : "Fuel droplet"} tone={evidence ? "measured" : "default"}
        position={[0, -rd * 1.9, 0]} selected={selected === "droplet"} onSelect={onSelect} />}
      {show("surface") && <Annotation id="surface" label="Fuel surface" position={[rd * 1.9, rd * 1.5, 0]} selected={selected === "surface"} onSelect={onSelect} />}
      {show("vapour") && <Annotation id="vapour" label="Fuel vapour region" position={[rf * 0.55, -rf * 0.35, rf * 0.3]} selected={selected === "vapour"} onSelect={onSelect} />}
      {show("flame", true) && <Annotation id="flame" label={evidence ? "Flame envelope (conceptual)" : "Flame envelope"} position={[rf * 0.95, rf * 0.75 + lift, 0]} selected={selected === "flame"} onSelect={onSelect} />}
      {heptane && show("soot") && <Annotation id="soot" label="Soot shell (n-heptane)" position={[-rf * 0.85, rf * 0.15 + lift * 0.4, 0]} selected={selected === "soot"} onSelect={onSelect} />}
      {show("ambient", true) && <Annotation id="ambient" label={`Ambient gas · O₂ ${o2.toFixed(2)}${evidence ? " (recorded)" : ""}`} tone={evidence ? "measured" : "default"}
        position={[-rf * 1.6, -rf * 0.55, 0]} selected={selected === "ambient"} onSelect={onSelect} />}
      {common.transport && show("oxygen") && <Annotation id="oxygen" label={earth ? "Buoyant updraft (1 g)" : "O₂ diffusing inward"} position={[rf * 1.9, -rf * 0.55, 0]} selected={selected === "oxygen"} onSelect={onSelect} />}
      {evidence && dext !== null && dext > 0 && interactive && common.labels !== "off" && <Annotation id="droplet" label={`D_ext ${dext} mm (measured)`} tone="measured" position={[0, rd * 1.5, rd * 1.2]} selected={false} onSelect={onSelect} />}
      {interactive && common.labels !== "off" && <Annotation id="scale" label={`${ruler} mm scale`} position={[0, -rf * 1.42, rf * 0.2]} selected={false} onSelect={() => undefined} />}
    </group>
  );
}
