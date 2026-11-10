import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import ExplorerView from "@/components/views/ExplorerView";

export const metadata: Metadata = { title: "Experiment explorer" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton rows={10} />}>
      <ExplorerView />
    </Suspense>
  );
}
