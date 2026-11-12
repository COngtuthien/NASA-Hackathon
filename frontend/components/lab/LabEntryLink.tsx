import Link from "next/link";
import { Icon } from "@/components/icons";
import { labHref, SCENE_BY_ID, type SceneId } from "@/lib/lab-models";

/** Compact entry point into the Interactive Combustion Lab from phenomenon and experiment pages. */
export default function LabEntryLink({ scene, record, label, className = "" }: { scene: SceneId; record?: string; label?: string; className?: string }) {
  const s = SCENE_BY_ID[scene];
  return (
    <Link href={labHref(scene, record)} data-testid="lab-entry"
      className={`lift glow-flame hairline-top group flex items-center gap-4 rounded-2xl border border-flame/30 bg-[linear-gradient(110deg,rgba(255,138,61,0.10),rgba(16,30,51,0.9)_55%)] px-4 py-3.5 text-text no-underline hover:border-flame/60 hover:no-underline md:px-5 ${className}`}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-flame/40 bg-flame/10 text-flame"><Icon name="lab" size={20} /></span>
      <span className="min-w-0 flex-1">
        <span className="subhead block text-[16px]">{label ?? `Explore ${s.title.toLowerCase()} in 3D`}</span>
        <span className="block text-[13px] text-text-2">Interactive Combustion Lab · {s.source}. Conceptual 3D next to {record ? "this test's NASA record" : "real NASA records"}; no simulated measurements.</span>
      </span>
      <Icon name="chevron" className="shrink-0 text-text-3 transition-transform group-hover:translate-x-0.5 group-hover:text-flame" />
    </Link>
  );
}
