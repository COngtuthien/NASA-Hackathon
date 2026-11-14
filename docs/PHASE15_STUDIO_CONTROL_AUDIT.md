# Phase 15 — Studio Control Audit

Audited on the final Phase 15 production build (2026-11-14) by browser interaction, not only by reading code.

## Key

| Status | Meaning |
|---|---|
| **BV** | Browser verified: an automated Playwright test drives the real control and checks its effect |
| **BV-ex** | Browser verified by an earlier-phase test that still passes on this build |
| **Impl** | Implemented and checked manually or visually, with no automated assertion |
| **N/A** | Not applicable to this studio |
| **Def** | Deferred |

## Two studio shells

| Shell | Studios | Status |
|---|---|---|
| `ScienceStudio` (+ `StudioViewport`, `TimelineBar`, immersive chrome) | FLEX, BASS-II, SAFFIRE-I | Mature since Phases 7–12; kept. Phase 15 adds a visible Play/Pause to its viewport toolbar. |
| `LiteStudio` (+ `LiteViewport`) | Gaseous Flame, Smoke Detection | Phase 13 shell, brought to the same control set in Phase 15 |

Shared by both: `SceneCanvas` and `ScientificCameraControls`.

**What "Pause" means.** It stops the shared canvas render loop (`data-frameloop` switches from `always` to `demand`). Phase 15
added a rendered-frame counter (`window.__spacefireLab.frames`). Tests assert that frames rise by more than 10 in 0.9 s
while playing and by at most 2 while paused, in all five studios.

## Matrix

| Studio | Hide/Show controls | Play/Pause | Reset | Fullscreen | Labels | Explanation | Evidence | Video |
|---|---|---|---|---|---|---|---|---|
| FLEX droplet | **BV** (panel toggle) | **BV** (viewport button, render loop); timeline Play/Pause/scrub **BV-ex** | Reset camera **BV-ex**; Reset parameters **Impl** | **BV-ex** (immersive, Esc, auto-hiding chrome) | **BV-ex** | Stage explainer and fullscreen "Explain" **BV-ex** | Mode "NASA Evidence" and evidence tab **BV-ex** | CFI-G clip in the page media strip (lightbox), native controls **Impl** |
| BASS-II flame spread | **BV** | **BV**; timeline **BV-ex** | as FLEX | **BV-ex** | **BV-ex** | Stage explainer **BV-ex** | Evidence mode, `?record=` **BV-ex** | N/A: still images only |
| SAFFIRE-I spacecraft fire | **BV** | **BV** (no timeline: decorative motion only) | Reset camera **BV-ex**; Reset parameters **Impl** | **BV-ex** | **BV-ex** | Walkthrough **BV-ex** | Data view **BV-ex** | NASA animation: play / replay / still **BV**; NASA YouTube video: click-to-load **BV-ex** |
| Gaseous Flame (new) | **BV** in page and fullscreen; floating "Show controls" | **BV** (pause, resume, state kept across fullscreen) | Reset **BV** (normal, hot, no event, no test, labels on, playing, camera); Reset camera **BV** | **BV** (native or expanded fallback; Escape in fallback **Impl**) | **BV** | **BV** | **BV** | Real NASA CFI-G clip below the studio: play, pause, seek, replay, mute and error state **BV** |
| Smoke Detection (new) | **BV** in page and fullscreen | **BV** | Reset **BV** (stage 1, Kapton or the URL material, fresh, playing); Reset camera **BV** | **BV** | **BV** | **BV** | **BV** (material and age update the verified Table 1 panel) | N/A: no SAME video in the download; no video button shown |

Also verified in the new studios:
- **Orbit and zoom.** Rotate buttons, zoom buttons, drag and wheel all work. Arrow keys, +/− and 0 are handled by the
  viewport. Space toggles Play/Pause (new). The zoom-and-reset round trip is **BV**.
- **Stages.** Smoke stages are stepped by the user with "‹ Stage" and "Next stage", which is **BV**. They are not a timed
  sequence, so nothing advances while paused (also **BV**). No timeline was added: smoke stages have no physical time
  scale, and a timeline would imply one.
- **Static (2D) view** and the WebGL failure fallback: **BV-ex**.
- **Conceptual labels.** The notice above the viewport and the evidence-class banner stay visible with controls hidden,
  in fullscreen, and with Explanation or Evidence hidden.

## Terminology after Phase 15

| Control | Label |
|---|---|
| Motion | "Play" / "Pause" (accessible name "Play animation" / "Pause animation") |
| Reset | "Reset" restores the starting state; "Reset camera" moves only the camera. The original studios keep "Reset parameters" in their setup panel. |
| Fullscreen | "Fullscreen", and "Exit" while active |
| Panel | "Hide controls" / "Show controls" |
| Toggles | "Key", "Labels", "Explanation", "Evidence" (pressed state exposed) |

Placement in the new studios:
- What-to-show toggles: bottom left.
- Playback (Play/Pause, stepping, Reset, Fullscreen): bottom right, with camera controls beneath. This is one wrapping bar,
  and a test checks that it stays inside the viewport at 390 px.
- Hide/Show controls and Fullscreen: also in the header.

The original studios keep their established layout: camera toolbar bottom right, which now starts with Play/Pause.

## Video and media inventory

| Medium | Where | Type | Controls | Verified |
|---|---|---|---|---|
| CFI-G "hot flame that leaves a cool flame" (NASA, public domain, about 30 s, no audio) | Gaseous Flame page (new) and FLEX media strip | Local mp4 (1.6 MB, already in the repo since Phase 9; not duplicated) | Native: play/pause, seek, volume/mute, fullscreen. Added: status line (not loaded / loading / playing / paused / ended / error), Replay, error panel with the NASA link. `preload="none"`, muted, never autoplays. | Play, pause, seek, replay, unmute, "nothing autoplays" and a 404 error state are all **BV**. Native fullscreen uses the browser's own button: **Impl**, not automated. |
| SAFFIRE-I burn frames (NASA) | SAFFIRE-I studio, footage view | Animated WebP | "Play NASA animation" / "Show still frame", plus Replay (new); error panel (new) | **BV**. An animated image cannot pause mid-way; "Show still frame" stops it, and this is labelled as such. |
| SAFFIRE-I NASA video | SAFFIRE-I footage view | YouTube, privacy-enhanced, click-to-load | YouTube's own controls | Facade **BV-ex**. The third-party player is not automated (no internet dependency in tests). |

**Not added.** There is no "Play NASA video" control on BASS-II, Smoke Detection or the Gaseous Flame studio itself: no
sourced video exists for them. No new video files were added.

## Deferred or limits

- **Full reset in the original studios.** These studios keep two buttons: "Reset camera" (viewport) and "Reset parameters"
  (setup panel). They were not merged into a single Reset, to avoid changing mature behaviour; both work.
- **Explanation and evidence toggles in the original studios.** They use the existing mechanisms (stage explainer,
  Mode = NASA Evidence, evidence tab) rather than new buttons.
- **Native video fullscreen.** It is provided by the browser and was not automated.
