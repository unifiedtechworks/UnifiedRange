import type {
  EquipmentPassport,
  OpticSightProfile,
  ProjectileProfile,
  RangeSession,
  SanitizedPublicPassport,
  TargetPhoto
} from "@/types";

interface SanitizePublicPassportInput {
  passport: EquipmentPassport;
  optic?: OpticSightProfile;
  projectile?: ProjectileProfile;
  rangeSessions: RangeSession[];
  targetPhotos: TargetPhoto[];
}

export const hiddenPublicPassportFields = [
  "Private notes",
  "Serial numbers if added later",
  "Lot numbers",
  "Purchase records and inventory details",
  "Exact home, range, or hunting locations",
  "Private target photos",
  "Private maintenance notes",
  "Image metadata and EXIF data",
  "Owner private profile details",
  "Personal documents or sensitive personal info"
];

export const allowedPublicPassportFields = [
  "Equipment type",
  "Nickname or public title",
  "Manufacturer and model",
  "Caliber or category",
  "Optic / sight summary",
  "Projectile / ammo summary",
  "Use case tags",
  "Public notes",
  "Public range-session summaries",
  "Public target photo placeholders"
];

export function sanitizePublicPassport({
  passport,
  optic,
  projectile,
  rangeSessions,
  targetPhotos
}: SanitizePublicPassportInput): SanitizedPublicPassport {
  const publicRangeSessions = rangeSessions
    .filter((session) => session.isPublicSummary)
    .map((session) => ({
      id: session.id,
      date: session.date,
      distanceLabel: `${session.distance} ${session.distanceUnit}`,
      discipline: session.discipline,
      position: session.position,
      supportType: session.supportType,
      groupOrScore: session.groupSize ?? session.score,
      confidenceRating: session.confidenceRating,
      notes: session.sessionNotes
    }));

  const publicSessionIds = new Set(publicRangeSessions.map((session) => session.id));
  const publicPhotoPlaceholders = targetPhotos
    .filter((photo) => photo.isPublic && publicSessionIds.has(photo.rangeSessionId))
    .map((photo) => ({
      id: photo.id,
      caption: photo.caption,
      manualEntry: photo.manuallyEnteredGroupSize ?? photo.manuallyEnteredScore
    }));

  return {
    id: `public-${passport.id}`,
    equipmentPassportId: passport.id,
    title: passport.nickname,
    equipmentType: passport.equipmentType,
    manufacturer: passport.manufacturer,
    model: passport.model,
    category: passport.category,
    caliber: passport.caliber,
    opticOrSightSummary: optic ? `${optic.manufacturer} ${optic.model}` : undefined,
    projectileSummary: projectile ? `${projectile.manufacturer} ${projectile.productLine}` : undefined,
    useCaseTags: passport.useCaseTags,
    publicNotes: passport.publicNotes,
    coverPhotoUrl: passport.coverPhotoUrl,
    publicRangeSessions,
    publicPhotoPlaceholders,
    hiddenFields: hiddenPublicPassportFields,
    publicFields: allowedPublicPassportFields,
    reactions: {
      helpful: 12,
      similar: 4,
      wellDocumented: 9
    }
  };
}
