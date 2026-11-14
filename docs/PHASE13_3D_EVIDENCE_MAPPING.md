# Phase 13 — 3D Evidence Mapping

Both new studios show, above the viewport, *"Conceptual 3D educational visualization; experimental values are
displayed separately where available."* An evidence banner inside the viewport names the class of what is drawn. Every
selectable part has a classification chip.

Classes:
- **Measured (NASA)**: a value measured in the experiment.
- **Source-backed derived**: calculated from measurements by NASA or SpaceFire.
- **Model prediction**: output of a numerical model.
- **Evidence-guided concept**: an arrangement or behaviour documented in a NASA source, with an illustrative shape.
- **Educational illustration**: a choice made for clarity.

## Gaseous Flame Studio (`/phenomena/gaseous-flames#studio`, `components/3d/GasFlameScene.tsx`)

| Element | Class | Evidence | What is NOT claimed |
|---|---|---|---|
| Porous spherical burner, 6.35 mm, drawn to scale (1 unit = 10 mm) | Measured | 0.25-inch sphere: Flame Design final report Table 1 note (PDF p24); CFI-G reused the Flame Design burners (CFI-G report PDF p4) | The exact burner of each CFI-G test (not per-test documented) |
| Normal vs inverse arrangement (which reactant leaves the burner) | Evidence-guided concept | CFI-G report PDF p3; Flame Design report PDF p3 | Flow rates, velocities |
| Hot-flame shell, default size (15 mm) | Educational illustration | — | Any measured size |
| Cool-flame shell, default size (6 mm) | Educational illustration | — | Any measured size |
| Hot and cool radii when a Table 3 event is selected | **Measured** | CFI-G final report Table 3 (PDF p46), verified; only for that event (30 % n-butane, normal, 2.03 bar) | Radii at any other condition (never interpolated); the inverse side of a comparison stays illustrative |
| Dashed ring = measured hot-flame radius before the cool flame | Measured | Table 3 | — |
| 21174D1 cool flame | Not drawn | Table 3 footnote 3: radius not measured | — |
| Flame colours, flicker, cool-flame pale-blue false colour | Educational illustration | Intensified cool-flame images are shown by NASA as converted blue (report Fig. 2) | Temperatures or emission spectra |
| Reactant dots and arrows | Educational illustration | — | Concentration fields, diffusion speeds |
| "Inspect an actual CFI-G test" panel | Measured (values only) | PSI-159 experimental tables | Changes geometry: it does not |

Controls: arrangement (normal/inverse), regime (hot/cool), side-by-side compare, measured-event picker, test
inspector, orbit/zoom (drag, wheel, buttons, arrow keys, +/−), reset (button or 0), labels, motion play/pause,
fullscreen (native, with an expanded fallback), and a static description view.

Not simulated: heat transfer, kinetics, transport, radiation or any CFD. The flame grows or extinguishes only in
the text, which cites Flame Design report p26.

## Smoke Detection Studio (`/phenomena/smoke-detection#studio`, `components/3d/SmokeScene.tsx`)

An original simplified schematic. It does not reproduce the SAME engineering drawings, whose redistribution rights
are unverified.

| Element | Class | Evidence | What is NOT claimed |
|---|---|---|---|
| Heated sample with wire coil on a carousel | Evidence-guided concept | Final Science Report; flight log (carousel / position) | Sample geometry, temperature |
| Smoke duct, aging chamber with piston, diluter | Evidence-guided concept | Final Science Report pp.10–13; ICES decks | Dimensions, volumes, layout |
| P-Trak (0th moment), ionization (1st), DustTrak A 1 µm / B 10 µm (3rd) | Evidence-guided concept | Report pp.15–19 (moment method) | Instrument placement |
| Space Shuttle (ionization) and ISS (light-scattering) detectors | Evidence-guided concept | ICES 2013 slides 4, 27–28; report p28 | Detection thresholds or probabilities |
| Six stages (heating → formation → transport → aging → sampling → detection) | Evidence-guided concept | Report narrative | Timing (stages are not to time scale) |
| Particle dots and their motion | Educational illustration | — | Trajectories, velocities, size distributions |
| Aged smoke: fewer, larger dots | Educational illustration of a documented trend | "Particle sizes increase substantially with aging" (ICES 2013 slide 27); measured values in the panel | Dot size is not the measured size |
| Measured particle sizes in the side panel and banner | Source-backed derived | Final Science Report Table 1 (p27): moment-method results | Raw instrument signals |

Controls: stage selector and "Next stage", material (Kapton / Teflon / silicone / lamp wick / DBP; DBP has no Table 1
row and the panel says so), fresh / aged 720 s, labels, motion play/pause, orbit/zoom, reset, fullscreen, static view.

## FLEX Studio (improved, existing component)

The flame-envelope component now explains the hot → cool flame transition for large n-alkane droplets and cites
Farouk & Dryer (PDF p2), the PSI-117 extinction slides (PDF p9) and the on-page PSI-117 charts (`#psi117`). The
cool-flame regime is deliberately **not** drawn in 3D: PSI-117 provides digitized figure data and 1-D model curves,
which are shown as charts, not as a validated geometry. Earth-vs-microgravity, fuel comparison, timeline, fullscreen
and evidence mode are unchanged (existing Phase 6–12 tests pass).

## Shared 3D behaviour

- Same canvas as the existing studios (`components/3d/SceneCanvas.tsx`): on-demand rendering when idle, adaptive
  resolution, context-loss handling and disposal counters (`window.__spacefireLab`).
- One canvas per page. The browser test navigates between the two new studios and asserts ≤ 1 live context and
  `disposed ≥ mounts − 1`.
- three.js loads only with the viewport (`next/dynamic`, `ssr: false`; each scene is `React.lazy`).
- No WebGL, a context loss or an error → a written description with a retry button.
- The viewport is a `theme-dark` island in both themes; light and dark themes are tested.
