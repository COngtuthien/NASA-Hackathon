# Immersive 3D UX v1 (Phase 11)

Branch `feature/spacefire-phase11-immersive-3d-ux`, based on Phase 10 (`4d112b4`, pushed and identical to the remote
when work started). Frontend only: no backend, data, verifier, algorithm or Gemini change. No new dependency.

Goal: let a visitor watch the combustion model with nothing in the way, like a video player, without losing any
scientific control or caveat.

## 1. What changed for the visitor

| Where | Before | Now |
|---|---|---|
| 3D viewport (all three studios) | Large banner over the scene ("Conceptual visualization — not measured NASA output." / "NASA Evidence — …") | Small mode label ("Conceptual 3D" / "NASA Evidence"); the full statement is beside the **Mode** control, in the fullscreen top bar and in the explanation overlay. Measured sizes stay labelled in the viewport ("Drawn to measured size: …", including "width 2 cm (CSV, nominal)") |
| Comparison caveat ("Conceptual comparison — not paired Earth and ISS measurements…") | Floating over the bottom of the scene | Directly under the viewport; in fullscreen in the top bar (full text in its tooltip) and the explanation overlay |
| BASS-II "Illustrative progression — not measured flame-front motion" 3D label | Floating in the scene | Kept on the timeline and on the fullscreen playback bar; in 3D only with **All** labels |
| "Drag to rotate…" hint | Always shown | Normal page only |
| Setup panel | Always beside the scene | **Hide controls / Show controls** (remembered for the session) |
| Studio | Page only | **Fullscreen** for FLEX, BASS-II and SAFFIRE-I |
| 3D component labels | Only via the panel's "3D labels" setting | Also a **Part labels** toggle on the viewport and in fullscreen |
| Earth labels | "Earth 1 g (comparison)", "Earth 1 g (conceptual comparison)", "Earth (1 g)" | **Earth**; the view is **Earth vs Microgravity** |
| Site navigation | Fixed 272 px sidebar | Collapsible to a 68 px icon rail (remembered) |

## 2. Normal page layout

- Title row: **Hide controls**, **Fullscreen**, **Start guided exploration**.
- Mode (with its statement) and View above the viewport.
- Viewport + setup panel side by side on desktop; with the panel hidden the grid becomes one column and the canvas
  widens (R3F resizes it; nothing is remounted). Below `lg` the panel stacks under the viewport and the same toggle
  removes it; the Phase 7 "Collapse / Expand" of the tab bodies is unchanged.
- The panel is `display: none` while hidden, so its tab, inputs and selections stay mounted. Its scroll position is
  saved when hiding and restored when it returns (display:none drops it).
- Preference: `sessionStorage["spacefire:studio-controls"]`, read through `useSyncExternalStore` (server snapshot
  "shown"), so there is no hydration mismatch; storage errors fall back to "shown".

## 3. Fullscreen

The studio `<section>` itself becomes the fullscreen element. Everything inside (the one WebGL canvas, scene,
timeline store, panel, tour) stays mounted, so state is preserved by construction and no second context is created.
`window.__spacefireLab.mounts` is checked by the tests before, during and after.

- Native: `element.requestFullscreen({ navigationUI: "hide" })` (`webkitRequestFullscreen` as fallback). The mode is
  confirmed by `document.fullscreenElement`; `fullscreenchange` follows exits made by the browser (Esc, F11, browser
  UI) and returns the page layout.
