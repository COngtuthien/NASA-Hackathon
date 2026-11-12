// Phase 10: the scientific content of each conceptual stage. Stage BOUNDARIES live in lib/timeline.ts (FLEX_STAGES,
// BASS_STAGES): the single timeline store's progress `p` decides the active stage everywhere (3D scene, highlighted
// components, explanation, announcements). This file only says what each stage means.
//
// Every statement carries its basis:
//   DOC        a principle or observation stated in a cited NASA document
//   experiment a value recorded for the selected test (shown only when a test is selected)
//   COMPUTED   an idealized calculation from recorded values (never a measurement)
//   HYPOTHESIS a conceptual illustration (the 3D drawing)
//   UNSUPPORTED something the local evidence cannot establish
// Nothing here is a time, temperature, velocity or rate: stages are positions on a normalized, illustrative axis.
import type { BassFlow, BassSample, FlexFuel } from "@/lib/lab-presets";
import { SOURCES, type SourceRef } from "@/lib/lab-scientific-metadata";

export type Basis = { kind: "DOC" | "experiment" | "COMPUTED" | "HYPOTHESIS" | "UNSUPPORTED"; text: string };

export type StageInfo = {
  id: string;
  title: string;
  /** One sentence, always visible. */
  summary: string;
  /** One key takeaway, always visible. */
  insight: string;
  /** "Why does this happen?" (on request). */
  why: string;
  /** Components the stage is about: emphasized in 3D and offered for inspection. */
  focus: string[];
  inspect: { id: string; label: string };
  /** Components not drawn in this stage, with the reason (shown instead of an empty inspector). */
  absent?: Record<string, string>;
  basis: Basis[];
  sources: SourceRef[];
  limits: string;
  /** Text alternative of what the 3D view shows in this stage. */
  a11y: string;
};

/** Earth vs microgravity, per stage. `focus` is what "Why are they different?" highlights in both views. */
export type GravityStage = { earth: string; micro: string; differ: string; detail: string; focus: string[]; sources: SourceRef[] };

// ------------------------------------------------------------------------------------------------- FLEX ----------

const NO_FLAME = "No flame exists before ignition, so it is not drawn in this stage.";

