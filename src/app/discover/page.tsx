import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Tag } from "@/components/Tag";
import { sanitizedPublicPassports } from "@/data/publicDiscovery";

export default function DiscoverPage() {
  return (
    <section>
      <PageHeader
        eyebrow="Discover"
        title="Public setup snapshots"
        description="Browse sanitized equipment profiles shared for setup discovery, range-log context, and community documentation."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {sanitizedPublicPassports.map((snapshot) => (
          <article key={snapshot.id} className="overflow-hidden rounded-md border border-ink/10 bg-white shadow-soft">
            <div className="h-56 bg-cover bg-center" style={{ backgroundImage: `url(${snapshot.coverPhotoUrl})` }} aria-hidden="true" />
            <div className="p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-steel">{snapshot.equipmentType}</p>
              <h3 className="mt-2 text-2xl font-bold text-ink">{snapshot.title}</h3>
              <p className="mt-2 text-sm text-ink/65">
                {snapshot.manufacturer} {snapshot.model} · {snapshot.caliber ?? snapshot.category}
              </p>
              <p className="mt-3 text-sm leading-6 text-ink/70">{snapshot.publicNotes}</p>
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
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
