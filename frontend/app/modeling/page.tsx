import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import View from "@/components/views/MlView";

export const metadata: Metadata = { title: "Exploratory FLEX Burn-Time Estimator" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton rows={10} />}>
      <View />
    </Suspense>
  );
}
