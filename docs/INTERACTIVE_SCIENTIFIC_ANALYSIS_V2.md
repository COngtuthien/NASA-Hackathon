# SpaceFire AI — Interactive Scientific Analysis v2 (Phase 7)

Phase 7 retires the standalone 3D lab (`/lab`, Phase 6). Its three models now sit inside the three Scientific
Analysis pages, each as an **Interactive Science Studio** that teaches through interaction and checks every picture
against NASA evidence. This document supersedes the architecture and route sections of `INTERACTIVE_3D_SCIENCE.md`.
That file still holds the scene-by-scene provenance tables, which remain valid.

Ground rule: **3D explains; numbers come from NASA records.** Every quantitative value on these pages is one of:
- a NASA measurement (CSV or report table);
- a transparent deterministic calculation on verified values (labelled *Computed*, or *Idealized calculation —
  assumptions apply*);
- a source-backed document statement with its page.

---

## 1. Information architecture

| Before (Phase 6) | Now (Phase 7) |
|---|---|
| `/lab` page with a scene selector; a "Interactive Combustion Lab" sidebar item | No standalone destination; the sidebar has no lab item |
| FLEX, BASS-II and SAFFIRE-I scenes, one route | FLEX studio in `/phenomena/flame-extinction#studio`, BASS-II studio in `/phenomena/flame-spread#studio`, SAFFIRE-I studio in `/phenomena/spacecraft-fire#studio` |
| Mission Control "lab" band → `/lab?scene=…` | Mission Control "Interactive Science Studios" band → each page's `#studio` |
| Experiment detail "View in 3D lab" | "Explore in 3D" → the matching page with `?record=<uid>&mode=evidence#studio` |

Page structure (all three):
1. Cinematic introduction: the existing page header with real NASA media, the scientific question and headline values.
2. **Interactive Science Studio** (`#studio`): viewport, inspector, mode and view switches, guided exploration, timeline.
3. Seen in orbit / hardware: verified NASA imagery (Phase 5).
4. The existing analytical charts, tables and report sections, unchanged in function. The FLEX extinction map and the
   BASS-II gas-balance chart ring the test selected in the studio.
5. **Scientific conclusions**: key findings and uncertainties, each with its basis (document page, computed analysis on
   the page, quality rule) and a link. Computed numbers are read from the page's own API responses.
6. **Scientific literature**: NASA PSI's publication list for the investigation (titles only; papers not read), plus
   entry points to external search, the local documents and a drafted Copilot question.

### Legacy links
`next.config.ts` redirects (307) `/lab?scene=bass` → `/phenomena/flame-spread`, `/lab?scene=saffire` →
`/phenomena/spacecraft-fire`, and any other `/lab` → `/phenomena/flame-extinction`. The query string passes through,
so `record`, `mode` and `component` survive. The studio reads them, drops the obsolete `scene` parameter on its
next URL update, and scrolls itself into view. `#footage` links on the SAFFIRE-I page open the studio's NASA footage
view.

## 2. Architecture

| Layer | Files |
|---|---|
| Studio (page bundle, no three.js) | `components/studio/ScienceStudio.tsx`: URL state (`record`, `mode`, `component`, `view`), scene state, layers, timeline, camera focus, comparisons, tour, inspector |
| Inspector panels | `ControlPanel.tsx` (Explore), `LayerInspector.tsx` (Layers), `EvidencePanel.tsx` (NASA evidence), `FuelCompare.tsx`, `BassCompare.tsx`, `D2Calculator.tsx`, `TimelineBar.tsx`, `GuidedTour.tsx`, `ScienceSummary.tsx` (conclusions, literature) |
| Viewport (client-only chunk with three.js) | `components/studio/StudioViewport.tsx`: WebGL check, context-loss recovery, mode banner, camera toolbar and presets, colour key, split captions, timeline driver |
| 3D engine | `components/3d/*`: `SceneCanvas` (one canvas, adaptive DPR, frame-loop policy), `ScientificCameraControls` (orbit, zoom, reset, smooth `fly` to a shot), `SplitView` (two scenes, one canvas), the three scenes, `flameMaterial` |
| Metadata | `lib/lab-models.ts` (components with basis, provenance and sources; `studioHref`), `lib/flex-fuels.ts`, `lib/tours.ts`, `lib/timeline.ts`, `lib/studio-camera.ts`, `lib/lab-scientific-metadata.ts` |

The `/lab` page, the scene selector and the Phase 6 lab view were removed. The rendering infrastructure and scene
components were kept and extended.

## 3. Interaction design: every control teaches something

