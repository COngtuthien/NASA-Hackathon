# Phase 16 — Guided Timelines in the New Studios

The Gaseous Flame and Smoke Detection studios now have the same guided timeline as the FLEX and BASS-II studios. Nothing
was rewritten:
- Same store (`lib/timeline.ts` `createTimeline`).
- Same bar (`components/studio/TimelineBar.tsx`): Play/Pause/Replay, Restart, ‹ Prev / Next ›, Speed 0.5×/1×/2×, a
  draggable progress slider, clickable stage markers and the current stage text.
- Same render-loop driver.

**Entry:** "Start guided exploration" in the studio header (`data-testid="guide-start"`). It starts at stage 1 and plays.

## Stages (illustrative, not measured durations)

| Studio | Stages | Pacing | Caveat on the bar |
|---|---|---|---|
| Gaseous Flame | Setup → Gas delivery → Ignition → Established flame → Extinction or transition → Interpretation | 42 s at 1× (positions on a normalized axis) | "Conceptual stages: not the timeline of any CFI-G test" |
| Smoke Detection | Material heating → Smoke formation → Particle transport → Aging chamber → Instrument sampling → Detector interpretation | 36 s at 1× | "Illustrative pacing: stages are not to time scale" |

Stage texts cite their sources:
- **Gas:** CFI-G report p.3 (arrangement), p.7 (retracting resistive igniter), p.46 (Table 3); Flame Design report pp.24
  and 26.
- **Smoke:** SAME Final Science Report (p.27 for the 720 s aging), ICES 2013 slide 28.

## What changes in the scene

**Gaseous Flame** (`GasFlameScene` `phase` prop):

| Stage | Scene |
|---|---|
| Setup | Burner and tube only, with no flow and no flame |
| Gas delivery | Outflowing and ambient reactant particles, no flame |
| Ignition | The flame shell grows from small to full size, easing even while paused (the renderer redraws until it settles) |
| Established | Full flame |
| Transition | The hot flame shrinks and dims toward extinction. **Only if a measured Table 3 event is selected** is the cool flame drawn, at its measured radii. No other test is implied to have had a cool flame, and the stage text says outcomes differ by test. |
| Interpretation | Full scene |

**Smoke Detection:** the guide sets the studio stage (1–6). This moves the particle stage in 3D, the stage text panel and
the stage selector. Selecting a stage, or using "‹ Stage" / "Next stage", moves the guide too.

## Synchronization rules

- The timeline advances in the render loop, so it moves only while the scene renders.
- **Pause** (the animation toggle) also pauses the guide, so the timeline cannot keep advancing over a frozen scene.
- **Reduced motion.** Idle animation is off, but pressing Play on the guide renders while it plays, because the user asked
  for it.
- **Reset** returns the guide to "Timeline off" (stage 0, paused).
- **Hide controls** hides the timeline with the panel; **Show controls** restores both.
- **Fullscreen** keeps the guide state.
- The FLEX, BASS-II and SAFFIRE-I studios are unchanged.

## Browser verification (`e2e/phase16.spec.ts`)

**Gas:**
- Start shows "Setup", with no flame label in the scene.
- Next → "Gas delivery" → "Ignition", where the flame label appears; Prev goes back.
- Slider to 75 → "Extinction or transition", whose text says "only at 30 % n-butane".
- At 2× the guide advances; pausing the animation stops it (value unchanged after 0.8 s).
- Restart → 0; studio Reset → "Timeline off".

**Smoke, under reduced motion:**
- The idle render loop is `demand`; Start switches it to `always` and the progress advances.
- Slider 70 → "Stage 5" and "Instrument sampling"; Next → stage 6.
- Clicking stage 2 moves the guide.
- Hide/Show controls hides and restores the timeline.
