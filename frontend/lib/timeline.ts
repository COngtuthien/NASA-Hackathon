// A tiny external store for the illustrative timelines (FLEX burn stages, BASS-II front progression).
// Progress `p` runs 0..1 over a fixed, arbitrary playback duration: it is NOT experiment time. The 3D scene reads `p`
// every frame; the UI subscribes through useSyncExternalStore and re-renders only the timeline bar.
import { useSyncExternalStore } from "react";

export type TimelineSnap = { p: number; playing: boolean; speed: number; active: boolean };

export type TimelineStore = {
  get: () => TimelineSnap;
  set: (patch: Partial<TimelineSnap>) => void;
  /** Advance by dt seconds of playback (called from the render loop while playing). */
  tick: (dt: number) => void;
  subscribe: (cb: () => void) => () => void;
  readonly duration: number;
};

export function createTimeline(duration = 14): TimelineStore {
  let snap: TimelineSnap = { p: 0, playing: false, speed: 1, active: false };
  const subs = new Set<() => void>();
  const emit = () => subs.forEach((f) => f());
  const store: TimelineStore = {
    duration,
    get: () => snap,
    set: (patch) => {
      const next = { ...snap, ...patch };
      next.p = Math.min(1, Math.max(0, next.p));
      snap = next;
      emit();
    },
    tick: (dt) => {
      if (!snap.playing) return;
      const p = snap.p + (dt * snap.speed) / duration;
      if (p >= 1) store.set({ p: 1, playing: false });
      else store.set({ p });
    },
    subscribe: (cb) => {
      subs.add(cb);
      return () => { subs.delete(cb); };
    },
  };
  return store;
}

const SERVER_SNAP: TimelineSnap = { p: 0, playing: false, speed: 1, active: false };

export function useTimeline(store: TimelineStore): TimelineSnap {
  return useSyncExternalStore(store.subscribe, store.get, () => SERVER_SNAP);
}

/** One primitive derived from the store: the caller re-renders only when that value changes (not every frame). */
export function useTimelineValue<T extends string | number | boolean | null>(store: TimelineStore, select: (s: TimelineSnap) => T, server: T): T {
  return useSyncExternalStore(store.subscribe, () => select(store.get()), () => server);
}

export type Stage = { id: string; label: string; from: number; to: number; text: string };

/** Conceptual FLEX burn stages. Boundaries are arbitrary positions on a normalized axis, not times from a test. */
export const FLEX_STAGES: Stage[] = [
  { id: "initial", label: "Initial droplet", from: 0, to: 0.08,
    text: "A droplet is formed between two hollow needles, which retract and leave it nearly stationary (MDCA procedure)." },
  { id: "ignition", label: "Ignition", from: 0.08, to: 0.2,
    text: "Hot-wire igniters heat the fuel vapour near the droplet, then retract once a flame is established." },
  { id: "burning", label: "Established burning", from: 0.2, to: 0.36,
    text: "A diffusion flame surrounds the droplet where outward-diffusing fuel vapour meets inward-diffusing oxygen." },
  { id: "regression", label: "Droplet regression", from: 0.36, to: 0.86,
    text: "The droplet shrinks as it evaporates. The classical d²-law describes D² falling linearly in time under idealized assumptions." },
  { id: "end", label: "Extinction or end of burning", from: 0.86, to: 1,
    text: "Burning ends. FLEX records each test's outcome as ‘Test end’: Extinction, Disruption or Completion (‘Disruption’ is not defined in the local documents)." },
];

/** Conceptual BASS-II stages for the illustrative flame-front progression. */
export const BASS_STAGES: Stage[] = [
  { id: "ignite", label: "Ignition", from: 0, to: 0.12, text: "The hot-wire igniter swings in and ignites one end of the sample." },
  { id: "spread", label: "Flame spread", from: 0.12, to: 0.88, text: "The flame front moves along the sample: toward the incoming air (opposed) or with it (concurrent)." },
  { id: "end", label: "End of spread", from: 0.88, to: 1, text: "The front reaches the end of the sample, or, under some conditions (for example reduced opposed flow), the flame goes out first." },
];

export function stageAt(stages: Stage[], p: number): Stage {
  return stages.find((s) => p >= s.from && p < s.to) ?? stages[stages.length - 1];
}

