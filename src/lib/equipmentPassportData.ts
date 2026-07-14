import type { Schema } from "../../amplify/data/resource";
import type { PassportFormValues } from "@/components/PassportForm";
import type { EquipmentPassport, EquipmentType } from "@/types";

export type EquipmentPassportRecord = Schema["EquipmentPassport"]["type"];

export const defaultPassportCoverPhoto = "https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1200&q=80";

export function splitTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function isNonEmptyString(value: string | null | undefined): value is string {
  return Boolean(value);
}

export function toPassportFormValues(passport: EquipmentPassport | EquipmentPassportRecord): PassportFormValues {
  return {
    equipmentType: (passport.equipmentType ?? "rifle") as EquipmentType,
    nickname: passport.nickname ?? "",
    manufacturer: passport.manufacturer ?? "",
    model: passport.model ?? "",
    caliberCategory: passport.caliber ?? passport.category ?? "",
    opticSightSummary: "opticSightSummary" in passport ? passport.opticSightSummary ?? "" : "",
    projectileAmmoSummary: "projectileAmmoSummary" in passport ? passport.projectileAmmoSummary ?? "" : "",
    useCaseTags: (passport.useCaseTags ?? []).filter(isNonEmptyString).join(", "),
    roundOrShotCount: String(passport.roundOrShotCount ?? 0),
    privateNotes: passport.privateNotes ?? "",
    publicNotes: passport.publicNotes ?? "",
    isPublic: Boolean(passport.isPublic)
  };
}

export function toCreatePassportInput(values: PassportFormValues, ownerId: string) {
  const count = Number(values.roundOrShotCount || 0);
  const caliberCategory = values.caliberCategory.trim();

  return {
    ownerId,
    equipmentType: values.equipmentType,
    nickname: values.nickname.trim(),
    manufacturer: values.manufacturer.trim(),
    model: values.model.trim(),
    category: caliberCategory,
    caliber: caliberCategory,
    opticSightSummary: values.opticSightSummary.trim(),
    projectileAmmoSummary: values.projectileAmmoSummary.trim(),
    accessories: [],
    useCaseTags: splitTags(values.useCaseTags),
    roundOrShotCount: Number.isFinite(count) ? count : 0,
    privateNotes: values.privateNotes.trim(),
    publicNotes: values.publicNotes.trim(),
    coverPhotoUrl: defaultPassportCoverPhoto,
    privateCoverPhotoKey: "",
    isPublic: values.isPublic
  };
}

export function toUpdatePassportInput(id: string, values: PassportFormValues) {
  const count = Number(values.roundOrShotCount || 0);
  const caliberCategory = values.caliberCategory.trim();

  return {
    id,
    equipmentType: values.equipmentType,
    nickname: values.nickname.trim(),
    manufacturer: values.manufacturer.trim(),
    model: values.model.trim(),
    category: caliberCategory,
    caliber: caliberCategory,
    opticSightSummary: values.opticSightSummary.trim(),
    projectileAmmoSummary: values.projectileAmmoSummary.trim(),
    useCaseTags: splitTags(values.useCaseTags),
    roundOrShotCount: Number.isFinite(count) ? count : 0,
    privateNotes: values.privateNotes.trim(),
    publicNotes: values.publicNotes.trim(),
    isPublic: values.isPublic
  };
}

export function recordToEquipmentPassport(record: EquipmentPassportRecord): EquipmentPassport {
  return {
    id: record.id,
    ownerId: record.ownerId,
    equipmentType: (record.equipmentType ?? "other") as EquipmentType,
    nickname: record.nickname,
    manufacturer: record.manufacturer,
    model: record.model,
    category: record.category,
    caliber: record.caliber ?? undefined,
    barrelLength: record.barrelLength ?? undefined,
    twistRate: record.twistRate ?? undefined,
    drawWeight: record.drawWeight ?? undefined,
    drawLength: record.drawLength ?? undefined,
    bowType: record.bowType ?? undefined,
    opticOrSightId: record.opticOrSightId ?? undefined,
    opticSightSummary: record.opticSightSummary ?? undefined,
    accessories: (record.accessories ?? []).filter(isNonEmptyString),
    preferredProjectileId: record.preferredProjectileId ?? undefined,
    projectileAmmoSummary: record.projectileAmmoSummary ?? undefined,
    useCaseTags: (record.useCaseTags ?? []).filter(isNonEmptyString),
    roundOrShotCount: record.roundOrShotCount ?? 0,
    maintenanceNotes: record.maintenanceNotes ?? undefined,
    privateNotes: record.privateNotes ?? undefined,
    publicNotes: record.publicNotes ?? undefined,
    coverPhotoUrl: record.coverPhotoUrl ?? defaultPassportCoverPhoto,
    privateCoverPhotoKey: record.privateCoverPhotoKey ?? undefined,
    isPublic: Boolean(record.isPublic),
    createdAt: record.createdAt ?? "",
    updatedAt: record.updatedAt ?? ""
  };
}
