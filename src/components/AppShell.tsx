"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AuthNav } from "@/components/AuthNav";

const navigation = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/passports", label: "Equipment Passports" },
  { href: "/projectiles", label: "Projectiles / Ammo" },
  { href: "/optics", label: "Optics / Sights" },
  { href: "/sessions", label: "Range Sessions" },
  { href: "/maintenance", label: "Maintenance" },
  { href: "/readiness", label: "Hunting Readiness" },
  { href: "/discover", label: "Discover" },
  { href: "/settings", label: "Settings" }
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-paper">
      <aside className="fixed inset-y-0 left-0 hidden w-72 flex-col border-r border-ink/10 bg-white/85 px-5 py-6 backdrop-blur lg:flex">
        <Link href="/dashboard" className="block">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-moss">UnifiedRange</p>
          <h1 className="mt-2 text-2xl font-bold text-ink">Setup logbook</h1>
        </Link>
        <nav className="mt-8 flex flex-col gap-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                  isActive ? "bg-field text-ink" : "text-ink/70 hover:bg-ink/5 hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <AuthNav />
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-ink/10 bg-paper/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <Link href="/dashboard">
              <span className="text-sm font-semibold uppercase tracking-[0.18em] text-moss">UnifiedRange</span>
            </Link>
            <AuthNav compact />
          </div>
          <nav className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`shrink-0 rounded-md px-3 py-2 text-xs font-semibold ${
                    isActive ? "bg-ink text-white" : "bg-white text-ink/75"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
