// Camera homes, per-component focus shots and named presets for the three studios (scene units: FLEX mm,
// BASS-II cm, SAFFIRE-I m). Plain numbers only, so the page bundle does not need three.js.
import type { SceneId } from "@/lib/lab-models";

export type Vec3 = [number, number, number];
export type Home = { position: Vec3; target: Vec3; min: number; max: number };
export type Shot = { target: Vec3; position?: Vec3; distance?: number };

export const CAMERA_HOME: Record<SceneId, Home> = {
  flex: { position: [17, 7.5, 31], target: [0, 1.5, 0], min: 2, max: 120 },
  bass: { position: [-2, 16, 36], target: [-3, -0.8, 0], min: 4, max: 110 },
  saffire: { position: [2.1, 1.25, 2.6], target: [0, 0.05, 0], min: 0.4, max: 7 },
};

/** Where to look when a FLEX layer is selected (depends on the drawn droplet size). */
export function flexFocus(id: string, d0: number): Shot | null {
  const rf = (d0 / 2) * 4;
  const dist: Record<string, number> = { droplet: rf * 1.7, surface: rf * 1.5, vapour: rf * 2.8, flame: rf * 4.6, soot: rf * 3.3, oxygen: rf * 6.4, ambient: rf * 8.5 };
  return dist[id] ? { target: [0, 0, 0], distance: dist[id] } : null;
}

const BASS_FOCUS: Record<string, Shot> = {
  duct: { target: [-1, 0, 0], distance: 34 },
  fan: { target: [-12.1, 0, 0], distance: 17 },
  straightener: { target: [-9.25, 0, 0], distance: 15 },
  sample: { target: [0, 0, 0], distance: 15 },
  holder: { target: [5.9, 0, -1.7], distance: 12 },
  flame: { target: [0, 0, 0], distance: 13 },
  igniter: { target: [5.7, 0, 0], distance: 10 },
  radiometer: { target: [7.6, 2.9, -2.9], distance: 10 },
  airflow: { target: [-3, 0, 0], distance: 44 },
};

export function bassFocus(id: string, igniterUpstream: boolean): Shot | null {
  const s = BASS_FOCUS[id];
  if (!s) return null;
  if (id === "igniter" && igniterUpstream) return { ...s, target: [-5.7, 0, 0] };
  return s;
}

const SAFFIRE_FOCUS: Record<string, Shot> = {
  enclosure: { target: [0, 0.05, 0], position: [2.1, 1.25, 2.6] },
  duct: { target: [0, 0, 0], distance: 1.8 },
  sample: { target: [0, 0, 0], position: [0.22, 0.1, 1.7] },
  fans: { target: [0, 0.53, 0], distance: 0.95 },
  straighteners: { target: [0, -0.5, 0], distance: 0.95 },
  cameras: { target: [0, 0, 0.36], distance: 1.15 },
  sensors: { target: [0.25, 0, 0.08], distance: 1.05 },
  flame: { target: [0, 0, 0], distance: 1.2 },
  airflow: { target: [0, 0, 0], distance: 2.6 },
};

export function saffireFocus(id: string): Shot | null {
  return SAFFIRE_FOCUS[id] ?? null;
}

/** Named SAFFIRE-I camera presets (the arrangement is conceptual; presets only frame its parts). */
export const SAFFIRE_PRESETS: { id: string; label: string; shot: Shot; component: string | null }[] = [
  { id: "overview", label: "Overview", shot: { target: [0, 0.05, 0], position: [2.1, 1.25, 2.6] }, component: null },
  { id: "duct", label: "Flow duct", shot: { target: [0, 0, 0], position: [1.4, 0.45, 1.85] }, component: "duct" },
  { id: "sample", label: "Fabric sample", shot: { target: [0, 0, 0], position: [0.22, 0.1, 1.7] }, component: "sample" },
  { id: "flow", label: "Fans and straighteners", shot: { target: [0, 0, 0], position: [2.75, 0.15, 1.2] }, component: "fans" },
  { id: "diagnostics", label: "Cameras and diagnostics", shot: { target: [0, 0, 0.3], position: [-0.95, 0.4, 2.4] }, component: "cameras" },
];
