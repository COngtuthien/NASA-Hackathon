// Phase 15: Guided Demo Mode. A five-step presentation path over the real pages (Explorer, analysis pages, 3D
// studios, Copilot) for one of the four Research-to-Safety scenarios. State lives in sessionStorage so it follows the
// presenter across pages and ends with the tab. The demo never changes data and never sends a Copilot question.
import { useSyncExternalStore } from "react";

export type DemoScenario = "gaseous-flames" | "smoke-detection" | "droplet-extinction" | "flame-spread";
/** "demo": the five-step presentation (Phase 15). "explore": the six-step Combustion Explorer guide (Phase 16). */
export type DemoMode = "demo" | "explore";
export type DemoState = { active: boolean; step: number; scenario: DemoScenario; mode?: DemoMode };

export const DEMO_STEPS = [
  { n: 1, title: "The challenge" },
  { n: 2, title: "Choose a research scenario" },
  { n: 3, title: "Explore NASA evidence" },
  { n: 4, title: "Interactive 3D exploration" },
  { n: 5, title: "Ask Research Copilot" },
] as const;

export const EXPLORE_STEPS = [
  { n: 1, title: "Choose a scientific domain" },
  { n: 2, title: "Choose a dataset" },
  { n: 3, title: "Explore records and filters" },
  { n: 4, title: "Inspect a record and its source" },
  { n: 5, title: "View the chart or 3D studio" },
  { n: 6, title: "Continue to Research Copilot" },
] as const;

/** Combustion Explorer guide per scenario: real collections, a real filter, a real record (all exist in SpaceFire). */
export const EXPLORE: Record<DemoScenario, { domain: string; dataset: string; filtered: string; record: string; viz: { label: string; href: string };
  test?: string; notes: Record<number, string> }> = {
  "gaseous-flames": { domain: "Gaseous Flame Dynamics", dataset: "cfig", filtered: "/experiments?dataset=cfig&f_configuration=normal&f_fuel_species=n-butane",
    record: "/experiments/cfig/cfig%3Anormal%3A21174C3", viz: { label: "CFI-G charts", href: "/phenomena/gaseous-flames?tab=cfig" }, test: "21174C3",
    notes: { 2: "ACME CFI-G holds measured outcomes; Flame Design is conditions only; BRE is day-level summaries.",
      3: "Normal flames, n-butane: outcomes and censored (FT) burn times per test point.",
      4: "Test 21174C3: every value with its role, the CSV row, flags and the Table 3 page." } },
  "smoke-detection": { domain: "Smoke & Fire Detection", dataset: "same_sizes", filtered: "/experiments?dataset=same_sizes&f_material=kapton",
    record: "/experiments/same_sizes/same%3Asize%3Akapton%3Aaged", viz: { label: "SAME particle-size charts", href: "/phenomena/smoke-detection#sizes" },
    notes: { 2: "Two separate SAME tables: the flight log (what was run) and Table 1 particle sizes (results).",
      3: "Kapton: fresh and aged rows from Table 1.", 4: "Aged Kapton smoke with Table 1, p.27 as its source." } },
  "droplet-extinction": { domain: "Liquid Droplet Combustion", dataset: "flex", filtered: "/experiments?dataset=flex&f_fuel=Heptane",
    record: "/experiments/flex/flex%3A180", viz: { label: "FLEX 3D studio for this test", href: "/phenomena/flame-extinction?record=flex%3A180#studio" }, test: "flex:180",
    notes: { 2: "FLEX has measured tests; PSI-117 has figure-data series; FLEX-2 has a test plan only.",
      3: "Heptane tests with O₂, pressure and diameter filters.", 4: "One FLEX test with every recorded value and its CSV row." } },
  "flame-spread": { domain: "Solid Flame Spread", dataset: "bass2", filtered: "/experiments?dataset=bass2&f_material_class=PMMA%20slab",
    record: "/experiments/bass2/bass2%3A27", viz: { label: "BASS-II report tables", href: "/phenomena/flame-spread#spread" }, test: "bass2:27",
    notes: { 2: "BASS-II has measured runs; PSI-62 is metadata only.", 3: "PMMA slabs.",
      4: "Test M1 with its Summary Report Table 5.1 spread rate." } },
};

