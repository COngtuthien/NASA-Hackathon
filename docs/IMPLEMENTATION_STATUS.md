# SpaceFire AI — Implementation Status

## Phase 13 — Scientific Data Integration, Analysis & Interactive 3D (branch `feature/spacefire-phase13-scientific-expansion`, 2026-11-14): PARTIALLY COMPLETE
Base `4a3b2bc` (Phase 12 + Copilot fix + both audits; linear). Rollback: `backup/spacefire-before-phase13`.
- Done: ACME folder rename (hash-verified); reproducible processing of all 7 investigations (`app.ingest.phase13`,
  curated JSON committed); registry/API; Gaseous Flame Dynamics and Smoke & Fire Detection pages; PSI-117 on the FLEX
  page; Gaseous Flame and Smoke Detection 3D studios; 30 new RAG documents; backend 211 passed; Phase 13 browser tests
  10 passed; tsc/eslint clean; production build OK.
- Not finished: the full Playwright regression was stopped at 125 passed / 0 failed by a low-memory shutdown; the
  mobile Phase 13 spec was not run. SAME telemetry plots deferred. Details: docs/PHASE13_*.md.

## Phase 13 ACME dataset audit (branch `audit/spacefire-acme-datasets`, 2026-11-14): AUDIT ONLY
Base: `79d08cf` (previous dataset audit). No app, data, model or database change; no Gemini request.
- Folders `ACME BRE` = PSI-20, `ACME CFI-G` = PSI-159, `AMCE Flame Design` (misspelled on disk) = PSI-10.
- CFI-G has the only per-test outcomes (333 test points + 15 measured cool-flame events); Flame Design tables are
  conditions only; BRE is documentation plus a day log. 4 BRE drawing ZIPs are damaged downloads.
- Docs: `docs/ACME_DATASET_AUDIT.md`, `docs/ACME_DATASET_INVENTORY.csv` (413 rows, rebuilt by
  `research/scripts/acme_dataset_inventory.py`), `docs/ACME_DATASET_INTEGRATION_MATRIX.md`,
  `docs/ACME_DATASET_DOWNLOAD_GAPS.md`, `docs/ACME_INTEGRATION_ROADMAP_PROPOSAL.md`.

## New NASA dataset audit (branch `audit/spacefire-new-nasa-datasets`, 2026-11-14): AUDIT ONLY
Base: `bcd76ce`. No app, data, model or database change; no Gemini request. Downloads stay untracked.
- Found `FLEX-2/` (PSI-68), `PSI-117/`, `PSI-62/` (metadata ZIP only), `SAME/` (PSI-102). The expected ACME
  investigations (PSI-159, PSI-10) are **not on disk**.
- Report `docs/NEW_NASA_DATASET_AUDIT.md`; inventory `docs/NEW_NASA_DATASET_INVENTORY.csv` (154 rows, rebuilt by
  `research/scripts/new_dataset_inventory.py`); `docs/NEW_NASA_DATASET_INTEGRATION_MATRIX.md`;
  `docs/NEW_NASA_DATASET_DOWNLOAD_GAPS.md`.
- Recommended order: PSI-117 → SAME → FLEX-2 → PSI-62. Nothing integrated yet.

## Copilot server-error repair (branch `fix/spacefire-copilot-server-error`, 2026-11-13): DONE
Base: Phase 12 `66242ac`. Diagnosis and evidence: `docs/COPILOT_SERVER_ERROR_DIAGNOSIS.md`.
- First failing component: the external provider (`gemini-3.8-flash` returned 503 "high demand", 503, then 504; one
  live request, 72 s). Backend, Next proxy, retrieval, verifier and stream parsing all passed zero-quota checks.
- Fixed in the app: the bounded Gemini retry budget (overload-only retries within 1.5 x `LLM_TIMEOUT_S`; SDK retries
  off); the repair call is skipped after a slow first answer; the Copilot page aborts on 45 s of stream silence, not a
  fixed 120 s that discarded the evidence; plain-language messages per failure with Retry only when it can help.
- Verification: pytest **188 passed**; tsc and eslint clean; production build OK; Playwright on the production build
  **158 passed, 1 skipped** (opt-in live test, not run), including `e2e/copilot-errors.spec.ts` (11).
  Gemini requests used: **1**.

## Phase 12 status (branch `feature/spacefire-phase12-premium-themes`, 2026-11-13): COMPLETE
Light and Dark themes (and System) for the whole website: one semantic token set with two value sets, a pre-paint
theme script, a header switcher, theme-aware charts, and dark islands for the 3D stages, the fullscreen studio and space
imagery. Frontend only: no data, calculation, verifier, backend or Gemini change; no new dependency. No Gemini request
was made (API on port 8010 with `LLM_API_KEY=` blank, `llm.mode = retrieval_only`; the opt-in live test was not run).
Design: `docs/THEME_DESIGN_SYSTEM_V1.md`. Rollback: `docs/PHASE12_ROLLBACK.md`.

**Baseline (rollback point):** `backup/spacefire-before-phase12` = `e5edd9f3c0e65e2e0f51367a3a06f343c8c0c8ff` (Phase 11
HEAD, equal to `origin/feature/spacefire-phase11-immersive-3d-ux`), created before any change and pushed to GitHub.
The Phase 11 branch was not modified.

| Milestone | Status | Evidence |
|---|---|---|
| M1 Protect baseline | DONE | Backup branch created at the verified Phase 11 commit and pushed; Phase 12 branched from it with no upstream to the backup; rollback switch verified (below) |
| M2 Design tokens | DONE | Phase 3 token names kept, light values added, dark refined; derived tokens for charts, sky, sidebar, tints, shadows; `.theme-dark` scope |
| M3 Theme switcher | DONE | `components/theme-switcher.tsx` (Light / Dark / System radio group, arrow keys), `lib/theme.ts`, `lib/prepaint.ts`; localStorage; OS preference; no flash, no remount |
| M4 Shell and typography | DONE | Sidebar, active nav, header, breadcrumbs (no overlap), phone header (icon-only Menu), stronger secondary and muted text, visible control borders |
| M5 Pages and charts | DONE | `Plot.tsx` recolours all Plotly charts from tokens on theme change (data untouched); validated categorical slots per theme; sequential ramp re-stepped for white; SVG figures tokenized; BASS-II gas chart shape fix |
| M6 3D and fullscreen | DONE | 3D viewport and fullscreen studio are dark islands; theme change keeps canvas, camera, playback, fullscreen and auto-hide (tested) |
| M7 Responsive and accessibility | DONE | 1440 / 768 / 390 px reviewed by screenshot in both themes; badges on photos, Home hero and space schematics fixed for Light Mode |
| M8 Regression | DONE | See below |
| M9 Docs and delivery | DONE | Design and rollback docs, README, this section |

### Phase 12 verification (2026-11-13)
- `tsc --noEmit` clean; `eslint components lib app e2e scripts` clean; `next build` OK (18 routes, separate
  `NEXT_DIST_DIR=.next-verify`, removed afterwards).
- Playwright on the final production build: **147 passed, 1 skipped** (opt-in live Gemini, not run). New:
  `e2e/phase12.spec.ts` (8: token contrast in both themes and the dark island, OS preference and explicit choice,
  pre-paint theme and no hydration or console error on 13 pages, keyboard switcher with route/sidebar kept and no reload,
  3D state across switches, fullscreen across an OS switch, chart recolouring with identical data, screenshots of both
  themes attached) and `e2e/phase12-mobile.spec.ts` (390 and 768 px, both themes, no overflow). No existing test changed.
- Backend `pytest`: **181 passed**. Smoke: 13 pages 200, `/lab?scene=bass` 307, health 200 (`retrieval_only`),
  records and FLEX map 200.
