import { PageHeader } from "@/components/PageHeader";
import { ProjectileProfileEdit } from "@/components/ProjectileProfileEdit";

export default async function EditProjectilePage({ params }: { params: Promise<{ projectileId?: string }> }) {
  const { projectileId } = await params;

  return (
    <section>
      <PageHeader
        eyebrow="Edit projectile / ammo"
        title="Update a projectile profile"
        description="Signed-in users edit saved AppSync records. Demo profiles keep local placeholder behavior."
      />
      <ProjectileProfileEdit projectileId={projectileId} />
    </section>
  );
}
