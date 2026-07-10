import { ProjectileProfileDetail } from "@/components/ProjectileProfileDetail";

export default async function ProjectileDetailPage({ params }: { params: Promise<{ projectileId?: string }> }) {
  const { projectileId } = await params;
  return <ProjectileProfileDetail projectileId={projectileId} />;
}
