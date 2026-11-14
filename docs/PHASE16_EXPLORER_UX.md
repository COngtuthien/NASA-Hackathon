# Phase 16 — Research-to-Safety Explorer UX

## Entry page (`/safety-explorer`)

- **Hero:** "Explore Spacecraft Fire Science". Subtitle: "Choose a question. Explore NASA evidence, scientific charts and
  interactive 3D." The kicker and navigation keep the name "Research-to-Safety Explorer".
- **Disclaimer:** a single short line (not fire-risk scores, certifications or predictions).
- **Four cards**, each with an image, a title, one sentence, the main investigation, Explore, and "Start guided
  exploration":

  | Scenario | Image |
  |---|---|
  | Flame spread | BASS-II flame (NASA) |
  | Gaseous flames | Frame of the NASA CFI-G test video, captioned as a video frame, never as a confirmed cool flame |
  | Smoke | Original schematic, labelled "not a photo" (no verified SAME image) |
  | Droplet | FLEX orbit-vs-Earth flame (NASA) |

  Credits are shown on each image. The long italic questions moved to the scenario pages.
- **"How the ranking works"** is collapsed by default.
- **"Start guided demo"** (the Phase 15 five-step demo) stays in the header.

## Scenario page (`/safety-explorer/{id}`): progressive disclosure

1. Overview: title, research question, Start guided exploration, Ask Research Copilot, short disclaimer.
2. Key evidence: the outcome summary with a **chart** drawn from the API's summary counts or values.

   | Scenario | Chart |
   |---|---|
   | Gaseous flames | Outcomes by configuration |
   | Droplet | FLEX test ends by fuel |
   | Smoke | Fresh vs aged mean diameter |
   | Flame spread | Range bars of reported spread rates |

   Beside it, the "See it" actions: charts, 3D, test, evidence, Copilot.
3. Ranked investigations: each now has "Browse records", leading into the Combustion Explorer.
4. Evidence: CFI-G test and SAME size items have "Open the record".
5. **Refine by experimental conditions:** filters and source availability, collapsed unless a condition filter is active.
6. Scientific interpretation:
   - "What the evidence shows" and "What cannot be concluded" stay visible.
   - "Why it matters" and "Missing data" sit behind a toggle.

No caveat was removed.

## Guided exploration per scenario

"Start guided exploration" on each card and scenario page starts the Phase 15 demo journey at step 3 for that scenario:
evidence → 3D → Copilot. Next, Previous, Restart, Exit and scenario switching all work, and the step and scenario stay in
sync with the cards (`data-selected`). All four journeys are reachable. The smoke journey is browser-tested from the card;
all journeys were tested in Phase 15.
