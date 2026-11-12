"use client";

// Key recorded values of one test with the warnings that affect them, shown next to the values (never collapsed).
import Link from "next/link";
import { Icon } from "@/components/icons";
import { Prov } from "@/components/ui";
import { recordFacts, type RecordLike } from "@/lib/record-facts";

export function RecordFacts({ record, className = "" }: { record: RecordLike; className?: string }) {
  const { facts, warnings } = recordFacts(record);
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <dl className="grid grid-cols-2 gap-x-5 gap-y-2.5 sm:grid-cols-3" aria-label={`Recorded values for test ${record.display_id}`} data-testid="record-facts">
        {facts.map((f) => (
          <div key={f.label} className="min-w-0">
            <dt className="text-[12px] text-text-3">{f.label}</dt>
            <dd className="mt-0.5 text-[14.5px] font-medium text-text">{f.value}</dd>
            {f.note && <dd className="mt-0.5 text-[11.5px] leading-snug text-text-3">{f.note}</dd>}
          </div>
        ))}
      </dl>
      <p className="flex items-center gap-2 text-[12px] text-text-3"><Prov kind="experiment" /> As recorded in the NASA {record.investigation} file, with units.</p>
      {warnings.length > 0 && (
        <ul className="flex flex-col gap-1.5" aria-label="Warnings for this test">
          {warnings.map((w, i) => (
            <li key={i} role="note" data-testid="record-warning"
              className={`flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-[13px] text-text-2 ${w.severity === "critical" ? "border-crit/50 bg-crit/[0.06]" : "border-warn/40 bg-warn/[0.05]"}`}>
              <Icon name="alert" size={15} className={`mt-0.5 shrink-0 ${w.severity === "critical" ? "text-crit" : "text-warn"}`} />
              <span><span className={`mr-1 font-semibold ${w.severity === "critical" ? "text-crit" : "text-warn"}`}>{w.severity === "critical" ? "Critical:" : "Warning:"}</span>
                {w.text}{w.rule && <> <Link href={`/reliability?rule_id=${encodeURIComponent(w.rule)}#flags`} className="raw text-[12px]">{w.rule}</Link></>}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
