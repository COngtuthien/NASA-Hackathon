// Minimal 1.5px-stroke icon set (24px grid). Decorative: always aria-hidden next to a text label.
const P: Record<string, string> = {
  overview: "M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-4H4zM14 7h6V4h-6z",
  assistant: "M5 5h14v10H9l-4 4zM9 9h6M9 12h4",
  experiments: "M4 5h16M4 10h16M4 15h16M4 20h10",
  compare: "M8 4v16M16 4v16M4 8h4M16 16h4M4 16h4M16 8h4",
  similar: "M8.5 8.5m-4.5 0a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0-9 0M15.5 15.5m-4.5 0a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0-9 0",
  quality: "M12 3l8 4v5c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V7zM9 12l2 2 4-4",
  documents: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6",
  research: "M10.5 10.5m-6.5 0a6.5 6.5 0 1 0 13 0a6.5 6.5 0 1 0-13 0M15.5 15.5L21 21",
  droplet: "M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11z",
  solid: "M4 8l8-4 8 4-8 4zM4 8v8l8 4 8-4V8M12 12v8",
  fire: "M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.5 2 1.5 3 3 3-1-3 0-6 0-8.5z",
  model: "M4 19l5-6 4 3 7-9M15 7h5v5",
  method: "M6 4h12v16H6zM9 8h6M9 12h6M9 16h3",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6L6 18",
  external: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
  alert: "M12 4l9 16H3zM12 10v4M12 17h.01",
  empty: "M4 7h16v12H4zM4 7l2-3h12l2 3M9 12h6",
  chevron: "M9 6l6 6-6 6",
  lab: "M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5",
  // Phase 11: immersive studio and collapsible navigation
  sliders: "M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4",
  info: "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 11v5M12 8h.01",
  tag: "M3 12V4h8l10 10-8 8zM7.5 7.5h.01",
  fullscreen: "M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5",
  "fullscreen-exit": "M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5",
  play: "M7 5v14l12-7z",
  pause: "M8 5v14M16 5v14",
  restart: "M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4",
  sidebar: "M4 5h16v14H4zM9 5v14",
  "panel-right": "M4 5h16v14H4zM15 5v14",
  // Phase 12: theme switcher
  sun: "M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4",
  moon: "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z",
  monitor: "M3 5h18v11H3zM8 20h8M12 16v4",
};

export function Icon({ name, size = 16, className = "" }: { name: keyof typeof P | string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d={P[name] ?? P.method} />
    </svg>
  );
}