| Interaction | What visibly happens | Concept taught | Visual basis | Supporting evidence | Not justified |
|---|---|---|---|---|---|
| FLEX fuel (n-heptane / methanol) | Soot shell on or off; fuel card, NASA media, slider ranges and test list change | Sooting vs non-sooting fuel; heptane two-stage (cool-flame) burning vs methanol radiative extinction | Conceptual (colours illustrative) | FLEX ERD PDF p.36; Farouk & Dryer PDF p.2; NASA FLEX soot composite | Fuel temperatures, burning rates, emission, extinction limits |
| Compare Fuels | Both fuels side by side, one shared camera; matched-test table | Fuel-specific features; what a controlled comparison needs | Conceptual; evidence mode draws each record's measured D₀ and D_ext | FLEX CSV rows | "Which fuel burns faster" |
| Earth vs microgravity | Sphere next to buoyant teardrop; NASA comparison image | Buoyancy shapes a flame; diffusion vs updraft | Conceptual comparison | NASA FLEX 1 g / ISS image; Liu et al. PDF p.2 | That every microgravity flame is spherical; any 1 g measurement |
| Burn timeline | Needles retract, igniters glow and retract, flame appears, droplet shrinks, flame fades | Sequence of a droplet burn; regression | Illustrative sequence on a normalized axis | MDCA procedure (Liu et al. PDF p.4); test end categories (CSV) | Timing of any test; the recorded burn time is shown separately |
| d²-law calculation | Line D² = D₀² − K·t to D₀²/K for the selected test; consistency ratio | Classical d²-law and its limits | Idealized calculation — assumptions apply | Liu et al. PDF p.2; backend `/analytics/flex/d2?uid=` | Prediction, extinction time, trajectory points |
| Layer select / isolate / hide | Camera flies to the layer, others fade or hide; label and explanation | Droplet, surface, vapour, flame, soot, O₂ transport, ambient | Per-layer basis badge | Per-layer sources (`lab-models.ts`) | — |
| O₂ and D₀ sliders | Dot share and drawn size; nearby real tests listed | Where real tests sit in condition space | Conceptual drawing; real test lookup | FLEX CSV (ranges per fuel computed live) | Any predicted outcome |
| BASS-II sample type | Geometry changes; test counts per type | Sample geometries used in orbit | Confirmed ranges; length illustrative | Summary Report PDF p.13; CSV facets | Thermophysical properties |
| BASS-II flow direction | Igniter end, flame shape, front direction, streamlines | Opposed vs concurrent vs stagnation spread | Conceptual | Summary Report PDF p.27, p.64 | Spread rates (only Table 5.1 values, shown separately) |
| Flame-spread timeline | Front travels from the ignition end | Direction of spread | "Illustrative progression — not measured flame-front motion" | — | Any synchronization with a spread rate |
| Material comparison | Two real tests side by side, drawn with recorded geometry and flow | What differs between tests; why PIs are confounded | Evidence (CSV, report tables) | CSV, Tables 5.1/7.1, cross-checks | Numerical comparability when conditions differ |
| SAFFIRE-I presets | Camera frames duct, sample, fans/straighteners, cameras/diagnostics; component selected | Experiment layout | Conceptual arrangement | ISA-Tab, Operations, NASA Glenn | Exact hardware geometry |
| Cutaway / exploded / isolate | Walls fade; parts separate; others hide | Which part does what | Conceptual | ISA-Tab | — |
| S1 vs S2 | Spread arrow direction; record in the URL; panels update | Concurrent vs opposed in the same flow | CSV | CSV, quality flags | Burn time as a material property |
| 3D / NASA footage / Evidence & metadata | Viewport switches without remounting the canvas | Model vs real recording vs data | Footage is NASA's; model conceptual | NASA Glenn animation; NASA YouTube video (click-to-load) | Any reconstruction from manifest frames |
| Guided exploration | Steps move the camera, select parts, ask for one interaction | The page's scientific story | As the step's sources | Per-step sources (`lib/tours.ts`) | — |

No control is decorative-only. Decorative motion (flicker, drift) is a labelled toggle and is off with reduced motion.

## 4. Scene behaviour (changes since Phase 6)

- **Contextual labels**: by default only 2–3 primary labels are shown, or only the selected component's label once
  something is selected. Labels can also be set to All or Off.
- **Layers**: each component can be hidden. "Isolate selected" hides unrelated layers but keeps the parts a selection
  needs (droplet with surface; sample with flame). Selecting a component dims the others to 28 % and flies the camera to
  it (an instant jump under reduced motion).
- **FLEX**: new fuel-vapour region layer. Oxygen transport is its own layer. The soot shell is drawn only for n-heptane.
  The flame shader uses alpha-preserving additive blending (fixes a dark halo on the transparent canvas), with toned-down
  intensity.
