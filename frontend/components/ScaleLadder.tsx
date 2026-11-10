"use client";

// Log-scale comparison of characteristic sample sizes. Values and their sources are stated, not inferred.
const ITEMS = [
  { name: "FLEX droplet", inv: "PSI-69", lo: 1.1, hi: 4.67, label: "1.1–4.7 mm initial diameter", src: "FLEX CSV, D₀ column" },
  { name: "BASS-II sample", inv: "PSI-25", lo: 10, hi: 100, label: "1–2 cm wide strips, rods up to 12.7 mm, ~10 cm long", src: "BASS-II CSV material text; Summary Report p.101" },
  { name: "SAFFIRE-I sheet", inv: "PSI-98", lo: 400, hi: 940, label: "~0.4 m × 0.94 m fabric", src: "SAFFIRE-I Operations, p.1" },
];
const MIN = 0.5, MAX = 2000; // mm
const x = (mm: number) => ((Math.log10(mm) - Math.log10(MIN)) / (Math.log10(MAX) - Math.log10(MIN))) * 100;
const TICKS = [1, 10, 100, 1000];

export default function ScaleLadder() {
  return (
    <figure className="w-full">
      <div className="relative ml-[118px] mr-2 h-5 text-[11px] text-text-3" aria-hidden>
        {TICKS.map((t) => (
          <span key={t} className="absolute -translate-x-1/2" style={{ left: `${x(t)}%` }}>{t >= 1000 ? `${t / 1000} m` : t >= 10 ? `${t / 10} cm` : `${t} mm`}</span>
        ))}
      </div>
      <ul className="flex flex-col gap-2.5">
        {ITEMS.map((it) => (
          <li key={it.name} className="grid grid-cols-[110px_1fr] items-center gap-2">
            <span className="text-sm text-text">{it.name}</span>
            <div className="relative mr-2 h-6 rounded bg-ink/60">
              {TICKS.map((t) => <span key={t} aria-hidden className="absolute top-0 h-full w-px bg-line" style={{ left: `${x(t)}%` }} />)}
              <span className="absolute top-1 h-4 rounded-sm bg-data/80" style={{ left: `${x(it.lo)}%`, width: `max(6px, ${x(it.hi) - x(it.lo)}%)` }}
                title={`${it.label} (${it.src})`} />
            </div>
            <span className="col-start-2 -mt-1.5 text-xs text-text-3">{it.label}. Source: {it.src}.</span>
          </li>
        ))}
      </ul>
      <figcaption className="mt-2 text-xs text-text-3">Logarithmic scale. Nearly three orders of magnitude separate the droplet and the spacecraft-scale sheet, one reason the three datasets are analyzed separately.</figcaption>
    </figure>
  );
}
