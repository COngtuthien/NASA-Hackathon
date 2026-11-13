import type { Metadata } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import { Suspense } from "react";
import Shell from "@/components/Shell";
import "./globals.css";

const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo", axes: ["wdth"], display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

// Static string (no user input). Applies the remembered navigation state before paint: no flash of the wide sidebar.
// The key matches NAV_KEY in lib/ui-prefs.ts.
const NAV_SCRIPT = `try{if(localStorage.getItem("spacefire:nav")==="collapsed")document.documentElement.dataset.nav="collapsed"}catch(e){}`;

export const metadata: Metadata = {
  title: { default: "SpaceFire AI", template: "%s · SpaceFire AI" },
  description: "Evidence-grounded microgravity combustion research over NASA FLEX, BASS-II and SAFFIRE-I data.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // data-nav (collapsed navigation) is set by the inline script before first paint, so React must ignore it.
    <html lang="en" className={`${archivo.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NAV_SCRIPT }} />
      </head>
      <body>
        <Suspense fallback={null}>
          <Shell>{children}</Shell>
        </Suspense>
      </body>
    </html>
  );
}