export const FLEX_INFO: Record<string, StageInfo> = {
  initial: {
    id: "initial", title: "Initial droplet",
    summary: "A fuel droplet is formed between two hollow needles, which retract and leave it nearly stationary.",
    insight: "Before ignition there is no flame: only a liquid droplet in a chosen atmosphere.",
    why: "FLEX burned single droplets in the Multi-user Droplet Combustion Apparatus (MDCA). The droplet is deployed free-floating, so only the surrounding gas affects how it later burns. Each test records its starting diameter D₀, its oxygen and diluent mole fractions and its pressure; no initial temperature is in the local data.",
    focus: ["droplet", "surface"], inspect: { id: "droplet", label: "Inspect the droplet" },
    absent: { flame: NO_FLAME, soot: NO_FLAME, vapour: "No vapour region is drawn before ignition.", oxygen: "Transport is drawn once the flame burns." },
    basis: [
      { kind: "DOC", text: "Droplet formation between needles and free-floating deployment (Liu et al. 2013, p.4)." },
      { kind: "experiment", text: "D₀, O₂, diluent and pressure are recorded for each FLEX test." },
      { kind: "HYPOTHESIS", text: "Needle and droplet proportions in 3D are illustrative." },
    ],
    sources: [SOURCES.liuP4, SOURCES.psi69],
    limits: "The drawing shows a representative droplet, not a particular test's deployment.",
    a11y: "A single spherical fuel droplet with two needles retracting from it; no flame.",
  },
  ignition: {
    id: "ignition", title: "Ignition",
    summary: "Hot-wire igniters heat the fuel near the droplet; once a flame forms they retract.",
    insight: "Ignition supplies energy; a flame forms only if the conditions can sustain it.",
    why: "The MDCA ignites the droplet with Kanthal hot-wire igniters. Heating evaporates fuel next to the droplet, and if that fuel-oxygen mixture can sustain combustion a flame forms around it. The local data record no ignition delay or ignition energy, so none is shown, and tests need not share one ignition history.",
    focus: ["vapour", "droplet"], inspect: { id: "vapour", label: "Inspect the fuel vapour region" },
    absent: { soot: "Soot is drawn only once burning is established." },
    basis: [
      { kind: "DOC", text: "Hot-wire igniters that retract after ignition (Liu et al. 2013, p.4; MDCA safety package, p.22)." },
      { kind: "UNSUPPORTED", text: "Ignition delay and energy are not in the local data." },
      { kind: "HYPOTHESIS", text: "The glow and igniter motion are an illustrative cue." },
    ],
    sources: [SOURCES.liuP4, SOURCES.mdcaIgniter],
    limits: "The ignition cue is not timed to any test.",
    a11y: "Two igniter tips glow beside the droplet and withdraw as a flame shell appears around it.",
  },
  burning: {
    id: "burning", title: "Established burning",
    summary: "Fuel vapour moves outward and oxygen inward; they react in a thin zone, the flame envelope.",
    insight: "This is a diffusion flame: fuel and oxygen meet by diffusing toward each other.",
    why: "Heat from the flame evaporates the liquid. The vapour diffuses outward, oxygen diffuses inward from the surroundings, and they burn where they meet. With buoyant convection suppressed, the flame can approach a sphere around the droplet; its real distance from the droplet varies with the droplet diameter and over time.",
    focus: ["flame", "vapour", "oxygen"], inspect: { id: "flame", label: "Inspect the flame envelope" },
    basis: [
      { kind: "DOC", text: "Spherical diffusion flame of a droplet in microgravity (Liu et al. 2013, p.2); standoff varies with D₀ (p.8)." },
      { kind: "HYPOTHESIS", text: "Particle and arrow motion shows direction only, not measured velocity." },
    ],
    sources: [SOURCES.liuP2, SOURCES.liuP8],
    limits: "The drawn flame radius (a fixed multiple of the droplet) is illustrative.",
    a11y: "A blue flame shell surrounds the droplet; amber dots move outward from the droplet and cyan dots move inward toward the flame.",
  },
  regression: {
    id: "regression", title: "Droplet regression",
    summary: "The droplet shrinks as it evaporates, while the flame keeps burning around it.",
    insight: "In the idealized d²-law the droplet's diameter squared falls linearly: D² = D₀² − K·t.",
    why: "Evaporation, heat transfer and mass transfer set how fast the liquid is consumed. The classical d²-law assumes a quasi-steady, spherically symmetric flame; under those assumptions D² falls at a constant rate K (mm²/s). Real burns can depart from it, for example through soot formation, radiative heat loss or a changing flame standoff.",
    focus: ["droplet", "surface"], inspect: { id: "droplet", label: "Inspect the shrinking droplet" },
    basis: [
      { kind: "DOC", text: "The d²-law and the burning-rate constant K (Liu et al. 2013, p.2)." },
      { kind: "COMPUTED", text: "Any time computed from D₀ and K is an idealized calculation, not a measured trajectory." },
      { kind: "HYPOTHESIS", text: "The drawn shrinkage follows the d²-law shape on an arbitrary axis." },
    ],
    sources: [SOURCES.liuP2, SOURCES.flexEird18],
    limits: "FLEX records give D₀, K, burn time and the end state, not a measured diameter history, so the law is not validated against time histories here.",
    a11y: "The droplet shrinks smoothly while the flame shell stays around it.",
  },
  end: {
    id: "end", title: "Extinction or end of burning",
    summary: "The visible flame goes out or the recorded burn ends; FLEX records the end as Extinction, Disruption or Completion.",
    insight: "How a burn ends depends on the fuel, the droplet size and the atmosphere: there is no single outcome.",
    why: "A flame can go out when the droplet becomes too small to sustain it (diffusive extinction), or when radiative heat loss from a large flame becomes too great (radiative extinction). Which applies depends on the fuel, the droplet size and the atmosphere. The test-end category alone does not say which mechanism ended a particular test.",
    focus: ["flame", "droplet"], inspect: { id: "flame", label: "Inspect the fading flame" },
    absent: { soot: "Soot fades with the visible flame." },
    basis: [
      { kind: "DOC", text: "Diffusive and radiative extinction; dependence on droplet size and fuel (Farouk & Dryer 2013, p.2)." },
      { kind: "experiment", text: "Each test's ‘Test end’ category, as recorded." },
      { kind: "HYPOTHESIS", text: "The fade is a neutral end state, the same for every outcome." },
    ],
    sources: [SOURCES.faroukP2, SOURCES.flexEird74],
    limits: "‘Disruption’ is not defined in the local documents and may hide a censored result.",
    a11y: "The flame shell fades away; the remaining droplet stays visible.",
  },
};

