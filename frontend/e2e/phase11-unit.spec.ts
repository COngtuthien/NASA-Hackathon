import { expect, test } from "@playwright/test";
import { AUTO_HIDE_MS, createAutoHide, type Timers } from "@/lib/auto-hide";

// Phase 11 logic tests: the video-player auto-hide state machine, driven by a fake clock (no real time passes).
test.beforeEach(({}, info) => { test.skip(info.project.name !== "desktop", "logic tests run once"); });

function fakeClock() {
  let now = 0, seq = 0;
  const queue = new Map<number, { at: number; fn: () => void }>();
  const timers: Timers = {
    set: (fn, ms) => { const id = ++seq; queue.set(id, { at: now + ms, fn }); return id; },
    clear: (h) => { queue.delete(h as number); },
  };
  return {
    timers,
    pending: () => queue.size,
    advance(ms: number) {
      const end = now + ms;
      for (;;) {
        const next = [...queue.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        now = next[1].at;
        queue.delete(next[0]);
        next[1].fn();
      }
      now = end;
    },
  };
}

function setup(timeout = AUTO_HIDE_MS) {
  const clock = fakeClock();
  const ctl = createAutoHide({ timeout, timers: clock.timers });
  const events: boolean[] = [];
  ctl.subscribe((v) => events.push(v));
  return { clock, ctl, events };
}

test.describe("Phase 11 auto-hide controller", () => {
  test("default threshold is 3 seconds; disabled (normal page) means always shown and no timer", () => {
    expect(AUTO_HIDE_MS).toBe(3000);
    const { clock, ctl } = setup();
    expect(ctl.visible).toBe(true);
    ctl.activity();
    clock.advance(60_000);
    expect(ctl.visible).toBe(true);
    expect(clock.pending()).toBe(0);
  });

  test("fullscreen opens with controls shown, then they hide after 3 s of inactivity", () => {
    const { clock, ctl, events } = setup();
    ctl.setEnabled(true);
    expect(ctl.visible).toBe(true);
    expect(ctl.pending()).toBe(1);
    clock.advance(2999);
    expect(ctl.visible).toBe(true);
    clock.advance(1);
    expect(ctl.visible).toBe(false);
    expect(ctl.pending()).toBe(0);
    expect(events).toEqual([false]);
  });

  test("activity reveals and restarts the countdown; stopping lets them hide again", () => {
    const { clock, ctl, events } = setup();
    ctl.setEnabled(true);
    clock.advance(3000);
    expect(ctl.visible).toBe(false);
    ctl.activity();                       // mouse move
    expect(ctl.visible).toBe(true);
    clock.advance(2000);
    ctl.activity();                       // still moving: countdown restarts
    clock.advance(2000);
    expect(ctl.visible).toBe(true);
    clock.advance(1000);
    expect(ctl.visible).toBe(false);
    expect(events).toEqual([false, true, false]);
  });

  test("never more than one pending timer, however many inputs, enables or re-entries", () => {
    const { clock, ctl } = setup();
    for (let i = 0; i < 5; i++) {
      ctl.setEnabled(true);
      for (let k = 0; k < 50; k++) ctl.activity();
      expect(clock.pending()).toBe(1);
      ctl.setEnabled(false);              // exit fullscreen clears it
      expect(clock.pending()).toBe(0);
      expect(ctl.visible).toBe(true);
    }
  });

  test("holds (drag, focus, open panel, hover, open menu) prevent hiding; the countdown resumes after the last release", () => {
    const { clock, ctl } = setup();
    ctl.setEnabled(true);
    ctl.hold("press", true);              // dragging the timeline
    ctl.hold("panel", true);              // setup drawer open
    clock.advance(30_000);
    expect(ctl.visible).toBe(true);
    expect(clock.pending()).toBe(0);
    ctl.hold("press", false);
    clock.advance(30_000);
    expect(ctl.visible).toBe(true);       // drawer still open
    ctl.hold("panel", false);
    expect(clock.pending()).toBe(1);
    clock.advance(3000);
    expect(ctl.visible).toBe(false);
    // a hold reveals hidden chrome at once (e.g. keyboard focus lands on a control)
    ctl.hold("focus", true);
    expect(ctl.visible).toBe(true);
    expect(ctl.holds()).toEqual(["focus"]);
  });

  test("an explicit dismissal (tap) hides at once, but never while something holds the chrome", () => {
    const { ctl } = setup();
    ctl.setEnabled(true);
    ctl.hold("hover", true);
    ctl.hide();
    expect(ctl.visible).toBe(true);
    ctl.hold("hover", false);
    ctl.hide();
    expect(ctl.visible).toBe(false);
  });

  test("a hidden tab pauses the countdown; returning restarts it in full", () => {
    const { clock, ctl } = setup();
    ctl.setEnabled(true);
    clock.advance(2500);
    ctl.setPaused(true);
    expect(clock.pending()).toBe(0);
    clock.advance(60_000);
    expect(ctl.visible).toBe(true);
    ctl.setPaused(false);
    clock.advance(2999);
    expect(ctl.visible).toBe(true);
    clock.advance(1);
    expect(ctl.visible).toBe(false);
  });

  test("dispose clears timers and listeners; later calls are inert", () => {
    const { clock, ctl, events } = setup();
    ctl.setEnabled(true);
    ctl.dispose();
    expect(clock.pending()).toBe(0);
    ctl.activity();
    ctl.setEnabled(true);
    clock.advance(10_000);
    expect(events).toEqual([]);
  });
});
