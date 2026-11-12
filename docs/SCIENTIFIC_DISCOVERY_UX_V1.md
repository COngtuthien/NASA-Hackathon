# Scientific Discovery UX v1 (Phase 9)

Branch `feature/spacefire-phase9-discovery-experience`, from Phase 8 (`efc3e92`). Frontend only: no backend, data,
algorithm, quality-flag, Gemini or verifier change. No Gemini request was made while building or testing it.

## 1. UX objectives

A first-time visitor should be able to understand what SpaceFire is about, pick a phenomenon, use its 3D model, see
one meaningful concept, check the model against real NASA evidence, open a real test, draft a question for the
Research Copilot and reach the full sources when they want them. Technical readers keep every value, unit, flag and
citation. Phase 8's progressive disclosure is preserved: every Phase 9 addition is either a link, a compact card that
appears only on request, or a replacement for a longer element. Visible words per page stay inside the Phase 8 density
budget (section 11).

## 2. Discovery journey ("Discover SpaceFire")

An optional, seven-step journey through the existing pages. It is not a separate experience: it reuses Home, the three
studios, the NASA comparison and the Copilot, and it never starts on its own.

| Step | Where | What the visitor does |
|---|---|---|
| 1 Welcome | Home hero: "Why does fire behave differently in space?" with a real BASS-II flame | **Start exploring** or **Explore on my own** |
| 2 Choose | Home, three phenomenon cards (image + one question) | Pick droplet flames, flame spread or spacecraft fire |
| 3 Explore the model | The phenomenon's studio | Rotate, zoom, select a part (or "Select … for me") |
| 4 One interaction | Studio | FLEX: Earth vs microgravity. BASS-II: opposed vs concurrent flow. SAFFIRE-I: cutaway, select the sample |
| 5 NASA evidence | Studio, "Compare with NASA" view | Pick a test (or "Use an example test"); read what is conceptual and what is measured |
| 6 Ask | Copilot with a drafted, investigation-specific question | Edit, then press Ask; nothing is sent before |
| 7 Continue | Copilot page | Return Home, explore another phenomenon, open the detailed measurements, or end |

Design:
- **State is the URL** (`journey`, `topic`): back/forward, reload and deep links work; no account, storage or new
  global state. Ending the journey removes the parameters and keeps everything else (selected test, mode).
- **Inline card, never an overlay** (`components/journey.tsx`): it sits above the studio controls and never covers the
  3D scene. Progress is a labelled `progressbar` ("Step n of 7") plus text; Back, Next and "End the journey" are
  buttons; Escape ends the journey; focus moves to the step heading when the step changes.
- **Tasks are optional**: each studio step names one task and offers a "do it for me" button, so it also works
  without a mouse, without WebGL (static fallback) and on touch screens. Next is never blocked.
- **Same-page steps keep context**: moving between studio steps merges the URL instead of replacing it, so the selected
  test and the visitor's Conceptual / NASA Evidence choice survive.
- **No model calls**: step 6 links with `draft=` (never `q=`, which asks immediately). Tests count assistant requests
  and require zero.
- Copy lives in `lib/journey.ts` (one or two sentences per step).

## 3. Smart scientific notices

`components/scientific-notice.tsx` with data in `lib/scientific-notices.ts`. Each notice is a `role="note"` with a
severity label in text (not colour alone), a short summary and **one visible sentence that names the actual issue**,
so the collapsed notice is still truthful. "Show the details" (`aria-expanded`/`aria-controls`) opens:

- a table of the original source value vs how SpaceFire shows it, with where each comes from;
- why it matters and which calculations or comparisons it affects;
- the quality-flag rules (linked to the filtered flag browser) and document sources.

