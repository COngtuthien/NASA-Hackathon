# Phase 15 — Demo Guide

## Start

1. Start the app (from `D:\NASA Hackathon`):
   - Backend: `cd backend; .venv/Scripts/python -m uvicorn app.main:app --host 127.0.0.1 --port 8010`
   - Frontend (production build):
     ```
     cd frontend
     NEXT_DIST_DIR=.next-verify BACKEND_URL=http://127.0.0.1:8010 npx next build
     NEXT_DIST_DIR=.next-verify BACKEND_URL=http://127.0.0.1:8010 npx next start --port 3010
     ```
     Skip the build if `.next-verify` was built from the current commit.
2. Open **http://localhost:3010/**. Press **Start guided demo** on Home or on the Explorer page, or go to
   **http://localhost:3010/demo**.
3. A demo bar appears at the bottom of every page:
   - Step 1–5 indicator, with clickable dots
   - Previous / Next, Restart, Skip to Explorer, Exit demo
   - Hide notes
   The demo state lives in the browser tab (sessionStorage), so a reload keeps the current step and closing the tab ends
   the demo.

## Phase 16 additions

- **Research-to-Safety entry** (`/safety-explorer`): four image cards. Each has "Start guided exploration", which jumps
  straight to that journey's evidence step (3).
- **Combustion & Fire Science Explorer** (`/experiments`): "Start guided exploration" runs a six-step guide.
  1. Domain
  2. Dataset
  3. Filtered records
  4. A record with its source
  5. Chart or 3D
  6. Copilot draft

  Demo tip: Gaseous Flame Dynamics → ACME CFI-G → normal, n-butane → test 21174C3 → CFI-G charts → Copilot.
- **Studios:** in the Gaseous Flame and Smoke Detection studios, press "Start guided exploration" for the staged
  timeline: Play/Pause, Prev/Next, slider and speed. Its stages are conceptual. In the gas studio, select a Table 3 event
  before the "Extinction or transition" stage to show a measured cool flame.
- **Talking point on honesty:** the Explorer labels every collection with its evidence level. Flame Design is "conditions
  only", BRE is "day-level summary", PSI-117 is "figure data, series not tests", FLEX-2 is a plan and PSI-62 is
  metadata only.
- **Estimator:** now "Exploratory FLEX Burn-Time Estimator" under Advanced research tools, with its validation shown.

## The five steps

| Step | Page | What to show |
|---|---|---|
| 1. The challenge | `/demo` | Why fire differs in microgravity (BASS-II Summary Report p.27), live counts (10 investigations, knowledge-graph links), what SpaceFire can and cannot do. Pick the journey. |
| 2. Choose a scenario | `/safety-explorer` | The four scenario cards; the demo's scenario is highlighted. Switch it in the bar. |
| 3. Explore NASA evidence | `/safety-explorer/{scenario}` | Ranking with the "How this score was computed" breakdown, a filter, evidence with page links, the interpretation. The bar links to the charts. |
| 4. Interactive 3D | the scenario's studio | Controls: Play/Pause, Reset, Fullscreen, Hide controls, Labels / Explanation / Evidence. Conceptual vs measured labels. |
| 5. Ask Research Copilot | `/copilot?draft=…&scenario=…` | The question is pre-filled with the Explorer context shown. Press **Ask** to send it. Also show an unsupported question. |

The demo never sends a Copilot question by itself; a browser test checks that no `/assistant/ask` request is made.

## Four journeys

### A — Gaseous Flame Behavior (default)

- **Question:** Under which experimental conditions do gaseous microgravity flames ignite, persist, transition, or
  extinguish?
- **Path:**
  1. Explorer `/safety-explorer/gaseous-flames` (CFI-G ranks first)
  2. Charts `/phenomena/gaseous-flames?tab=cfig`
  3. Studio `/phenomena/gaseous-flames#studio`, plus the NASA CFI-G clip below it
  4. Copilot: "What conditions produced the reported CFI-G cool flames?"
- **Evidence:** 333 test outcomes (179 normal, 154 inverse); 15 cool-flame events from Final Report Table 3, p.46 (e.g.
  21174C3: hot 17.6 mm, cool 7.6 mm, 13.9 s).
