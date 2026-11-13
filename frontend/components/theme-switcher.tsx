"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { Icon } from "@/components/icons";
import { themePref, watchSystemTheme, type ThemePref } from "@/lib/theme";

const OPTIONS: { id: ThemePref; label: string; icon: string }[] = [
  { id: "light", label: "Light theme", icon: "sun" },
  { id: "dark", label: "Dark theme", icon: "moon" },
  { id: "system", label: "Match system theme", icon: "monitor" },
];

/**
 * Light / Dark / System. A radio group (arrow keys move and select, as in any radio group). Switching changes CSS
 * tokens only: no reload, no remount, the route, 3D scene, timeline, fullscreen and sidebar state are untouched.
 */
export default function ThemeSwitcher() {
  const pref = themePref.use();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => watchSystemTheme(pref), [pref]);

  function onKey(e: KeyboardEvent, i: number) {
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + OPTIONS.length) % OPTIONS.length;
    themePref.set(OPTIONS[n].id);
    refs.current[n]?.focus();
  }

  return (
    <div role="radiogroup" aria-label="Colour theme" data-testid="theme-switcher"
      className="inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-line bg-panel/70 p-0.5">
      {OPTIONS.map((o, i) => {
        const on = pref === o.id;
        return (
          <button key={o.id} ref={(el) => { refs.current[i] = el; }} type="button" role="radio" aria-checked={on} aria-label={o.label} title={o.label}
            tabIndex={on ? 0 : -1} onClick={() => themePref.set(o.id)} onKeyDown={(e) => onKey(e, i)} data-testid={`theme-${o.id}`}
            className={`press grid h-8 w-8 place-items-center rounded-md ${on ? "bg-raised text-text shadow-[inset_0_0_0_1px_var(--line-strong)]" : "text-text-3 hover:text-text"}`}>
            <Icon name={o.icon} size={16} />
          </button>
        );
      })}
    </div>
  );
}