/** Fuel-specific notes per stage (only where a source supports a difference). */
export const FLEX_FUEL_NOTE: Record<string, Partial<Record<FlexFuel, { text: string; source: SourceRef }>>> = {
  burning: {
    Heptane: { text: "n-Heptane is a sooting fuel: soot forms between the droplet and the flame and can collect in a shell.", source: SOURCES.flexEird18 },
    Methanol: { text: "Methanol is a non-sooting alcohol fuel, so no soot shell is drawn.", source: SOURCES.flexEird36 },
  },
  regression: {
    Heptane: { text: "Soot trapped between droplet and flame holds chemical energy that is not released, one reason sooting burns can depart from the ideal law.", source: SOURCES.flexEird18 },
    Methanol: { text: "Methanol burns without a soot shell; the FLEX design pairs it with n-heptane to separate soot effects.", source: SOURCES.flexEird36 },
  },
  end: {
    Heptane: { text: "For sufficiently large n-heptane droplets the hot visible flame can stop while a low-temperature second stage keeps the droplet burning without visible emission (a ‘cool flame’), ending later in diffusive extinction. Smaller droplets burn in a single stage. The cool flame is not drawn: its shape is not seen in ordinary imagery, and not every test shows it.", source: SOURCES.faroukP2 },
    Methanol: { text: "Large methanol droplets have shown classical radiative extinction in microgravity.", source: SOURCES.faroukP2 },
  },
};

export const FLEX_GRAVITY: Record<string, GravityStage> = {
  initial: {
    earth: "Gravity acts on the droplet and the gas around it, but nothing is burning yet.",
    micro: "Effective gravity is greatly reduced, so a deployed droplet can stay nearly stationary.",
    differ: "Before ignition there is no flame to compare; the environments differ only in how the droplet is held and what heated gas will later do.",
    detail: "FLEX flew because buoyancy would distort the burning droplet later on. At this stage neither side has a flame shape.",
    focus: ["droplet"], sources: [SOURCES.flexEird64],
  },
  ignition: {
    earth: "Gas heated by the igniters becomes less dense than its surroundings and starts to rise.",
    micro: "Buoyant rising is greatly reduced; residual or imposed flow can still move the gas.",
    differ: "The first hot gas behaves differently: on Earth it begins to rise, in orbit it stays near the droplet.",
    detail: "Hot gas is lighter than the cooler gas around it. Gravity turns that density difference into a buoyant force; with gravity greatly reduced the force is too, so ignition alone does not fix the transport pattern or the flame shape.",
    focus: ["oxygen", "vapour"], sources: [SOURCES.flexEird64],
  },
  burning: {
    earth: "Hot combustion gas rises by buoyancy-driven convection, pulling fresh air in from below and stretching the flame upward.",
    micro: "With buoyancy greatly reduced, diffusion carries a larger share of the transport and the flame can become nearly spherical.",
    differ: "Gravity turns density differences into flow: hot, light gas rises on Earth; in orbit that flow largely disappears, so diffusion shapes the flame.",
    detail: "FLEX's requirements state that spherical symmetry is possible only when diffusion times are much shorter than the buoyancy-controlled time. At 1 g and 1 atm that needs droplets far smaller than 1 mm, too small to measure, which is why FLEX flew. Diffusion still acts on Earth, and gas still moves in orbit; what changes is their balance.",
    focus: ["oxygen", "flame"], sources: [SOURCES.flexEird64, SOURCES.liuP2],
  },
  regression: {
    earth: "Buoyant flow carries heat and fuel vapour upward, changing how heat and mass reach the droplet.",
    micro: "Without buoyant flow, transport is mainly diffusive, though radiation, residual motion or imposed flow can still matter.",
    differ: "The droplet shrinks in both environments; what changes is how heat and vapour are carried, so the rate cannot be read off the flame shape.",
    detail: "Regression depends on the fuel, the atmosphere, the flow and the experimental configuration. SpaceFire has no paired Earth measurements, so it makes no faster-or-slower claim.",
    focus: ["droplet", "oxygen"], sources: [SOURCES.flexEird64],
  },
  end: {
    earth: "Extinction depends on fuel properties, oxygen supply, heat loss and transport.",
    micro: "Extinction also depends on conditions; without buoyancy, large slowly burning droplets are possible, and radiative heat loss can end their visible flame.",
    differ: "Flame shape alone does not decide when or how a flame goes out.",
    detail: "No Earth-versus-orbit extinction threshold or timing is shown: there are no comparable paired measurements in the local data. FLEX flew partly because measurable extinction diameters need large droplets, which buoyancy would disturb on Earth.",
    focus: ["flame"], sources: [SOURCES.flexEird64, SOURCES.faroukP2],
  },
};

