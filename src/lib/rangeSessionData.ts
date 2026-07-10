import type { Schema } from "../../amplify/data/resource";
import type { RangeSessionFormValues } from "@/components/RangeSessionForm";
import type { DistanceUnit, EquipmentPassport, OpticSightProfile, ProjectileProfile, RangeSession } from "@/types";

export type RangeSessionRecord = Schema["RangeSession"]["type"];
export type EquipmentPassportRecord = Schema["EquipmentPassport"]["type"];
export type ProjectileProfileRecord = Schema["ProjectileProfile"]["type"];
export type OpticSightProfileRecord = Schema["OpticSightProfile"]["type"];

export interface SelectOption {
  id: string;
  label: string;
}

export interface SavedSessionRelations {
  passports: EquipmentPassportRecord[];
  projectiles: ProjectileProfileRecord[];
  optics: OpticSightProfileRecord[];
}

export function equipmentPassportLabel(passport: Pick<EquipmentPassport, "nickname" | "manufacturer" | "model"> | EquipmentPassportRecord) {
  return `${passport.nickname} - ${passport.manufacturer} ${passport.model}`;
}

export function projectileProfileLabel(projectile: Pick<ProjectileProfile, "manufacturer" | "productLine" | "caliber"> | ProjectileProfileRecord) {
  return `${projectile.manufacturer} ${projectile.productLine}${projectile.caliber ? ` (${projectile.caliber})` : ""}`;
}

export function opticSightProfileLabel(optic: Pick<OpticSightProfile, "manufacturer" | "model" | "sightType"> | OpticSightProfileRecord) {
  return `${optic.manufacturer} ${optic.model}${optic.sightType ? ` (${String(optic.sightType).replace("_", " ")})` : ""}`;
}

export function relationOptions(relations: SavedSessionRelations) {
  return {
    passportOptions: relations.passports.map((passport) => ({ id: passport.id, label: equipmentPassportLabel(passport) })),
    projectileOptions: relations.projectiles.map((projectile) => ({ id: projectile.id, label: projectileProfileLabel(projectile) })),
    opticOptions: relations.optics.map((optic) => ({ id: optic.id, label: opticSightProfileLabel(optic) }))
  };
}

export function toRangeSessionFormValues(session: RangeSession | RangeSessionRecord): RangeSessionFormValues {
  return {
    date: session.date ?? "",
    equipmentPassportId: session.equipmentPassportId ?? "",
    projectileProfileId: session.projectileProfileId ?? "",
    opticSightId: "opticSightProfileId" in session ? session.opticSightProfileId ?? "" : session.opticSightProfileId ?? "",
    distance: String(session.distance ?? ""),
    distanceUnit: (session.distanceUnit ?? "yards") as DistanceUnit,
    discipline: session.discipline ?? "",
    position: session.position ?? "",
    supportType: session.supportType ?? "",
    weatherNotes: session.weatherNotes ?? "",
    windNotesFreeText: session.windNotesFreeText ?? "",
    groupSizeOrScore: session.groupSize ?? session.score ?? "",
    isColdBore: Boolean(session.isColdBore),
    isCleanBarrel: Boolean(session.isCleanBarrel),
    isSuppressed: Boolean(session.isSuppressed),
    confidenceRating: String(session.confidenceRating ?? 3),
    sessionNotes: session.sessionNotes ?? "",
    targetPhotoNote: "",
    targetManualEntry: ""
  };
}

export function toCreateRangeSessionInput(values: RangeSessionFormValues, ownerId: string) {
  const distance = Number(values.distance || 0);
  const confidenceRating = Number(values.confidenceRating || 3);

  return {
    ownerId,
    equipmentPassportId: values.equipmentPassportId,
    projectileProfileId: values.projectileProfileId || undefined,
    opticSightProfileId: values.opticSightId || undefined,
    date: values.date,
    distance: Number.isFinite(distance) ? distance : 0,
    distanceUnit: values.distanceUnit,
    discipline: values.discipline.trim(),
    position: values.position.trim(),
    supportType: values.supportType.trim(),
    weatherNotes: values.weatherNotes.trim(),
    windNotesFreeText: values.windNotesFreeText.trim(),
    groupSize: values.groupSizeOrScore.trim(),
    score: "",
    isColdBore: values.isColdBore,
    isCleanBarrel: values.isCleanBarrel,
    isSuppressed: values.isSuppressed,
    confidenceRating: Number.isFinite(confidenceRating) ? confidenceRating : 3,
    sessionNotes: values.sessionNotes.trim(),
    isPublicSummary: false
  };
}

export function toUpdateRangeSessionInput(id: string, values: RangeSessionFormValues) {
  const distance = Number(values.distance || 0);
  const confidenceRating = Number(values.confidenceRating || 3);

  return {
    id,
    equipmentPassportId: values.equipmentPassportId,
    projectileProfileId: values.projectileProfileId || undefined,
    opticSightProfileId: values.opticSightId || undefined,
    date: values.date,
    distance: Number.isFinite(distance) ? distance : 0,
    distanceUnit: values.distanceUnit,
    discipline: values.discipline.trim(),
    position: values.position.trim(),
    supportType: values.supportType.trim(),
    weatherNotes: values.weatherNotes.trim(),
    windNotesFreeText: values.windNotesFreeText.trim(),
    groupSize: values.groupSizeOrScore.trim(),
    score: "",
    isColdBore: values.isColdBore,
    isCleanBarrel: values.isCleanBarrel,
    isSuppressed: values.isSuppressed,
    confidenceRating: Number.isFinite(confidenceRating) ? confidenceRating : 3,
    sessionNotes: values.sessionNotes.trim()
  };
}

export function recordToRangeSession(record: RangeSessionRecord): RangeSession {
  return {
    id: record.id,
    ownerId: record.ownerId,
    equipmentPassportId: record.equipmentPassportId,
    projectileProfileId: record.projectileProfileId ?? undefined,
    opticSightProfileId: record.opticSightProfileId ?? undefined,
    date: record.date,
    distance: record.distance,
    distanceUnit: (record.distanceUnit ?? "yards") as DistanceUnit,
    discipline: record.discipline ?? "Range session",
    position: record.position ?? "",
    supportType: record.supportType ?? "",
    weatherNotes: record.weatherNotes ?? undefined,
    windNotesFreeText: record.windNotesFreeText ?? undefined,
    groupSize: record.groupSize ?? undefined,
    score: record.score ?? undefined,
    isColdBore: Boolean(record.isColdBore),
    isCleanBarrel: Boolean(record.isCleanBarrel),
    isSuppressed: Boolean(record.isSuppressed),
    confidenceRating: Math.min(5, Math.max(1, record.confidenceRating ?? 3)) as RangeSession["confidenceRating"],
    sessionNotes: record.sessionNotes ?? undefined,
    isPublicSummary: Boolean(record.isPublicSummary),
    createdAt: record.createdAt ?? "",
    updatedAt: record.updatedAt ?? ""
  };
}
