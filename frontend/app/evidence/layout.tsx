import { HubTabs } from "@/components/ui";

const TABS = [
  { href: "/evidence", label: "NASA documents", note: "page-level passages" },
  { href: "/evidence/literature", label: "External literature", note: "NTRS, OpenAlex, Crossref" },
  { href: "/evidence/media", label: "Scientific media", note: "NASA photos, video" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <HubTabs label="Evidence and literature sources" tabs={TABS} />
      {children}
    </>
  );
}
