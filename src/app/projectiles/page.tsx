import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { ProjectileProfileList } from "@/components/ProjectileProfileList";

export default function ProjectilesPage() {
  return (
    <section>
      <PageHeader
        eyebrow="Projectiles / ammo"
        title="Inventory and profile notes"
        description="Track ammunition now and keep the model ready for arrows, bolts, and other projectile records later."
        action={
          <Link href="/projectiles/new" className="inline-flex rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
            Add projectile / ammo
          </Link>
        }
      />
      <ProjectileProfileList />
    </section>
  );
}
