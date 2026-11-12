// "Discover SpaceFire" (Phase 9): an optional guided journey through the existing pages. Its whole state is two URL
// parameters, `journey` (the step) and `topic` (the chosen phenomenon), so it survives navigation and reloads, works
// without accounts or storage, and disappears when the parameters are removed. No step sends a model request: the
// Copilot step only opens a drafted question.
import { ROUTES } from "@/lib/routes";

export const JOURNEY_STEPS = ["welcome", "choose", "model", "interact", "evidence", "ask", "next"] as const;
export type JourneyStep = (typeof JOURNEY_STEPS)[number];
export type Topic = "flex" | "bass" | "saffire";

export const TOPICS: Record<Topic, { page: string; label: string; source: string; inv: string; mediaId: string; question: string }> = {
  flex: { page: ROUTES.extinction, label: "Droplet flames", source: "FLEX", inv: "PSI-69", mediaId: "flex-heptane-soot-composite",
    question: "Why does a burning droplet make a sphere of flame in orbit?" },
  bass: { page: ROUTES.spread, label: "Flame spread", source: "BASS-II", inv: "PSI-25", mediaId: "bass2-flame-gmt203",
    question: "How does a flame creep across a solid without gravity?" },
  saffire: { page: ROUTES.spacecraft, label: "Spacecraft fire", source: "SAFFIRE-I", inv: "PSI-98", mediaId: "saffire1-hardware-cygnus",
    question: "What happens when a large fire burns inside a spacecraft?" },
};

export const TOPIC_OF_PAGE: Record<string, Topic> = { [ROUTES.extinction]: "flex", [ROUTES.spread]: "bass", [ROUTES.spacecraft]: "saffire" };

export function isStep(v: string | null | undefined): v is JourneyStep {
  return !!v && (JOURNEY_STEPS as readonly string[]).includes(v);
}
export function isTopic(v: string | null | undefined): v is Topic {
  return v === "flex" || v === "bass" || v === "saffire";
}

/** 1-based position for "Step n of 7". */
export function stepNumber(s: JourneyStep) {
  return JOURNEY_STEPS.indexOf(s) + 1;
}

export function nextStep(s: JourneyStep): JourneyStep | null {
  const i = JOURNEY_STEPS.indexOf(s);
  return i < JOURNEY_STEPS.length - 1 ? JOURNEY_STEPS[i + 1] : null;
}
export function prevStep(s: JourneyStep): JourneyStep | null {
  const i = JOURNEY_STEPS.indexOf(s);
  return i > 0 ? JOURNEY_STEPS[i - 1] : null;
}

/** The page a step lives on. Steps after "choose" need a topic; without one they fall back to choosing. */
export function journeyHref(step: JourneyStep, topic: Topic | null): string {
  if (step === "welcome") return "/";
  if (step === "choose" || !topic) return "/?journey=choose#explore";
  const t = TOPICS[topic];
  if (step === "model" || step === "interact" || step === "evidence") {
    // the evidence step opens the studio's "Compare with NASA" view; earlier steps keep the default view
    const extra = step === "evidence" ? "&view=nasa" : "";
    return `${t.page}?journey=${step}${extra}#studio`;
  }
  const p = new URLSearchParams({ draft: JOURNEY_QUESTION[topic], inv: t.inv, from: "journey", journey: step, topic });
  return `${ROUTES.copilot}?${p.toString()}`;
}

/** The drafted, investigation-specific question the journey hands to the Copilot. Never auto-submitted. */
export const JOURNEY_QUESTION: Record<Topic, string> = {
  flex: "Why can a droplet flame become nearly spherical in microgravity, according to the NASA FLEX (PSI-69) sources?",
  bass: "How does airflow direction affect flame spread over solid materials in the NASA BASS-II (PSI-25) experiments?",
  saffire: "Why is large-scale spacecraft fire testing like SAFFIRE-I (PSI-98) important?",
};

/** Short, per-topic copy for the studio steps. Kept to one or two sentences each. */
export const STEP_COPY: Record<Topic, Record<"model" | "interact" | "evidence", { title: string; body: string; task: string; action: string }>> = {
  flex: {
    model: { title: "Explore the 3D droplet", body: "Drag to rotate, scroll or pinch to zoom, and click a part to select it. With the keyboard: focus the 3D view and use the arrow keys.", task: "Select a part of the model.", action: "Select the flame for me" },
    interact: { title: "Switch gravity off and on", body: "On Earth, hot gas rises and stretches the flame into a teardrop. In orbit there is no buoyancy, so the flame can wrap the droplet in a near-spherical shell.", task: "Open the Earth vs microgravity view.", action: "Show Earth vs microgravity" },
    evidence: { title: "Compare with NASA imagery", body: "The 3D droplet is a conceptual illustration. Beside it is a real NASA FLEX image and the values recorded for one test: those are the evidence.", task: "Pick a test to see its recorded values beside the image.", action: "Use an example test" },
  },
  bass: {
    model: { title: "Explore the flow duct", body: "Drag to rotate, scroll or pinch to zoom, and click a part to select it. With the keyboard: focus the 3D view and use the arrow keys.", task: "Select a part of the model.", action: "Select the sample for me" },
    interact: { title: "Compare opposed and concurrent flow", body: "Air flowing against the spreading flame (opposed) and with it (concurrent) changes how fast and how far the flame moves.", task: "Open the side-by-side flow comparison.", action: "Show both flows" },
    evidence: { title: "Compare with NASA evidence", body: "The duct and flame are conceptual. Beside them are a real BASS-II photograph and one test's recorded geometry and airflow.", task: "Pick a test to see its recorded geometry and airflow.", action: "Use an example test" },
  },
  saffire: {
    model: { title: "Explore the spacecraft experiment", body: "Drag to rotate, scroll or pinch to zoom, and click a part to select it. With the keyboard: focus the 3D view and use the arrow keys.", task: "Select a part of the model.", action: "Select the sample for me" },
    interact: { title: "Look inside the flow duct", body: "The cutaway shows the fabric sample card inside the duct, where air flows from bottom to top. S1 burned with the airflow, S2 against it.", task: "Turn on the cutaway and select the sample.", action: "Show the sample" },
    evidence: { title: "Compare with NASA hardware and footage", body: "The arrangement is conceptual. Beside it are NASA's photograph of the flight unit and its published burn footage; the local manifest has no pixels to reconstruct from.", task: "Open the comparison and look at burn S1's recorded values.", action: "Open the comparison" },
  },
};

/** An example record per topic, used only when the visitor asks the evidence step to pick one. */
export const EXAMPLE_RECORD: Record<Topic, string> = { flex: "flex:180", bass: "bass2:33", saffire: "saffire1:S1" };
