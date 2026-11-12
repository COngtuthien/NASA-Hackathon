# SpaceFire AI — Interactive Combustion Lab (Phase 6)

The lab (`/lab`) shows three NASA microgravity combustion investigations as interactive 3D models: FLEX droplet
combustion, BASS-II flame spread over solids and the SAFFIRE-I spacecraft fire experiment. Each sits beside the real
NASA records for that investigation. This document describes:
- what the 3D views show;
- what each part rests on;
- what the controls do;
- what the lab deliberately does not claim.

The rule behind every choice: **3D explains principles and arrangements; measured values live only in the NASA
evidence panel**, with their units, provenance and flags.

---

## 1. Architecture

| Layer | Files | Notes |
|---|---|---|
| Route | `frontend/app/lab/page.tsx` | Server page with metadata; renders the client view inside `<Suspense>` |
| Lab view | `components/lab/InteractiveLabView.tsx` | URL state (`scene`, `mode`, `record`, `component`), control state, record fetch, the three panels |
| Viewport (client-only chunk) | `components/lab/LabViewport.tsx` | Loaded with `next/dynamic({ ssr: false })`. Holds three.js, R3F and drei. Handles the WebGL check, context-loss recovery, mode banner, legend, camera toolbar and keyboard camera |
| Canvas lifecycle | `components/3d/SceneCanvas.tsx` | One `<Canvas>` for the whole lab. Adaptive DPR (`[1, 1.75]`, drops to 1 on `PerformanceMonitor` decline). Frame loop: `always` while decorative motion runs, `demand` otherwise, `never` off-screen or in a hidden tab |
| Scene switcher | `components/3d/InteractiveScene.tsx` | Shared studio lighting. Each scene is a `React.lazy` chunk; only the selected one is mounted |
| Scenes | `DropletCombustionScene.tsx`, `FlameSpreadScene.tsx`, `SpacecraftFireScene.tsx` | Procedural geometry only (no model files, no textures except a generated dot sprite) |
| Shared 3D | `ScientificCameraControls.tsx`, `ScientificAnnotations.tsx`, `ModelLegend.tsx`, `SceneFallback.tsx`, `flameMaterial.ts`, `sceneUtils.tsx`, `webgl.ts`, `types.ts` | Orbit and zoom without pan (the subject cannot be lost), imperative camera API, pinned labels, legend, static fallback, flame shader, picking |
| Panels | `LabSceneSelector.tsx`, `LabControlPanel.tsx`, `LabExplanationPanel.tsx`, `LabEvidencePanel.tsx`, `LabEntryLink.tsx` | All plain DOM, so every function works without the 3D view |
| Metadata | `lib/lab-models.ts`, `lib/lab-presets.ts`, `lib/lab-scientific-metadata.ts`, `lib/lab-copilot.ts` | Components with basis, provenance and sources; defaults and ranges; mode definitions and source links; Copilot hand-off |

Versions: three 0.187.0, @react-three/fiber 9.8.2, @react-three/drei 10.7.9, @types/three 0.187.0, all pinned exactly.
They are compatible with React 19.3 / Next 16.4; no framework was upgraded. No backend change: the lab reads the
existing endpoints:
- `/experiments` (filters `f_fuel`, `min_x_o2` and so on);
- `/experiments/{uid}`;
- `/analytics/bass/report`;
- `/analytics/saffire/case`.

Integration points:
- Main navigation (Discover → Interactive Combustion Lab).
- A Mission Control band with three scene cards.
- An entry card on each phenomenon page.
- "View in 3D lab" on burn-record detail pages, which opens evidence mode with that record.
- "Ask AI about this", which hands off to the Research Copilot.

## 2. Scenes

### A. Droplet combustion — FLEX (PSI-69), millimetres
- A glossy liquid droplet at the chosen (or measured) D₀, inside a translucent flame shell drawn at a fixed 4× the
  droplet radius. The shell is a thin emissive shell with limb brightening, rendered by a custom shader.
- **Microgravity** (default): the shell is spherical. Optional transport particles show fuel vapour moving outward
  (amber) and O₂ moving inward (cyan).
- **Earth 1 g (comparison)**: the shell deforms smoothly into an upward teardrop with a warmer tip. A buoyant
  updraft and a gravity arrow appear.