- Contrast (computed from the live CSS): lowest text pair 4.97 dark / 4.55 light; button text 8.5 / 5.3; control
  borders 3.1 / 3.1; categorical chart slots validated with the dataviz validator per theme.
- Visual review: every page at 1440 px and key pages at 390 px in both themes, all charts in both themes, the studio
  in Light Mode with a theme switch during playback. Issues found and fixed: a hydration-time re-apply of the OS theme
  over a saved choice; the Home hero photo showing as a black block; unreadable relation badges on photographs;
  breadcrumb overlap; logo wrapping on phones; the BASS-II gas chart's fourth group relying on colour alone.
- Rollback verified: `git switch backup/spacefire-before-phase12` → HEAD `e5edd9f…`, no `frontend/lib/theme.ts`, no
  `data-theme` in `globals.css`; `git switch feature/spacefire-phase12-premium-themes` → back, stash restored;
  `git ls-remote origin backup/spacefire-before-phase12` → `e5edd9f…`.

### Phase 12 known limitations
- Light Mode keeps dark islands by design (3D stage, fullscreen, Home hero, space schematics).
- Text over photographs and translucent layers was reviewed visually; the automated contrast test covers token pairs.
- Plotly's mode bar and the YouTube player keep their own styling.

## Phase 11 status (branch `feature/spacefire-phase11-immersive-3d-ux`, 2026-11-13): COMPLETE
Immersive 3D studios: the large viewport banners are gone (their statements moved beside the controls and into the
fullscreen overlays), the setup panel can be hidden, every studio has a video-player-style fullscreen with auto-hiding
controls, independent Controls / Explanations / Part labels toggles, simpler "Earth" labels, and a collapsible site
navigation. Base: Phase 10 (`4d112b4`, pushed, equal to the remote). Frontend only: no backend, data, verifier,
algorithm or Gemini change, no new dependency. No Gemini request was made; verification used a backend with
`LLM_API_KEY=` blank (`llm.mode = retrieval_only`) and the opt-in live test was not run. Design:
`docs/IMMERSIVE_3D_UX_V1.md`.

| Milestone | Status | Evidence |
|---|---|---|
| M1 Architecture review | DONE | Base branch chosen after `git fetch` (Phase 10 complete and pushed). Reused the studio section, the one canvas, the timeline store, the Phase 10 stage content, the existing label modes and the panel tabs; new: `lib/auto-hide.ts`, `lib/ui-prefs.ts`, `components/studio/immersive.tsx` |
| M2 Clean viewport | DONE | Mode banner → compact mode label; statement beside Mode (`mode-note`); measured-size label kept in the viewport; comparison caveat moved under the viewport; BASS-II floating caveat only with All labels; lighter unselected labels |
| M3 Right control panel | DONE | Hide/Show controls, viewport widens, canvas resized not remounted, tab/inputs/scroll preserved, session memory without hydration mismatch |
| M4 Fullscreen foundation | DONE | The studio section is the fullscreen element (native API, honest expanded fallback), same canvas and state, Escape/browser exit, focus return, scroll lock in fallback, cleanup on navigation |
| M5 Auto-hide | DONE | 3 s state machine with holds (press, hover, keyboard focus, select, drawer, colour key), touch tap reveal/dismiss, cursor hiding, inert hidden chrome, tab-visibility pause, one timer at most, DOM-only visibility (no React render) |
| M6 Fullscreen overlays | DONE | Top bar, playback bar (FLEX/BASS-II timeline; SAFFIRE-I walkthrough), setup drawer / bottom sheet with Mode and View, explanation overlay synchronized with stage, fuel, test and view (with basis and sources), Part labels starting hidden |
| M7 Global navigation | DONE | 68 px icon rail with tooltips (hover and keyboard focus), active page kept, localStorage + pre-paint `html[data-nav]` (no flash), drawer below 1024 px unchanged |
| M8 Copy and integrity | DONE | "Earth", "Earth vs Microgravity"; scientific "1 g" text in explanations, captions of NASA media, methodology and source text unchanged; corrected a stale left/right description of the comparison (Earth has been on the left since Phase 10); safeguard placement table in the design doc |
| M9 Validation | DONE | See below |
| M10 Docs and delivery | DONE | `docs/IMMERSIVE_3D_UX_V1.md`, README studio-controls paragraph, this section |

### Phase 11 verification (2026-11-13)
- `tsc --noEmit` clean; `eslint components lib app e2e scripts` clean; `next build` OK (18 routes, separate
  `NEXT_DIST_DIR=.next-verify`, removed afterwards).
- Playwright on the production build (port 3010, API on 8010 with the model disabled): **138 passed, 1 skipped**
  (opt-in live Gemini, not run). New: `e2e/phase11-unit.spec.ts` (8, fake-clock state machine),
  `e2e/phase11.spec.ts` (15), `e2e/phase11-mobile.spec.ts` (2). Playwright's Chrome took the native fullscreen path;
  the refused and unsupported paths are forced in a test.
- Changed older assertions only where they read the removed banner (`mode-banner` → `mode-note` / `measured-label`) or
  the old Earth labels (phase 7, 8, 9, 10 specs).
- Backend `pytest`: **181 passed**. Smoke: the three phenomenon pages, Home and Methodology 200, `/lab?scene=bass` 307,
  `/api/v1/health` 200 (`retrieval_only`), FLEX and BASS-II records 200, FLEX map 200.
- Visual checks at 1440, 768 and 390 px (FLEX single and Earth vs Microgravity with drawer and explanation, BASS-II,
  SAFFIRE-I walkthrough, collapsed rail): no horizontal overflow, no overlap, no console errors on the production
  build. Fixes found this way: the drawer covered the top-bar buttons and half of a split view (the chrome now stops
  at the drawer and the scene area narrows beside it); the fallback notice overlapped the explanation (now a short-lived
  toast); comparison captions moved beside the divider so the explanation never hides "Earth"; phone step titles got
  their own row.
- Environment: no other local server was running this time; ports 3010/8010 and a separate build folder were used
  anyway. `tsconfig.json` rewrites from the custom dist dir were reverted.

### Phase 11 known limitations
- In native fullscreen Escape always leaves fullscreen (browser-owned), even with the drawer open; the fallback closes
  the drawer or explanation first.
- Pointer movement over the NASA YouTube iframe is invisible to the page, so the chrome can fade while the pointer
  rests on the video.
- iPhone Safari has no element fullscreen; it gets the expanded fallback with its notice.
- Hiding labels unmounts drei `<Html>` label roots (as the existing "Off" setting does); React logs a dev-only warning
  about it in `next dev`, not in production.

## Phase 10 status (branch `feature/spacefire-phase10-combustion-storytelling`, 2026-11-12): COMPLETE
Stage-by-stage combustion storytelling in the existing studios: one timeline store drives the 3D state, the stage
chip, the highlighted components and a short, source-backed explanation; Earth and microgravity are compared stage by
stage on one canvas; BASS-II gets material- and flow-aware stages; SAFFIRE-I gets an explanatory walkthrough. Frontend
only: no backend, data, flag, verifier or Gemini change. No Gemini request was made; verification used a backend with
`LLM_API_KEY=` blank (`llm.mode = retrieval_only`) and the opt-in live test was not run. Design, sources and rules:
`docs/COMBUSTION_STAGE_STORYTELLING.md`.

