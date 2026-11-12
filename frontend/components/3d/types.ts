import type { BassState, CommonState, FlexState, SaffireState } from "@/lib/lab-presets";
import type { Mode } from "@/lib/lab-scientific-metadata";
import type { TimelineStore } from "@/lib/timeline";

/** Measured values that a scene may draw to scale in evidence mode (each is exactly the recorded value). */
export type FlexMeasured = { uid: string; label: string; d0_mm: number | null; dext_mm: number | null; x_o2: number | null; fuel: string | null };
export type BassMeasured = { uid: string; label: string; width_cm: number | null; thickness_mm: number | null; diameter_mm: number | null; flow: string | null };
export type SaffireMeasured = { uid: string; label: string; flow: string | null };

export type SceneCommonProps = {
  common: CommonState;
  /** Decorative motion actually running (user toggle, reduced-motion preference). */
  animate: boolean;
  mode: Mode;
  selected: string | null;
  onSelect: (id: string) => void;
  /** Layers the visitor has hidden. */
  hidden: string[];
  /** Show only the selected layer (and the ones it needs to be read). */
  isolate: boolean;
  /** Pointer picking and 3D labels (off inside a split comparison view). */
  interactive: boolean;
  /** Illustrative timeline driving the scene, when active. */
  timeline: TimelineStore | null;
};

export type FlexSceneProps = SceneCommonProps & { state: FlexState; measured: FlexMeasured | null };
export type BassSceneProps = SceneCommonProps & { state: BassState; measured: BassMeasured | null };
export type SaffireSceneProps = SceneCommonProps & { state: SaffireState; measured: SaffireMeasured | null };

/** Visibility and emphasis of one layer under the current hide / isolate / selection state. */
export function layerView(p: SceneCommonProps, id: string, keepWith: string[] = []): { visible: boolean; emphasis: number } {
  if (p.hidden.includes(id)) return { visible: false, emphasis: 0 };
  const sel = p.selected;
  if (p.isolate && sel && sel !== id && !keepWith.includes(sel)) return { visible: false, emphasis: 0 };
  return { visible: true, emphasis: !sel || sel === id ? 1 : 0.28 };
}

/** Whether a 3D label is shown: contextual ("focus") mode shows primary labels, or only the selected one. */
export function labelShown(p: SceneCommonProps, id: string, primary = false): boolean {
  if (!p.interactive || p.common.labels === "off") return false;
  if (p.common.labels === "all") return !p.hidden.includes(id);
  return p.selected ? p.selected === id : primary;
}