- n-heptane adds a soot shell between droplet and flame. Ambient-gas dots: the cyan share equals the O₂ mole fraction.
- A millimetre scale bar sits beside the droplet.
- Evidence mode draws:
  - the selected test's measured D₀ (translucent droplet plus a cyan ring);
  - the measured visible-flame extinction diameter D_ext (solid cyan sphere);
  - O₂ dots from the recorded fraction.

  The flame shell is dimmed and labelled conceptual. Gravity is locked to microgravity: every FLEX test ran aboard the ISS.

### B. Flame spread — BASS-II (PSI-25), centimetres
- The documented 7.6 × 7.6 × 17 cm duct: dark anodized walls, a front window and an outline.
- Upstream of it, the fan housing with a restrictor plate, then the honeycomb straightener and screen.
- In the duct:
  - a sample on an illustrative holder;
  - a hot-wire igniter at the end where spread starts;
  - the radiometer in the downstream top back corner, looking upstream;
  - a 10 cm scale on the back wall.
- Sample types: thin film, slab, rod, sphere section, fabric strip. Flow relative to spread: opposed, concurrent, or
  stagnation (rods only).
- An illustrative flame front travels along the sample with a charred region behind it. The flame is short in opposed
  flow and trails downstream in concurrent flow.
- Evidence mode draws the selected test's CSV width or diameter, sample class and flow direction.

### C. Spacecraft fire safety — SAFFIRE-I (PSI-98), metres
- A conceptual enclosure (white panels, transparent in cutaway) containing:
  - a flow duct with the ~0.4 × 0.94 m SIBAL sample card in its middle;
  - fans at the top and flow straighteners at the bottom, with air drawn upward;
  - two cameras;
  - thermocouple wires, radiometers, anemometers and a gas-sensor box;
  - an avionics box.
- Cutaway and exploded views separate the parts so each can be selected.
- A flame-spread arrow and an illustrative band follow the CSV direction for S1 (concurrent) or S2 (opposed).
- The Evidence panel embeds NASA's burn animation (plays only on request), hardware photos and a link to the NASA
  video on the Spacecraft Fire Dynamics page.

## 3. Scientific sources

All are local NASA files already ingested by the backend (served at `/api/v1/documents/{id}/file`), plus NASA
pages already in `lib/scientific-media.ts`. The links are listed in `lib/lab-scientific-metadata.ts` → `SOURCES`, and
an E2E test requests every local one.

| Source | Used for |
|---|---|
| Liu et al. 2013 (`2g11-070he-0310`), PDF p.2 | Spherically symmetric droplet flame structure; classical d²-law statement |
| Liu et al. 2013, PDF p.4 | MDCA procedure: hollow needles retract leaving a free-floating droplet; hot-wire igniters retract; spherical burning |
| FLEX ERD v4 (`flex-eird-v4`), PDF p.74 | Earlier quiescent and fan-driven droplet experiments (transport context) |
| NASA Science FLEX page image (1 g vs micro-g) | Qualitative shape: near-spherical dim blue flame aboard the ISS vs yellow teardrop at 1 g |
| NASA "Burning in Microgravity" (FLEX heptane soot composite) | Soot forms near the heptane droplet and spirals out of the flame zone |
| BASS-II Summary Report (`bass-ii-summary-report`), PDF p.12–13 | Duct size and finish, fan and restrictors (~55 → ~35 cm/s), honeycomb + screen, airspeed transducer position, radiometer position, windows, sample geometry ranges, Kanthal hot-wire igniter |
| BASS-II Summary Report, PDF p.27, p.64 | Spread slows as opposed flow is reduced; Table 5.1 set-up (opposed flow, 3–20 cm/s, camera views) |
| SAFFIRE-I ISA-Tab (`saffire-1-isatab`) | Sample card in the middle of a large flow duct; fans at the top; flow straighteners at the bottom; 20 cm/s; two cameras; thermocouples, two radiometers, pressure/CO₂/O₂ sensors, two anemometers |
| SAFFIRE-I Operations (`saffire-i-operations`), PDF p.1 | Sample ~0.4 m wide × 0.94 m tall; flow-duct inlet and outlet; experiment avionics |
| SAFFIRE-I/III Description of Data (`saffire-i-and-saffire-iii-dod`) | SIBAL composition; 20 cm/s; camera labels C1/C2; F1/F2 roles |
| NASA Glenn, "NASA Ignites Fire Experiment Aboard Space Cargo Ship" | Enclosure about 0.5 m wide, 1 m deep, 1.3 m long; hot-wire ignition |

