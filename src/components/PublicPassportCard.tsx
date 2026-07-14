import Link from "next/link";
import { Tag } from "@/components/Tag";
import type { SanitizedPublicPassport } from "@/types";

export function PublicPassportCard({ snapshot, sourceLabel }: { snapshot: SanitizedPublicPassport; sourceLabel: string }) {
  return (
    <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-center gap-2">
        <Tag>{snapshot.equipmentType}</Tag>
        <span className="text-xs font-semibold text-moss">{sourceLabel}</span>
      </div>
      <h3 className="mt-3 text-2xl font-bold text-ink">{snapshot.title}</h3>
      <p className="mt-2 text-sm text-ink/65">
        {snapshot.manufacturer} {snapshot.model} - {snapshot.caliber ?? snapshot.category}
      </p>
      <p className="mt-3 text-sm leading-6 text-ink/70">{snapshot.publicNotes ?? "No public notes shared."}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {snapshot.useCaseTags.map((tag) => (
          <Tag key={tag}>{tag}</Tag>
        ))}
      </div>
      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-ink">Optic / sight</dt>
          <dd className="text-ink/65">{snapshot.opticOrSightSummary ?? "Not shared"}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ink">Projectile / ammo</dt>
          <dd className="text-ink/65">{snapshot.projectileSummary ?? "Not shared"}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ink">Public range reports</dt>
          <dd className="text-ink/65">{snapshot.publicRangeSessions.length}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ink">Reactions</dt>
          <dd className="text-ink/65">{snapshot.reactions.helpful + snapshot.reactions.similar + snapshot.reactions.wellDocumented} placeholder reactions</dd>
        </div>
      </dl>
      <Link href={`/discover/passports/${snapshot.id}`} className="mt-5 inline-flex rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
        View public setup
      </Link>
    </article>
  );
}