| Milestone | Status | Evidence |
|---|---|---|
| M1 Audit and architecture | DONE | Reused the timeline store (single source of truth), `flexStage(p)` scene states, `SplitView`, `layerView` emphasis, tours and the journey. Added `lib/stages.ts`, `components/studio/StageExplainer.tsx`, `useStageId`, `useTimelineValue`, `goToStage`, a scene `focus` prop and a stacked `SplitView`. No new dependency, canvas or timer |
| M2 FLEX stages | DONE | Five stages with summary, key idea, why, basis labels, sources, limits, inspect target, absent-component reasons and a text alternative; selected-test lines (idealized D₀²/K time beside the recorded burn time; outcome text per test-end category) |
| M3 Earth vs microgravity | DONE | Earth (1 g) left, microgravity right, same stage on one canvas; per-stage Earth / microgravity lines; stage-specific "Why are they different?" with sources and 3D emphasis; NASA 1 g vs µg photo with credit; "Conceptual comparison — not paired Earth and ISS measurements"; stacked on phones |
| M4 Fuel-specific context | DONE | Methanol vs n-heptane notes for burning, regression and end (soot; cool flame described, not drawn, not every test); Compare Fuels shows both and says the shared timeline is not equal burn time |
| M5 BASS-II stages | DONE | Ignition, spread, end from the chosen sample and flow; selected test: width conflict, Table 5.1 rates with units and page, recorded outcome or "cannot be inferred" |
| M6 SAFFIRE-I walkthrough | DONE | Five explanatory steps (not a timeline), burn-aware (S1 / S2), keyboard operable, footage on request, nothing reconstructed |
| M7 UX and accessibility | DONE | Prev / Next stage, stage list `aria-current`, polite stage announcements, screen-reader scene descriptions, stage chip in the viewport, opt-in camera follow, reduced motion, WebGL fallback, 36 px touch targets |
| M8 Scientific validation | DONE | Every new statement checked against its cited passage (FLEX ERD pp.18, 36, 64, 74; Liu et al. pp.2, 4, 8; Farouk & Dryer p.2; MDCA package p.22; BASS-II pp.12, 13, 27, 64; SAFFIRE-I documents); unsupported claims omitted |
| M9 Regression and delivery | DONE | See below |

### Phase 10 verification (2026-11-12)
- `tsc --noEmit` clean; `eslint .` clean; `next build` OK (18 routes).
- Playwright on the production build, model disabled: **113 passed, 1 skipped** (opt-in live Gemini, not run).
  New: `e2e/phase10-unit.spec.ts` (8 logic tests), `e2e/phase10.spec.ts` (10), `e2e/phase10-mobile.spec.ts` (2:
  390 px stacked comparison with touch, 768 px side by side).
- No existing test was changed: the stage line keeps its `timeline-stage` test id and stage titles, and the gravity
  captions and split note keep the texts older tests check.
- Backend `pytest`: **181 passed**. Smoke: pages 200, `/lab` 307, records and all newly cited documents 200.
- Sweep at 1440, 768 and 390 px over the comparison, fuels, record, BASS-II, SAFFIRE-I and Home views: no horizontal
  overflow, no console errors.
- Robustness fixes found during testing: the studio no longer re-renders on every animation frame (selective
  subscriptions); the shared record fetch retries once on a transient network/proxy/5xx failure (seen once as a
  missing record context in a full run).
- Environment: another `next start` on port 3000 and a Gemini-enabled backend on port 8000 were running outside this
  session and were left untouched. Verification used port 8010 (model disabled) and a separate build folder on 3010
  through new optional settings: `NEXT_DIST_DIR` (next.config), `PW_BASE_URL` / `PW_API_PORT` (Playwright). Defaults
  are unchanged.

### Phase 10 known limitations
- Stage boundaries are illustrative and identical for every test; recorded burn times are shown beside the timeline,
  never used to scale it.
- The 1 g side is a qualitative shape; no FLEX test ran at 1 g, and no Earth numbers are shown.
- The n-heptane cool flame is described, not drawn.

## Phase 9 status (branch `feature/spacefire-phase9-discovery-experience`, 2026-11-12): COMPLETE
A scientific discovery layer on top of Phase 8: an optional guided journey, compact but truthful scientific notices,
a "Compare with NASA" view in every studio, chart points that select real tests, contextual Copilot drafts and a small
glossary. Frontend only: no backend, data, algorithm, flag severity, Gemini or verifier change. No Gemini request was
made; the API ran with `LLM_API_KEY=` blank (health `llm.mode = retrieval_only`) and the opt-in live test was not run.
Design and rules: `docs/SCIENTIFIC_DISCOVERY_UX_V1.md`.

| Milestone | Status | Evidence |
|---|---|---|
| M1 Audit and component design | DONE | Reused Disclosure/hash-open, MediaFigure/lightbox, the studio's URL state (`record`, `mode`, `view`, `component`) and the media registry; no new dependency or global state |
| M2 Smart scientific notices | DONE | `components/scientific-notice.tsx`, `lib/scientific-notices.ts`: severity in text, summary, one visible sentence naming the issue, details on request (original vs interpreted, why, affects, flag rules, sources), `#notice-*` deep links. Contextual warnings beside values via `lib/record-facts.ts` (FLEX K unit and header, BASS-II nominal vs actual width, warning/critical flags) |
| M3 Discovery journey | DONE | `lib/journey.ts`, `components/journey.tsx`: 7 steps in the URL (`journey`, `topic`), inline card (no overlay), progressbar, Back/Next/End, Escape, focus to heading, optional "do it for me" tasks; Home hero "Start exploring" / "Explore on my own"; Copilot step drafts only |
| M4 Visual evidence comparison | DONE | Studio view `view=nasa` on all three pages, same canvas; `lib/evidence-compare.ts` offers only experimental media of the same investigation (never BASS (I)), captions state the relation to the selection, recorded values with warnings, "what differs", click-to-play footage |
| M5 Connected exploration | DONE | FLEX map, d² and ratio charts and the BASS-II gas chart select into `record` (ring + `components/record-spotlight.tsx` with a keyboard select); studio follows, mode kept; record pages link "Show this test on the … chart"; shared record cache; studio no longer steals deep links to other sections |
| M6 Contextual Copilot and glossary | DONE | `lib/copilot-suggestions.ts` (draft-only links naming the investigation, record UID only); shared local health for AI availability and "AI paused" status; `lib/glossary.ts`, `components/glossary.tsx` (11 terms, popover, Methodology list) |
| M7 Polish and validation | DONE | Studio stacking isolated (camera toolbar no longer draws over the sticky header); Plotly charts resize when a hidden chart opens (fixed a 390 px overflow); Home kept static (journey part in its own Suspense boundary) |
| M8 Documentation and delivery | DONE | This section, `docs/SCIENTIFIC_DISCOVERY_UX_V1.md`, README |

Presentation mode was considered and deferred (see the design document, section 13).

### Phase 9 verification (2026-11-12)
- `tsc --noEmit` clean; `eslint .` clean; `next build` OK (18 routes; Home still static).
- Playwright on the production build, model disabled: **93 passed, 1 skipped** (opt-in live Gemini, not run).
  New: `e2e/phase9-unit.spec.ts` (6 logic tests), `e2e/phase9.spec.ts` (11), `e2e/phase9-mobile.spec.ts` (2, 390 px).
  Assistant requests are counted in the journey, chart and suggestion tests and must be zero.
- Updated tests (intent unchanged): `phase3` (hero links are now "Start exploring" / "Explore on my own"), `phase7`
  (ring legend reads "Selected test: …"), `journeys` (the FLEX-P-ZERO check is scoped to the flag browser; with
  `severity=critical` the top-warnings list also names that rule, which made `.first()` order-dependent).
