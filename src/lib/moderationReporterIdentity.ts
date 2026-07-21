import type { UserProfileRecord } from "@/lib/userProfileData";

export interface ReporterIdentity {
  username?: string;
  displayName?: string;
}

interface UsernameReservationRecord {
  ownerId: string;
  username: string;
}

export function buildReporterIdentityMap(
  reservations: UsernameReservationRecord[],
  safelyReadableProfiles: UserProfileRecord[]
) {
  const identities: Record<string, ReporterIdentity> = {};

  for (const reservation of reservations) {
    if (reservation.ownerId && reservation.username) {
      identities[reservation.ownerId] = { username: reservation.username };
    }
  }

  for (const profile of safelyReadableProfiles) {
    if (!profile.ownerId) {
      continue;
    }

    identities[profile.ownerId] = {
      ...identities[profile.ownerId],
      username: identities[profile.ownerId]?.username ?? profile.username ?? undefined,
      displayName: profile.displayName || undefined
    };
  }

  return identities;
}

export function shortInternalId(id: string) {
  return id.length > 10 ? `${id.slice(0, 8)}...` : id;
}

export function getReporterPrimaryLabel(reporterId: string, identity?: ReporterIdentity) {
  if (identity?.username) {
    return `@${identity.username}`;
  }

  if (identity?.displayName) {
    return identity.displayName;
  }

  return shortInternalId(reporterId);
}