| Investigation | Summary | Always-visible sentence |
|---|---|---|
| FLEX | Two FLEX source headers require scientific interpretation. | Burning rate K is labelled ‘mm’ but read as mm²/s, and the CO₂ column is headed ‘CO’; values are interpreted, never altered. |
| BASS-II | Some sample dimensions differ between NASA sources. | The CSV gives nominal widths (1 or 2 cm); the report tables give actual widths (1.2 or 2.2 cm). Both are kept, never reconciled. |
| SAFFIRE-I | Some experimental measurements are unavailable in the local dataset. | The local files hold two burn rows and an image manifest; flame-spread rates, temperatures, gas histories and image pixels are not included, so no manifest frame is shown or reconstructed. |

**Contextual warnings are separate and never collapsed.** `lib/record-facts.ts` returns a test's key values together
with the warnings that affect them, and `components/record-facts.tsx` shows them next to the values:
- FLEX K is always shown as `… mm²/s` with "source header ‘Burning rate; mm’, read as mm²/s (FLEX-UNIT-K)"; a CO₂
  diluent notes that the header reads ‘CO’.
- BASS-II: when a test's CSV width differs from a report-table width, a warning states both (e.g. M7: "1 cm in the CSV
  (nominal) and 1.2 cm in Table 5.1 (PDF p.65)"). T24's report conflict appears as its flag.
- Every warning- or critical-severity flag of the selected test is listed with its rule.

Severities and flag texts are read from the stored data; nothing was reclassified to reduce clutter. Notices open on
their own when the URL hash names them (`#notice-flex`, `#notice-bass`, `#notice-saffire`).

## 4. Visual evidence comparison

A fourth studio view, **Compare with NASA** (`view=nasa`), on all three Scientific Analysis pages
(`components/studio/EvidenceCompare.tsx`, `lib/evidence-compare.ts`):

- Left: the live 3D model, labelled "3D conceptual model", with its existing "Conceptual visualization — not measured
  NASA output" banner. It is the **same canvas** (no second WebGL context); the panel only changes the layout, so the
  scene never remounts. On wide screens the model and the evidence share the width and the model stays in view; on
  narrow screens they stack.
- Right: "NASA experiment image": verified registry media of the same investigation, a media switch (radio group),
  a caption that says how the image relates to the current selection, the credit, "Open the original NASA source", the
  selected test's recorded values with their warnings (section 3), "What differs between the model and the evidence"
  (on request) and one drafted Copilot question about the image.
- Video and animation load only when the visitor presses play (lightbox players from Phase 5); nothing autoplays.

## 5. Media provenance rules

- Only registry media with `relation: "experimental"` and the **same investigation** are offered: FLEX → FLEX,
  BASS-II → BASS-II, SAFFIRE-I → SAFFIRE-I. BASS (I) media (`bass1-flame-2013`, `bass-iss40-20140627`) and related
  experiments (CFI-G, SoFIE, FLEX-2 apparatus) are never offered in the comparison. Unit-tested.
- No NASA caption names a test number, so every caption states the relation instead of implying one:
  "A real BASS-II slab flame, the same sample type as test M7; not a photo of that test."
- When the selection has no matching verified image the comparison says so: a methanol FLEX test gets "Shows an
  n-heptane droplet … no verified NASA image names a methanol FLEX droplet" and the fuel-neutral 1 g vs µg image comes
  first; a BASS-II sphere or film test gets "Investigation-level image … which has no verified NASA photograph here."
- SAFFIRE-I hardware photos are labelled "hardware context, no flame"; the footage is NASA's published selection of
  frames, and the comparison repeats that the manifest has no pixels and nothing in 3D is reconstructed from it.
- No new media were added and nothing was scraped.

## 6. Chart-to-record connections

Charts whose points are individual tests select a test into the existing `record` URL parameter instead of leaving the
page. The same parameter already drives the studio's NASA evidence panel and the chart rings, so one selection is
reflected everywhere and stays deep-linkable (`?record=flex%3A180#map`).