- **BASS-II**: streamlines, plus a front position driven by the timeline (no free-running loop). A selected record
  draws its CSV width, thickness or diameter and its flow direction.
- **SAFFIRE-I**: five camera presets, an airflow layer, isolation, and record-driven S1/S2.

## 5. Fuel comparison
- Left and right fuels are selectable (either FLEX fuel on either side).
- **Step 1**: pick a test of the left fuel near the Explore O₂ and D₀ settings.
- **Step 2**: tests of the right fuel are ranked by how closely their recorded conditions match: pressure, diluent,
  O₂, CO₂, He, D₀.
- **Step 3**: a side-by-side table of recorded values; any condition beyond the display tolerances is highlighted
  (O₂ ±0.01, D₀ ±0.25 mm, pressure ±0.1 atm, CO₂/He ±0.02, equal diluent). The verdict reads either "Not a controlled
  comparison: N conditions differ" or "match within the display tolerances … still two single tests". The table
  always states that no conclusion about which fuel burns faster is drawn. The tolerances are SpaceFire's display
  choice, not a statistical criterion.
- The 3D comparison is one canvas with two scissored viewports and one camera, so orbit, zoom and reset are
  synchronized by construction. The table is the accessible alternative to the split view.

## 6. Material comparison (BASS-II)
- Without records, the split view compares the same sample in opposed vs concurrent (or stagnation) flow,
  conceptually.
- With two records chosen (dropdowns list every BASS-II test with its PI, class and flow), each side is drawn with its
  recorded geometry and flow. The table lists PI, material (raw), class, geometry, thickness, diameter, nominal width,
  flow direction, restrictors, the Air display text, O₂ and every report-table row (Table 5.1/7.1 with PDF page;
  spread rates exactly as printed).
- Differing conditions are highlighted. The verdict refuses numerical comparability when conditions differ. The
  nominal-vs-actual width disagreement is stated, not reconciled.

## 7. Timeline semantics
- `lib/timeline.ts`: a small external store (progress 0–1, playing, speed 0.5–2×). The render loop advances it while
  playing; the UI subscribes via `useSyncExternalStore`, so 60 fps playback re-renders only the timeline bar.
- The axis is **normalized progress**, never seconds. Stage boundaries are arbitrary positions on that axis.
- FLEX stages: initial droplet → ignition → established burning → droplet regression → extinction or end of burning.
  Regression uses the d² shape purely as an illustration, with an arbitrary end size. A selected test's recorded burn
  time and test end appear beside the timeline as measured values, marked "the timeline is not scaled to it".
- BASS-II stages: ignition → flame spread → end of spread. When a record has Table 5.1 spread rates, they appear beside
  the timeline as "measured; independent of the animation".
- Controls: Play / Pause / Replay, Restart, speed, a scrub slider with a stage readout, clickable stage labels, and
  Exit timeline.

## 8. Idealized d²-law calculation
- Shown in the FLEX evidence panel for the selected test, labelled **Idealized calculation — assumptions apply**.
- D(t)² = D₀² − K·t for 0 ≤ t ≤ D₀²/K, using the test's recorded D₀ (mm) and K (mm²/s; raw header "Burning rate; mm",
  flag FLEX-UNIT-K). It is drawn only up to t* = D₀²/K, never into negative D², and t* is called "an idealized burnout
  time, not an extinction time".
- The consistency numbers (end diameter, idealized time, recorded ÷ idealized ratio, exclusion reasons) come from the
  backend's d²-law check (`/analytics/flex/d2?uid=`), the same analysis as on the rest of the page. Tests the check
  excludes (for example Disruption) show the reason instead of a ratio.
- The recorded end (burn time, end diameter) is drawn as one marker of two recorded values, explicitly "not a
  measured trajectory". No intermediate points exist or are drawn.
- Assumptions listed with the source (Liu et al. PDF p.2): quasi-steady, spherically symmetric, no soot or radiation
  effects, constant K. Not a validated model; there is still no "Validated model" mode.

## 9. Guided tours
- `lib/tours.ts`: FLEX 9 steps, BASS-II 9, SAFFIRE-I 8. Each introduces the investigation, focuses the camera,
  explains a mechanism with sources, asks for one interaction (checked: switch to 1 g, switch to methanol, pick a
  record, choose a rod, switch to concurrent and play, open the footage) and ends with a takeaway.
- Controls: Next, Back, Skip (×), Restart, Finish, and a progress bar. Keyboard: ←/→ move, Esc closes. Focus moves to
  each step's heading. Nothing autoplays, and no step calls the Research Copilot or any model.
- Desktop: a card over the viewport. Mobile: below the viewport.

## 10. Quantitative vs illustrative (summary)

