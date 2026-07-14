import {
  equipmentPassports,
  huntingChecklists,
  maintenanceEntries,
  optics,
  projectiles,
  rangeSessions,
  targetPhotos
} from "@/data/mockData";

export function getPassportById(id?: string | null) {
  return equipmentPassports.find((passport) => passport.id === id);
}

export function getProjectileById(id?: string | null) {
  return projectiles.find((projectile) => projectile.id === id);
}

export function getOpticById(id?: string | null) {
  return optics.find((optic) => optic.id === id);
}

export function getSessionById(id?: string | null) {
  return rangeSessions.find((session) => session.id === id);
}

export function isDemoPassportId(id?: string | null) {
  return Boolean(getPassportById(id));
}

export function isDemoProjectileId(id?: string | null) {
  return Boolean(getProjectileById(id));
}

export function isDemoOpticId(id?: string | null) {
  return Boolean(getOpticById(id));
}

export function isDemoSessionId(id?: string | null) {
  return Boolean(getSessionById(id));
}

export function getMaintenanceById(id?: string | null) {
  return maintenanceEntries.find((entry) => entry.id === id);
}

export function isDemoMaintenanceId(id?: string | null) {
  return Boolean(getMaintenanceById(id));
}

export function getChecklistById(id?: string | null) {
  return huntingChecklists.find((checklist) => checklist.id === id);
}

export function isDemoChecklistId(id?: string | null) {
  return Boolean(getChecklistById(id));
}

export function getSessionsForPassport(passportId: string) {
  return rangeSessions.filter((session) => session.equipmentPassportId === passportId);
}

export function getMaintenanceForPassport(passportId: string) {
  return maintenanceEntries.filter((entry) => entry.equipmentPassportId === passportId);
}

export function getChecklistForPassport(passportId: string) {
  return huntingChecklists.find((checklist) => checklist.equipmentPassportId === passportId);
}

export function getTargetPhotosForSession(sessionId: string) {
  return targetPhotos.filter((photo) => photo.rangeSessionId === sessionId);
}
