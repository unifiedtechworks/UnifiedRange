import type { Schema } from "../../amplify/data/resource";
import type { MaintenanceLogFormValues } from "@/components/MaintenanceLogForm";
import type { EquipmentPassport, MaintenanceLogEntry } from "@/types";

export type MaintenanceLogEntryRecord = Schema["MaintenanceLogEntry"]["type"];
export type MaintenancePassportRecord = Schema["EquipmentPassport"]["type"];

export interface SelectOption {
  id: string;
  label: string;
}

export function maintenancePassportLabel(passport: Pick<EquipmentPassport, "nickname" | "manufacturer" | "model"> | MaintenancePassportRecord) {
  return `${passport.nickname} - ${passport.manufacturer} ${passport.model}`;
}

export function maintenancePassportOptions(passports: MaintenancePassportRecord[]): SelectOption[] {
  return passports.map((passport) => ({ id: passport.id, label: maintenancePassportLabel(passport) }));
}

export function toMaintenanceLogFormValues(entry: MaintenanceLogEntry | MaintenanceLogEntryRecord): MaintenanceLogFormValues {
  return {
    equipmentPassportId: entry.equipmentPassportId ?? "",
    date: entry.date ?? "",
    roundOrShotCount: String(entry.roundOrShotCount ?? 0),
    maintenanceType: entry.maintenanceType ?? "",
    partsChanged: (entry.partsChanged ?? []).join(", "),
    cleaningNotes: entry.cleaningNotes ?? entry.notes ?? "",
    torqueCheckNotes: entry.torqueCheckNotes ?? "",
    privateNotes: entry.privateNotes ?? ""
  };
}

export function toCreateMaintenanceInput(values: MaintenanceLogFormValues, ownerId: string) {
  const count = Number(values.roundOrShotCount || 0);
  const partsChanged = values.partsChanged
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    ownerId,
    equipmentPassportId: values.equipmentPassportId,
    date: values.date,
    roundOrShotCount: Number.isFinite(count) ? count : 0,
    maintenanceType: values.maintenanceType.trim(),
    partsChanged,
    cleaningNotes: values.cleaningNotes.trim(),
    torqueCheckNotes: values.torqueCheckNotes.trim(),
    privateNotes: values.privateNotes.trim(),
    notes: values.cleaningNotes.trim()
  };
}

export function toUpdateMaintenanceInput(id: string, values: MaintenanceLogFormValues) {
  const count = Number(values.roundOrShotCount || 0);
  const partsChanged = values.partsChanged
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    id,
    equipmentPassportId: values.equipmentPassportId,
    date: values.date,
    roundOrShotCount: Number.isFinite(count) ? count : 0,
    maintenanceType: values.maintenanceType.trim(),
    partsChanged,
    cleaningNotes: values.cleaningNotes.trim(),
    torqueCheckNotes: values.torqueCheckNotes.trim(),
    privateNotes: values.privateNotes.trim(),
    notes: values.cleaningNotes.trim()
  };
}

export function recordToMaintenanceLogEntry(record: MaintenanceLogEntryRecord): MaintenanceLogEntry {
  return {
    id: record.id,
    ownerId: record.ownerId,
    equipmentPassportId: record.equipmentPassportId,
    date: record.date,
    roundOrShotCount: record.roundOrShotCount ?? 0,
    maintenanceType: record.maintenanceType,
    partsChanged: (record.partsChanged ?? []).filter((part): part is string => Boolean(part)),
    cleaningNotes: record.cleaningNotes ?? undefined,
    torqueCheckNotes: record.torqueCheckNotes ?? undefined,
    privateNotes: record.privateNotes ?? undefined,
    notes: record.notes ?? undefined,
    createdAt: record.createdAt ?? "",
    updatedAt: record.updatedAt ?? ""
  };
}
