import { DetailRow } from "@/components/DetailRow";
import { PageHeader } from "@/components/PageHeader";
import { projectiles } from "@/data/mockData";

export default function ProjectilesPage() {
  return (
    <section>
      <PageHeader
        eyebrow="Projectiles / ammo"
        title="Inventory and profile notes"
        description="Track ammunition now and keep the model ready for arrows, bolts, and other projectile records later."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projectiles.map((projectile) => (
          <article key={projectile.id} className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-clay">{projectile.projectileType}</p>
            <h3 className="mt-2 text-xl font-bold text-ink">{projectile.productLine}</h3>
            <p className="mt-1 text-sm text-ink/65">{projectile.manufacturer}</p>
            <dl className="mt-4">
              <DetailRow label="Caliber / category" value={projectile.caliber} />
              <DetailRow label="Bullet weight" value={projectile.bulletWeight} />
              <DetailRow label="Bullet type" value={projectile.bulletType} />
              <DetailRow label="Rounds remaining" value={projectile.roundsRemaining} />
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
