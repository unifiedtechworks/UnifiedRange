import { PageHeader } from "@/components/PageHeader";
import { ProjectileProfileEdit } from "@/components/ProjectileProfileEdit";

export default async function EditProjectilePage({ params }: { params: Promise<{ projectileId?: string }> }) {
  const { projectileId } = await params;

  return (
    <section>
      <PageHeader
        eyebrow="Edit projectile / ammo"
        title="Update a projectile profile"
        description="Update a saved private record, or explore the clearly labeled sample editor while signed out."
      />
      <ProjectileProfileEdit projectileId={projectileId} />
    </section>
  );
}