- Backend `pytest`: **181 passed**. Smoke: 9 pages 200, `/lab` 307, 8 API endpoints 200.
- No horizontal overflow at 390 and 768 px on 12 Phase 9 views; screenshots reviewed at 1440, 768 and 390 px.
  Production console on the new flows: no errors (three.js's existing `THREE.Clock` deprecation warning only).
- Density at 1440 px (visible words): Home 499, FLEX 890, BASS-II 827, SAFFIRE-I 728, record 300
  (`docs/ux-audit-phase9-1440.json`), inside the Phase 8 budgets.

### Phase 9 known limitations
- Plotly points are not keyboard-focusable; the spotlight's labelled select is the keyboard path.
- Some sample types have no verified NASA image (BASS-II spheres and films, methanol FLEX droplets); the comparison
  says so rather than substituting.
- AI availability reflects the health check at page load.

## Phase 8 status (branch `feature/spacefire-phase8-ux-simplification`, 2026-11-12): COMPLETE
A human-centred simplification pass: progressive disclosure across the site, "Mission Control" renamed **Home**,
shorter defaults, and scientific warnings kept visible. Frontend only: no backend, data, algorithm, Gemini or verifier
change. No Gemini request was made; the API ran with `LLM_API_KEY=` blank (health `llm.mode = retrieval_only`) and the
opt-in live test was not run. Design and page-by-page detail: `docs/UX_SIMPLIFICATION_V1.md`.

| Milestone | Status | Evidence |
|---|---|---|
| M1 Audit and design system | DONE | `frontend/scripts/ux-audit.mjs` (visible words, numbers, pills, first-viewport words, height for 15 pages). `components/disclosure.tsx`: `Disclosure` (specific action label, `aria-expanded`/`aria-controls`, body stays mounted but `hidden`, opens on a matching URL hash or a declared inner anchor), `Takeaway`, `MeasureGroup`, `QualityNotice`, `ReadMore`, `SectionIntro`. Calmer type scale, panels and status bar; site footer with attribution |
| M2 Home | DONE | "Mission Control" → "Home" in navigation and breadcrumbs. Five sections: hero, three phenomena, 3D studios, Copilot (examples pre-fill only), trust. KPI counters, the scroll story and the dashboards moved to the pages they explain |
| M3 Scientific Analysis pages | DONE | Key question lead, 3D model, key findings as takeaways ("Why we say this" opens evidence, sources, limits), visible data-quality notices (FLEX K header ‘mm’ read as mm²/s; BASS-II nominal vs actual widths; SAFFIRE-I has no local images), "Explore the data" disclosures, literature collapsed. Studio notes shortened, coverage and display settings on request |
| M4 Experiments | DONE | Explorer: primary filters and key columns first; "Show all filters" (opens itself when an advanced filter is active) and "Show all columns" (`cols=all`, never sent to the API). Detail: key recorded values with units, visible quality notice, raw values, report rows, pages, flags and provenance on request; "Ask about this test" pre-fills |
| M5 Copilot | DONE | Answer first; three statements then "Show all N"; limitations always visible; sources collapsed (open when there is no AI answer or a citation marker is clicked); tool trace under "How this answer was built" |
| M6 Research tools | DONE | Reliability leads with the most important warnings (full flag browser opens itself when filtered); Methodology has a four-card summary with sections as disclosures (ids kept); Modeling, Evidence, Literature, Media, Similar and Compare have shorter leads and secondary controls on request |
| M7 Verification and delivery | DONE | See below |

Density, visible words at 1440 px before → after (`docs/ux-audit-before-1440.json`, `docs/ux-audit-after-1440.json`):
Home 2047 → 483, flame-extinction 2875 → 784, flame-spread 5268 → 730, spacecraft-fire 1789 → 645, experiments 704 → 311,
experiment detail 610 → 228, reliability 2104 → 392, methodology 1662 → 377, evidence 590 → 84, modeling 479 → 216.
Visible numbers on flame-spread 1961 → 53, Home 200 → 21. A 390 px run is in `docs/ux-audit-after-390.json`.

### Phase 8 verification (2026-11-12)
- `tsc --noEmit` clean; `eslint .` clean; `next build` OK (18 routes).
- Playwright on the production build, model disabled: **74 passed, 1 skipped** (opt-in live Gemini, not run).
  New: `e2e/phase8.spec.ts` (11): Home naming, accessible and state-preserving disclosures, deep links into
  disclosures (including content that loads later), visible scientific warnings, takeaways, Explorer columns and filters
  in the URL, experiment key values, answer-first Copilot (mocked stream), reliability top warnings, example questions
  that send no request, and a density budget for seven pages.
- Updated tests (intent unchanged, they now open the relevant section first via `e2e/helpers.ts` `openSection`):
  `journeys` (counts asserted from `/api/v1/investigations`, the FLEX chart on its page; provenance, flags, values,
  report, pages, d², endpoints, manifest, timeline, metrics), `phase2` (deep links `#spread`, `#outcomes`; report and
  pages), `phase3` (nav "Home"; the Mission Control story test became a calm-Home test; reduced motion without counters;
  conditions inside the map), `phase4` ("How this answer was built" before the trace; methodology citations and AI),
  `phase5` (Home hero and credited cards; gallery "More filters"), `phase7` (Home link, "3D model" nav item, fuel
  coverage and display settings on request, literature, map section), `mobile` (Home heading).
- Bug found and fixed during testing: the Explorer sent its view-only `cols` URL key to the API (400).
- Backend `pytest`: **181 passed**. Smoke checks: 7 pages 200, `/lab` 307, 5 API endpoints 200.
- No horizontal overflow on 15 pages at 390 px and 768 px; screenshots reviewed at 1440, 768 and 390 px.

### Phase 8 known limitations
- The audit measures density, not comprehension; no study with real users was run.
- Opened research-level tables (BASS-II endpoints, SAFFIRE-I manifest, flag browser) remain dense by nature.
- The media gallery keeps captions and credits on every card (attribution is required).

## Phase 7 status (branch `feature/spacefire-phase7-premium-analysis`, 2026-11-12): COMPLETE
The Phase 6 lab is now integrated: each Scientific Analysis page opens with an **Interactive Science Studio**
(`#studio`), and the standalone `/lab` page and its sidebar item are gone (old URLs redirect with their context).
Frontend only: no backend, data, Gemini or verifier change. No Gemini request was made; the API ran with `LLM_API_KEY=`
blank (health `llm.mode = retrieval_only`) and the opt-in live test was not run. Design, semantics and limitations:
`docs/INTERACTIVE_SCIENTIFIC_ANALYSIS_V2.md`.

| Milestone | Status | Evidence |
|---|---|---|
| M1 Navigation and architecture | DONE | Studio embedded in `/phenomena/flame-extinction`, `/flame-spread` and `/spacecraft-fire`. Sidebar lab item removed. `/lab?scene=…` → 307 to the page, keeping `record`, `mode`, `component`. Mission Control band and experiment "Explore in 3D" link to `#studio` (with `record` and `mode=evidence`). `#footage` opens the SAFFIRE-I footage view. The FLEX map and BASS-II gas chart ring the studio's record |
| M2 FLEX | DONE | Fuel card sourced to FLEX ERD p.36 and Farouk & Dryer p.2. Soot only for sooting n-heptane. Per-fuel slider ranges computed from the CSV. Compare Fuels in one canvas (split viewports, shared camera) with condition matching and an honest verdict. Earth vs microgravity split with NASA imagery. Burn timeline (MDCA needles and igniters, regression, extinction) with play, pause, scrub, speed and restart; the recorded burn time is shown separately. Idealized d²-law calculation (D₀, K in mm²/s, stops at D₀²/K, consistency ratio from the backend). New vapour and oxygen layers |
| M3 BASS-II | DONE | Sample menu with CSV test counts. Opposed, concurrent and stagnation flow with streamlines. Flame-spread timeline ("Illustrative progression — not measured flame-front motion"), with Table 5.1 rates shown independently. Material comparison of two real tests (CSV, report tables with PDF pages, mismatches flagged, nominal-vs-actual widths kept), drawn side by side |
| M4 SAFFIRE-I | DONE | Five camera presets. Isolate, hide, exploded and cutaway views. S1/S2 recorded in the URL. 3D model / NASA footage (click-to-load) / Evidence & metadata views without remounting the canvas. Airflow layer |
| M5 Guided exploration | DONE | `lib/tours.ts` (FLEX 9, BASS-II 9, SAFFIRE-I 8 steps): camera focus, selection, one checked interaction per tour, sources, takeaway. Next, Back, Skip, Restart, Finish, progress, ←/→/Esc, focus on the step heading. Never calls the model |
| M6 UX and performance polish | DONE | Contextual labels (primary labels or the selection only). Smooth camera fly-to (instant under reduced motion). Alpha-preserving additive flame blending (removes a dark halo) and toned-down intensity. Collapsible inspector on mobile. Fewer particles. Each page loads only its own scene chunk; three.js is in no initial bundle |
| M7 Verification and delivery | DONE | See below |

### Phase 7 verification (2026-11-12)
- `tsc --noEmit` clean; `eslint .` clean; `next build` OK (18 routes; `/lab` is now a redirect).
- Playwright on the production build, model disabled: **63 passed, 1 skipped** (opt-in live Gemini, not run).
  New tests:
  - `e2e/phase7.spec.ts` (20): integrated studios, redirects, entry points and chart ring, camera, fuels, Compare Fuels,
    Earth vs microgravity, timeline, d²-law vs backend, layers, BASS-II material comparison and evidence, SAFFIRE-I
    presets, footage and data views, tours, Copilot hand-off with a bounded request, disposal, WebGL fallback, reduced
    motion, source links, conclusions and literature.
  - `e2e/studio-mobile.spec.ts`: 390 px on all three pages.

  The Phase 6 specs were superseded (assertions carried over). One Phase 3 locator was scoped to the conditions panel
  because the studio adds a second "Methanol" radio; intent unchanged.
- Backend `pytest`: **181 passed**. Smoke checks: 7 pages and 5 endpoints used by the studios return 200; the `/lab`
  redirects return 307 with the query preserved. three.js is in none of the initial chunks of `/` or a phenomenon
  page.
- Screenshots reviewed at 1440 px (all three studios, split views, timeline, tour), 768 px and 390 px (no horizontal
  overflow).

### Phase 7 known limitations
- Timelines are illustrative sequences on a normalized axis. The d²-law line is an idealized calculation, not a
  validated model; there is still no "Validated model" mode.
- Fuel and material comparisons use single tests; no ranking is drawn. Display tolerances are SpaceFire's choice.
- Frame rate was not profiled on a hardware GPU or a physical phone: browser tests run on SwiftShader.
- In `next dev`, Fast Refresh of a scene module while its labels are mounted can log drei `<Html>` unmount errors.
  This is development only; production E2E runs see no console errors.

## Phase 6 status (branch `feature/spacefire-phase6-interactive-3d`, 2026-11-12): COMPLETE
Interactive Combustion Lab at `/lab`: three interactive 3D scenes, each beside the real NASA records for its
investigation. Frontend only: no backend, data, Gemini or verifier change. No Gemini request was made; the API ran
with `LLM_API_KEY=` blank (health `llm.mode = retrieval_only`). Science, sources, trust model and limitations:
`docs/INTERACTIVE_3D_SCIENCE.md`.

| Milestone | Status | Evidence |
|---|---|---|
| M1 Foundation | DONE | three 0.187.0, @react-three/fiber 9.8.2, @react-three/drei 10.7.9 (exact pins; React 19.3 / Next 16.4 unchanged). Client-only viewport chunk (`next/dynamic`, `ssr: false`). One canvas shared by lazy scene chunks. Frame loop always / demand / never (off-screen, hidden tab). Adaptive DPR. Context-loss recovery. WebGL capability check with static fallback. Error boundary. Disposal registry `window.__spacefireLab` |
| M2 FLEX droplet (most polished) | DONE | Custom flame-shell shader with limb brightening. Smooth microgravity ↔ 1 g teardrop transition. Radial fuel-out / O₂-in transport vs buoyant updraft. Heptane soot shell. O₂ dot share. mm scale bar. Raycast picking of nested parts. Evidence mode: a real FLEX test drawn at measured D₀ and D_ext. Panel: K in mm²/s with raw header `Burning rate; mm`, flags, nearby real tests for the slider settings |
| M3 BASS-II flame spread | DONE | Documented 7.6 × 7.6 × 17 cm duct, fan + restrictors, honeycomb + screen, radiometer (downstream top back), igniter, 10 cm ruler. 5 sample geometries. Opposed / concurrent / stagnation flow. Illustrative front labelled "not a measured rate". Evidence: CSV record, Table 5.1/7.1 rows with PDF page, T24 width conflict and nominal-vs-actual widths kept |
| M4 SAFFIRE-I spacecraft | DONE | Conceptual enclosure (~0.5 × 1 × 1.3 m per NASA Glenn), duct with the 0.4 × 0.94 m card, fans top / straighteners bottom, 2 cameras, diagnostics. Cutaway and exploded views, selectable components. S1/S2 direction from the CSV. SAF-LENGTH-WIDTH and other flags in the evidence table. NASA animation plays only on request |
| M5 Integration | DONE | Nav entry (Discover). Mission Control "Interactive Combustion Lab" band. Entry cards on the 3 phenomenon pages. "View in 3D lab" on burn-record pages (evidence mode). "Ask AI about this": Copilot `?draft=` pre-fills without sending, `inv` pre-selects the investigation, and a context note explains what will be sent (existing `?q=` links keep asking immediately) |
| M6 Performance, a11y, polish | DONE | Keyboard camera (arrows, ±, 0), labelled camera toolbar, radio-group scene selector, tablist panels, every component as a button, text alternatives, reduced motion (motion off, on-demand rendering), static view, mobile layout (viewport first, compact selector), aspect-aware camera framing. three.js is in no initial page bundle (checked on `/`, a phenomenon page and `/lab`); the 3D chunk is 912 KB raw / 239 KB gzip, fetched only when the lab viewport mounts |
| M7 Regression + delivery | DONE | See below |

**Modes.** Two are offered: "Conceptual 3D" and "NASA Evidence". A third, "Validated model", is deliberately omitted:
the only quantitative droplet relation in SpaceFire is the d²-law consistency check, which is not validated to predict
a burn.

### Phase 6 verification (2026-11-12)
- `tsc --noEmit` clean; `eslint .` clean; `next build` OK (19 routes, new `/lab`); `npm audit --omit=dev`: 0
  vulnerabilities.
- Playwright on the production build, model disabled: **56 passed, 1 skipped** (opt-in live Gemini). New tests:
  - `e2e/phase6.spec.ts`, 13 tests: lazy single-scene load; camera drag, keys, buttons and reset; one canvas across
    scene switches and control changes; selection by 3D click, 3D label and keyboard; FLEX K = API value in mm²/s
    with the raw header; BASS-II report values and discrepancies; SAFFIRE-I flags and no autoplay; source links;
    Copilot draft with no auto-send and a bounded request body; renderer disposal after leaving; no-WebGL fallback;
    reduced motion and static view; all entry points.
  - `e2e/lab-mobile.spec.ts`: Pixel 7, 390 px.
- Backend `pytest`: **181 passed**. API smoke: lab, phenomenon, detail, Copilot and media pages, plus the 5 endpoints
  the lab calls, all HTTP 200.
- Screenshots reviewed at 1440, 768 and 390 px for each scene, evidence mode and the Copilot hand-off. No console
  errors in the production E2E runs; the dev server shows R3F's own `THREE.Clock` deprecation warning only.

### Phase 6 known limitations
- The 3D views are illustrations, not simulations. Flame standoff, teardrop shape, soot shell, flame-front speed and
  particle speeds are not computed from data.
- SAFFIRE-I geometry beyond the documented features is assumed; the ignition location is not drawn (not in the local
  data).
- In `next dev`, Fast Refresh of a scene module while its labels are mounted logs React "synchronously unmount a root"
  / `removeChild` errors from drei `<Html>`. This is development only; normal navigation, scene switches and label
  toggles produce no console errors (asserted in the E2E tests).
- WebGL tests run on SwiftShader (software rendering). Frame rate was not profiled on a hardware GPU or on a physical phone.

## Final Gemini validation (on Phase 5, 2026-11-11, 10:20–10:30 UTC): COMPLETE
This closes the live checks Phase 4 left pending. They ran on branch `feature/spacefire-phase5-scientific-visuals`,
on top of 8b6dea0. Full report: `docs/LIVE_LLM_EVALUATION_RUN_B.md`.

| Check | Result |
|---|---|
| FLEX K unit (g02, g27) | Both **answered** on the first attempt and state K in **mm²/s**, naming the raw header 'Burning rate; mm'. No statement gives K in any other unit |
| Live sample (g22, g31, g29) | g22 and g31 answered; every number matches the database or analytics service. g29 first returned `insufficient_evidence` because of a retrieval gap (below); after the fix it answered |
| Citations and numbers | 5/5 answered, 18 claims, 0 rejected, 0 structural issues. Every stated value was checked by hand against `flex_tests`, `bass2_tests`, report Tables 5.1/A.5, `analytics.bass_gases`, `saffire_manifest` and `investigation_publications` |
| Reasoning review | Sound overall. Two wording weaknesses recorded: g22 opens with "Yes" although the thin-film slope (0.42) does not support it; g27 gives M5's width from Table 5.1 (2.2 cm) without noting that the CSV reads 2 cm |
| Live browser test | `E2E_LIVE_LLM=1 npx playwright test -g "live Gemini"`: **1 passed** (31 s, production build). The streamed step "Write answer with the model", the Answered status, "Written by gemini" and citation markers all appeared. The server log shows that verification rejected 1 statement and the model regenerated once; the final answer has 4 DOC claims citing 6 NASA document passages |
| Gemini usage | 8 requests (plus one automatic SDK retry after an HTTP 503), no 429, free tier, billing untouched |

**Retrieval fix (g29).** "Which publications cover SAFFIRE large scale flame spread?" got only external search hits and
concluded that no paper specifically covers it. SpaceFire's own NASA PSI metadata, however, lists 6 SAFFIRE publications,
including Urban et al., *Flame spread: Effects of microgravity and scale*.
- Backend: literature questions that name an investigation now receive NASA PSI's publication list for it as a
  `publication_list` evidence item, in every source scope (`backend/app/services/assistant.py`).
- Prompt: the system prompt says these titles are metadata only, so the model infers a paper's topic from its title and
  says so.
- Frontend: a "NASA pub. list" source badge and a progress-step label (`ui.tsx`, `AssistantView.tsx`).
- Tests: golden g29 now requires the item and the Urban et al. title.

Re-run live: answered, citing the 3 most relevant titles with DOIs, all matching the database.

Regression after the fix: backend `pytest` **181 passed**; `tsc --noEmit` and `eslint` (changed files) clean; `next build`
OK. Servers were started one at a time for the browser test and stopped afterwards. NASA source files are unchanged.

## Phase 5 status (branch `feature/spacefire-phase5-scientific-visuals`, 2026-11-11): COMPLETE
Real NASA scientific media woven into the existing experience. Frontend only: backend, data, Gemini integration and
verification are unchanged. No Gemini request was made during Phase 5.

| Milestone | Status | Evidence |
|---|---|---|
| M1 Media research + provenance registry | DONE | `frontend/lib/scientific-media.ts`: 15 items (FLEX, BASS-II, SAFFIRE-I + related CFI-G, FLEX-2, BASS (I), SoFIE). Each has source URL, credit, date, NASA ID, relation (real experimental / related / illustration), relation reason, alt text and caveat. Metadata from the NASA Image and Video Library API, nasa.gov / science.nasa.gov captions and Wikimedia Commons; all 14 source URLs returned HTTP 200. No item claims a test ID |
| M2 Acquisition + optimization | DONE | WebP 480/960/1600 px with explicit dimensions; Saffire-I GIF 12.9 MB → 756 KB animated WebP (all 574 frames); 1.6 MB silent NASA clip; 3.0 MB total. Rejected: a lab photo with the NASA insignia as a print element, Saffire-II/V/VI media, a Cygnus record whose date and caption disagree (`docs/SCIENTIFIC_MEDIA_SOURCES.md`) |
| M3 Mission Control | DONE | Full-bleed hero with a real BASS-II flame (fade, glow and star field labelled decorative); each of the 4 physics steps paired with matching NASA media (document citations kept); three-scales cards with investigation imagery; context image on the lead finding; new "Recorded in orbit" band; no image repeats on the page |
| M4 Phenomenon pages | DONE | Real media as header art on all three pages; "Seen in orbit" panels show real media and a labelled schematic side by side. SAFFIRE-I: NASA burn animation (plays only on request), click-to-load NASA YouTube video (youtube-nocookie), hardware photos; the callout now separates NASA's public footage from the local manifest (no frame reconstructed) |
| M5 Experiment + Evidence media | DONE | Detail pages show an investigation-level **apparatus** photo with "It does not show test {ID}". New `/evidence/media` gallery tab (filters: phenomenon, investigation, type, relation; URL-synced; accessible `<dialog>` lightbox with full provenance) |
| M6 Visual polish + motion | DONE | Mask reveals, hover depth and scroll zoom only with rich motion (off for reduced motion and narrow screens); opaque badges on bright photos; no autoplay, no audio, no video backgrounds |
| M7 Validation | DONE | See below |

Photo-to-test analysis: NASA's BASS-II captions give session days but no test numbers. One possible match (iss040e072900 ↔ M10)
contradicts NASA's own caption day, and one session day (214) has no CSV test, so no image is attached to a test.

### Phase 5 verification (2026-11-11)
- Frontend: `tsc --noEmit` clean; `eslint .` clean; `next build` OK (18 routes, new `/evidence/media`).
- Playwright on the production build (model disabled): **42 passed, 1 skipped** (opt-in live Gemini). Includes 7 new
  Phase 5 tests:
  - every registry file is served and every item fully attributed;
  - every image decodes with reserved size, and every media figure links its source;
  - lightbox: keyboard open, focus on Close, Esc closes, focus returns;
  - gallery filters;
  - no YouTube request and no animation before a click;
  - the detail-page disclaimer;
  - reduced motion.

  Two Phase 1/3 assertions were reworded with unchanged intent: the SAFFIRE callout text, and the hero label check (the
  hero is now labelled real media).
- Route sweep: 18 routes × 1440/768/390 px: 0 console errors, 0 failed API or media requests, 0 horizontal overflow.
  Mission Control CLS 0.024.
- Backend `pytest`: 181 passed (unchanged code). API smoke test: 7/7 passed. NASA source files unchanged.

## Phase 4 status (branch `feature/spacefire-phase4-gemini`, 2026-11-11): COMPLETE (live checks closed on the Phase 5 branch, see above)
Gemini-backed Research Copilot with code-verified citations and units, streamed progress, quota protection, reviewed
citation links, BASS-II report cross-checks and a redesigned Methodology page. NASA source files unchanged.

**Previously pending, now done:** the live confirmation of the FLEX unit correction (g02, g27), a live sample across
BASS-II, SAFFIRE-I and external literature, and the opt-in live browser test. They waited for the free-tier quota to reset
(probe at 06:54 UTC: HTTP 429) and passed at 10:20–10:30 UTC; see "Final Gemini validation" above.

| Item | Status | Evidence |
|---|---|---|
| 1 Gemini provider | DONE | `GeminiProvider` (`backend/app/providers/llm.py`) on `google-genai==3.1.0`: JSON-schema output, thinking level, header auth, 2 retries on 5xx. 25 adapter tests with a fake SDK client and real SDK error objects |
| 2–3 Copilot + RAG with real answers | DONE; live revalidation DONE (Run B) | Pre-flight: key valid; `gemini-2.5-flash` 404 for new users → `gemini-3.8-flash`. Live (before the unit fix): 15 golden questions, 13 synthesized, all 35 claims cited and number-verified, every cited record resolves; 2 HTTP 503 fell back to evidence. Manual review: 2 answers (g02, g27) stated FLEX K as "mm" instead of mm²/s; reasoning review in `docs/LIVE_LLM_EVALUATION.md` |
| 2a FLEX unit correction (FLEX-UNIT-K) | DONE; confirmed live (g02, g27 state mm²/s) | Column rules travel with experiment evidence (raw header unchanged); prompt rule; **verifier `UNIT_RULES`** rejects K stated in any unit but mm²/s, regenerates once, then removes the statement and withholds the prose. Same path for `/ask` and `/ask/stream`. 11 regression tests, including the literal g02/g27 live outputs; applied retroactively, it flags exactly those statements |
| 4–5 Fallback and error handling | DONE | 429 (per-minute/daily, retry delay parsed), 401/403/invalid key, 404, 408/504/timeouts, 5xx, transport errors, refusals/safety blocks, MAX_TOKENS, empty/non-JSON/non-object output → typed `LLMError` → evidence-only answer with the reason. Quota circuit breaker pauses synthesis until the provider's reset; verified-answer cache (key = model + prompt + full evidence pack) |
| 6 28 unreviewed citation links | DONE | All reviewed against Appendix A (run #, sample, GMT day): 20 own rows, 5 figure captions, 3 cross-references (`backend/app/curation/link_reviews.json`), applied at ingest as `manually_reviewed`; 0 `auto_unreviewed` remain; stale-review detection |
| 7 Methodology redesign | DONE | `/methodology`: pipeline, provenance, AI answers, citation-link confidence, safeguards, limitations, sources; live figures from new `GET /api/v1/methodology` |
| 8 Copilot tool progress | DONE | `POST /api/v1/assistant/ask/stream` (NDJSON): `tool_start`/`tool_end` per tool and model call; verified live through the Next proxy with Gemini (events arrive at 0.03 s, 1.6 s, 2.1 s, 6.4 s, not batched). In the browser the live steps and the quota fallback were seen; a live synthesized answer in the browser passed in the final validation |
| 9 BASS-II limitations / report-only values | DONE | `app/curation/report_consistency.py`: thickness 20/20 agree; width 46/47 (T24 conflict flagged); velocity 28/47 consistent with Air display → new rule `BASS-AIR-DISPLAY-NOT-VELOCITY`; flow direction for T1/T2/T4/T15 from the Table 7.1 title. Shown on the flame-spread page (`#report-trust`) |
| 10 Phase 3 preserved | DONE | All 29 Phase 1–3 E2E tests pass unchanged |
| 11 Validation | DONE (live checks in Run B) | See "Phase 4 verification" |
| 12 Credentials | DONE | Key never in source, logs, API responses or bundle; staged diffs scanned before each commit (configured key and generic key patterns: none); `.env` never committed |

### Phase 4 verification
Final run (2026-11-11, ~07:00 UTC, after the unit guard):
- Backend `pytest`: **181 passed** (131 before Phase 4 + Gemini adapter, streaming, quota pause, cache, link reviews,
  report cross-checks, methodology, FLEX unit guard).
- Frontend: `tsc --noEmit` clean; `eslint .` clean. No frontend source changed after the 06:22 UTC production build, which
  was reused instead of rebuilt (memory pressure).
- API smoke test (`scripts/smoke_test.py`): 7/7 passed.
- Playwright on the production build, model disabled for determinism: **35 passed, 1 skipped** (opt-in live test,
  blocked by quota).
- Security: `.env` ignored and untracked; the key is absent from the staged diff, all 285 blobs of git history, the
  `.next` bundle (1,499 files), `processed/`, logs and test output. Provider errors are mapped to fixed messages that
  never include the key.
- NASA sources: all 28 dataset files, 2 zips and 17 research files tracked by git and unmodified.

Earlier in the session (not rerun): `next build` OK (17 routes, 06:22 UTC); route sweep of 18 routes × 1440/768/390 px with
0 console errors, 0 failed API calls and 0 horizontal overflow.

### Phase 4 known limitations
1. Gemini free tier: **20 generation requests per day** for `gemini-3.8-flash` (`GenerateRequestsPerDayPerProjectPerModel-FreeTier`,
   confirmed from the 429 body). A question costs 1–2 requests. The full 42-question golden suite cannot run live in one day;
   it runs on every `pytest` with a fake model, and live runs cover subsets.
2. The quota pause is held in process memory; after an API restart the first request re-discovers it (one 429, no cost).
3. The verifier checks citations and numbers, not reasoning.
4. HTTP 503 "model overloaded" occurs on the free tier; after 2 SDK retries the answer falls back to evidence only.
5. A 429 can take 20–125 s to arrive, so the first question after the quota runs out is slow; later ones are instant.
6. The unit rule covers the documented FLEX-UNIT-K correction. A K value written without any unit is not rejected.
7. Live revalidation of the unit fix and a live answer in the browser: done (`docs/LIVE_LLM_EVALUATION_RUN_B.md`).

## Phase 3 status (branch `feature/spacefire-phase3-ui-motion`, 2026-11-11)
Cinematic product redesign of the frontend only; backend, data, API contracts and NASA files are unchanged.

| Milestone | Status | Notes |
|---|---|---|
| M1 IA + design system + motion system | DONE | Navigation grouped as Discover / Scientific analysis / Research intelligence / Trust & methods. Pages renamed by phenomenon; NASA investigations shown as source badges. Old URLs redirect (`next.config.ts` → `LEGACY_REDIRECTS`, mirrored in `lib/routes.ts`). Motion: `components/motion.tsx` (Motion 14.7.1: reveals, stagger, word reveal, parallax, count-up, off-screen pause), React `<ViewTransition>` page transitions, CSS tokens in `app/globals.css`; reduced motion respected |
| M2 Mission Control | DONE | Hero (labelled illustration, parallax, live counts), scroll story with 4 cited NASA passages, three-scales section, recomputed findings, interactive FLEX preview, workflow tabs, Copilot band |
| M3 Phenomenon pages | DONE | Flame Extinction & Burning Dynamics (FLEX), Flame Spread & Material Behavior (BASS-II), Spacecraft Fire Dynamics (SAFFIRE-I): phenomenon headers with computed facts, condition consoles, outcome bars, airflow schematics from CSV fields, fixed SAFFIRE timeline bar widths |
| M4 Research / exploration pages | DONE | Research Copilot (source segmented control, phenomenon toggles, evidence-only mode banner, tool trace built from the real `tool_calls`, starter questions); Combustion Explorer (phenomenon-first dataset tabs, workflow strip); Experiment Intelligence hub (similar + compare tabs); Evidence & Literature hub (documents + external literature tabs); Prediction & Modeling (model card, interval figure for estimates); Data Reliability (rows-with-flags per investigation, review status, problem categories linked to filters); experiment detail headers with phenomenon kicker + source badge; chart refresh pulse (opacity only) |
| M5 Validation | DONE | Backend `pytest` 131 passed; `tsc` and `eslint .` clean; `next build` OK (17 routes); API smoke 7/7; Playwright on the production build 28/28 (27 desktop incl. 6 Phase 3 tests, 1 mobile sweeping 10 routes); 26-route sweep at 1440/768/390 px: 0 console errors, 0 horizontal overflow; Mission Control CLS 0.012; view transition fires on navigation and Back works; reduced-motion test: counters show final values and ambient loops stop; NASA files: 49/50 baseline hashes match (only README.md differs, intentionally since Phase 2) |

Phase 3 known limitations: page transitions animate only in browsers with the View Transitions API (others swap instantly);
the physics-story figures and phenomenon art are schematics, labelled as such; Copilot tool trace appears when the
response arrives (the backend does not stream per-tool progress); LLM synthesis still deferred.

Route map (old → new): `/assistant` → `/copilot`; `/physics/flex` → `/phenomena/flame-extinction`; `/physics/bass-ii` → `/phenomena/flame-spread`;
`/physics/saffire-i` → `/phenomena/spacecraft-fire`; `/similar` → `/intelligence/similar`; `/compare` → `/intelligence/compare`;
`/research` → `/evidence/literature`; `/ml/flex` → `/modeling`; `/quality` → `/reliability`. Unchanged: `/`, `/experiments`, `/experiments/{dataset}/{uid}`, `/evidence`, `/methodology`.

## Phase 2 status (branch `feature/spacefire-phase2`, 2026-11-11)
| Priority | Status | Evidence |
|---|---|---|
| P1 GitHub sync | DONE | Commits `ad46fbe` (checkpoint), `7e1ecc4`, `315547e`, `ce0d5e7`, plus final regression commit; all pushed, no force-push |
| P2 BASS-II report curation | DONE | `app/curation/bass_report.py` → `processed/curated/*.json` (committed, reproducibility-tested). Table 5.1: 20/20 rows verified vs CSV; Table 7.1: 27/27 BASS-II rows verified + 4 BASS (I) rows kept unlinked; Appendix A: 123/126 verified, 3 genuine report-vs-CSV conflicts (F3, P3a, P22b) flagged; flow direction for 117 tests; 126-vs-129 explained (O20–O22 absent). Shown in detail pages, BASS-II lab (spread-rate chart, SIBAL outcomes), Explorer filter, assistant evidence |
| P3 Citation reliability | DONE | `app/ingest/linking.py`: verified_table_row / exact_context / auto_unreviewed; excludes ambiguous tokens (O2 = oxygen, F2 = SD card), GMT collisions with BASS (I), Table/Figure labels; badges in UI; slides no longer cited as "PDF p." |
| P4 UI refinement | DONE (incremental redesign) | Icons, breadcrumbs, status pills, section navs, filter chips, metric band, scale ladder, citation-type tabs, severity chart, error/empty states; 25-route sweep with 0 console errors, 0 horizontal overflow |
| P5 Retrieval | DONE | 30-question benchmark (`docs/RETRIEVAL_EVALUATION.md`): BM25+LSA R@5 0.767 / nDCG 0.555; BM25+bge-small R@5 0.800 / nDCG 0.566 (within noise) → LSA stays default, neural opt-in via `RETRIEVAL_DENSE`; NASA-PSI-listed badge on external papers |
| P6 Regression | DONE | See "Verification results" |

## Current milestone
**M7 — End-to-end validation: complete.** All P0 and P1 features are implemented and verified; P2 (FLEX ML) is implemented behind a validation gate.
Phase 2 work is committed and pushed to `feature/spacefire-phase2` (main untouched).

## How to run
`scripts/setup.ps1` then `scripts/start.ps1` (Windows) or `scripts/setup.sh` / `scripts/start.sh`. UI http://localhost:3000, API http://127.0.0.1:8000/docs.

## Feature status (evidence = command actually run this session)
| ID | Feature | Status | Evidence |
|---|---|---|---|
| F12 | Overview | **DONE** | Counts from `/overview` (274/129/2); 5 computed insights with citations; fuel filter re-queries chart (E2E) |
| F01 | AI assistant | **DONE (retrieval-only verified); live LLM PARTIAL** | 11 whitelisted tools, verifier, injection guard; 42 golden questions + verifier tests with fake LLM pass. No `LLM_API_KEY` in this environment, so live Anthropic synthesis was not exercised (by design the UI shows "Evidence only") |
| F02 | External research | **DONE** | Live: NTRS (12 hits) and OpenAlex (53 hits) for "Saffire spacecraft fire flame spread"; Crossref verified DOI 10.1016/j.combustflame.2018.10.012; OpenAlex related works (12 refs, 7 related); offline → stale cache / unavailable message (tests + E2E) |
| F03 | Explorer & detail | **DONE** | All 405 burn rows; 193F001 → flex:70 / flex:73; BASS GMT shown as day-of-year; SAFFIRE image sets not burns; CSV export normalized/original |
| F04 | Compare | **DONE** | Same-investigation deltas/chart; FLEX+BASS shows qualitative mode with no chart (E2E) |
| F05 | Evidence explorer | **DONE** | `M5`, `BASS-II Table 5.1` (PDF p.65 / printed p.57), `FLEX d²-law`, `SIBAL` all return expected docs with pages; snippets verbatim (tests) |
| F06 | FLEX lab | **DONE** | Extinction map (n=262/274), outcome-by-O₂ table, d²-law check n=183, median 1.048, exclusions listed |
| F07 | BASS-II lab | **DONE** | ΔCO₂/O₂ slope 0.810 (n=66) vs 5/6; 5 unphysical rows excluded; raw `OR`/`>500`/`none` shown verbatim |
| F08 | SAFFIRE-I | **DONE** | S1/S2 table; manifest timeline (10/30/60 s bins) + CSV export; F2 conflict flagged; no media fabricated |
| F09 | Similar | **DONE** | Deterministic Gower on inputs only, per-field breakdown; SAFFIRE returns "not meaningful (n=2)" |
| F10 | Data quality | **DONE** | 554 flags, 34 rules, file/row/column/raw value; CSV export; links to records (E2E) |
| F11 | FLEX ML (P2) | **DONE (exploratory)** | GroupKFold(5), 71 groups; Ridge −29.8 % MAE(log) vs dummy → gate passed; OOD refusal; classification evaluation-only |

## Verification results (Phase 2 final run)
- Backend: `pytest` → **131 passed** (unit, providers mocked, API, 42 golden questions, curation/linking validation, retrieval benchmark guard, citation integrity).
- Frontend: `npx tsc --noEmit` clean; `npx eslint .` clean; `npx next build` succeeds (17 routes).
- E2E: `npx playwright test` → **22 passed** (21 desktop journeys + 1 mobile 390 px).
- Smoke: `scripts/smoke_test.py` all pass. Route sweep: 25 routes, 0 console errors, 0 failed API calls (except the intentional 404 test), 0 horizontal overflow.
- Source integrity: original NASA datasets, research reports and specs unchanged (SHA-256 baseline + `git diff` on tracked dataset paths).

## Known issues / limitations
1. Live LLM synthesis intentionally not integrated in Phase 2 (deferred by the user); assistant runs evidence-only.
2. Curated report values are verified only where the CSV offers a cross-check (IDs, gases); report-only fields (spread rates, flow direction, observations) are faithful transcriptions of the printed page, not independently re-measured. Figures in the report (plots) are not digitized.
3. 28 `auto_unreviewed` ID links remain (bare mentions); they are labelled as such.
4. Neural retrieval is optional and not the default (benchmark difference within noise).
5. External providers: NTRS can return duplicate records without DOIs (not merged, by design: dedupe is DOI-exact). OpenAlex works without a key on a shared daily budget; set `OPENALEX_API_KEY` for heavier use.
6. Optional Docker Compose not provided.

## Next actions (if continuing)
- Phase 3: LLM provider integration (deferred), then run the golden suite with live synthesis and review manually.
- Open a PR from `feature/spacefire-phase2` into `main` after review.
- Optional: digitize report figures, Semantic Scholar/arXiv adapters, Docker.
