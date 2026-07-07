import Link from "next/link";
import { getOpticById, getProjectileById } from "@/data/selectors";
import type { EquipmentPassport } from "@/types";
import { Tag } from "@/components/Tag";

export function PassportCard({ passport }: { passport: EquipmentPassport }) {
  const optic = getOpticById(passport.opticOrSightId);
  const projectile = getProjectileById(passport.preferredProjectileId);

  return (
    <Link href={`/passports/${passport.id}`} className="group rounded-md border border-ink/10 bg-white shadow-soft transition hover:-translate-y-0.5 hover:border-moss/40">
      <div
        className="h-36 rounded-t-md bg-cover bg-center"
        style={{ backgroundImage: `url(${passport.coverPhotoUrl})` }}
        aria-hidden="true"
      />
      <div className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Tag>{passport.equipmentType}</Tag>
          <span className="text-xs font-semibold text-ink/55">{passport.isPublic ? "Public snapshot ready" : "Private"}</span>
        </div>
        <h3 className="mt-3 text-lg font-bold text-ink group-hover:text-moss">{passport.nickname}</h3>
        <p className="mt-1 text-sm text-ink/65">
          {passport.manufacturer} {passport.model} · {passport.caliber ?? passport.category}
        </p>
        <dl className="mt-4 grid grid-cols-1 gap-2 text-sm text-ink/70 sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-ink">Optic / sight</dt>
            <dd>{optic ? `${optic.manufacturer} ${optic.model}` : "Not assigned"}</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Projectile</dt>
            <dd>{projectile ? projectile.productLine : "Not assigned"}</dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          {passport.useCaseTags.map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </div>
      </div>
    </Link>
  );
}