- Fallback: if the API is missing, disabled or the request is rejected, the section is shown as a fixed full-window
  layer (z 80) over the page, page scrolling is locked, and a notice says so honestly ("The browser declined
  fullscreen…" / "Fullscreen isn't available in this browser…"). The notice is a `role=status` toast that clears after
  8 s. Nothing claims fullscreen succeeded when it did not.
- Exit: **Exit fullscreen**, Escape (fallback; in native mode the browser handles Escape), or the browser. Focus
  returns to the **Fullscreen** button. Leaving the page while fullscreen exits native fullscreen and clears timers.
- Layout in fullscreen: the page header, journey card, title and the regular timeline are hidden (`hidden`, still
  mounted); the scene fills the screen. With the setup drawer open on tablet/desktop the scene area narrows beside it
  (same canvas, resized), so a split comparison is never half covered.
- Window resizing and orientation changes are handled by R3F's resize observer; the camera keeps its orbit.
- WebGL context loss and the static fallback behave as on the page.

## 4. Auto-hide state machine

`lib/auto-hide.ts` (pure, injectable timers) + `useImmersiveChrome` in `components/studio/immersive.tsx`.

```
DISABLED (page) ──enter──▶ SHOWN (one timer) ──3 s idle──▶ HIDDEN
                              ▲   │ hold(k)                 │ activity()
                              │   ▼                         │
                              └── HELD (no timer) ◀─────────┘
                       release of the last hold → SHOWN (timer restarts)
```

- Threshold: **3000 ms** (`AUTO_HIDE_MS`). Reveal 200 ms opacity, hide 300 ms; reduced motion: no transition.
- Activity (real input only): mouse `pointermove` with a changed position, `pointerdown`, wheel, any `keydown`.
  Animation frames and scene renders never count, so a still cursor over the canvas lets the chrome hide.
- Holds (no timer while any is held): `press` (any pointer down: scrubbing, sliders, orbit drags, pinch), `hover`
  (mouse over the top bar, playback bar, camera controls, explanation or tour), `focus` (keyboard focus inside the
  chrome, drawer, explanation or tour, i.e. after keyboard use), `select` (a dropdown that may be open), `panel` (setup
  drawer open), `legend` (colour key open).
- Touch: a tap on the scene reveals; a second quick tap (< 400 ms, < 12 px, one finger) dismisses; two-finger gestures
  never toggle.
- Visibility is applied straight to the DOM: `data-chrome="shown|hidden"` on the section, `inert` on every
  `[data-chrome-item]`. Showing and hiding therefore never re-renders React or touches the scene. Hidden chrome has
  `pointer-events: none` and is inert (not in the tab order, no clicks). If focus was on a control that hides, it moves
  to the section. The cursor is hidden with the chrome (`cursor: none`) and returns on the next move.
- Keyboard: the first key press reveals the chrome before Tab moves focus; a focused control holds it; Escape exits.
  No other global shortcut was added.
- Tab hidden (`visibilitychange`): the countdown stops and restarts in full on return.
- Lifecycle: one controller per studio; at most one timer (`pending()` ≤ 1, tested); exit or unmount removes every
  listener, clears the timer and releases internal holds.
- Not hidden: the explanation overlay, the setup drawer, the guided tour card, split captions ("Earth" /
  "Microgravity"), the conceptual-model label in Compare with NASA, and the NASA media column.

## 5. Fullscreen overlays and toggles

- **Top bar** (auto-hides): investigation and title; mode label ("Conceptual 3D · illustrative, not measured" /
  "NASA Evidence · 3D geometry illustrative unless marked measured"); context line (comparison caveat or measured size);
  **Controls**, **Explanations**, **Part labels**, **Exit fullscreen** (icon + text on ≥ 640 px, icon with accessible
  name on phones; 40 px targets).
- **Playback bar** (auto-hides): FLEX and BASS-II share the page's timeline store: Play/Pause/Replay, Restart,
  previous/next stage, scrubber with stage segments, stage name, speed, and the illustrative-timing caveat. SAFFIRE-I
  shows its five walkthrough steps ("Explanatory steps — not a timeline of the burn"); no burn timing is invented.
- **Controls**: the page's own setup panel slides in as a right drawer (≥ 640 px) or a bottom sheet (phones), with Mode
  and View at the top. Non-modal: the scene stays visible and usable, so focus is not trapped; opening moves focus to
  the active tab, Escape inside it or the close button returns focus to **Controls**. Starts closed.
- **Explanations**: a floating panel (top-left on tablet/desktop, above the playback bar on phones) with the active
  stage or step from `lib/stages.ts` (the Phase 10 explainer content): title, summary, key idea, Earth/microgravity
  lines in the comparison, fuel and selected-test lines (including measured values and their caveats), "Why does this
  happen?" with the basis of each statement, "Sources & limits", and the mode statement. Updates with the timeline,
  scrubbing, fuel, test and view. Stays until closed. Starts closed.
- **Part labels**: starts off in fullscreen (unless a component is being inspected, whose label stays), toggles between
  off and the last label mode. It does not change the page's own label setting; leaving fullscreen restores it.
  Selection, Layers and the component list are unaffected.

## 6. Collapsible site navigation

- Toggle at the top of the sidebar (`aria-expanded`, "Collapse sidebar" / "Expand sidebar").
- Collapsed: 68 px rail with the logo mark and icons; group titles become separators; labels are visually hidden but
  remain the links' accessible names; a tooltip with the page name appears on hover and on keyboard focus; the active
  page keeps its highlight and `aria-current`.
- Remembered in `localStorage["spacefire:nav"]`. A tiny inline script in the root layout sets `html[data-nav]` before
  first paint, and the layout is pure CSS on that attribute, so there is no flash and no hydration mismatch
  (`suppressHydrationWarning` on `<html>` for that one attribute).
- Below 1024 px the existing drawer is unchanged (no forced rail on phones).
- Fullscreen hides it completely (native: not rendered; fallback: covered) and never changes its state.

## 7. Accessibility

Named icon-only buttons; `aria-expanded` / `aria-pressed` on toggles; visible focus rings everywhere (the fullscreen
scrubber is a native range input); an sr-only status when fullscreen opens explains auto-hide and Escape; hidden chrome
is inert; focus never stays on a hidden control; keyboard users never lose the controls (a key reveals, focus holds);
touch targets ≥ 36–40 px; reduced motion removes fades and slides without disabling any control; the Phase 7/10 keyboard
camera and timeline controls are unchanged.

## 8. Performance

No new canvas, scene, geometry or dependency. Auto-hide changes only DOM attributes (no React render). The playback bar
subscribes to the timeline store like the page timeline. Labels toggled off unmount their drei `<Html>` roots (as the
existing "Off" label setting does). Timers and listeners exist only while fullscreen is on.

## 9. Scientific safeguards (where each now lives)

| Safeguard | Location |
|---|---|
| Conceptual vs measured | Mode label in the viewport; full statement beside Mode; fullscreen top bar; explanation overlay footer |
| Measured values drawn to scale | "Drawn to measured size: …" in the viewport (evidence mode) and fullscreen context line |
| BASS-II nominal vs actual width | In the measured label ("width 2 cm (CSV, nominal)"), the evidence panel and the stage lines (unchanged) |
| Illustrative timing | Timeline caveat (page) and playback bar caveat (fullscreen) |
| Earth side not a FLEX measurement | Split note under the viewport; fullscreen context line and explanation; stage explainer |
| FLEX K in mm²/s, SAFFIRE-I missing pixels, source links, data-quality notices | Unchanged (panels, notices, explainer) |

## 10. Tests

- `e2e/phase11-unit.spec.ts` (8): the state machine with a fake clock: 3 s default, reveal/restart, one timer at most
  across enters and inputs, holds, tap dismissal, hidden tab, dispose.
- `e2e/phase11.spec.ts` (15): panel hide/show with state and canvas preserved and session memory; banners gone and
  statements present; Part labels; navigation rail (tooltips, keyboard, routing, reload without flash); fullscreen on
  all three studios with the same canvas; native path (taken by Playwright's Chrome) and refused/unsupported fallbacks;
  real 3 s auto-hide with cursor hidden; mouse reveal, continued playback, no interception; holds for scrubbing,
  drawer and keyboard focus, Tab reveal, Escape; timer cleanup on exit, re-entry and navigation; reduced motion;
  synchronized explanations with sources; labels in fullscreen; NASA Evidence, Compare with NASA and footage
  provenance.
- `e2e/phase11-mobile.spec.ts` (2): phone tap reveal/dismiss, bottom sheet, explanation placement, no overlap or
  overflow on all three studios; 768 × 1024 and 1024 × 768 with both comparison captions on screen.
- Updated older assertions that read the removed banner or the old Earth labels (phase 7, 8, 9, 10 specs).

Results: see `docs/IMPLEMENTATION_STATUS.md` (Phase 11 verification).

## 11. Known limitations

- In native fullscreen, Escape belongs to the browser: it always leaves fullscreen, even with the drawer open (in the
  fallback, Escape closes the drawer or explanation first).
- Mouse movement over the YouTube footage iframe is not visible to the page, so the chrome may fade while the pointer
  rests on the video; moving off it (or pressing a key) brings it back. The player's own controls are separate.
- The explanation overlay can cover part of the left (Earth) half in the comparison; the captions sit beside the divider
  so both stay readable, and the overlay can be closed at any time.
- The setup drawer slides over the scene on phones (bottom sheet, 72 % height); the scene above it stays visible.
- iPhone Safari supports fullscreen only for video elements, so phones there use the expanded fallback (with the notice).