type Journey = {
  label: string; letter: string; question: string; investigation: string;
  explorer: string; charts: { label: string; href: string }; studio: string;
  /** What to point at on each step (short, presenter-facing). */ notes: Record<number, string[]>;
  evidence: string; limitation: string; copilotQuestion: string;
};

// Every number below is shown on the linked page and comes from verified NASA records (see docs/PHASE15_DEMO_GUIDE.md).
export const JOURNEYS: Record<DemoScenario, Journey> = {
  "gaseous-flames": {
    label: "Gaseous Flame Behavior", letter: "A", investigation: "PSI-159",
    question: "Under which experimental conditions do gaseous microgravity flames ignite, persist, transition, or extinguish?",
    explorer: "/safety-explorer/gaseous-flames",
    charts: { label: "CFI-G charts", href: "/phenomena/gaseous-flames?tab=cfig" },
    studio: "/phenomena/gaseous-flames#studio",
    evidence: "333 CFI-G test outcomes (179 normal, 154 inverse) and 15 measured cool-flame events from Final Report Table 3, p.46.",
    limitation: "Flow-terminated burn times are lower bounds; cool flames were seen at one condition family only, so their radii are not transferable.",
    copilotQuestion: "What conditions produced the reported CFI-G cool flames?",
    notes: {
      3: ["ACME CFI-G ranks first: measured per-test outcomes. Flame Design gives conditions only; BRE is context.",
        "Filter to inverse flames: normal tests are rejected, never pooled.",
        "Open a Table 3 cool-flame event: radii with the PDF page."],
      4: ["Switch normal / inverse and hot / cool; pick a Table 3 event to draw its measured radii to scale.",
        "Everything else is labelled conceptual. Pause, Reset, Hide controls and Fullscreen work like the other studios.",
        "Below the studio: real NASA footage from a CFI-G test."],
    },
  },
  "smoke-detection": {
    label: "Early Smoke Detection", letter: "B", investigation: "PSI-102",
    question: "How do smoke particle characteristics and detector observations vary among overheated spacecraft materials?",
    explorer: "/safety-explorer/smoke-detection",
    charts: { label: "SAME particle-size charts", href: "/phenomena/smoke-detection#sizes" },
    studio: "/phenomena/smoke-detection?material=kapton#studio",
    evidence: "SAME Final Science Report Table 1 (p.27): for Kapton, mean particle diameter 105 nm fresh and 186 nm after 720 s of aging.",
    limitation: "Moment-method statistics (log-normal assumption); no detector alarm threshold or sensitivity is computed; 1 Hz telemetry is not processed.",
    copilotQuestion: "Why does SAME particle-size information matter for spacecraft smoke detection?",
    notes: {
      3: ["SAME ranks first with report-backed measurements; BASS-II and SAFFIRE-I are context only.",
        "Pick Kapton: fresh vs aged sizes from Table 1, with the page link.",
        "The interpretation says what cannot be concluded: no detector sensitivity."],
      4: ["Step through the six stages; switch material and fresh / aged: the measured panel follows the selection.",
        "Particles are illustrative, not measured trajectories. Pause stops them; Reset returns to stage 1."],
    },
  },
  "droplet-extinction": {
    label: "Droplet Flame Extinction", letter: "C", investigation: "PSI-69",
    question: "How do fuel properties and experimental conditions affect droplet burning and flame extinction in microgravity?",
    explorer: "/safety-explorer/droplet-extinction",
    charts: { label: "PSI-117 model vs experiment", href: "/phenomena/flame-extinction#psi117-explore" },
    studio: "/phenomena/flame-extinction#studio",
    evidence: "274 FLEX test rows (heptane and methanol) with recorded test ends; PSI-117 provides published experiment points and 1-D model curves.",
    limitation: "Test-end counts are not extinction probabilities (adaptive test matrix); PSI-117 is not joined to FLEX rows; FLEX-2 has no outcome data.",
    copilotQuestion: "How does gaseous cool-flame research differ from FLEX droplet cool-flame research?",
    notes: {
      3: ["FLEX ranks first; PSI-117 supports with figure data and model curves; FLEX-2 is documents only.",
        "Set O₂ to 0.9–1: the Explorer says there is no matching evidence instead of predicting.",
        "Open the PSI-117 charts: experiment and model are drawn separately."],
      4: ["Earth vs microgravity, the burn timeline and fuel comparison. Play, pause and scrub the timeline.",
        "The flame drawing is conceptual; measured values of a selected test are shown beside it."],
    },
  },
  "flame-spread": {
    label: "Solid Flame Spread", letter: "D", investigation: "PSI-25",
    question: "How do material properties and airflow conditions affect flame spread in microgravity?",
    explorer: "/safety-explorer/flame-spread",
    charts: { label: "BASS-II report tables", href: "/phenomena/flame-spread#spread" },
    studio: "/phenomena/flame-spread?record=bass2:27#studio",
    evidence: "BASS-II Summary Report Table 5.1 (p.65): spread rates over PMMA slabs in opposed flow, e.g. test M1: 0.071 mm/s at 9 cm/s.",
    limitation: "Rates differ with thickness, width and airflow, so they are listed, not averaged; BRE emulation is not BASS-II flame spread.",
    copilotQuestion: "How does BASS-II flame spread evidence differ from the SAFFIRE-I large-scale burns?",
    notes: {
      3: ["BASS-II ranks first; SAFFIRE-I adds one spacecraft-scale burn per flow direction; PSI-62 is metadata only.",
        "Filter PMMA + opposed flow: spread rates come from the Summary Report with row and page."],
      4: ["The studio opens on test M1 with its recorded spread rate beside the model.",
        "The flame-front progression is illustrative, not measured flame-front motion."],
    },
  },
};

