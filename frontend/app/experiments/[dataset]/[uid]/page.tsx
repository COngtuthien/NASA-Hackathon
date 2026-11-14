import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import DetailView from "@/components/views/RecordRoute";

export default function Page() {
  return (
    <Suspense fallback={<Skeleton rows={12} />}>
      <DetailView />
    </Suspense>
  );
}