/** What the selected record's recorded end means for the end stage (never more than the category supports). */
export function flexOutcomeText(testEnd: string | null | undefined, dext: number | null | undefined): string {
  switch (testEnd) {
    case "Extinction":
      return `Recorded as ‘Extinction’: the visible flame went out${dext !== null && dext !== undefined && dext > 0 ? ` at a recorded diameter of ${dext} mm` : ""}. The record does not state the extinction mechanism.`;
    case "Disruption":
      return "Recorded as ‘Disruption’, a category not defined in the local documents; it may hide a censored result. How this burn ended cannot be determined from the available evidence.";
    case "Completion":
      return "Recorded as ‘Completion’. The record does not establish a physical extinction mechanism for this test.";
    default:
      return "No test end is recorded for this test, so how it ended cannot be determined.";
  }
}

/** Idealized d²-law time for D² to reach zero (s), only for valid inputs. Not an extinction time. */
export function d2ZeroTime(d0: number | null | undefined, k: number | null | undefined): number | null {
  if (typeof d0 !== "number" || typeof k !== "number" || !(d0 > 0) || !(k > 0)) return null;
  return (d0 * d0) / k;
}

// ----------------------------------------------------------------------------------------------- BASS-II ---------

const SAMPLE_TEXT: Record<BassSample, string> = {
  "thin-film": "a thin PMMA film", slab: "a flat PMMA slab", rod: "a PMMA rod", sphere: "a section of a PMMA sphere", fabric: "a fabric strip",
};
const FLOW_SPREAD: Record<BassFlow, string> = {
  opposed: "The flame front creeps along the sample toward the incoming air (opposed spread).",
  concurrent: "The flame front moves with the airflow, and the flame trails downstream of it (concurrent spread).",
  stagnation: "Air flows head-on onto the sample (stagnation flow) and the flame sits on the facing surface.",
};

