import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { ProjectileForm, type ProjectileFormValues } from "@/components/ProjectileForm";
import { getProjectileById } from "@/data/selectors";

export default function EditProjectilePage({ params }: { params: { projectileId: string } }) {
  const projectile = getProjectileById(params.projectileId);

  if (!projectile) {
    notFound();
  }

  const initialValues: ProjectileFormValues = {
    projectileType: projectile.projectileType,
    manufacturer: projectile.manufacturer,
    productLine: projectile.productLine,
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

  return (
    <section>
      <PageHeader
        eyebrow="Edit projectile / ammo"
        title={projectile.productLine}
        description="Update mock projectile profile values. Saving is local-only until the AWS backend is implemented."
      />
      <ProjectileForm mode="edit" initialValues={initialValues} cancelHref={`/projectiles/${projectile.id}`} />
    </section>
  );
}
