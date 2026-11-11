import { HubTabs } from "@/components/ui";

const TABS = [
  { href: "/intelligence/similar", label: "Find similar cases", note: "Gower distance on initial conditions" },
  { href: "/intelligence/compare", label: "Compare side by side", note: "2–5 tests" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <HubTabs label="Experiment intelligence workflows" tabs={TABS} />
      {children}
    </>
  );
}
