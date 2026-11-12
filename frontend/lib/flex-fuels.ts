// Fuel-specific, source-backed descriptions for the FLEX studio. The FLEX CSV contains exactly two fuels
// (methanol: 157 rows, n-heptane: 117 rows); no other fuel is offered. Every statement is qualitative and cites the
// local NASA document page it comes from. No temperature, burning rate, emission spectrum or extinction threshold
// is stated per fuel: the evidence panel shows only the measured values of real tests.
import { SOURCES, type SourceRef } from "@/lib/lab-scientific-metadata";

export type FuelId = "Methanol" | "Heptane";

export type FuelInfo = {
  id: FuelId;
  label: string;
  formula: string;
  family: string;
  /** Short statements, each with a source. */
  facts: { text: string; source: SourceRef }[];
  /** What the 3D view draws differently for this fuel, and on what basis. */
  visual: string;
  /** NASA media in lib/scientific-media.ts that genuinely relates to this fuel (if any). */
  mediaId: string | null;
  mediaNote: string;
  limits: string;
};

export const FUELS: Record<FuelId, FuelInfo> = {
  Heptane: {
    id: "Heptane", label: "n-Heptane", formula: "C₇H₁₆", family: "Alkane",
    facts: [
      { text: "An alkane fuel with a wide range of sooting behaviour that varies with environmental conditions.", source: SOURCES.flexEird36 },
      { text: "In larger ignited droplets, radiative heat loss can stop the hot (classical) flame at a relatively large droplet size.", source: SOURCES.faroukP2 },
      { text: "The droplet can then keep burning in a second, low-temperature stage without visible flame emission (a “cool flame”), ending in diffusive extinction at a finite size. This dual mode appears only for sufficiently large initial diameters.", source: SOURCES.faroukP2 },
    ],
    visual: "Adds a soot shell between droplet and flame (sooting fuel). In the burn timeline, the end stage notes that visible extinction may be followed by cool-flame burning. Flame colours are illustrative.",
    mediaId: "flex-heptane-soot-composite",
    mediaNote: "NASA's FLEX composite of a burning 3 mm heptane droplet with soot streamers (false colour).",
    limits: "Soot shell radius and density are illustrative. Whether a given test showed cool-flame burning is not a CSV column, so it is not inferred per test.",
  },
  Methanol: {
    id: "Methanol", label: "Methanol", formula: "CH₃OH", family: "Alcohol",
    facts: [
      { text: "A non-sooting alcohol fuel.", source: SOURCES.flexEird36 },
      { text: "Shows classical radiative extinction, in contrast to the two-stage behaviour seen with n-heptane.", source: SOURCES.faroukP2 },
      { text: "Earlier quiescent microgravity experiments produced radiative extinction of large methanol droplets.", source: SOURCES.flexEird74 },
    ],
    visual: "No soot shell is drawn (non-sooting fuel). Flame colours are illustrative.",
    mediaId: null,
    mediaNote: "SpaceFire's verified media registry has no NASA image that names a methanol FLEX droplet. The 1 g vs microgravity comparison image does not state its fuel.",
    limits: "Flame visibility, colour and temperature differences are not quantified here.",
  },
};

export const FUEL_IDS: FuelId[] = ["Heptane", "Methanol"];
