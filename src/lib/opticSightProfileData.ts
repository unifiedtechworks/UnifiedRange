import type { Schema } from "../../amplify/data/resource";
import type { OpticSightFormValues } from "@/components/OpticSightForm";
import type { OpticSightProfile, SightType } from "@/types";

export type OpticSightProfileRecord = Schema["OpticSightProfile"]["type"];

export function toOpticSightFormValues(optic: OpticSightProfile | OpticSightProfileRecord): OpticSightFormValues {
  return {
    sightType: (optic.sightType ?? "scope") as SightType,
    manufacturer: optic.manufacturer ?? "",
    model: optic.model ?? "",
    reticleOrPinSetup: optic.reticleOrPinSetup ?? "",
    magnification: optic.magnification ?? "",
    sightUnit: optic.sightUnit ?? "",
    clickValue: optic.clickValue ?? "",
    privateNotes: optic.privateNotes ?? "",
    publicNotes: optic.publicNotes ?? ""
  };
}

export function toCreateOpticSightInput(values: OpticSightFormValues, ownerId: string) {
  return {
    ownerId,
    sightType: values.sightType,
    manufacturer: values.manufacturer.trim(),
    model: values.model.trim(),
    reticleOrPinSetup: values.reticleOrPinSetup.trim(),
    magnification: values.magnification.trim(),
    sightUnit: values.sightUnit.trim(),
    clickValue: values.clickValue.trim(),
    privateNotes: values.privateNotes.trim(),
    publicNotes: values.publicNotes.trim()
  };
}

export function toUpdateOpticSightInput(id: string, values: OpticSightFormValues) {
  return {
    id,
    sightType: values.sightType,
    manufacturer: values.manufacturer.trim(),
    model: values.model.trim(),
    reticleOrPinSetup: values.reticleOrPinSetup.trim(),
    magnification: values.magnification.trim(),
    sightUnit: values.sightUnit.trim(),
    clickValue: values.clickValue.trim(),
    privateNotes: values.privateNotes.trim(),
    publicNotes: values.publicNotes.trim()
  };
}

export function recordToOpticSightProfile(record: OpticSightProfileRecord): OpticSightProfile {
  return {
    id: record.id,
    ownerId: record.ownerId,
    sightType: (record.sightType ?? "other") as SightType,
    manufacturer: record.manufacturer,
    model: record.model,
    reticleOrPinSetup: record.reticleOrPinSetup ?? undefined,
    magnification: record.magnification ?? undefined,
    sightUnit: record.sightUnit ?? undefined,
    clickValue: record.clickValue ?? undefined,
    privateNotes: record.privateNotes ?? undefined,
    publicNotes: record.publicNotes ?? undefined,
    createdAt: record.createdAt ?? "",
    updatedAt: record.updatedAt ?? ""
  };
}
