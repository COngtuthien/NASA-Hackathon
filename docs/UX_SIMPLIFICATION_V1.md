# SpaceFire AI — UX Simplification v1 (Phase 8)

Phase 8 is a product-wide UX refinement, not a feature phase. The principle: **show less first, reveal more on demand,
preserve everything important.** No scientific function, value, citation, warning or safeguard was removed. Some moved
behind a named, accessible disclosure; the warnings that change how data can be used stay visible.

---

## 1. Information architecture, before and after

| Area | Before (Phase 7) | After (Phase 8) |
|---|---|---|
| Home (`/`) | "Mission Control": hero with 4 counters, 4-step physics story with document quotes, three-scales cards with statistics, recomputed findings, media band, 3D band, FLEX preview chart, workflow tabs, Copilot band (~11.7k px tall) | **Home**: hero (1 headline, 1 sentence, 2 actions, NASA flame), three phenomenon cards (image, title, question, link), 3D studios teaser, Ask scientific AI (examples pre-fill only; "How it works" on demand), scientific trust (3 points + Methodology), footer (~4.3k px) |
| Sidebar | "Mission Control" first; NASA blurb at the bottom | "Home" first; the attribution moved to a site-wide footer |
| Header | Three status pills (data date, retrieval mode, AI mode), on a second row below 1536 px | One quiet indicator (data loaded, AI mode); retrieval mode and date in its tooltip; prominent pills only for problems (API offline, data missing) |
| Phenomenon pages | Header with 3 statistics; studio; media band; 5–8 always-open analysis panels; conclusions and limits; literature | Short introduction posed as one key question; studio; **Key findings** (takeaways with "Why we say this"); one visible data-quality notice; media; **Explore the data** (named disclosures, one per analysis); literature (disclosure) |
| Experiment detail | Provenance, full value table, report rows, document links, flags, dataset notes, publications, all open | **Key recorded values** (with units and provenance) and a visible notice for warning/critical flags; disclosures for all recorded values, report rows, document pages, flags, provenance, publications |
| Explorer | Workflow strip; header export buttons; every filter; every column | Dataset tabs; 2 primary filters plus "Show all filters" (auto-open when one is active); key columns plus "Show all columns" (`cols=all` in the URL); exports as quiet links under the table |
| Copilot | Status, tool-trace chips, answer, every claim, limitations, open source list, build details | Status; the answer; the first 3 supporting statements ("Show all N"); limitations (always visible); sources collapsed (opened by any citation marker, and open by default in evidence-only mode); the tool trace inside "How this answer was built" |
| Reliability | Investigation cards, completeness, status counts, categories, chart, flags list and rules, all open | Investigation cards; **Most important warnings** (every critical and warning rule, plain text, counts); statistics and the full flag browser in disclosures (the browser opens itself when the URL carries a filter) |
| Methodology | Seven long sections, all open | Four "at a glance" answers; the seven sections as disclosures under their original headings and anchors |
| Modeling | Model card, gate, metrics tables, leakage review, estimate form | Gate status (visible), estimate form first, a short model summary; full card, validation metrics and leakage review on request |
| Evidence / Literature / Media | Long technical leads; ranking notes on every hit; the full document list; all gallery filters; statistics row | One-sentence leads; "Why ranked here" per hit on request; document list collapsed; gallery shows phenomenon and relation filters ("More filters" for investigation and type); label legend collapsed |

Routes and deep links are unchanged. Old anchors (`#map`, `#d2`, `#ratio`, `#gas`, `#endpoints`, `#spread`,
`#outcomes`, `#report`, `#report-trust`, `#airflow`, `#compare`, `#timeline`, `#manifest`, `#sets`, `#flags`, `#rules`,
`#pipeline`, `#ai`, `#limits`, …) open their disclosure and scroll to it.

## 2. Home naming
- The page formerly called "Mission Control" is **Home** everywhere: sidebar, breadcrumbs, labels, footer, docs, tests.
  The route stays `/`; the brand stays SpaceFire AI.
- Hero: "Understanding Fire Beyond Earth" / "Explore how flames behave in space through real NASA experiments,
  interactive 3D models and an AI research assistant that cites its sources." Actions: "Explore the science" (to the
  three phenomena) and "Ask Research Copilot".
- The mission-control framing (counters, ops-style dashboard) was removed. Literal uses of "mission" in scientific text
  are untouched.

## 3. Progressive-disclosure conventions
Three levels, used consistently:
1. **Discover** (always visible): heading, one short explanation, media, takeaways, at most one or two meaningful values,
   one primary action.
2. **Explore** (on interaction): 3D controls, focused charts, comparisons. Disclosures at this level have a flame-accent
   button, for example "Explore the extinction map".
3. **Research details** (explicit request): full values, raw cells, tables, calculations, methods, citations,
   data-quality rules. Their button names the content, for example "Show raw and parsed values", "Show the report
   tables", "Show the limits". There are no generic "More" buttons.

Components (`frontend/components/disclosure.tsx`):
- `Disclosure`: a titled section with a summary that stays visible. The button carries `aria-expanded` and
  `aria-controls`, and the body uses `hidden`, so collapsed content is out of the accessibility tree but stays mounted:
  filters, selections and loaded data survive closing. It opens itself (and scrolls) when the URL hash targets it or
  anything inside it.
- `Takeaway`: a one-sentence finding with its provenance badge. "Why we say this" reveals the rationale, values,
  limits and sources.