No reference outside these was introduced.

## 4. Confirmed versus conceptual elements

Every inspectable component carries one of three labels (`BASIS_LABEL`), shown as a badge in the Explain panel.
Its provenance text says exactly what is confirmed and what is drawn.

| Scene | Confirmed (stated in a source) | Documented principle (qualitative) | Illustrative (assumed) |
|---|---|---|---|
| FLEX | FLEX fuels (methanol, n-heptane); in evidence mode D₀, D_ext and O₂ of the chosen test | Spherical flame in microgravity; buoyant teardrop at 1 g; fuel-out / O₂-in diffusion; heptane soot shell; d²-law surface regression | Flame at 4× droplet radius; flame colours; soot shell radius and density; dot counts; particle speeds; flicker |
| BASS-II | Duct 7.6 × 7.6 × 17 cm; fan + restrictors upstream; honeycomb + screen; radiometer position; front window; igniter type; sample geometry ranges; in evidence mode the test's CSV width or diameter and flow direction | Opposed vs concurrent vs stagnation spread; spread slows with less opposed flow | Sample length (10 cm); holder; igniter position; fan size and blades; flame shape; front speed; char region |
| SAFFIRE-I | Sample card in the middle of a flow duct; ~0.4 × 0.94 m sample; fans at top; straighteners at bottom; 20 cm/s; two cameras; sensor list; enclosure ~0.5 × 1 × 1.3 m; S1/S2 flow directions (CSV) | Concurrent vs opposed spread | Mapping of the enclosure dimensions to axes; duct cross-section; every component position; fan count; flame band and its motion; avionics box shape |

Nothing in SAFFIRE-I is presented as a reconstruction of the flight hardware. The enclosure's provenance text says so,
and the scene is labelled "conceptual arrangement" throughout.

## 5. Meaning of each control

| Control | What it changes | What it does **not** do |
|---|---|---|
| Visualization mode | Conceptual 3D vs NASA Evidence (banner, locks, measured overlays) | There is no third "Validated model" mode (section 7) |
| Gravity environment (FLEX) | Shell shape (sphere ↔ teardrop), transport indicators, gravity arrow | It is not a buoyancy simulation |
| Fuel (FLEX) | Soot shell on/off, flame tint; filters the nearby real tests | It does not set burning rate, temperature or extinction |
| Ambient O₂ (FLEX) | Share of cyan dots; filters real FLEX tests within ±0.02 | No extinction threshold, flame temperature or flame position |
| Initial diameter D₀ (FLEX) | Drawn droplet size, to scale, with the flame at 4×; filters real tests within ±0.5 mm | No burn time, no shrinking animation, no K |
| Sample type (BASS-II) | Geometry drawn (thin film, slab, rod, sphere section, fabric); filters the test list by material class | It does not represent a material property |
| Flame spread vs airflow (BASS-II) | Which end ignites, flame shape, front direction; stagnation only for rods | No spread rate: the front's speed is arbitrary |
| Moving flame front (BASS-II) | Shows or hides the travelling front | — |
| Cutaway / Exploded (SAFFIRE-I) | Wall transparency; separates fans, straighteners, cameras and diagnostics | — |
| Burn record S1/S2 (SAFFIRE-I) | Spread arrow and band direction (from the CSV) | No flame position, speed or ignition location |
| Annotations / transport / decorative motion | Labels, conceptual arrows and particles, flicker and drift | Particle speeds are not velocities |
| Reset parameters / Reset camera | Restore the scene defaults / the home view | — |

## 6. Data-to-visualization mapping (evidence mode)

