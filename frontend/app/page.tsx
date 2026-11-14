import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import OverviewView from "@/components/views/OverviewView";

export default function Page() {
  return (
    <Suspense fallback={<Skeleton rows={8} />}>
      <OverviewView />
    </Suspense>
  );
}
