# Theme design system v1 (Phase 12)

Branch `feature/spacefire-phase12-premium-themes`, from the baseline `backup/spacefire-before-phase12` (`e5edd9f`).
Rollback: `docs/PHASE12_ROLLBACK.md`. Frontend only: no data, calculation, verifier, backend or Gemini change; no new
dependency.

## 1. Approach

One token system, two value sets. The Phase 3 tokens (`--void`, `--ink`, `--panel`, …) were already used by every
component through Tailwind (`bg-panel`, `text-text-2`, `border-line-strong/70`, …), so they keep their names and gain a
light value set; components switch theme without per-component changes. Hardcoded colours that bypassed the tokens
were replaced (gradients, SVG figures, chart colours, tour and journey cards, badges on photos).

- `app/globals.css`: dark values on `:root`, `:root[data-theme="dark"]` and `.theme-dark`; light values on
  `:root[data-theme="light"]`.
- `.theme-dark` re-declares the dark values (and resets `color`) for a subtree: a **dark island** inside Light Mode.
- `lib/prepaint.ts`: inline `<head>` script; `lib/theme.ts`: preference store and resolved-theme hook;
  `components/theme-switcher.tsx`: the control; `components/Plot.tsx`: chart recolouring.

## 2. Tokens and palettes

| Token (role) | Dark | Light | Use |
|---|---|---|---|
| `--void` (recessed) | `#0c1626` | `#fbfcfe` | inputs, overlays, deepest layer |
| `--ink` (page) | `#111d30` | `#f1f5fa` | page background |
| `--panel` (surface) | `#182840` | `#ffffff` | cards, panels, chart paper |
| `--raised` (raised / hover) | `#21344f` | `#e8eef6` | hover, selected chips, table header |
| `--line` | `#2b3f5c` | `#d5deea` | hairlines, dividers |
| `--line-strong` | `#5a7499` | `#7c8ea6` | control borders (≥ 3:1 on page and surface) |
| `--text` (primary) | `#f0f5fc` | `#16243a` | body and headings |
| `--text-2` (secondary) | `#c2d0e2` | `#3f5169` | descriptions |
| `--text-3` (muted) | `#9fb2ca` | `#566980` | captions, labels (still ≥ 4.5:1) |
| `--flame` (primary action, combustion) | `#fa9555` | `#b04e1a` | primary buttons, active nav, focus ring |
| `--flame-ink` (text on flame) | `#1f0e03` | `#ffffff` | |
| `--ember` (warm highlight) | `#ffbe73` | `#9a5410` | |
| `--data` (NASA measured data) | `#5ccbdf` | `#0b6f84` | measured values and badges |
| `--electric` (structure, selection) | `#7aa0ff` | `#2d5cc8` | guided tour, selected outlines |
| `--link` | `#c0afff` | `#5a3dc0` | links |
| `--crit` / `--warn` / `--ok` / `--info` | `#ff8585` / `#f3c763` / `#7fd6a0` / `#97b9e4` | `#b42d2d` / `#865c00` / `#1f7442` / `#2b5c93` | scientific states only, always with an icon or word |
| `--cat-1…4` (chart categories) | `#22a6bf #d87830 #a07ceb #56a93b` | `#0086a3 #c2611d #7752d4 #3d8a2a` | fixed order, never cycled |
| derived | `--chart-grid`, `--row-hover`, `--raw-bg/-text`, `--sky-*`, `--side-*`, `--nav-active`, `--tint-*`, `--shadow`, `--grid-line` | | surfaces built from the palette |

Mapping to the generic names in the brief: background = `--ink`, surface = `--panel`, surface-raised / surface-hover =
`--raised`, text-primary/secondary/muted = `--text`/`--text-2`/`--text-3`, border/border-strong = `--line`/`--line-strong`,
accent = `--flame` (hover: the same token with the `press` transition, no second orange), focus-ring = `--flame`,
data-primary = `--data`, data-secondary = `--electric`, warning/danger/success = `--warn`/`--crit`/`--ok`.

Semantic states stay separate: measured data (`--data`, "Measured" badges), conceptual visualisation (amber label
"Conceptual 3D"), computed results ("Computed" badge in flame), warnings (`--warn`/`--crit` with ▲/◆ glyphs and words).
No meaning is carried by colour alone.

Changes in Dark Mode (refinement): the page moved from near-black (`#0a1424`) to midnight navy (`#111d30`); secondary
text from `#a9b8cd` (8.3:1 on panel) to `#c2d0e2` (9.5:1); muted text from `#8194ae` (5.4:1) to `#9fb2ca` (6.9:1);
control borders became visible (`#31496d`, 1.8:1 → `#5a7499`, 3.1:1); the orange is slightly softer (`#ff8a3d` →
`#fa9555`).

## 3. Contrast (WCAG 2.x formula, computed from the live CSS by `e2e/phase12.spec.ts`)

