import { PageHeader } from "@/components/PageHeader";
import { ProjectileForm } from "@/components/ProjectileForm";

export default function NewProjectilePage() {
  return (
    <section>
      <PageHeader
        eyebrow="New projectile / ammo"
        title="Create a projectile profile"
        description="Add ammunition now, or use the broader fields for future arrow, bolt, pellet, or other projectile support."
      />
      <ProjectileForm mode="create" cancelHref="/projectiles" />
    </section>
  );
}