export function bassInfo(sample: BassSample, flow: BassFlow): Record<string, StageInfo> {
  const what = SAMPLE_TEXT[sample];
  return {
    ignite: {
      id: "ignite", title: "Ignition",
      summary: `The hot-wire igniter heats one end of ${what} inside the flow duct.`,
      insight: "Ignition starts the flame at one end, so that its spread along the sample can be watched.",
      why: "A Kanthal hot-wire coil, swung into place by a crew-pulled lever, ignites the sample while the fan drives air through the duct past it. Flow restrictors and a honeycomb straightener set and smooth the airflow before it reaches the sample.",
      focus: ["igniter", "sample"], inspect: { id: "igniter", label: "Inspect the igniter" },
      basis: [
        { kind: "DOC", text: "Igniter, duct, fan and flow conditioning (BASS-II Summary Report, pp.12–13)." },
        { kind: "HYPOTHESIS", text: "The igniter's drawn position at the starting end is illustrative." },
      ],
      sources: [SOURCES.bassP13, SOURCES.bassP12],
      limits: "No ignition timing is in the local data.",
      a11y: `A glowing igniter coil touches one end of ${what} in the duct; air flows past.`,
    },
    spread: {
      id: "spread", title: "Flame spread",
      summary: FLOW_SPREAD[flow],
      insight: "Airflow direction relative to the front changes how heat from the flame reaches unburned material.",
      why: `To spread, the flame must heat the unburned material ahead of it to ignition. In opposed spread NASA found the spread rate falls as the opposed flow is reduced, until the flame goes out. Sample geometry matters too: ${what} needs a different amount of heat to warm ahead of the front, so tests are compared within one geometry.`,
      focus: ["flame", "airflow"], inspect: { id: "flame", label: "Inspect the flame front" },
      basis: [
        { kind: "DOC", text: "Spread rate falls as opposed flow is reduced (Summary Report, p.27); Table 5.1 conditions (p.64)." },
        { kind: "HYPOTHESIS", text: "The moving front in 3D shows direction only: its speed is not a measured spread rate." },
      ],
      sources: [SOURCES.bassP27, SOURCES.bassP64],
      limits: "Measured spread rates come only from Summary Report Table 5.1, in mm/s at a stated flow velocity.",
      a11y: `A flame front moves along ${what}; arrows show the airflow ${flow === "opposed" ? "against" : flow === "concurrent" ? "with" : "onto"} it.`,
    },
    end: {
      id: "end", title: "End of observed spread",
      summary: "Spread ends when the front reaches the end of the sample, or earlier if the flame goes out.",
      insight: "How a test ended is known only where NASA recorded it; it is not assumed.",
      why: "Some BASS-II tests ended with the sample burned to its end, others with extinction when conditions (for example a reduced opposed flow) could no longer sustain the flame. The local CSV does not record an outcome for every test; the report tables do for some.",
      focus: ["flame", "sample"], inspect: { id: "sample", label: "Inspect the sample" },
      basis: [
        { kind: "DOC", text: "Spread slowing to extinction under reduced opposed flow (Summary Report, p.27)." },
        { kind: "UNSUPPORTED", text: "Without a report row, the end of a particular test cannot be inferred." },
      ],
      sources: [SOURCES.bassP27],
      limits: "The illustrative front reaches the end of the drawn sample in every case.",
      a11y: "The flame front reaches the far end of the sample and the flame fades.",
    },
  };
}

/**
 * Components emphasized for a stage, from primitive inputs only (scene, stage id, walkthrough step, whether
 * "Why are they different?" is open). Stage focus does not depend on the fuel, sample or burn.
 */
export function stageFocus(scene: "flex" | "bass" | "saffire", stageId: string | null, walk: number | null, gravityWhy: boolean): string {
  if (scene === "flex" && stageId) return (gravityWhy ? FLEX_GRAVITY[stageId]?.focus : FLEX_INFO[stageId]?.focus)?.join("|") ?? "";
  if (scene === "bass" && stageId) return bassInfo("slab", "opposed")[stageId]?.focus.join("|") ?? "";
  if (scene === "saffire" && walk !== null) return saffireWalk("S1")[walk]?.focus.join("|") ?? "";
  return "";
}

// ----------------------------------------------------------------------------------------------- SAFFIRE-I -------

export type WalkStep = StageInfo & { preset?: string; view?: "3d" | "footage" };

const glenn: SourceRef = { label: "NASA Glenn: NASA Ignites Fire Experiment Aboard Space Cargo Ship", href: "https://www.nasa.gov/centers-and-facilities/glenn/nasa-ignites-fire-experiment-aboard-space-cargo-ship/", external: true };