- `MeasureGroup`: a compact grid of key recorded values (label, exact value with unit, provenance).
- `QualityNotice`: a visible, concise data-quality note with a specific link to the details.
- `ReadMore` and `SectionIntro`: short explanation with the rest on request; consistent section headings.
- `ScientificConclusions` / `LiteraturePanel` (`components/studio/ScienceSummary.tsx`): key findings as takeaways, page
  limits in a disclosure, the visible notice, and literature in a disclosure.

## 4. Design-system changes
- Body text 15.5 px / 1.6. Introductions 17 px with a 62-character measure. Section titles 22–26 px.
- Panels: lighter borders (`line/60`) and backgrounds (`panel/60`). The glowing gradient "feature" tone and decorative
  grids were removed from content panels. The studio frame lost its electric gradient.
- Fewer badges: per-investigation cards show only critical and warning counts (info as plain text), and the header
  status became text plus one dot.
- Colour use: flame for primary actions and explore-level disclosures, neutral for research-level ones, warn and crit
  only for real issues; data cyan and document violet provenance badges are unchanged.
- Motion: the hero keeps its word reveal, a lighter star field and a gentle parallax. Count-up counters, the
  scroll-indicator animation and the decorative glows were removed from Home. Reduced motion is still honoured
  everywhere.
- A site-wide footer (Explore / Research / Trust links and NASA attribution, with "Not an official NASA website").

## 5. Page-by-page improvements
- **Home**: from 11 sections to 5. Example questions open the Copilot pre-filled (`?draft=`); only typing a question
  and pressing Ask sends it.
- **Scientific Analysis (×3)**:
  - The introduction is one key question.
  - The studio copy was shortened (one-line control notes). Display settings (labels, transport, motion) sit in a
    closed group; the fuel card shows one fact, with "Fuel facts and sources" on request; per-fuel data coverage is
    on request.
  - All Phase 7 studio features are unchanged: fuel comparison, Earth vs microgravity, timelines, d²-law calculation,
    layers, tours, footage, material comparison, cutaway and exploded views.
  - The conceptual/measured banner is unchanged.
  - Each page shows 3–4 takeaways and one visible data-quality notice:
    - FLEX: the K unit header and the CO₂ header.
    - BASS-II: nominal vs actual sample widths.
    - SAFFIRE-I: no images or flame measurements locally, and no manifest frame reconstructed.
- **Experiment detail**: 5–6 key recorded values (FLEX K labelled mm²/s, with a note that the header reads "mm"),
  flag notice, then six named disclosures. "Ask about this test" now pre-fills the Copilot instead of sending.
- **Explorer**: key columns and two primary filters by default; nothing removed.
- **Copilot**: answer-first layout. Answer text and claims are rendered exactly as returned (never truncated or
  reworded); only additional statements fold behind "Show all N statements". The evidence-only and model-failure
  notices stay prominent.
- **Reliability, Methodology, Modeling, Evidence, Literature, Media, Compare, Similar**: shorter introductions; secondary
  material on request (section 1).

## 6. Accessibility decisions
- Disclosures are native buttons with `aria-expanded`/`aria-controls`, and their bodies use the `hidden` attribute (not
  CSS-only hiding).
- Every disclosure label states what opens. Hash links open the targeted section, so keyboard and screen-reader users
  can reach content from the section navigation.
- Takeaways keep the claim and its provenance badge outside the disclosure; the evidence is one button away.
- Visible focus styles are unchanged. All new controls are reachable by Tab and operable with Enter or Space.
- Status: problems remain visible on every page and at every width (the compact header shows only problems on narrow
  screens).
- Copilot citation markers open the Sources section before scrolling to the cited item.

## 7. Scientific integrity checks
- **No values changed.** Every number shown by default is the same API value as before. The UX audit counts fewer
  numbers because they moved into disclosures, not because any were removed or simplified.
- **Kept visible:** FLEX K in mm²/s (raw header "Burning rate; mm" noted on the detail page, in the studio evidence and
  in the visible notice), the FLEX CO₂ header, BASS-II nominal-vs-actual widths and the T24 conflict (notice and
  report cross-checks), SAFFIRE-I's missing images and measurements and the swapped CSV size columns (notice, studio
  evidence, data view), and the conceptual-vs-measured banners.
- **On request:** raw cells, normalized values, report rows, citations, flags, provenance and methods; all reachable
  from each page.
- Gemini safeguards are unchanged. No request is sent automatically: Home examples and "Ask about this test" pre-fill
  the Copilot, and existing `?q=` links still ask, as an explicit action. No Gemini request was made in Phase 8.

## 8. Test results
Final run on the production build with the model disabled: Playwright **74 passed, 1 skipped** (opt-in live Gemini),
including the 11 new tests in `frontend/e2e/phase8.spec.ts`; backend `pytest` **181 passed**; `tsc`, `eslint` and
`next build` clean. Details and the list of updated tests: `docs/IMPLEMENTATION_STATUS.md` (Phase 8). The UX density audit
(`frontend/scripts/ux-audit.mjs`) records visible words, numbers, badge pills, first-viewport words and page height
for 15 pages, before and after: `docs/ux-audit-before-1440.json` and `docs/ux-audit-after-1440.json` (plus `docs/ux-audit-after-390.json`).

Phase 9 builds on these conventions (smart notices, journey, NASA comparison, glossary): see
`docs/SCIENTIFIC_DISCOVERY_UX_V1.md`.

## 9. Known limitations
- The audit measures density, not comprehension; no study with real users was run.
- Long tables (BASS-II endpoints, the SAFFIRE-I manifest, the flag browser) are still dense when opened; they are
  research-level content.
- The media gallery keeps its captions and credits on every card (attribution is required), so its reduction is
  smaller.
- Some research-heavy tests now open a disclosure before asserting. Their intent is unchanged (listed in the status
  document).
