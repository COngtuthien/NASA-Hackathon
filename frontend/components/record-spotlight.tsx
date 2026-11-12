"use client";

// Chart-to-record connection (Phase 9). Charts whose points are individual tests select a test into the URL
// (`record`), the same parameter the 3D studio and the chart rings already follow, so one selection is reflected in
// every view and stays deep-linkable. This panel shows the selected test compactly, with routes to the full record,
// the 3D studio (the visitor's Conceptual / NASA Evidence choice is kept) and a drafted Copilot question. A plain
// select gives keyboard and screen-reader users the same choice as clicking a point.
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useId } from "react";
import { AskSuggestions } from "@/components/ask-suggestions";
import { RecordFacts } from "@/components/record-facts";
import { Icon } from "@/components/icons";
import { Skeleton } from "@/components/ui";
import type { Inv } from "@/lib/copilot-suggestions";
import { expHref, useCachedApi } from "@/lib/api";
import type { RecordLike } from "@/lib/record-facts";

/** Read and set the selected test (`record` URL parameter) without scrolling or leaving the page. */
export function useSelectedRecord(prefix: string) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = sp.get("record");
  const uid = raw && raw.startsWith(prefix) ? raw : null;
  const select = useCallback((next: string | null) => {
    const n = new URLSearchParams(sp.toString());
    if (next) n.set("record", next); else n.delete("record");
    const q = n.toString();
    router.replace(`${pathname}${q ? `?${q}` : ""}${window.location.hash}`, { scroll: false });
  }, [sp, router, pathname]);
  return { uid, select, mode: sp.get("mode") };
}

export function RecordSpotlight({ uid, onSelect, options, inv, chartName }: {
  uid: string | null; onSelect: (uid: string | null) => void; options: { uid: string; label: string }[]; inv: Inv; chartName: string;
}) {
  const det = useCachedApi<RecordLike>(uid ? `/experiments/${encodeURIComponent(uid)}` : null);
  const d = det.data && det.data.experiment_uid === uid ? det.data : null;
  const selId = useId();
  const sp = useSearchParams();
  const mode = sp.get("mode") === "evidence" ? "NASA Evidence" : "Conceptual 3D";
  return (
    <section aria-label={`Selected test in the ${chartName}`} data-testid="record-spotlight" aria-live="polite"
      className="mt-3 rounded-xl border border-line/70 bg-ink/40 p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="subhead text-[15px]">{uid ? <>Selected test: {d?.display_id ?? uid} <span className="text-[12.5px] font-normal text-text-3">{d ? `${d.investigation} · ${d.investigation_id}` : ""}</span></> : "Inspect a test"}</h3>
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <label htmlFor={selId} className="text-text-3">{uid ? "Choose another" : "Click a point, or choose a test"}</label>
          <select id={selId} value={uid ?? ""} onChange={(e) => onSelect(e.target.value || null)}
            className="max-w-[180px] rounded-md border border-line-strong bg-ink px-2 py-1 text-[13px] text-text">
            <option value="">None</option>
            {options.map((o) => <option key={o.uid} value={o.uid}>{o.label}</option>)}
          </select>
          {uid && <button type="button" onClick={() => onSelect(null)} className="text-link hover:underline">Clear</button>}
        </div>
      </div>
      {uid && !d && (det.error ? <p className="mt-2 text-sm text-crit">{det.error.message}</p> : <div className="mt-3"><Skeleton rows={2} /></div>)}
      {d && (
        <div className="mt-3 flex flex-col gap-3">
          <RecordFacts record={d} />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px]">
            <Link href={expHref(d.experiment_uid)} className="inline-flex items-center gap-1">Open full record<Icon name="chevron" size={13} /></Link>
            <a href="#studio" className="inline-flex items-center gap-1">Explore in 3D<Icon name="chevron" size={13} /></a>
            <span className="text-[12.5px] text-text-3">The studio keeps your {mode} mode; switch to NASA Evidence there to draw the recorded size.</span>
          </div>
          <AskSuggestions ctx={{ inv, record: { uid: d.experiment_uid, label: d.display_id }, from: "chart" }} max={1} compact title="Ask AI about this test" />
        </div>
      )}
    </section>
  );
}
