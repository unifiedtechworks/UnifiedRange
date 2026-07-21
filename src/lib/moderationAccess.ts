import type { AuthUserState } from "@/hooks/useAuthUser";

export const moderationGroups = ["admin", "moderator"] as const;

export function hasModerationAccess(authState: AuthUserState) {
  if (authState.status !== "signed-in") {
    return false;
  }

  return authState.groups.some((group) => moderationGroups.includes(group.toLowerCase() as (typeof moderationGroups)[number]));
}

export function isPendingReportStatus(status?: string | null) {
  return !status || status === "open" || status === "pending";
}

export function countPendingReports<T extends { status?: string | null }>(reports: T[]) {
  return reports.filter((report) => isPendingReportStatus(report.status)).length;
}

export function sortModerationReports<T extends { status?: string | null; createdAt?: string | null }>(reports: T[]) {
  return [...reports].sort((a, b) => {
    const pendingDelta = Number(isPendingReportStatus(b.status)) - Number(isPendingReportStatus(a.status));

    if (pendingDelta !== 0) {
      return pendingDelta;
    }

    return new Date(b.createdAt ?? "").getTime() - new Date(a.createdAt ?? "").getTime();
  });
}
