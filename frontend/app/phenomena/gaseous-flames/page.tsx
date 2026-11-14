import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import View from "@/components/views/gas/GasFlamesView";

export const metadata: Metadata = { title: "Gaseous Flame Dynamics" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton rows={10} />}>
      <View />
    </Suspense>
  );
}
