import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

const inter = localFont({
  src: "./fonts/InterVariable.woff2",
  display: "swap",
  weight: "100 900",
  style: "normal",
  fallback: ["Arial", "sans-serif"]
});

export const metadata: Metadata = {
  title: "UnifiedRange",
  description: "Privacy-first setup documentation, range logging, readiness, and discovery."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
