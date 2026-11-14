import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import View from "@/components/views/SmokeView";

export const metadata: Metadata = { title: "Smoke & Fire Detection" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton rows={10} />}>
      <View />
    </Suspense>
  );
}
