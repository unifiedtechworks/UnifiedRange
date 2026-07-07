import Link from "next/link";
import type { ProjectileProfile } from "@/types";
import { DetailRow } from "@/components/DetailRow";
import { Tag } from "@/components/Tag";

export function ProjectileCard({ projectile }: { projectile: ProjectileProfile }) {
  return (
    <Link href={`/projectiles/${projectile.id}`} className="block rounded-md border border-ink/10 bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-clay/40">
      <div className="flex flex-wrap items-center gap-2">
        <Tag>{projectile.projectileType}</Tag>
        <span className="text-xs font-semibold text-ink/55">Lot details private by default</span>
      </div>
      <h3 className="mt-3 text-xl font-bold text-ink">{projectile.productLine}</h3>
      <p className="mt-1 text-sm text-ink/65">{projectile.manufacturer}</p>
      <dl className="mt-4">
        <DetailRow label="Caliber / category" value={projectile.caliber} />
        <DetailRow label="Bullet / arrow detail" value={projectile.bulletWeight ?? projectile.arrowSpine ?? projectile.totalWeight} />
        <DetailRow label="Remaining" value={projectile.roundsRemaining ?? "Tracked in notes"} />
      </dl>
    </Link>
  );
}
