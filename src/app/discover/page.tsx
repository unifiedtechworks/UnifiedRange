import { PageHeader } from "@/components/PageHeader";
import { Tag } from "@/components/Tag";
import { publicPassports } from "@/data/mockData";

export default function DiscoverPage() {
  return (
    <section>
      <PageHeader
        eyebrow="Discover"
        title="Public setup snapshots"
        description="Browse sanitized equipment profiles shared for research, comparison, and community setup documentation."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {publicPassports.map((snapshot) => (
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
              <dl className="mt-5 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <dt className="font-semibold text-ink">Sessions</dt>
                  <dd className="text-ink/65">{snapshot.publicStats.loggedSessions}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-ink">Care logs</dt>
                  <dd className="text-ink/65">{snapshot.publicStats.maintenanceEntries}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-ink">Status</dt>
                  <dd className="text-ink/65">{snapshot.publicStats.lastUpdatedLabel}</dd>
                </div>
              </dl>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
