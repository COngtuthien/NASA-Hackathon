# Combustion Stage Storytelling (Phase 10)

Branch `feature/spacefire-phase10-combustion-storytelling`, from Phase 9 (`aa20417`). Frontend only: no backend,
data, flag, verifier or Gemini change. No Gemini request was made while building or testing it.

## 1. Architecture

Audit result: the existing pieces already had the right shape, so Phase 10 extends them instead of adding a new
animation or navigation system.

| Existing piece | Phase 10 use |
|---|---|
| `lib/timeline.ts` store (`p`, `playing`, `speed`, `active`), ticked by the R3F frame loop | The **single source of truth** for the active stage. `useStageId(store, stages)` derives the stage id; components using it re-render only when the stage changes |
| `DropletCombustionScene` / `FlameSpreadScene` read `p` every frame (`flexStage(p)`) | Unchanged: the 3D state for each stage was already driven by the store |
| `SplitView` (one canvas, two scissored viewports, one camera) | Earth vs microgravity on one canvas; new `stacked` mode (top/bottom) for phones |
| `layerView()` emphasis for hide / isolate / selection | New optional `focus` prop: without an explicit selection, the stage's components keep full emphasis and the others are softened; contextual labels show the focused parts |
| `TimelineBar` (play, pause, restart, speed, scrub, stage list) | Gains Previous / Next stage and `aria-current`; renders the stage explainer as a child element, so its per-frame re-render does not re-render the explainer |
| `LayerInspector` `unavailable` list | Also lists components the active stage does not draw, with the reason |
| Guided tours (`lib/tours.ts`) and the Phase 9 journey | Unchanged; tours that set the timeline now also move the explanation |

New files: `lib/stages.ts` (what each stage means, with its basis and sources) and
`components/studio/StageExplainer.tsx` (the explainer and the SAFFIRE-I walkthrough). The studio also stopped
re-rendering on every animation frame: it now subscribes only to `playing`, to one boolean used by a tour task, and to
the stage id (`useTimelineValue`, `useStageId`).

No new dependency, canvas, timer or global store was added.

## 2. Timeline and stage model

- Stage boundaries stay in `lib/timeline.ts` (`FLEX_STAGES`, `BASS_STAGES`) on a normalized, illustrative axis.
- Stage meaning is in `lib/stages.ts` (`StageInfo`): title, one-sentence summary, one key idea, "why" (on request),
  focus components, an "inspect" target, components absent in that stage, the basis of each statement, sources,
  limits and a text alternative of the 3D view.
- Every control acts on the same store: Play / Pause, Restart, speed, the scrub slider, Previous / Next, the stage
  list, "Start at stage 1", guided tours and the Discover journey. Jumping to a stage pauses playback (`goToStage`).
- Default view: "Stage n of N — Title", one sentence, one key idea, and three actions: **Why does this happen?**,
  **View NASA evidence**, **Inspect …**. A stage chip inside the 3D view mirrors the active stage.
- Basis labels: `Document` (stated in a cited NASA source), `Measured` (recorded for the selected test),
  `Computed` (idealized calculation), `Hypothesis` (conceptual drawing), `Unsupported` (not in the local evidence).
- "Camera follows the stage" is an opt-in checkbox (off by default). The camera moves once per stage change, never per
  frame, instantly under reduced motion, and never re-targets after the visitor moves it or presses Reset.

## 3. FLEX stages

| # | Stage | Shown in 3D | Key idea | Sources |
|---|---|---|---|---|
| 1 | Initial droplet | droplet, retracting needles, no flame | before ignition there is no flame | Liu et al. 2013 p.4; PSI-69 |
| 2 | Ignition | igniter glow and retraction, flame shell forming | a flame forms only if conditions sustain it; no ignition delay is in the data | Liu p.4; MDCA safety package p.22 |
| 3 | Established burning | droplet, flame envelope, outward vapour, inward O₂ | a diffusion flame; particles show direction, not velocity | Liu p.2, p.8 |
| 4 | Droplet regression | droplet shrinking on the d²-law shape | D² = D₀² − K·t is idealized (K in mm²/s) | Liu p.2; FLEX ERD p.18 |
| 5 | Extinction or end of burning | neutral flame fade, droplet kept | there is no single outcome | Farouk & Dryer 2013 p.2; FLEX ERD p.74 |

With a selected test (any mode):
- **Regression** shows the idealized time for D² to reach zero, D₀²/K, labelled as a calculation that is neither a
  measurement nor the extinction time, next to the recorded burn time and test end (flex:180: 28.2 s calculated;
  4.5 s recorded; Extinction). No value is produced for a missing or non-positive D₀ or K.
