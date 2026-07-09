import Link from "next/link";
import type { OpticSightProfile } from "@/types";
import { DetailRow } from "@/components/DetailRow";
import { Tag } from "@/components/Tag";

export function OpticSightCard({ optic, sourceLabel }: { optic: OpticSightProfile; sourceLabel?: string }) {
  return (
    <Link href={`/optics/${optic.id}`} className="block rounded-md border border-ink/10 bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-steel/40">
      <div className="flex flex-wrap items-center gap-2">
        <Tag>{optic.sightType.replace("_", " ")}</Tag>
        {sourceLabel ? <span className="text-xs font-semibold text-moss">{sourceLabel}</span> : null}
      </div>
      <h3 className="mt-3 text-xl font-bold text-ink">
        {optic.manufacturer} {optic.model}
      </h3>
      <p className="mt-2 text-sm leading-6 text-ink/65">{optic.publicNotes ?? "Sight profile notes."}</p>
      <dl className="mt-4">
        <DetailRow label="Reticle / pin setup" value={optic.reticleOrPinSetup} />
        <DetailRow label="Magnification" value={optic.magnification} />
        <DetailRow label="Sight unit" value={optic.sightUnit} />
      </dl>
    </Link>
  );
}
