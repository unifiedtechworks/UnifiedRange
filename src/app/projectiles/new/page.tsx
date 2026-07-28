import { PageHeader } from "@/components/PageHeader";
import { ProjectileProfileCreate } from "@/components/ProjectileProfileCreate";

export default function NewProjectilePage() {
  return (
    <section>
      <PageHeader
        eyebrow="New projectile / ammo"
        title="Create a projectile profile"
        description="Add ammunition now, or use the broader fields for arrow, bolt, pellet, or other projectile records. Signed-in users save this record privately."
      />
      <ProjectileProfileCreate />
    </section>
  );
}
