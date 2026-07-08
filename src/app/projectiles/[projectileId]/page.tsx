import Link from "next/link";
import { notFound } from "next/navigation";
import { DetailRow } from "@/components/DetailRow";
import { PageHeader } from "@/components/PageHeader";
import { Tag } from "@/components/Tag";
import { getProjectileById } from "@/data/selectors";

export default function ProjectileDetailPage({ params }: { params: { projectileId: string } }) {
  const projectile = getProjectileById(params.projectileId);

  if (!projectile) {
    notFound();
  }

  return (
    <section>
      <PageHeader
        eyebrow="Projectiles / ammo"
        title={projectile.productLine}
        description={projectile.publicNotes ?? "Private projectile profile notes."}
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/projectiles" className="inline-flex justify-center rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink">
              Back to Projectiles / Ammo
            </Link>
            <Link href={`/projectiles/${projectile.id}/edit`} className="inline-flex justify-center rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
              Edit profile
            </Link>
          </div>
        }
      />
      <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <div className="flex flex-wrap gap-2">
          <Tag>{projectile.projectileType}</Tag>
          <Tag>{projectile.caliber ?? "category pending"}</Tag>
        </div>
        <dl className="mt-5 grid gap-x-6 md:grid-cols-2">
          <DetailRow label="Manufacturer" value={projectile.manufacturer} />
          <DetailRow label="Product line" value={projectile.productLine} />
          <DetailRow label="Caliber / category" value={projectile.caliber} />
          <DetailRow label="Bullet weight" value={projectile.bulletWeight} />
          <DetailRow label="Bullet type" value={projectile.bulletType} />
          <DetailRow label="Lot number" value={projectile.lotNumber ? "Private record exists" : "Not recorded"} />
          <DetailRow label="Purchased" value={projectile.roundsPurchased} />
          <DetailRow label="Remaining" value={projectile.roundsRemaining} />
          <DetailRow label="Arrow shaft" value={projectile.arrowShaft} />
          <DetailRow label="Arrow spine" value={projectile.arrowSpine} />
          <DetailRow label="Point / broadhead" value={projectile.pointOrBroadhead} />
          <DetailRow label="Fletching" value={projectile.fletching} />
          <DetailRow label="Total weight" value={projectile.totalWeight} />
        </dl>
      </article>
    </section>
  );
}
