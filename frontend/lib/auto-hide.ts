// Phase 11: the video-player-style auto-hide state machine for the immersive (fullscreen) studio.
//
// States: DISABLED (normal page: chrome always shown) → SHOWN (timer pending) ⇄ HELD (an interaction in progress:
// no timer) → HIDDEN. Only real user input calls `activity()`; animation frames and scene renders never do, so a
// stationary cursor over the canvas lets the chrome hide. At most one timer is ever pending. Pure TypeScript with
// injectable timers, so the behaviour is unit-tested deterministically (e2e/phase11-unit.spec.ts).

export const AUTO_HIDE_MS = 3000;

export type Timers = { set: (fn: () => void, ms: number) => unknown; clear: (handle: unknown) => void };

const realTimers: Timers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

export type AutoHide = {
  readonly visible: boolean;
  readonly enabled: boolean;
  readonly timeout: number;
  /** A real user input (pointer move, click, tap, key, wheel): show the chrome and restart the countdown. */
  activity(): void;
  /** Explicit dismissal (a tap on the scene while the chrome is shown). Ignored while something holds it. */
  hide(): void;
  /** Keep the chrome shown while `key` is held (drag, focused control, open panel, hovered bar…). */
  hold(key: string, on: boolean): void;
  holds(): string[];
  /** Immersive mode on/off. Off: chrome shown, no timer. On: chrome shown, countdown starts. */
  setEnabled(on: boolean): void;
  /** Tab hidden: stop counting. Visible again: the countdown restarts from the beginning. */
  setPaused(paused: boolean): void;
  subscribe(cb: (visible: boolean) => void): () => void;
  /** Number of pending timers (0 or 1). For tests and the debug hook. */
  pending(): number;
  dispose(): void;
};

export function createAutoHide({ timeout = AUTO_HIDE_MS, timers = realTimers }: { timeout?: number; timers?: Timers } = {}): AutoHide {
  let visible = true;
  let enabled = false;
  let paused = false;
  let disposed = false;
  let handle: unknown = null;
  const held = new Set<string>();
  const subs = new Set<(v: boolean) => void>();

  const clear = () => {
    if (handle !== null) { timers.clear(handle); handle = null; }
  };
  const setVisible = (v: boolean) => {
    if (v === visible) return;
    visible = v;
    subs.forEach((f) => f(v));
  };
  const schedule = () => {
    clear();
    if (disposed || !enabled || paused || held.size > 0 || !visible) return;
    handle = timers.set(() => { handle = null; if (enabled && held.size === 0) setVisible(false); }, timeout);
  };

  return {
    get visible() { return visible; },
    get enabled() { return enabled; },
    timeout,
    activity() {
      if (disposed || !enabled) return;
      setVisible(true);
      schedule();
    },
    hide() {
      if (disposed || !enabled || held.size > 0) return;
      clear();
      setVisible(false);
    },
    hold(key, on) {
      if (disposed) return;
      if (on) {
        if (held.has(key)) return;
        held.add(key);
        clear();
        setVisible(true);
      } else if (held.delete(key) && held.size === 0) {
        schedule();
      }
    },
    holds: () => [...held],
    setEnabled(on) {
      if (disposed) return;
      enabled = on;
      clear();
      setVisible(true);
      if (on) schedule();
    },
    setPaused(p) {
      if (disposed) return;
      paused = p;
      if (p) clear();
      else schedule();
    },
    subscribe(cb) {
      subs.add(cb);
      return () => { subs.delete(cb); };
    },
    pending: () => (handle === null ? 0 : 1),
    dispose() {
      clear();
      disposed = true;
      held.clear();
      subs.clear();
    },
  };
}

/** True when `el` (or an ancestor) belongs to the immersive chrome or one of its persistent overlays. */
export const CHROME_SELECTOR = "[data-chrome-item],[data-immersive-panel]";
