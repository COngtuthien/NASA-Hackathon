"use client";

// Smart Scientific Notice (Phase 9). A compact, always-visible statement of a data limitation: a severity label
// (text, not colour alone), a short summary and one explanatory sentence. "Show the details" opens the exact
// discrepancies (original vs interpreted), why they matter, what they affect, the quality-flag rules and sources.
// It never replaces a contextual warning shown next to a value it affects (see RecordFacts).
import Link from "next/link";
import { useId, useState } from "react";
import { Icon } from "@/components/icons";
import { useHashOpen } from "@/components/disclosure";
import { SEVERITY_LABEL, type ScientificNoticeData } from "@/lib/scientific-notices";

const TONE = {
  warning: { box: "border-warn/40 bg-warn/[0.05]", icon: "text-warn", label: "text-warn" },
  caution: { box: "border-warn/30 bg-warn/[0.03]", icon: "text-warn", label: "text-warn" },
  info: { box: "border-info/40 bg-info/[0.05]", icon: "text-info", label: "text-info" },
} as const;

export function ScientificNotice({ notice, className = "" }: { notice: ScientificNoticeData; className?: string }) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  useHashOpen(notice.id, [], setOpen);
  const t = TONE[notice.severity];
  return (
    <div id={notice.id} role="note" aria-label={`${SEVERITY_LABEL[notice.severity]}: ${notice.summary}`} data-testid="scientific-notice"
      data-open={open ? "true" : "false"} className={`scroll-mt-36 rounded-xl border px-3.5 py-3 ${t.box} ${className}`}>
      <div className="flex items-start gap-2.5">
        <Icon name="alert" size={17} className={`mt-0.5 shrink-0 ${t.icon}`} />
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] text-text">
            <span className={`mr-1.5 text-[12px] font-semibold uppercase tracking-wide ${t.label}`}>{SEVERITY_LABEL[notice.severity]}</span>
            <span className="font-medium">{notice.summary}</span>
          </p>
          <p className="mt-0.5 text-[13.5px] leading-relaxed text-text-2">{notice.explain}</p>
          <button type="button" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen(!open)}
            className="mt-1.5 inline-flex min-h-8 items-center gap-1 text-[13px] text-link hover:underline">
            {open ? "Hide the details" : "Show the details"}
            <Icon name="chevron" size={13} className={`transition-transform ${open ? "-rotate-90" : "rotate-90"}`} />
          </button>
          <div id={bodyId} hidden={!open} className="mt-2 flex flex-col gap-3 border-t border-line/50 pt-3 text-[13.5px] text-text-2">
            <div className="overflow-x-auto">
              <table className="data text-[13px]">
                <caption className="sr-only">Original source values and how SpaceFire interprets them</caption>
                <thead><tr><th scope="col">Item</th><th scope="col">In the source</th><th scope="col">Shown as</th><th scope="col">Where</th></tr></thead>
                <tbody>{notice.rows.map((r) => (
                  <tr key={r.label}><th scope="row" className="font-normal text-text">{r.label}</th><td><span className="raw">{r.original}</span></td><td>{r.interpreted}</td><td className="text-text-3">{r.source}</td></tr>
                ))}</tbody>
              </table>
            </div>
            <p><span className="text-text-3">Why it matters: </span>{notice.why}</p>
            <div>
              <p className="text-text-3">What it affects</p>
              <ul className="mt-1 list-disc pl-5">{notice.affects.map((a) => <li key={a}>{a}</li>)}</ul>
            </div>
            <p className="flex flex-wrap gap-x-3 gap-y-1">
              <span className="text-text-3">Quality flags:</span>
              {notice.flags.map((f) => <Link key={f.rule} href={f.href} className="raw">{f.rule}</Link>)}
            </p>
            <p className="flex flex-wrap gap-x-3 gap-y-1">
              <span className="text-text-3">Sources:</span>
              {notice.sources.map((s) => <a key={s.href} href={s.href} target={s.external ? "_blank" : undefined} rel="noreferrer">{s.label}</a>)}
            </p>
            <p className="text-[12.5px] text-text-3">Source values are kept exactly as recorded; nothing is corrected or reconciled.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
