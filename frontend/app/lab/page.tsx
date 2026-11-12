import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import View from "@/components/lab/InteractiveLabView";

export const metadata: Metadata = {
  title: "Interactive Combustion Lab",
  description: "Explore FLEX droplet combustion, BASS-II flame spread and the SAFFIRE-I spacecraft fire experiment in interactive 3D, next to real NASA records.",
};

export default function Page() {
  return (
    <Suspense fallback={<Skeleton rows={10} />}>
      <View />
    </Suspense>
  );
}
