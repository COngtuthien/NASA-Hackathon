"use client";

// Contextual Copilot suggestions (Phase 9). Links only: each opens the Copilot with a drafted question, and nothing is
// sent until the visitor presses Ask there. AI availability comes from the shared local health check (no model call,
// no remote quota check); when AI writing is off or paused the Copilot still returns the evidence it finds.
import Link from "next/link";
import { Icon } from "@/components/icons";
import { aiStatus, useHealth } from "@/lib/api";
import { suggestions, type SuggestionContext } from "@/lib/copilot-suggestions";

export function AskSuggestions({ ctx, max = 3, title = "Ask the Research Copilot", compact = false, className = "" }: {
  ctx: SuggestionContext; max?: number; title?: string; compact?: boolean; className?: string;
}) {
  const h = useHealth();
  const ai = aiStatus(h.data);
  const list = suggestions(ctx, max);
  return (
    <div className={`text-[14px] ${className}`} data-testid="ask-suggestions">
      <p className={`flex items-center gap-1.5 ${compact ? "text-[13px] text-text-3" : "subhead text-[15px]"}`}><Icon name="assistant" size={compact ? 14 : 16} />{title}</p>
      <ul className="mt-1.5 flex flex-col gap-1">
        {list.map((s) => <li key={s.href}><Link href={s.href} className="text-[14px]">{s.text}</Link></li>)}
      </ul>
      <p className="mt-1.5 text-[12.5px] text-text-3">
        Opens the Copilot with the question drafted; AI generation begins only when you press Ask.
        {ai === "off" && " AI writing is off here, so you will get the evidence it finds rather than a written answer."}
        {ai === "paused" && " AI writing is paused (free-tier quota); you will get the evidence it finds, and saved answers still work."}
      </p>
    </div>
  );
}
