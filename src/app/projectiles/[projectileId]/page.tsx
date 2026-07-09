import { ProjectileProfileDetail } from "@/components/ProjectileProfileDetail";

export default function ProjectileDetailPage({ params }: { params: { projectileId: string } }) {
  return <ProjectileProfileDetail projectileId={params.projectileId} />;
}
