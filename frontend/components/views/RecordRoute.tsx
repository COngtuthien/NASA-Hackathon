"use client";

// Experiment detail route: FLEX, BASS-II and SAFFIRE-I rows keep their existing page; Phase 13 collections
// (CFI-G, Flame Design, BRE, SAME, PSI-117, FLEX-2) open the evidence-level record view (Phase 16).
import { useParams } from "next/navigation";
import DetailView from "@/components/views/DetailView";
import RecordView from "@/components/views/combustion/RecordView";

export default function RecordRoute() {
  const { dataset } = useParams<{ dataset: string }>();
  return ["flex", "bass2", "saffire1"].includes(dataset) ? <DetailView /> : <RecordView />;
}
