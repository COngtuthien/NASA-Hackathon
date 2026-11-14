import type { Metadata } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import { Suspense } from "react";
import Shell from "@/components/Shell";
import { PREPAINT_SCRIPT } from "@/lib/prepaint";
import "./globals.css";

const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo", axes: ["wdth"], display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });


export const metadata: Metadata = {
  title: { default: "SpaceFire AI", template: "%s · SpaceFire AI" },
  description: "Evidence-grounded microgravity combustion research over NASA FLEX, BASS-II and SAFFIRE-I data.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // data-theme and data-nav are set by the inline script before first paint (no flash), so React must ignore them.
    <html lang="en" className={`${archivo.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREPAINT_SCRIPT }} />
      </head>
      <body>
        <Suspense fallback={null}>
          <Shell>{children}</Shell>
        </Suspense>
      </body>
    </html>
  );
}