| Check | Dark (lowest) | Light (lowest) | Target |
|---|---|---|---|
| Every text token on void, ink, panel, raised | 4.97 (electric on raised) | 4.55 (flame on raised) | ≥ 4.5 |
| Primary text on page | 15.4 | 14.2 | ≥ 4.5 |
| Muted text (`--text-3`) on page | 7.8 | 5.2 | ≥ 4.5 |
| Button text on flame | 8.5 | 5.3 | ≥ 4.5 |
| Control border (`--line-strong`) on page / surface | 3.5 / 3.1 | 3.1 / 3.4 | ≥ 3 |
| Focus ring (`--flame`) on page / surface | 7.6 / 6.7 | 4.9 / 5.3 | ≥ 3 |

Automated checks cover the token pairs and the dark islands; they are not a full accessibility audit (text over
photographs, gradients and translucent overlays was reviewed visually).

## 4. Theme behaviour

- Choices: **Light**, **Dark**, **System** (default until the visitor picks one). A three-icon radio group (sun, moon,
  monitor) in the page header, so it is visible on every page, with the sidebar collapsed and on phones. Arrow keys
  move and select; each option has an accessible name.
- Stored in `localStorage["spacefire:theme"]` (survives navigation and browser restarts; no account).
- The pre-paint script in `<head>` reads the choice (or `prefers-color-scheme` while on System) and sets
  `html[data-theme]` before the body is parsed: no flash of the wrong theme. React never renders that attribute
  (`suppressHydrationWarning` on `<html>`), so there is no hydration mismatch. While on System the page follows OS
  changes live.
- Switching changes one attribute. No reload and no remount: route, URL state, 3D canvas, camera, timeline playback,
  fullscreen, auto-hide timers and the sidebar are untouched (tested).

## 5. Charts

- `components/Plot.tsx` recolours every chart at draw time: each palette colour the views write (the Phase 3 dark
  values) maps to a token (`#101E33` → `--panel`, `#A9B8CD` → `--text-2`, `#22A6BF` → `--cat-1`, `#FF6B6B` → `--crit`,
  …) read from the live CSS. Charts subscribe to the resolved theme and redraw on change, without the "data changed"
  pulse. Data arrays, axes, units, filters and statistics are not touched (the test compares point counts across
  themes).
- Categorical slots keep their identity (Extinction teal, Disruption orange, Completion violet) with luminance
  re-stepped per surface. Validated with the dataviz validator: light `#0086A3,#C2611D,#7752D4` passes all checks
  all-pairs on white (CVD ΔE 11.4); dark passes on `#182840` with a CVD warning (7.4) that is covered by the marker
  shapes the outcome charts already use (circle / × / diamond). Slot 4 (green) fails the CVD check against slot 2
  (orange) when both appear in one scatter; the BASS-II gas chart did exactly that with circles for both, so its fourth
  group (fabric, wax and other) now uses diamonds (caption updated). Bar charts use adjacent slots, which pass.
- The BASS-II thickness ramp (sequential cyan) starts darker on white so its lightest step stays visible
  (`sequential` prop).
- Marker outlines use the surface colour (a gap between overlapping marks); the selected-test ring uses the text colour.
- SVG figures (d²-law calculator, SAFFIRE-I flow schematic) use token classes (`stroke-flame`, `fill-text-3`, …).

## 6. 3D studios and dark islands

The flame, soot and particle effects are additive light on a dark stage; a light scene background washed them out.
The 3D viewport is therefore a dark island in Light Mode (`theme-dark` on the viewport box): the surrounding studio,
controls, timeline and panels are light, the stage and its overlay chips, labels and camera controls are dark. Scene
geometry, materials and meaning are unchanged.

Other dark islands: the fullscreen studio (a cinema view, like a video player), the Home hero (a real NASA photograph
of a flame aboard the ISS on a night band), the space schematics (`PhenomenonArt`) and relation badges drawn on
photographs. NASA images, captions and credits are unchanged.

## 7. Fullscreen

Phase 11 behaviour is unchanged: the fullscreen studio is a dark island in both themes, so its chrome, playback bar,
drawer and explanation overlay read the same in either theme. A theme change while fullscreen (OS switch on System)
keeps fullscreen, the canvas and the auto-hide timer (tested).

## 8. Responsive

At 390 px the Menu button becomes icon-only (accessible name "Open navigation") so the logo stays on one line next to
the switcher; switcher targets are 32 px. Checked at 1440, 768 and 390 px in both themes: no horizontal overflow, no
clipped header. The breadcrumb truncates each crumb (first crumb kept whole) instead of overlapping.

## 9. Known limitations

- Light Mode keeps dark islands (3D stage, fullscreen, Home hero, space schematics) by design.
- Plotly's mode bar and some third-party UI (the YouTube player) keep their own styling.
- Colours inside NASA photographs and the colourised FLEX composite are the originals.
- Text over photographs and translucent layers is checked visually, not by the automated contrast test.

## 10. Test results

See `docs/IMPLEMENTATION_STATUS.md` (Phase 12 verification).