- **End** explains the test's own category: ‘Extinction’ (with the recorded extinction diameter; the mechanism is
  not stated), ‘Disruption’ (undefined locally; the ending cannot be determined), ‘Completion’ (no mechanism
  established).

Components missing in a stage (for example the flame before ignition) are explained in the explainer and the Layers
panel instead of showing an empty inspector.

## 4. Earth vs microgravity

The **Earth vs microgravity** view shows **Earth (1 g, left)** and **Microgravity (right)** on one canvas with one
camera, both driven by the same timeline: they are always at the same stage, and the stage chip is shared. On phones
the two views stack top/bottom in the same canvas, and the text stacks too.

Per stage the explainer adds: what happens on Earth, what happens in microgravity, and **Why are they different?**,
a stage-specific insight with detail and sources that also moves the 3D emphasis to the regions it talks about
(transport and flame). The verified NASA "1 g vs µg" photograph appears in the burning and regression stages with its
credit, original link and what it shows ("NASA does not state their fuel or test … not a paired FLEX measurement").

| Stage | Why are they different? |
|---|---|
| Initial | no flame to compare yet; only how the droplet is held differs |
| Ignition | the first hot gas rises on Earth, stays near the droplet in orbit (density difference + gravity = buoyant force) |
| Burning | gravity turns density differences into flow; FLEX ERD p.64: spherical symmetry needs diffusion times ≪ buoyancy time, which at 1 g and 1 atm would need droplets far below 1 mm, which is why FLEX flew |
| Regression | the droplet shrinks in both; transport differs, so the rate cannot be read off the flame shape; no faster-or-slower claim |
| End | flame shape alone does not decide when or how a flame goes out; no extinction threshold or timing comparison exists here |

Trust rules (tested): the notice "Conceptual comparison — not paired Earth and ISS measurements" is always shown;
there are no Earth FLEX records, flame radii, temperatures, burn rates, transport velocities or extinction timings;
the texts never say diffusion stops on Earth or gas motion stops in orbit, and never say "always".

## 5. Fuel-specific explanations

Verified against FLEX ERD p.36 (sooting n-heptane, non-sooting methanol), p.18 (soot shell) and Farouk & Dryer 2013
p.2 (cool flames). Notes appear only where a source supports a difference:
- **Burning**: n-heptane sooting (soot between droplet and flame, can form a shell); methanol non-sooting.
- **Regression**: trapped soot holds chemical energy that is not released (heptane); methanol has no soot shell.
- **End**: large n-heptane droplets can lose the hot visible flame and continue in a low-temperature stage without
  visible emission (a "cool flame") until diffusive extinction; smaller droplets burn in one stage; **not every test
  shows it, and the cool flame is not drawn**. Large methanol droplets have shown classical radiative extinction.

**Compare fuels**: each fuel's note is shown separately, with "Both sides share one conceptual timeline; it does not
mean the two fuels burn for equal times." The existing condition matching and verdict are unchanged.

## 6. BASS-II stages

Three stages (Ignition, Flame spread, End of spread), built from the current sample type and flow direction
(`bassInfo(sample, flow)`): the summary names the sample and describes opposed, concurrent or stagnation flow. With a
selected test:
- **Ignition**: the CSV material text, and the nominal-vs-actual width conflict when there is one (M7: 1 cm CSV,
  1.2 cm Table 5.1; both kept).
- **Spread**: Table 5.1 rates with units, flow velocities and PDF page (M7: 0.106, 0.099, 0.083, 0.07 mm/s at 10, 6, 5,
  3 cm/s, PDF p.65), and "The animated front is not scaled to it"; without a report row it says the animation's speed
  means nothing for that test.
- **End**: the report's recorded outcome when one exists (T24: "ignited_one_sided", Table 7.1, PDF p.104), otherwise
  "no recorded outcome … cannot be inferred".

## 7. SAFFIRE-I walkthrough

Not a timeline: five explanatory steps, labelled "Explanatory steps — not a timeline of the burn": Experiment setup,
Airflow and ignition, Flame-spread investigation, Diagnostics and observation, Evidence and limitations. Each step
emphasizes its components (sample, airflow, flame direction, cameras and sensors) and can move the camera to a preset
if the visitor turns that on. The selected burn changes the text (S1 concurrent, S2 opposed). The last step opens
NASA's footage view on request. Flame positions, spread rates, temperatures and sensor time series are stated as
absent; nothing is reconstructed from the manifest. Keyboard: the step buttons, Previous / Next, and ← / → inside the
walkthrough.

## 8. Scientific sources and provenance

