import type { Metadata } from "next";
import View from "@/components/views/DemoView";

export const metadata: Metadata = { title: "Guided demo" };

export default function Page() {
  return <View />;
}
