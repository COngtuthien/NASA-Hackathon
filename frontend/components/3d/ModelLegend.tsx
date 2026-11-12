// Colour key for the 3D scenes (DOM overlay, readable by screen readers).
export type LegendItem = { color: string; label: string; dashed?: boolean };

export default function ModelLegend({ items, title = "Key" }: { items: LegendItem[]; title?: string }) {
  if (!items.length) return null;
  return (
    <div className="rounded-lg border border-line/80 bg-void/70 px-2.5 py-2 text-[11.5px] text-text-2 backdrop-blur-md">
      <p className="mb-1 font-medium text-text-3">{title}</p>
      <ul className="flex flex-col gap-1">
        {items.map((it) => (
          <li key={it.label} className="flex items-center gap-2">
            <span aria-hidden className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={it.dashed ? { border: `1.5px dashed ${it.color}` } : { background: it.color }} />
            {it.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