/**
 * The active stage id (null while the timeline is off), derived from the one timeline store. Components using it
 * re-render only when the stage changes, never on every animation frame.
 */
export function useStageId(store: TimelineStore | null, stages: Stage[]): string | null {
  const get = () => {
    const s = store?.get();
    return s && s.active ? stageAt(stages, s.p).id : null;
  };
  return useSyncExternalStore(store ? store.subscribe : NOOP_SUB, get, () => null);
}
const NOOP_SUB = () => () => {};

/** Jump to a stage (paused): the same action for stage buttons, Previous / Next and guided steps. */
export function goToStage(store: TimelineStore, stages: Stage[], index: number) {
  const s = stages[Math.max(0, Math.min(stages.length - 1, index))];
  store.set({ p: s.from + 0.001, playing: false, active: true });
}

/** Phase 16: conceptual guided stages for the Gaseous Flame Studio (ACME CFI-G / Flame Design). Boundaries are
 *  positions on a normalized axis, not times of any test; outcomes differ between tests (see the stage-5 text). */
export const GAS_STAGES: Stage[] = [
  { id: "setup", label: "Setup", from: 0, to: 0.14,
    text: "A porous sphere 6.35 mm across sits on a supply tube inside the ACME chamber, which holds the test atmosphere (CFI-G report p.3; Flame Design report p.24)." },
  { id: "delivery", label: "Gas delivery", from: 0.14, to: 0.3,
    text: "Normal flame: fuel flows out of the burner into an O₂/N₂ atmosphere. Inverse flame: O₂/N₂ flows out into a fuel/N₂ atmosphere (CFI-G report p.3)." },
  { id: "ignition", label: "Ignition", from: 0.3, to: 0.44,
    text: "A retracting resistive igniter lights the gas near the burner (CFI-G report p.7). Some CFI-G test points did not ignite." },
  { id: "established", label: "Established flame", from: 0.44, to: 0.66,
    text: "Without buoyancy the flame is a nearly spherical shell where outflowing and ambient reactants meet by diffusion; it grows slowly (Flame Design report p.26)." },
  { id: "transition", label: "Extinction or transition", from: 0.66, to: 0.86,
    text: "Outcomes differ by test: self-extinction, flow termination (burn time censored), or no ignition. A cool flame after radiative extinction was seen only at 30 % n-butane, normal, 2.03 bar (Table 3, p.46): pick a Table 3 event to draw a measured case." },
  { id: "interpret", label: "Interpretation", from: 0.86, to: 1,
    text: "Which conditions led to which outcome is in the CFI-G charts and the Explorer. This sequence is a conceptual guide, not the timeline of one test." },
];

/** Phase 16: conceptual guided stages for the Smoke Detection Studio (SAME). Not to time scale. */
export const SMOKE_STAGES: Stage[] = [
  { id: "heating", label: "Material heating", from: 0, to: 1 / 6,
    text: "A wire coil heats the sample until it pyrolyzes, without flaming (SAME Final Science Report)." },
  { id: "formation", label: "Smoke formation", from: 1 / 6, to: 2 / 6,
    text: "Vapour from the overheated material condenses into fine liquid and solid smoke particles near the sample." },
  { id: "transport", label: "Particle transport", from: 2 / 6, to: 3 / 6,
    text: "A flow carries the smoke along the duct toward the aging chamber. Dot paths are illustrative, not measured trajectories." },
  { id: "aging", label: "Aging chamber", from: 3 / 6, to: 4 / 6,
    text: "Smoke is held so particles grow by coagulation; for Table 1 the aged samples were held 720 s (Final Science Report p.27)." },
  { id: "sampling", label: "Instrument sampling", from: 4 / 6, to: 5 / 6,
    text: "Diluted smoke reaches the P-Trak (number), ionization sensor (diameter-weighted) and two DustTraks (mass); their ratios give the moment-method sizes." },
  { id: "detection", label: "Detector interpretation", from: 5 / 6, to: 1,
    text: "The Space Shuttle ionization detector favours small particles, the ISS light-scattering detector larger ones; the authors report reduced ISS-detector performance for Kapton and Teflon smoke (ICES 2013, slide 28)." },
];