- **Talking points:**
  - Normal and inverse flames are never pooled; try the inverse filter.
  - In the studio, pick event 21174C3 to draw its measured radii to scale; everything else is labelled conceptual.
- **Limits:**
  - Flow-terminated burn times are lower bounds.
  - Cool flames were seen at one condition family only.
  - The 3D view is not CFD.

### B — Early Smoke Detection

- **Question:** How do smoke particle characteristics and detector observations vary among overheated spacecraft
  materials?
- **Path:**
  1. Explorer `/safety-explorer/smoke-detection`
  2. Sizes `/phenomena/smoke-detection#sizes`
  3. Studio `/phenomena/smoke-detection?material=kapton#studio`
  4. Copilot: "Why does SAME particle-size information matter for spacecraft smoke detection?"
- **Evidence:** SAME Final Science Report Table 1, p.27. Kapton mean diameter: 105 nm fresh, 186 nm after 720 s of aging.
- **Talking points:**
  - Aging grows the particles.
  - Detectors respond differently to small and large particles.
  - In the studio, change material and age: the measured panel follows.
- **Limits:**
  - Moment-method statistics.
  - No detector sensitivity or alarm time is computed.
  - The 1 Hz telemetry is not processed.
  - Particles in 3D are illustrative.

### C — Droplet Flame Extinction

- **Question:** How do fuel properties and experimental conditions affect droplet burning and flame extinction in
  microgravity?
- **Path:**
  1. Explorer `/safety-explorer/droplet-extinction`
  2. PSI-117 `/phenomena/flame-extinction#psi117-explore`
  3. FLEX studio `/phenomena/flame-extinction#studio`
  4. Copilot: "How does gaseous cool-flame research differ from FLEX droplet cool-flame research?"
- **Evidence:** 274 FLEX test rows (heptane, methanol) with test ends; PSI-117 published experiment points and 1-D model
  curves.
- **Talking points:** Set O₂ to 0.9–1: the Explorer says "No matching experimental evidence…" instead of predicting.
- **Limits:**
  - Test-end counts are not probabilities.
  - PSI-117 is not joined to FLEX rows.
  - FLEX-2 has no outcome data.

### D — Solid Flame Spread

- **Question:** How do material properties and airflow conditions affect flame spread in microgravity?
- **Path:**
  1. Explorer `/safety-explorer/flame-spread`
  2. Report tables `/phenomena/flame-spread#spread`
  3. Studio `/phenomena/flame-spread?record=bass2:27#studio`
  4. Copilot: "How does BASS-II flame spread evidence differ from the SAFFIRE-I large-scale burns?"
- **Evidence:** BASS-II Summary Report Table 5.1, p.65. Test M1: 0.071 mm/s at 9 cm/s (PMMA slab, opposed flow).
- **Talking points:**
  - Filter PMMA and opposed flow.
  - PSI-62 is metadata only.
  - BRE is labelled emulation, not flame spread.
- **Limits:**
  - Rates differ with thickness, width and airflow, so they are listed, not averaged.
  - The flame-front animation is illustrative.

## Offline fallback and recovery

- **Gemini off, over quota or failing (503/504).** The Copilot answers "Evidence only": retrieved NASA passages, knowledge
  graph items and computed analyses, with a plain-language notice. The demo does not depend on Gemini.
- **Unsupported question.** For example "Can SpaceFire certify that an untested polymer is safe?". The Copilot abstains
  without calling the model, which works offline too.
- **Backend down.** Pages show an error with a retry. Check with `curl http://127.0.0.1:8010/api/v1/health`, then restart
  uvicorn with the command above.
- **Frontend down or "address in use".** Stop the old `next start` process; in PowerShell:
  ```
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ? { $_.CommandLine -match 'next.*start' }
  ```
  Then `taskkill /PID <id> /T /F` and start again.
- **3D view fails (no WebGL, lost context).** Each studio shows a written description with "Try the 3D view". The 2D
  button gives the same description on purpose.
- **Demo bar stuck.** Press **Exit demo**, or close the tab.
- **Low memory.** Run one browser tab, and close the 3D page you are not presenting: only one WebGL canvas is mounted per
  page.