| Chart | Points | On click |
|---|---|---|
| FLEX extinction map (`#map`) | one FLEX test each | select + spotlight + ring |
| FLEX d²-law check (`#d2`) | included tests | select + spotlight + ring |
| FLEX extinction diameter vs O₂ (`#ratio`) | extinction tests | select + ring (spotlight in the map and d² sections) |
| BASS-II gas balance (`#gas`) | one test each | select + spotlight + ring |
| BASS-II report charts, SAFFIRE-I downlink timeline, outcome bands | aggregates or report rows | unchanged (no record mapping is invented) |

The **record spotlight** (`components/record-spotlight.tsx`) shows the test ID and investigation, its key values with
contextual warnings, "Open full record", "Explore in 3D" (keeps the visitor's Conceptual / NASA Evidence choice; the
studio never switches mode on a chart click) and one drafted question. A labelled `<select>` lists the plotted tests,
so keyboard and screen-reader users can choose any point. Record pages link back with "Show this test on the extinction
map / gas-balance chart". Record fetches are shared between the studio, spotlight and comparison through a small
in-page cache (`useCachedApi`), so the same record is not fetched twice.

Deep links to a chart (`?record=…#map`) no longer get pulled to the studio: the studio scrolls itself into view only
when no other section is targeted.

## 7. Contextual Research Copilot

`lib/copilot-suggestions.ts` + `components/ask-suggestions.tsx`. Suggestions appear on each Scientific Analysis page
(after the key findings), in the record spotlight, in the NASA comparison (about the shown image) and on record pages.
Every suggestion names its investigation, is under 300 characters, and opens the Copilot with `draft`, `inv`, `from`
and, for a selected test, `uid` only (conceptual 3D settings are never sent). The Copilot shows "Draft question only:
nothing has been sent … AI generation begins only when you press Ask."

AI availability is read from the shared, local `/health` result (one request per page, shared with the status bar; no
model call and no remote quota check). When AI writing is off or paused for the free-tier quota, the suggestions say
the visitor will get the evidence the Copilot finds instead, and the status bar shows "AI paused: evidence-only". The
API, retrieval and citation verification are unchanged; there is no second chat interface.

## 8. Glossary

`lib/glossary.ts` + `components/glossary.tsx`: microgravity, diffusion flame, flame extinction, flame spread, opposed
flow, concurrent flow, burning-rate constant (K), d²-law, soot, NASA Evidence, conceptual visualization. Each entry has
a plain-language definition (≤ 40 words), its caveat where one matters (K's ‘mm’ header, the d²-law being a
consistency check only, the visible flame vs cool flame, spread rates only from Table 5.1, a conceptual model not
being a simulation) and a local NASA source where one exists.

Terms are used sparingly (two to five per page): page leads, a finding, the extinction-map and d² summaries, the
studio's mode line. A term is a button (`aria-expanded`); its non-modal popover opens on click, tap, Enter or Space,
closes on Escape (focus returns to the term) or an outside click, and is positioned inside the viewport (16 px gutter;
positioned with `left`, so it never widens the page on mobile). The full list is a "Glossary" disclosure on
Methodology with an anchor per term (`/methodology#glossary-d2-law`).

## 9. Accessibility

- Semantic controls throughout: buttons with `aria-expanded`/`aria-controls` for notices, glossary and "what differs";
  radio groups for media choice; a labelled select as the keyboard path to chart points; `progressbar` for the journey.
- Visible text labels carry meaning (severity words, "Measured", "Experiment media", "3D conceptual model"); colour
  is never the only signal.
- Focus moves to the journey step heading; Escape ends the journey and closes popovers and lightboxes with focus
  return.
- Without WebGL the studio shows its static fallback and the journey, comparison and evidence all still work (tested).
- Reduced motion is respected by every existing animation; the new components add none.
- Touch targets for the new buttons are at least 36 px high (tested at 390 px).

## 10. Performance

- One WebGL context per page as before: the comparison reuses the studio canvas.
- New components are small client modules; three.js still loads only with the studio chunk.
- Videos and animations load on press only; YouTube loads only on play.
- Record and health requests are shared (`cachedFetch`).
- Charts drawn while their disclosure was closed now resize to their container (ResizeObserver + a width check after
  each draw), which also fixed a pre-existing case where a chart could overflow a 390 px screen after a deep link.