| Quantitative (shown with provenance) | Illustrative (labelled) |
|---|---|
| FLEX test values (D₀, D_ext, O₂, N₂, CO₂, He, pressure, K in mm²/s, burn time, test end); per-fuel coverage ranges computed from the CSV; d²-law line and consistency ratio (computed) | Flame standoff (4× radius), flame colours, soot-shell size, vapour glow, particle speeds, 1 g teardrop, burn timeline, regression animation |
| BASS-II CSV fields, test counts per sample type, report-table rows (spread rates, velocities, widths with PDF pages), gas endpoints | Sample length, holder, igniter position, streamlines, flame shape, front travel |
| SAFFIRE-I CSV burn rows, quality flags, documented sample size and flow speed | Enclosure axis mapping, duct cross-section, component positions, fan count, flame band |

## 11. Data provenance
Unchanged from Phase 6, plus:
- FLEX fuel statements: FLEX ERD v4 PDF p.36; Farouk & Dryer 2013 (`1g17-070he-0166`) PDF p.2.
- Flame-standoff variability: Liu et al. PDF p.8.
- Per-fuel coverage: computed from `/analytics/flex/map`.
- BASS-II counts per sample type: `/experiments?dataset=bass2` facets.
- d²-law consistency: `/analytics/flex/d2?uid=`.
- Literature: `/research/publications?investigation=`.

All local source links are requested by an E2E test.

## 12. Scientific limitations
- No scene is a simulation. The burn timeline and flame-front progression are conceptual sequences; their speeds and
  stage lengths carry no physical meaning.
- The d²-law line is classical theory applied to recorded D₀ and K. Real droplets deviate (K depends on D₀; soot and
  radiation matter), and FLEX extinction occurs at a finite diameter.
- Fuel comparison uses at most two single tests. FLEX's adaptive design means test conditions are not randomized, so
  no fuel ranking is drawn.
- BASS-II cross-PI comparisons are confounded by material, geometry and flow direction.
- SAFFIRE-I has two burn rows and a frame manifest. There is no flame position, spread rate, temperature or sensor time
  series, and the ignition location is not drawn.

## 13. Accessibility
- Every 3D interaction has a DOM route:
  - layers as buttons with show/hide toggles;
  - presets as buttons;
  - the comparison tables;
  - a text alternative per scene;
  - the static fallback.
- Keyboard:
  - viewer: arrows rotate, ± zoom, 0 resets;
  - tablist and radio groups: arrow keys;
  - tour: ←/→ and Esc.
  Visible focus throughout.
- Reduced motion: decorative motion off, damping off, on-demand rendering, instant camera moves (tested).
  User-started playback still works.
- Mobile: the viewport comes first, then the timeline, then a collapsible inspector (Collapse/Expand,
  `aria-expanded`). The tour sits below the viewport; camera buttons are 36 px.
- WebGL unavailable, context lost or chunk error: a static schematic plus text; panels keep working.

## 14. Performance
- three.js loads only with the studio viewport chunk; one scene module per page, so a page never mounts another
  investigation's scene.
- One WebGL context per page. Comparisons render two scenes into one canvas (scissored viewports), with no second
  context.
- The SAFFIRE-I footage and data views hide the canvas without unmounting it. Off-screen, the frame loop stops
  (`never`); it is `demand` without motion and `always` only while motion or a timeline is playing.
- Particle counts were reduced (FLEX ≤ 950 points, BASS-II 220 plus 16 streamlines, SAFFIRE-I 260). There is no
  post-processing. DPR ≤ 1.75, dropping to 1 on a sustained frame-rate decline.
- Timeline playback re-renders only the timeline bar (external store). Camera tweens run in the render loop.
- Disposal is verified by tests (`live` 0, `disposed == mounts` after leaving a page).
- Frame rate was **not** profiled on a hardware GPU or a physical phone: tests run on SwiftShader. Interaction
  responsiveness (drag, presets, timeline, scrub, tour) is exercised in the browser tests.

## 15. Test results
See `docs/IMPLEMENTATION_STATUS.md` (Phase 7 verification) for the commands and counts.
- `e2e/phase7.spec.ts` (20 desktop tests): integrated studios, redirects, entry points with chart ring, camera, fuels,
  Compare Fuels, Earth vs microgravity, timeline, d²-law calculation vs backend, layers, BASS-II material comparison and
  evidence, SAFFIRE-I presets, footage and data views, tours, Copilot hand-off, disposal, WebGL fallback, reduced
  motion, source links, conclusions and literature.
- `e2e/studio-mobile.spec.ts`: 390 px on all three pages.
- The Phase 6 specs (`phase6.spec.ts`, `lab-mobile.spec.ts`) were superseded, with their assertions carried over to
  the integrated studios.