| Scene | Field (API → NASA source) | Visual |
|---|---|---|
| FLEX | `normalized.d0_mm` (CSV "Droplet initial diameter; mm") | Droplet radius = D₀/2 mm, cyan equator ring |
| FLEX | `normalized.dext_mm` (CSV "Visible flame extinction diameter; mm") | Cyan sphere, radius = D_ext/2 mm |
| FLEX | `normalized.x_o2` (CSV "O initial ambient composition; mole fraction") | Share of cyan ambient dots |
| FLEX | `normalized.fuel` | Soot shell shown for heptane |
| FLEX | `normalized.k_mm2_s`, `burn_time_s`, `test_end`, pressure, N₂/CO₂/He | **Panel only**, never drawn or animated |
| BASS-II | `normalized.width_cm`, `thickness_mm`, `diameter_mm` (parsed from the CSV material text) | Sample width, thickness or rod diameter (cm) |
| BASS-II | `normalized.material_class`, `flow_direction` (Summary Report Table A.4) | Sample type and flow direction |
| BASS-II | Report-table rows (Tables 5.1 / 7.1: velocity, spread rate, width) | **Panel only**, with table, PDF page and verification state |
| SAFFIRE-I | `normalized.flow_direction` (CSV) | Spread arrow direction |
| SAFFIRE-I | All CSV burn fields, quality flags | **Panel only** |

The panel shows every value as stored, with a provenance badge (Measured, Computed, Document, Report table) and
value-kind tags (range, approximate, blank). Non-numeric cells are shown raw.

## 7. Known scientific limitations

- **No simulation.** No scene solves a conservation equation. The teardrop, flame standoff, soot shell, front travel
  and particle motion are illustrations.
- **No validated model mode.** SpaceFire's only quantitative droplet relation is the d²-law consistency check
  (`docs/SCIENTIFIC_METHODS.md` §2). It compares estimated with reported burn times; it is not validated to
  predict a burn. A "Validated model" mode would need a governing equation, assumptions, units, an applicable domain,
  validation evidence and limitations, implemented and evaluated. None of that exists here, so the mode is omitted
  rather than shown empty.
- FLEX: the drawn flame standoff is constant (4× radius). Real standoff varies with fuel, oxygen and time, and the
  local data has no flame diameters. 'Disruption' outcomes are undefined in the local documents. Heptane extinction
  may be followed by cool-flame burning, so D_ext marks the end of the visible flame, not of burning.
- BASS-II: sample length and holder are assumed. The moving front is not a spread rate (measured rates appear only
  as printed in Table 5.1). Differences between PIs are confounded with material, geometry and flow direction.
- SAFFIRE-I: the local workbook is a manifest of image files. It has no pixels, flame positions, spread rates,
  temperatures or gas histories, so no frame or burn evolution is reconstructed. The ignition location is not in the
  local data and is not drawn.
- Photographs and video are NASA's public releases. They are not tied to individual test rows.

### Data discrepancies kept visible (never silently reconciled)
- FLEX K: the raw header "Burning rate; mm" is interpreted as mm²/s (flag FLEX-UNIT-K). The raw header and raw value
  are shown next to every K value.
- FLEX CO₂: the column header reads "CO" (flag FLEX-HDR-CO2).
- BASS-II widths: the CSV and Appendix A log give nominal widths (1 or 2 cm); the report tables print actual widths
  (1.2 or 2.2 cm). Both are shown. T24 conflict: Table 7.1 prints 2.2 cm, while the log and CSV say 1 cm.
- SAFFIRE-I: CSV Length 40.6 cm and Width 94.0 cm appear swapped relative to the Operations document
  (SAF-LENGTH-WIDTH). The 3D card follows the document, and the conflict is flagged in the evidence table.
  Also kept: the F2 label conflict and the Sample 2 downlink gap (~25 % of frames received).

## 8. Unit conventions

| Scene | World unit | Scale cue |
|---|---|---|
| FLEX | 1 unit = 1 mm | Millimetre scale bar (length = rounded D₀) |
| BASS-II | 1 unit = 1 cm | 10 cm ruler with 1 cm ticks on the back wall |
| SAFFIRE-I | 1 unit = 1 m | Documented sample size in the label (evidence mode) |

Panel units follow the backend:
- FLEX K in **mm²/s** (never mm or mm/s; the backend verifier enforces the same rule);
- diameters in mm, pressure in mmHg (the derived atm value is marked Computed), mole fractions;
- BASS-II gases in % by volume (CO in ppm), report velocities in cm/s, spread rates in mm/s;
- SAFFIRE-I in the CSV's units (cm, cm/s, W, s), with O₂ as recorded text.

