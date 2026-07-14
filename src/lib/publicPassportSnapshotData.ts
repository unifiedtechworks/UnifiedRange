import type { Schema } from "../../amplify/data/resource";
import { allowedPublicPassportFields, hiddenPublicPassportFields } from "@/lib/sanitizePublicPassport";
import type { EquipmentPassport, EquipmentType, PublicRangeSessionSummary, PublicTargetPhotoPlaceholder, SanitizedPublicPassport } from "@/types";

export type PublicPassportSnapshotRecord = Schema["PublicPassportSnapshot"]["type"];

function filterStrings(value: Array<string | null> | null | undefined) {
  return (value ?? []).filter((item): item is string => Boolean(item));
}

function normalizePublicRangeSessions(value: unknown): PublicRangeSessionSummary[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const sessions: PublicRangeSessionSummary[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const candidate = item as Partial<PublicRangeSessionSummary>;

    if (!candidate.id || !candidate.date || !candidate.distanceLabel || !candidate.discipline) {
      continue;
    }

    sessions.push({
      id: candidate.id,
      date: candidate.date,
      distanceLabel: candidate.distanceLabel,
      discipline: candidate.discipline,
      position: candidate.position ?? "",
      supportType: candidate.supportType ?? "",
      groupOrScore: candidate.groupOrScore,
      confidenceRating: candidate.confidenceRating ?? 0,
      notes: candidate.notes
    });
  }

  return sessions;
}

function normalizePublicPhotoPlaceholders(value: unknown): PublicTargetPhotoPlaceholder[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const placeholders: PublicTargetPhotoPlaceholder[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const candidate = item as Partial<PublicTargetPhotoPlaceholder>;

    if (!candidate.id) {
      continue;
    }

    placeholders.push({
      id: candidate.id,
      caption: candidate.caption,
      manualEntry: candidate.manualEntry
    });
  }

  return placeholders;
}

export function toPublicSnapshotInput(passport: EquipmentPassport, ownerId: string) {
  return {
    ownerId,
    equipmentPassportId: passport.id,
    title: passport.nickname,
    equipmentType: passport.equipmentType,
    manufacturer: passport.manufacturer,
    model: passport.model,
    category: passport.category,
    caliber: passport.caliber ?? passport.category,
    opticOrSightSummary: passport.opticSightSummary ?? "",
    projectileSummary: passport.projectileAmmoSummary ?? "",
    useCaseTags: passport.useCaseTags,
    publicNotes: passport.publicNotes ?? "",
    coverPhotoUrl: "",
    publicStats: {
      loggedSessions: 0,
      maintenanceEntries: 0,
      lastUpdatedLabel: new Date().toISOString()
    },
    publicRangeSessions: [],
    publicPhotoPlaceholders: []
  };
}

export function recordToSanitizedPublicPassport(record: PublicPassportSnapshotRecord): SanitizedPublicPassport {
  return {
    id: record.id,
    equipmentPassportId: record.equipmentPassportId,
    title: record.title,
    equipmentType: (record.equipmentType ?? "other") as EquipmentType,
    manufacturer: record.manufacturer ?? "",
    model: record.model ?? "",
    category: record.category ?? "",
    caliber: record.caliber ?? undefined,
    opticOrSightSummary: record.opticOrSightSummary ?? undefined,
    projectileSummary: record.projectileSummary ?? undefined,
    useCaseTags: filterStrings(record.useCaseTags),
    publicNotes: record.publicNotes ?? undefined,
    coverPhotoUrl: record.coverPhotoUrl ?? undefined,
    publicRangeSessions: normalizePublicRangeSessions(record.publicRangeSessions),
    publicPhotoPlaceholders: normalizePublicPhotoPlaceholders(record.publicPhotoPlaceholders),
    hiddenFields: hiddenPublicPassportFields,
    publicFields: allowedPublicPassportFields,
    reactions: {
      helpful: 0,
      similar: 0,
      wellDocumented: 0
    }
  };
}
