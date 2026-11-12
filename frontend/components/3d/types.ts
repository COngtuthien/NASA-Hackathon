import type { BassState, CommonState, FlexState, SaffireState } from "@/lib/lab-presets";
import type { Mode } from "@/lib/lab-scientific-metadata";

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
};

export type FlexSceneProps = SceneCommonProps & { state: FlexState; measured: FlexMeasured | null };
export type BassSceneProps = SceneCommonProps & { state: BassState; measured: BassMeasured | null };
export type SaffireSceneProps = SceneCommonProps & { state: SaffireState; measured: SaffireMeasured | null };
