// Default (reset) states for the lab's conceptual controls. These values steer the illustration only.
import type { SceneId } from "@/lib/lab-models";

export type Gravity = "micro" | "earth";
export type FlexFuel = "Methanol" | "Heptane";

export type FlexState = {
  gravity: Gravity;
  /** Ambient O₂ mole fraction for the illustration (dot share) and for finding nearby real tests. */
  o2: number;
  /** Drawn initial droplet diameter, mm. */
  d0: number;
  fuel: FlexFuel;
};

export type BassSample = "thin-film" | "slab" | "rod" | "sphere" | "fabric";
export type BassFlow = "opposed" | "concurrent" | "stagnation";

export type BassState = {
  sample: BassSample;
  flow: BassFlow;
  showFront: boolean;
};

export type SaffireBurn = "S1" | "S2";

export type SaffireState = {
  cutaway: boolean;
  exploded: boolean;
  burn: SaffireBurn;
};

/** Labels: "focus" shows the primary labels, or only the selected component's label once one is selected. */
export type LabelMode = "focus" | "all" | "off";

export type CommonState = {
  labels: LabelMode;
  transport: boolean;
  motion: boolean;
};

export const COMMON_DEFAULT: CommonState = { labels: "focus", transport: true, motion: true };
export const FLEX_DEFAULT: FlexState = { gravity: "micro", o2: 0.21, d0: 3, fuel: "Heptane" };
export const BASS_DEFAULT: BassState = { sample: "slab", flow: "opposed", showFront: true };
export const SAFFIRE_DEFAULT: SaffireState = { cutaway: true, exploded: false, burn: "S1" };

/** Control ranges, chosen to span the FLEX CSV (initial O₂ 0.12–0.34 mole fraction, D₀ 1.1–4.67 mm). */
export const FLEX_RANGE = { o2: { min: 0.12, max: 0.34, step: 0.01 }, d0: { min: 1, max: 5, step: 0.1 } } as const;

export const BASS_SAMPLES: { id: BassSample; label: string; materialClasses: string[]; note: string }[] = [
  { id: "thin-film", label: "PMMA thin film", materialClasses: ["PMMA thin film"], note: "Flat PMMA film, the thinnest flat samples (slabs and films span 0.125–5 mm)." },
  { id: "slab", label: "PMMA slab", materialClasses: ["PMMA slab"], note: "Flat; 1–5 mm thick in Table 5.1." },
  { id: "rod", label: "PMMA rod", materialClasses: ["PMMA rod (clear)", "PMMA rod (black)"], note: "Cylinder, 6.35–12.7 mm diameter." },
  { id: "sphere", label: "PMMA sphere section", materialClasses: ["PMMA sphere section"], note: "Section of a 4 cm diameter sphere." },
  { id: "fabric", label: "Fabric strip", materialClasses: ["SIBAL fabric", "Nomex III fabric"], note: "Cotton-fiberglass (SIBAL) or Nomex strips, 1–2 cm wide." },
];

export const BASS_FLOWS: { id: BassFlow; label: string; note: string }[] = [
  { id: "opposed", label: "Opposed", note: "Flame spreads toward the incoming air." },
  { id: "concurrent", label: "Concurrent", note: "Flame spreads with the air." },
  { id: "stagnation", label: "Stagnation", note: "Air flows head-on onto the end of a rod (rods only)." },
];

export function sceneDefaults(id: SceneId) {
  return id === "flex" ? FLEX_DEFAULT : id === "bass" ? BASS_DEFAULT : SAFFIRE_DEFAULT;
}