New source entries (all resolve, checked through the API): FLEX ERD v4 p.18 and p.64, the MDCA/FLEX2 Reflight Safety
Data Package p.22. Existing ones reused: Liu et al. 2013 pp.2, 4, 8; Farouk & Dryer 2013 p.2; FLEX ERD pp.36, 74; BASS-II
Summary Report pp.12, 13, 27, 64; SAFFIRE-I Operations, ISA-Tab and Description of Data; NASA Glenn. Each stage
statement was checked against the passage it cites; statements not supported were not written (for example ignition
delay, flame temperature, cool-flame appearance, Earth-vs-orbit burn rates).

## 9. Conceptual vs measured

- The 3D views, stage boundaries, flame fade and particle motion are conceptual and say so (banner, timeline caveat,
  basis labels, split note).
- Measured values appear only for a selected test and only as recorded (FLEX K in mm²/s with its raw ‘mm’ header
  traceable elsewhere; BASS-II report rates with units and pages; SAFFIRE-I CSV rows).
- Calculations are labelled as idealized (the d²-law time).
- Unknowns are stated as unknown (ignition delay, Disruption endings, BASS-II outcomes without a report row, SAFFIRE-I
  flame data).

## 10. Accessibility

Stage controls are buttons (Previous / Next, stage list with `aria-current="step"`, Start, Play / Pause, Restart) and
a labelled range input whose `aria-valuetext` names the stage. The stage line is a polite live region that changes only
when the stage changes. Each stage has a screen-reader description of what the 3D view shows. Disclosures use
`aria-expanded` / `aria-controls`. Everything works without WebGL (the static fallback keeps the timeline, explainer,
comparison text and sources) and with reduced motion (nothing auto-plays; camera moves are instant). Touch targets are
at least 36 px high. Text never depends on colour alone.

## 11. Performance

One canvas per page as before (the comparison uses `SplitView`). The studio and explainer no longer re-render on every
frame during playback; the scene still reads the store each frame, and the camera moves only on stage changes when
asked. No particles, post-processing or media were added; the NASA comparison image is lazy-loaded inside a closed
disclosure. A transient failure of the shared record fetch now retries once (network, proxy or 5xx only).

## 12. Test results

Production build, backend with the model disabled (`llm.mode = retrieval_only`):

- `tsc --noEmit` and `eslint .` clean; `next build` OK (18 routes).
- Playwright: **113 passed, 1 skipped** (the opt-in live Gemini test, not run). New:
  - `e2e/phase10-unit.spec.ts` (8 logic tests): stage ids match the timeline; short defaults; every stage has a basis,
    a conceptual declaration and resolvable sources; no temperatures, spread rates, burn-rate or "always" claims;
    five distinct Earth-vs-µg differences; fuel notes and cool-flame wording; outcome texts; d²-law guard; BASS-II
    flow/material awareness; SAFFIRE-I burn awareness; single-store stage derivation and focus.
  - `e2e/phase10.spec.ts` (10): stage navigation by every control; disclosures and source links; selected-test
    calculation and outcomes (Extinction, Disruption); Earth vs microgravity shared stage, stage-specific "why", NASA
    image credit, one canvas and no remount; fuel notes and Compare Fuels; BASS-II rates, width conflict and outcomes;
    SAFFIRE-I walkthrough incl. keyboard and burn switch; opt-in camera follow and no override; tour compatibility;
    reduced motion without WebGL.
  - `e2e/phase10-mobile.spec.ts` (2): stacked comparison and touch stepping at 390 px; side-by-side and walkthrough
    at 768 px.
- Backend `pytest`: **181 passed**. Smoke: pages 200, `/lab` 307, records and cited documents 200.
- Sweep at 1440, 768 and 390 px over the comparison, fuels, record, BASS-II, SAFFIRE-I and Home views: no horizontal
  overflow, no console errors.

Test environment note: another `next start` (port 3000) and a Gemini-enabled backend (port 8000) were running outside
this session, so verification used a separate model-disabled backend on 8010 and a separate build folder served on
3010 (`NEXT_DIST_DIR`, `BACKEND_URL`, `PW_BASE_URL`, `PW_API_PORT`; all optional, defaults unchanged). Those other
servers were not stopped or modified.

## 13. Known limitations

- Stage boundaries are fixed positions on a normalized axis for every test; a real test's recorded burn time is shown
  beside the timeline and never used to scale it.
- The Earth side is a qualitative shape for the same conceptual droplet; no FLEX test ran at 1 g.
- The cool-flame stage is described, not drawn.
- BASS-II stage text depends on the sample and flow chosen; tests with mixed or multi-stage flows are described by
  their report rows only.
- The NASA comparison photograph is not tied to a fuel or test by NASA's caption.
