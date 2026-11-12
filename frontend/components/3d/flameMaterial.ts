// A lightweight emissive "flame shell" shader shared by the three scenes.
// It draws a thin, translucent glowing shell with limb brightening (a thin emissive shell looks brightest
// edge-on). `uStretch` (0..1) deforms a unit sphere into an upward teardrop: used for the conceptual 1 g
// comparison and for flames trailed by an airflow. Nothing here is computed from data.
import * as THREE from "three";

const vertex = /* glsl */ `
uniform float uTime;
uniform float uStretch;
uniform float uFlicker;
varying vec3 vNormalW;
varying vec3 vViewW;
varying float vHeight;

float wobble(vec3 p, float t) {
  return sin(p.x * 5.1 + t * 2.3) * sin(p.z * 4.3 + t * 1.7) * sin(p.y * 3.7 - t * 2.9);
}

void main() {
  vec3 p = position;
  float up = max(p.y, 0.0);
  // teardrop: lift and stretch the upper half, narrow it toward the tip, flatten the base slightly
  float s = uStretch;
  float taper = 1.0 - s * 0.5 * smoothstep(0.0, 1.0, up);
  p.xz *= taper;
  p.y = p.y > 0.0 ? p.y * (1.0 + s * 1.5) : p.y * (1.0 - s * 0.22);
  p.y += s * 0.32;
  // gentle flicker along the normal; stronger toward the tip of a stretched flame
  float amp = uFlicker * (0.012 + 0.07 * s * up);
  p += normal * wobble(position, uTime) * amp;
  vec4 world = modelMatrix * vec4(p, 1.0);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vViewW = normalize(cameraPosition - world.xyz);
  vHeight = position.y * 0.5 + 0.5;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const fragment = /* glsl */ `
uniform vec3 uBase;
uniform vec3 uTip;
uniform float uIntensity;
uniform float uStretch;
varying vec3 vNormalW;
varying vec3 vViewW;
varying float vHeight;

void main() {
  float facing = abs(dot(normalize(vNormalW), normalize(vViewW)));
  float limb = pow(1.0 - facing, 2.2);
  // colour: blue base everywhere; warmer toward the tip as the flame is stretched
  float warm = smoothstep(0.35, 1.0, vHeight) * uStretch;
  vec3 col = mix(uBase, uTip, clamp(warm + uStretch * 0.15, 0.0, 1.0));
  float a = (0.05 + limb * 0.95) * uIntensity;
  gl_FragColor = vec4(col * a, a);
}
`;

export type FlameUniforms = {
  uTime: { value: number }; uStretch: { value: number }; uFlicker: { value: number };
  uBase: { value: THREE.Color }; uTip: { value: THREE.Color }; uIntensity: { value: number };
};

/** Constructor arguments for a <shaderMaterial args={[...]} />. Create once (useMemo) so R3F builds it once. */
export function flameMaterialArgs(base = "#4f8dff", tip = "#ffb547", intensity = 0.9): THREE.ShaderMaterialParameters {
  const uniforms: FlameUniforms = {
    uTime: { value: 0 }, uStretch: { value: 0 }, uFlicker: { value: 1 },
    uBase: { value: new THREE.Color(base) }, uTip: { value: new THREE.Color(tip) }, uIntensity: { value: intensity },
  };
  return { uniforms, vertexShader: vertex, fragmentShader: fragment, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide };
}

/** Typed access to a flame material's uniforms through a ref (R3F owns and disposes the material). */
export function flameU(m: THREE.ShaderMaterial | null): FlameUniforms | null {
  return m ? (m.uniforms as unknown as FlameUniforms) : null;
}

/** Exponential approach used for smooth, frame-rate independent transitions. Returns true while still moving. */
export function approach(current: { value: number }, target: number, dt: number, rate = 4): boolean {
  const d = target - current.value;
  if (Math.abs(d) < 1e-3) {
    current.value = target;
    return false;
  }
  current.value += d * (1 - Math.exp(-rate * Math.min(dt, 0.1)));
  return true;
}
