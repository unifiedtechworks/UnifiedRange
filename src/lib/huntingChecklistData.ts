import type { Schema } from "../../amplify/data/resource";
import type { HuntingReadinessFormValues } from "@/components/HuntingReadinessForm";
import type { EquipmentPassport, HuntingChecklist, HuntingChecklistItem } from "@/types";

export type HuntingChecklistRecord = Schema["HuntingChecklist"]["type"];
export type HuntingPassportRecord = Schema["EquipmentPassport"]["type"];

export interface SelectOption {
  id: string;
  label: string;
}

export function huntingPassportLabel(passport: Pick<EquipmentPassport, "nickname" | "manufacturer" | "model"> | HuntingPassportRecord) {
  return `${passport.nickname} - ${passport.manufacturer} ${passport.model}`;
}

export function huntingPassportOptions(passports: HuntingPassportRecord[]): SelectOption[] {
  return passports.map((passport) => ({ id: passport.id, label: huntingPassportLabel(passport) }));
}

export function normalizeChecklistItems(value: unknown): HuntingChecklistItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const candidate = item as Partial<HuntingChecklistItem>;
      if (!candidate.label) {
        return null;
      }

      return {
        id: candidate.id ?? `readiness-item-${index + 1}`,
        label: candidate.label,
        isComplete: Boolean(candidate.isComplete)
      };
    })
    .filter((item): item is HuntingChecklistItem => Boolean(item));
}

export function toHuntingReadinessFormValues(checklist: HuntingChecklist | HuntingChecklistRecord): HuntingReadinessFormValues {
  return {
    huntName: checklist.huntName ?? "",
    equipmentPassportId: checklist.equipmentPassportId ?? "",
    season: checklist.season ?? "",
    species: checklist.species ?? "",
    checklistItems: normalizeChecklistItems(checklist.checklistItems),
    notes: checklist.notes ?? ""
  };
}

export function toCreateHuntingChecklistInput(values: HuntingReadinessFormValues, ownerId: string) {
  return {
    ownerId,
    equipmentPassportId: values.equipmentPassportId,
    huntName: values.huntName.trim(),
    season: values.season.trim(),
    species: values.species.trim(),
    checklistItems: values.checklistItems,
    notes: values.notes.trim()
  };
}

export function toUpdateHuntingChecklistInput(id: string, values: HuntingReadinessFormValues) {
  return {
    id,
    equipmentPassportId: values.equipmentPassportId,
    huntName: values.huntName.trim(),
    season: values.season.trim(),
    species: values.species.trim(),
    checklistItems: values.checklistItems,
    notes: values.notes.trim()
  };
}

export function recordToHuntingChecklist(record: HuntingChecklistRecord): HuntingChecklist {
  return {
    id: record.id,
    ownerId: record.ownerId,
    equipmentPassportId: record.equipmentPassportId,
    huntName: record.huntName,
    season: record.season ?? "",
    species: record.species ?? "",
    checklistItems: normalizeChecklistItems(record.checklistItems),
    notes: record.notes ?? undefined,
    createdAt: record.createdAt ?? "",
    updatedAt: record.updatedAt ?? ""
  };
}
