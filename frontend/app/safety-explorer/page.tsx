import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import View from "@/components/views/explorer/ExplorerHome";

export const metadata: Metadata = { title: "Research-to-Safety Explorer" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton rows={10} />}>
      <View />
    </Suspense>
  );
}