export const SCENARIO_ORDER: DemoScenario[] = ["gaseous-flames", "smoke-detection", "droplet-extinction", "flame-spread"];
const KEY = "spacefire:demo";
const OFF: DemoState = { active: false, step: 1, scenario: "gaseous-flames" };
const listeners = new Set<() => void>();
let cache: { raw: string | null; state: DemoState } = { raw: null, state: OFF };
let memory: string | null = null;   // fallback when sessionStorage is blocked

function read(): DemoState {
  let raw: string | null = null;
  try { raw = sessionStorage.getItem(KEY); } catch { /* storage blocked: demo state lives in memory only */ raw = memory; }
  if (raw === cache.raw) return cache.state;
  let state = OFF;
  try {
    const v = raw ? JSON.parse(raw) : null;
    const mode: DemoMode = v?.mode === "explore" ? "explore" : "demo";
    const max = mode === "explore" ? 6 : 5;
    if (v && typeof v.step === "number" && v.step >= 1 && v.step <= max && SCENARIO_ORDER.includes(v.scenario)) {
      state = { active: !!v.active, step: v.step, scenario: v.scenario, mode };
    }
  } catch { /* ignore malformed */ }
  cache = { raw, state };
  return state;
}

export function setDemo(next: DemoState | null) {
  const raw = next ? JSON.stringify(next) : null;
  try {
    if (raw) sessionStorage.setItem(KEY, raw); else sessionStorage.removeItem(KEY);
  } catch { memory = raw; }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function useDemo(): DemoState {
  return useSyncExternalStore(subscribe, read, () => OFF);
}

export function stepsFor(mode: DemoMode | undefined) {
  return mode === "explore" ? EXPLORE_STEPS : DEMO_STEPS;
}

/** The page each step of the Combustion Explorer guide opens. */
export function exploreHref(step: number, scenario: DemoScenario): string {
  const e = EXPLORE[scenario];
  switch (step) {
    case 1: case 2: return `/experiments?dataset=${e.dataset}`;
    case 3: return e.filtered;
    case 4: return e.record;
    case 5: return e.viz.href;
    default: {
      const q = new URLSearchParams({ draft: JOURNEYS[scenario].copilotQuestion, inv: JOURNEYS[scenario].investigation, scenario });
      if (e.test) q.set("test", e.test);
      return `/copilot?${q.toString()}`;
    }
  }
}

/** The page each step opens for a scenario. */
export function stepHref(step: number, scenario: DemoScenario, mode: DemoMode = "demo"): string {
  if (mode === "explore") return exploreHref(step, scenario);
  const j = JOURNEYS[scenario];
  switch (step) {
    case 1: return "/demo";
    case 2: return "/safety-explorer";
    case 3: return j.explorer;
    case 4: return j.studio;
    default: {
      const q = new URLSearchParams({ draft: j.copilotQuestion, inv: j.investigation, scenario });
      return `/copilot?${q.toString()}`;
    }
  }
}
