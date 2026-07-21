"use client";

import Link from "next/link";
import { useModerationReports } from "@/hooks/useModerationReports";

export function ModerationNavLink({ isActive, variant }: { isActive: boolean; variant: "desktop" | "mobile" }) {
  const { canAccessModeration, pendingCount } = useModerationReports();

  if (!canAccessModeration) {
    return null;
  }

  const badge = pendingCount && pendingCount > 0 ? <span className="rounded-md bg-clay px-2 py-0.5 text-xs font-bold text-white">{pendingCount}</span> : null;

  if (variant === "mobile") {
    return (
      <Link href="/moderation" className={`shrink-0 rounded-md px-3 py-2 text-xs font-semibold ${isActive ? "bg-ink text-white" : "bg-white text-ink/75"}`}>
        <span className="inline-flex items-center gap-2">
          Moderation
          {badge}
        </span>
      </Link>
    );
  }

  return (
    <Link
      href="/moderation"
      className={`rounded-md px-3 py-2 text-sm font-medium transition ${isActive ? "bg-field text-ink" : "text-ink/70 hover:bg-ink/5 hover:text-ink"}`}
    >
      <span className="flex items-center justify-between gap-3">
        <span>Moderation</span>
        {badge}
      </span>
    </Link>
  );
}