## 9. Accessibility

- All 3D content has a non-visual route:
  - every component is a button in the Explain panel (`aria-pressed`, keyboard operable);
  - each scene has a plain-language text alternative, used as the viewer's accessible name, by the static fallback
    and in "What you are looking at".
- Keyboard: the viewer is focusable. Arrow keys rotate (Shift for larger steps), `+`/`-` zoom, `0`/Home reset. The
  camera toolbar has labelled buttons. The scene selector is a radio group with roving focus; panel tabs are a tablist
  with arrow-key navigation.
- No hover-only function: labels are clickable, and everything is also in the panels. Touch: drag and pinch
  (OrbitControls), plus touch-sized buttons (36 px).
- The mode banner is always visible and is DOM text (screen readers read it).
- Reduced motion (`prefers-reduced-motion`): decorative motion defaults to off, damping is off and the canvas renders
  only on change. Visitors can still turn motion on.
- No WebGL, a lost context or a failed chunk shows a static schematic with the full text description; controls,
  explanation and evidence keep working. Visitors can also choose "Static view" to save battery and memory.
- Labels use the site's type and contrast tokens; the evidence uses existing provenance badges.

## 10. Performance strategy

- three.js, R3F and drei load only on `/lab`, in a client-only dynamic chunk. Each scene is a further lazy chunk;
  only one scene is mounted at a time, and they share one WebGL context.
- Frame loop: continuous only while decorative motion is on, the viewport is on screen and the tab is visible;
  otherwise on demand (a frame per change, plus frames while a transition eases) or stopped.
- DPR capped at 1.75 and dropped to 1 when `PerformanceMonitor` reports a decline.
- Geometry: procedural, under ~25k triangles per scene; at most ~1,200 particles (FLEX; 220 in BASS-II, 260 in SAFFIRE-I), updated in place (no
  per-frame allocation); no post-processing, no bloom, no HDR environment downloads.
- No simulation runs per frame. Per-frame work is particle placement and a few uniforms.
- Disposal: R3F disposes JSX-declared geometries, materials and the renderer (and force-loses the context) on unmount.
  Imperatively created objects (sprite texture, outline boxes) are disposed in effect cleanups. A small registry
  (`window.__spacefireLab`: live, mounts, disposed, contextLost, sceneLoads, camera) lets tests verify this.
- Context loss: a genuine loss shows a "Try the 3D view again" overlay that remounts the canvas. The deliberate loss
  on unmount is ignored.

## 11. Validation methodology

Automated (Playwright, real browser, SwiftShader WebGL; the model is never called):
- `e2e/phase6.spec.ts` (desktop, 1440 × 900):
  - lazy single-scene load and the conceptual banner;
  - absence of a "Validated" mode;
  - camera drag, buttons, keys and reset (camera position from the registry);
  - scene switching on one canvas (mount and scene-load counters unchanged by control changes);
  - control effects (labels change with gravity, O₂, sample, flow and burn record);
  - reset of parameters;
  - selection by 3D click (raycast picking), by 3D label and by keyboard;
  - FLEX evidence: K equals the API value in mm²/s, the raw header is shown, no "mm/s" appears, drawn sizes follow
    the record;
  - BASS-II report values and discrepancies (T24, 2.2 vs 2 cm);
  - SAFFIRE-I swap flag and no autoplay or YouTube request;
  - every source link resolves;
  - Copilot hand-off: a draft only, no request until Ask, request body limited to question, scope, investigation
    and one UID, with no slider values;
  - renderer disposal after leaving;
  - WebGL-less fallback;
  - reduced motion and static view;
  - entry points from navigation, Mission Control, phenomenon pages and detail pages.
- `e2e/lab-mobile.spec.ts` (Pixel 7, 390 px): viewport before panels, touch buttons, tabs, scene switch, no horizontal
  overflow.
- Regression: the existing Phase 1–5 suites, `tsc --noEmit`, `eslint`, `next build`, backend `pytest`.

Manual: screenshots at 1440, 768 and 390 px of each scene, evidence mode and the Copilot hand-off. Numbers shown in
the panels were compared with the API responses for flex:180 (C02H101), bass2:27 (M1) and saffire1:S1/S2.
