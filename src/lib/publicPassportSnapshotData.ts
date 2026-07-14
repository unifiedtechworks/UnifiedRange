import type { Schema } from "../../amplify/data/resource";
import { allowedPublicPassportFields, hiddenPublicPassportFields } from "@/lib/sanitizePublicPassport";
import type { EquipmentPassport, EquipmentType, PublicRangeSessionSummary, PublicTargetPhotoPlaceholder, SanitizedPublicPassport } from "@/types";

export type PublicPassportSnapshotRecord = Schema["PublicPassportSnapshot"]["type"];

type PublicPassportSnapshotInput = {
  ownerId: string;
  equipmentPassportId: string;
  title: string;
  equipmentType: EquipmentType;
  manufacturer?: string;
  model?: string;
  category?: string;
  caliber?: string;
  opticOrSightSummary?: string;
  projectileSummary?: string;
  useCaseTags?: string[];
  publicNotes?: string;
  coverPhotoUrl?: string;
};

function filterStrings(value: Array<string | null> | null | undefined) {
  return (value ?? []).filter((item): item is string => Boolean(item));
}

function omitUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)) as T;
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

export function buildPublicPassportSnapshotInput(passport: EquipmentPassport, ownerId: string) {
  const input: PublicPassportSnapshotInput = {
    ownerId,
    equipmentPassportId: passport.id,
    title: passport.nickname,
    equipmentType: passport.equipmentType,
    manufacturer: passport.manufacturer,
    model: passport.model,
    category: passport.category,
    caliber: passport.caliber ?? passport.category,
    opticOrSightSummary: passport.opticSightSummary || undefined,
    projectileSummary: passport.projectileAmmoSummary || undefined,
    useCaseTags: passport.useCaseTags,
    publicNotes: passport.publicNotes || undefined
  };

  return omitUndefined(input);
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
