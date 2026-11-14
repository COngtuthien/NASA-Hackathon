# Phase 16 — Science Media Audit

## Verified media in SpaceFire (`frontend/lib/scientific-media.ts`, 15 items)

| Investigation | Items | Types | Source |
|---|---|---|---|
| FLEX (PSI-69) | 2 | images | NASA Image and Video Library / NASA releases (public domain) |
| FLEX-2 (PSI-68) | 1 | image (MDCA apparatus) | NASA Image and Video Library |
| ACME CFI-G (PSI-159) | 1 | video (about 30 s, no audio, local mp4) | NASA Image and Video Library, "Hot Flame Aboard the ISS" |
| BASS-II (PSI-25) | 4 | images | NASA |
| BASS, SoFIE (related, not registered) | 3 | images | NASA, labelled "related" |
| SAFFIRE-I (PSI-98) | 4 | animation, YouTube video (click-to-load), 2 images | NASA Glenn, NASA Video |

**Local files.** Every image variant, poster and video path in the catalog exists in `frontend/public/media` (checked
automatically): no broken local link. External source URLs are NASA pages; they were not fetched during this phase, so
their availability was not re-checked.

## Missing coverage (no verified media; nothing substituted)

| Investigation | Media |
|---|---|
| ACME Flame Design (PSI-10) | none |
| ACME BRE (PSI-20) | none |
| SAME (PSI-102) | none |
| PSI-117 | none |
| PSI-62 | none |

The gallery's new coverage panel lists all ten investigations and states "No verified NASA media in SpaceFire" for these
five. Each entry links to its analysis page.

## Restrictions respected

- No engineering drawings from the downloads are published (redistribution rights unverified). The panel says so.
- No raw video was copied or duplicated.
- The CFI-G frame used on cards is captioned "video frame from a CFI-G test", never "cool flame".
- Conceptual studio graphics are not presented as photographs. The smoke cards use an original schematic labelled "not a
  photo".

## Gallery upgrades

- Coverage panel per investigation, with counts, a filter shortcut and an analysis link.
- The existing filters stay: phenomenon, relation, investigation, media type.

## Contextual use

| Where | Media |
|---|---|
| Combustion Explorer domain cards | Verified images with credits |
| Research-to-Safety scenario cards | Verified images with credits |
| Gaseous Flame page | CFI-G clip under the studio (Phase 15) |

The clip player keeps its working controls: play, pause, seek, mute, fullscreen, Replay and an error state.
