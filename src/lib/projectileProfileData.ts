import type { Schema } from "../../amplify/data/resource";
import type { ProjectileFormValues } from "@/components/ProjectileForm";
import type { ProjectileProfile, ProjectileType } from "@/types";

export type ProjectileProfileRecord = Schema["ProjectileProfile"]["type"];

export function toProjectileFormValues(projectile: ProjectileProfile | ProjectileProfileRecord): ProjectileFormValues {
  return {
    projectileType: (projectile.projectileType ?? "ammo") as ProjectileType,
    manufacturer: projectile.manufacturer ?? "",
    productLine: projectile.productLine ?? "",
    caliberCategory: projectile.caliber ?? "",
    bulletWeight: projectile.bulletWeight ?? "",
    bulletType: projectile.bulletType ?? "",
    lotNumber: projectile.lotNumber ?? "",
    roundsPurchased: String(projectile.roundsPurchased ?? 0),
    roundsRemaining: String(projectile.roundsRemaining ?? 0),
    arrowShaft: projectile.arrowShaft ?? "",
    arrowSpine: projectile.arrowSpine ?? "",
    pointOrBroadhead: projectile.pointOrBroadhead ?? "",
    fletching: projectile.fletching ?? "",
    totalWeight: projectile.totalWeight ?? "",
    privateNotes: projectile.privateNotes ?? "",
    publicNotes: projectile.publicNotes ?? ""
  };
}

export function toCreateProjectileInput(values: ProjectileFormValues, ownerId: string) {
  const roundsPurchased = Number(values.roundsPurchased || 0);
  const roundsRemaining = Number(values.roundsRemaining || 0);

  return {
    ownerId,
    projectileType: values.projectileType,
    manufacturer: values.manufacturer.trim(),
    productLine: values.productLine.trim(),
    caliber: values.caliberCategory.trim(),
    bulletWeight: values.bulletWeight.trim(),
    bulletType: values.bulletType.trim(),
    lotNumber: values.lotNumber.trim(),
    roundsPurchased: Number.isFinite(roundsPurchased) ? roundsPurchased : 0,
    roundsRemaining: Number.isFinite(roundsRemaining) ? roundsRemaining : 0,
    arrowShaft: values.arrowShaft.trim(),
    arrowSpine: values.arrowSpine.trim(),
    pointOrBroadhead: values.pointOrBroadhead.trim(),
    fletching: values.fletching.trim(),
    totalWeight: values.totalWeight.trim(),
    privateNotes: values.privateNotes.trim(),
    publicNotes: values.publicNotes.trim()
  };
}

export function toUpdateProjectileInput(id: string, values: ProjectileFormValues) {
  const roundsPurchased = Number(values.roundsPurchased || 0);
  const roundsRemaining = Number(values.roundsRemaining || 0);

  return {
    id,
    projectileType: values.projectileType,
    manufacturer: values.manufacturer.trim(),
    productLine: values.productLine.trim(),
    caliber: values.caliberCategory.trim(),
    bulletWeight: values.bulletWeight.trim(),
    bulletType: values.bulletType.trim(),
    lotNumber: values.lotNumber.trim(),
    roundsPurchased: Number.isFinite(roundsPurchased) ? roundsPurchased : 0,
    roundsRemaining: Number.isFinite(roundsRemaining) ? roundsRemaining : 0,
    arrowShaft: values.arrowShaft.trim(),
    arrowSpine: values.arrowSpine.trim(),
    pointOrBroadhead: values.pointOrBroadhead.trim(),
    fletching: values.fletching.trim(),
    totalWeight: values.totalWeight.trim(),
    privateNotes: values.privateNotes.trim(),
    publicNotes: values.publicNotes.trim()
  };
}

export function recordToProjectileProfile(record: ProjectileProfileRecord): ProjectileProfile {
  return {
    id: record.id,
    ownerId: record.ownerId,
    projectileType: (record.projectileType ?? "other") as ProjectileType,
    manufacturer: record.manufacturer,
    productLine: record.productLine,
    caliber: record.caliber ?? undefined,
    bulletWeight: record.bulletWeight ?? undefined,
    bulletType: record.bulletType ?? undefined,
    lotNumber: record.lotNumber ?? undefined,
    roundsPurchased: record.roundsPurchased ?? undefined,
    roundsRemaining: record.roundsRemaining ?? undefined,
    arrowShaft: record.arrowShaft ?? undefined,
    arrowSpine: record.arrowSpine ?? undefined,
    pointOrBroadhead: record.pointOrBroadhead ?? undefined,
    fletching: record.fletching ?? undefined,
    totalWeight: record.totalWeight ?? undefined,
    privateNotes: record.privateNotes ?? undefined,
    publicNotes: record.publicNotes ?? undefined,
    createdAt: record.createdAt ?? "",
    updatedAt: record.updatedAt ?? ""
  };
}