- Home stays a static page: the only part that reads the URL (journey card and card links) is isolated in its own
  Suspense boundary, with the normal cards as the static fallback.

## 11. Density (UX audit, 1440 px, visible words)

| Page | Before Phase 8 | Phase 8 | Phase 9 |
|---|---|---|---|
| Home | 2047 | 483 | 499 |
| Flame extinction (FLEX) | 2875 | 784 | 890 |
| Flame spread (BASS-II) | 5268 | 730 | 827 |
| Spacecraft fire (SAFFIRE-I) | 1789 | 645 | 728 |
| Experiment record flex:180 | 610 | 228 | 300 |
| Methodology | 1662 | 377 | 393 |

Source: `docs/ux-audit-before-1440.json`, `docs/ux-audit-after-1440.json`, `docs/ux-audit-phase9-1440.json`. The
increase is the questions box and the notice wording; all pages stay inside the Phase 8 density budget test.

## 12. Scientific safeguards (unchanged and re-tested)

- FLEX: K in mm²/s with the raw ‘mm’ header kept and shown next to every K value; no flame temperature or extinction
  threshold is inferred; the d²-law is a consistency check.
- BASS-II: nominal and actual widths both kept and shown; report vs CSV values distinguished; the flame-front animation
  stays "Illustrative progression — not measured flame-front motion"; spread rates come only from Table 5.1.
- SAFFIRE-I: manifest = metadata, not frames; nothing reconstructed; conceptual geometry labelled.
- No measurement, citation, media relation or flag severity was invented or changed; no NASA source file was touched.

## 13. Presentation mode (deferred)

A presentation mode (fullscreen studio, simplified controls) was considered and deferred. The journey and the
"Compare with NASA" view already give a guided, uncluttered demo path, and a second display mode would add a parallel
layout to every studio and risk hiding caveats. It can be added later as a user-gesture fullscreen toggle on the
studio viewport only.

## 14. Test results

Production build, backend with the model disabled (`llm.mode = retrieval_only`):

- `tsc --noEmit` clean, `eslint .` clean, `next build` OK.
- Playwright: **93 passed, 1 skipped** (the opt-in live Gemini test, not run). New:
  - `e2e/phase9-unit.spec.ts` (6 logic tests, no browser): journey transitions and hrefs, notice content, media
    provenance rules, suggestion links, glossary, record facts and warnings.
  - `e2e/phase9.spec.ts` (11): Home entry, full FLEX journey with zero assistant requests, Back/End/Escape, FLEX,
    BASS-II and SAFFIRE-I comparisons, chart selection shared with the studio and kept on reload, contextual drafts,
    smart notices by keyboard and deep link, glossary keyboard/outside-click/focus return, and the journey without
    WebGL.
  - `e2e/phase9-mobile.spec.ts` (2, 390 px): journey with touch, stacked comparison, spotlight and glossary popover
    without horizontal overflow.
- Backend `pytest`: **181 passed**. Smoke: 9 pages 200, `/lab` 307, 8 API endpoints 200.
- Overflow sweep at 390 and 768 px on 12 Phase 9 views: none. Production console on the new flows: no errors (only
  three.js's existing `THREE.Clock` deprecation warning).

## 15. Remaining limitations

- The journey covers one phenomenon per pass; "Explore another phenomenon" restarts it at step 3 for the next one.
- Plotly points are not keyboard-focusable themselves; the spotlight's select is the keyboard path.
- The comparison images are investigation-level; no verified image exists for some sample types (BASS-II spheres and
  thin films, methanol FLEX droplets), and the comparison says so instead of filling the gap.
- AI availability is the state at page load; a quota pause that starts later is shown by the Copilot itself.
- No study with real users was run; the density audit measures text, not comprehension.
