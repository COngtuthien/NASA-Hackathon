import { expect, test } from "@playwright/test";
import { SOURCES } from "@/lib/lab-scientific-metadata";
import { bassInfo, d2ZeroTime, FLEX_FUEL_NOTE, FLEX_GRAVITY, FLEX_INFO, flexOutcomeText, saffireWalk, stageFocus } from "@/lib/stages";
import { BASS_STAGES, createTimeline, FLEX_STAGES, goToStage, stageAt } from "@/lib/timeline";

// Phase 10 logic tests: the stage model, its scientific guard rails and the single-timeline stage derivation.
test.beforeEach(({}, info) => { test.skip(info.project.name !== "desktop", "logic tests run once"); });

const words = (s: string) => s.split(/\s+/).length;
const ALL_TEXT = (o: unknown): string => JSON.stringify(o);

test.describe("Phase 10 logic", () => {
  test("FLEX: five stages, same ids as the timeline, short defaults, every claim has a basis and a source", () => {
    expect(Object.keys(FLEX_INFO)).toEqual(FLEX_STAGES.map((s) => s.id));
    expect(FLEX_STAGES.map((s) => s.id)).toEqual(["initial", "ignition", "burning", "regression", "end"]);
    for (const s of Object.values(FLEX_INFO)) {
      expect(words(s.summary)).toBeLessThanOrEqual(25);
      expect(words(s.insight)).toBeLessThanOrEqual(25);
      expect(s.basis.length).toBeGreaterThan(0);
      expect(s.basis.some((b) => b.kind === "HYPOTHESIS")).toBe(true);           // the drawing is always declared conceptual
      expect(s.sources.length).toBeGreaterThan(0);
      for (const src of s.sources) expect(src.href).toMatch(/^(\/api\/v1\/documents\/[\w-]+\/file(#page=\d+)?|https:\/\/)/);
      expect(s.focus.length).toBeGreaterThan(0);
      expect(s.a11y.length).toBeGreaterThan(20);
    }
    expect(FLEX_INFO.initial.absent?.flame).toMatch(/No flame exists before ignition/);
    expect(FLEX_INFO.regression.insight).toContain("D² = D₀² − K·t");
    expect(FLEX_INFO.regression.why).toContain("mm²/s");
    expect(FLEX_INFO.end.insight).toMatch(/there is no single outcome/);
  });

  test("no fabricated quantities: no temperatures, velocities, ignition delays or burn-rate comparisons", () => {
    const text = ALL_TEXT([FLEX_INFO, FLEX_GRAVITY, FLEX_FUEL_NOTE, bassInfo("rod", "concurrent"), saffireWalk("S1")]);
    expect(text).not.toMatch(/\d+(\.\d+)?\s*(°C|°F|K\b|kelvin)/i);                // no temperatures
    expect(text).not.toMatch(/\d+(\.\d+)?\s*mm\/s/);                              // no spread rates in the stage copy
    expect(text).not.toMatch(/burns? (faster|slower) (in|on)/i);
    const gravity = ALL_TEXT(FLEX_GRAVITY);
    expect(gravity).not.toMatch(/\balways\b/i);
    expect(gravity).not.toMatch(/diffusion (disappears|stops)|no convection/i);
    expect(gravity).toMatch(/Diffusion still acts on Earth, and gas still moves in orbit/);
    expect(gravity).toMatch(/no faster-or-slower claim/);
    expect(gravity).toMatch(/No Earth-versus-orbit extinction threshold or timing/);
  });

  test("Earth vs microgravity: every stage explains both sides and a stage-specific difference", () => {
    expect(Object.keys(FLEX_GRAVITY)).toEqual(FLEX_STAGES.map((s) => s.id));
    const differs = new Set<string>();
    for (const [id, g] of Object.entries(FLEX_GRAVITY)) {
      expect(g.earth, id).not.toBe(g.micro);
      expect(g.sources.length).toBeGreaterThan(0);
      expect(g.focus.length).toBeGreaterThan(0);
      differs.add(g.differ);
    }
    expect(differs.size).toBe(5);                                                  // not one generic paragraph
    expect(FLEX_GRAVITY.initial.differ).toMatch(/no flame to compare/);
    expect(FLEX_GRAVITY.burning.earth).toMatch(/buoyancy-driven convection/);
    expect(FLEX_GRAVITY.burning.micro).toMatch(/nearly spherical/);
    expect(FLEX_GRAVITY.burning.sources).toContain(SOURCES.flexEird64);
    expect(FLEX_GRAVITY.end.differ).toMatch(/Flame shape alone does not decide/);
  });

  test("fuel notes: methanol non-sooting; heptane cool flame stated carefully; nothing invented about its look", () => {
    expect(FLEX_FUEL_NOTE.burning.Methanol!.text).toMatch(/non-sooting/);
    expect(FLEX_FUEL_NOTE.burning.Heptane!.text).toMatch(/sooting fuel/);
    const cool = FLEX_FUEL_NOTE.end.Heptane!.text;
    expect(cool).toMatch(/sufficiently large n-heptane droplets/);
    expect(cool).toMatch(/not every test shows it/);
    expect(cool).toMatch(/The cool flame is not drawn/);
    expect(cool).not.toMatch(/\b(blue|purple|faint glow|radius)\b/i);
    expect(FLEX_FUEL_NOTE.end.Heptane!.source).toBe(SOURCES.faroukP2);
    expect(FLEX_FUEL_NOTE.end.Methanol!.text).toMatch(/radiative extinction/);
    expect(FLEX_FUEL_NOTE.initial).toBeUndefined();                                // no fuel claim where none is sourced
  });

  test("record outcome text never claims more than the category; the d²-law time is guarded", () => {
    expect(flexOutcomeText("Extinction", 3.13)).toBe("Recorded as ‘Extinction’: the visible flame went out at a recorded diameter of 3.13 mm. The record does not state the extinction mechanism.");
    expect(flexOutcomeText("Extinction", null)).not.toMatch(/diameter/);
    expect(flexOutcomeText("Disruption", null)).toMatch(/cannot be determined from the available evidence/);
    expect(flexOutcomeText("Completion", null)).toMatch(/does not establish a physical extinction mechanism/);
    expect(flexOutcomeText(null, null)).toMatch(/cannot be determined/);
    expect(d2ZeroTime(3.4, 0.41)).toBeCloseTo(28.195, 2);                          // D₀²/K with D₀ in mm, K in mm²/s → s
    for (const [d, k] of [[0, 0.4], [3, 0], [-1, 0.4], [3, -0.2], [null, 0.4], [3, undefined]] as const) expect(d2ZeroTime(d, k)).toBeNull();
  });

  test("BASS-II: three stages, flow- and material-aware, conceptual front declared", () => {
    expect(BASS_STAGES.map((s) => s.id)).toEqual(["ignite", "spread", "end"]);
    const opp = bassInfo("slab", "opposed"), con = bassInfo("rod", "concurrent");
    expect(Object.keys(opp)).toEqual(["ignite", "spread", "end"]);
    expect(opp.spread.summary).toMatch(/toward the incoming air \(opposed spread\)/);
    expect(con.spread.summary).toMatch(/with the airflow.*\(concurrent spread\)/);
    expect(opp.ignite.summary).toContain("a flat PMMA slab");
    expect(con.ignite.summary).toContain("a PMMA rod");
    expect(opp.spread.basis.find((b) => b.kind === "HYPOTHESIS")!.text).toMatch(/not a measured spread rate/);
    expect(opp.spread.limits).toMatch(/Table 5\.1/);
    expect(opp.end.insight).toMatch(/it is not assumed/);
  });

  test("SAFFIRE-I: a five-step walkthrough (not a timeline) that follows the selected burn and reconstructs nothing", () => {
    const s1 = saffireWalk("S1"), s2 = saffireWalk("S2");
    expect(s1.map((s) => s.id)).toEqual(["setup", "airflow", "spread", "diagnostics", "evidence"]);
    expect(s1[1].insight).toMatch(/S1 spread with the airflow \(concurrent\)/);
    expect(s2[1].insight).toMatch(/S2 spread against the airflow \(opposed\)/);
    expect(s1[2].basis.some((b) => b.kind === "UNSUPPORTED" && /not in the local files/.test(b.text))).toBe(true);
    expect(s1[4].insight).toMatch(/Nothing in the 3D view is reconstructed/);
    expect(s1.every((s) => s.sources.length > 0)).toBe(true);
  });

  test("one timeline store decides the stage; jumping to a stage pauses; focus derives from primitives", () => {
    const tl = createTimeline(14);
    tl.set({ playing: true, active: true });
    goToStage(tl, FLEX_STAGES, 2);
    expect(tl.get().playing).toBe(false);
    expect(stageAt(FLEX_STAGES, tl.get().p).id).toBe("burning");
    goToStage(tl, FLEX_STAGES, 99);                                                 // clamped
    expect(stageAt(FLEX_STAGES, tl.get().p).id).toBe("end");
    for (const st of FLEX_STAGES) {                                                // every boundary maps to its own stage
      tl.set({ p: st.from + 0.0001 });
      expect(stageAt(FLEX_STAGES, tl.get().p).id).toBe(st.id);
    }
    tl.set({ p: 0.5, playing: true });
    tl.tick(100);                                                                  // playback ends at 1 and stops
    expect(tl.get()).toMatchObject({ p: 1, playing: false });
    expect(stageFocus("flex", "burning", null, false)).toBe("flame|vapour|oxygen");
    expect(stageFocus("flex", "burning", null, true)).toBe("oxygen|flame");
    expect(stageFocus("flex", null, null, false)).toBe("");
    expect(stageFocus("saffire", null, 3, false)).toBe("cameras|sensors");
  });
});
