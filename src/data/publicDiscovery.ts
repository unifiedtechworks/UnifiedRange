import { equipmentPassports, optics, projectiles, rangeSessions, targetPhotos } from "@/data/mockData";
import { sanitizePublicPassport } from "@/lib/sanitizePublicPassport";

export const sanitizedPublicPassports = equipmentPassports
  .filter((passport) => passport.isPublic)
  .map((passport) =>
    sanitizePublicPassport({
      passport,
      optic: optics.find((optic) => optic.id === passport.opticOrSightId),
      projectile: projectiles.find((projectile) => projectile.id === passport.preferredProjectileId),
      rangeSessions: rangeSessions.filter((session) => session.equipmentPassportId === passport.id),
      targetPhotos
    })
  );

export function getSanitizedPublicPassportById(id?: string | null) {
  return sanitizedPublicPassports.find((passport) => passport.id === id);
}