/** An explanatory walkthrough, not a timeline: the steps are topics, not intervals of the burn. */
export function saffireWalk(burn: "S1" | "S2"): WalkStep[] {
  const dir = burn === "S1" ? "with the airflow (concurrent)" : "against the airflow (opposed)";
  return [
    { id: "setup", title: "Experiment setup", preset: "overview",
      summary: "A large cotton-fiberglass sheet was mounted in a flow duct inside a closed unit aboard the Cygnus cargo vehicle.",
      insight: "Saffire-I tested a fire at spacecraft scale, far larger than the small ISS samples.",
      why: "Small-sample experiments cannot show how a fire grows over a large surface in a real vehicle. Saffire-I burned a sheet about 0.4 m wide by 0.94 m tall after Cygnus left the space station, with no crew aboard.",
      focus: ["sample", "enclosure"], inspect: { id: "sample", label: "Inspect the sample card" },
      basis: [{ kind: "DOC", text: "Sample size and arrangement (SAFFIRE-I Operations, p.1; ISA-Tab)." }, { kind: "HYPOTHESIS", text: "Enclosure and duct proportions are simplified." }],
      sources: [SOURCES.saffireOps, SOURCES.saffireIsa], limits: "The CSV's length and width columns appear swapped; the drawing follows the Operations document.",
      a11y: "A closed experiment box with a tall fabric sample card in a central flow duct." },
    { id: "airflow", title: "Airflow and ignition", preset: "flow",
      summary: "Fans draw air upward through the duct at 20 cm/s, and a hot wire ignites the sample.",
      insight: `Burn ${burn} spread ${dir}.`,
      why: "Flow straighteners at the bottom of the duct smooth the air that the fans draw past the sample. NASA describes ignition by a hot wire; the ignition location is not in the local data, so it is not drawn.",
      focus: ["airflow", "fans", "straighteners"], inspect: { id: "airflow", label: "Inspect the airflow" },
      basis: [{ kind: "DOC", text: "20 cm/s flow, fans and straighteners (ISA-Tab; Description of Data)." }, { kind: "experiment", text: `Flow direction of burn ${burn} (CSV).` }, { kind: "HYPOTHESIS", text: "Airflow arrows are conceptual, not measured vectors." }],
      sources: [SOURCES.saffireIsa, SOURCES.saffireDod, glenn], limits: "No ignition position or timing is in the local data.",
      a11y: "Arrows show air moving upward through the duct past the sample." },
    { id: "spread", title: "Flame-spread investigation", preset: "sample",
      summary: "The experiment set out to observe how a flame spreads over a large sample in low gravity.",
      insight: "The direction of spread relative to the airflow is recorded; the flame's positions over time are not in the local data.",
      why: "Concurrent and opposed spread were run as separate burns (S1 and S2) in the same 20 cm/s flow, so their burn times reflect the flow direction as well as the material. The moving band in 3D shows the recorded direction only.",
      focus: ["flame", "sample"], inspect: { id: "flame", label: "Inspect the spread direction" },
      basis: [{ kind: "experiment", text: "S1 concurrent, S2 opposed; burn times as recorded (CSV)." }, { kind: "UNSUPPORTED", text: "Flame-front positions, spread rates and temperatures are not in the local files." }],
      sources: [SOURCES.saffireDod], limits: "No spread rate or flame-front trajectory is shown or reconstructed.",
      a11y: `A band on the sample marks the direction burn ${burn} spread, ${dir}.` },
    { id: "diagnostics", title: "Diagnostics and observation", preset: "diagnostics",
      summary: "Two cameras recorded the burn, alongside radiometers, thermocouples and gas, pressure and flow sensors.",
      insight: "The sensors existed, but their time series are not in SpaceFire's local data.",
      why: "NASA's metadata lists two cameras, thermocouples, two radiometers, O₂, CO₂ and pressure sensors and two anemometers. Only the image manifest (file names, times and receipt status) is available locally.",
      focus: ["cameras", "sensors"], inspect: { id: "cameras", label: "Inspect the cameras" },
      basis: [{ kind: "DOC", text: "Instrument list (SAFFIRE-I ISA-Tab)." }, { kind: "HYPOTHESIS", text: "Sensor positions in 3D are illustrative." }],
      sources: [SOURCES.saffireIsa], limits: "No sensor readings are shown because none are in the local data.",
      a11y: "Two camera bodies and a sensor cluster are highlighted around the duct." },
    { id: "evidence", title: "Evidence and limitations", view: "footage",
      summary: "NASA's public footage shows the real burn; the local files hold two burn rows and an image manifest.",
      insight: "Nothing in the 3D view is reconstructed from NASA's frames.",
      why: "The footage is NASA's selection of frames, so its playback rate is not the burn rate. The manifest lists image files and times without pixels, and about a quarter of the Sample 2 frames are marked received.",
      focus: ["cameras"], inspect: { id: "cameras", label: "Inspect the cameras" },
      basis: [{ kind: "DOC", text: "NASA footage of the Saffire-I burn (NASA Glenn)." }, { kind: "experiment", text: "Manifest receipt counts (SAF-DOWNLINK-GAP)." }, { kind: "UNSUPPORTED", text: "No image pixels or measurement histories are in the local data." }],
      sources: [glenn, SOURCES.saffireDod], limits: "The footage is not tied to a test row by NASA's caption.",
      a11y: "The NASA footage view opens; press play to load NASA's animation." },
  ];
}
