import Link from "next/link";
import { notFound } from "next/navigation";
import { DetailRow } from "@/components/DetailRow";
import { PageHeader } from "@/components/PageHeader";
import { PublicPhotoPlaceholderList, PublicRangeSessionList, ReactionBar } from "@/components/PublicPassportSections";
import { ReportContentButton } from "@/components/ReportContentButton";
import { Tag } from "@/components/Tag";
import { getSanitizedPublicPassportById } from "@/data/publicDiscovery";

export default function PublicPassportDetailPage({ params }: { params: { publicPassportId: string } }) {
  const passport = getSanitizedPublicPassportById(params.publicPassportId);

  if (!passport) {
    notFound();
  }

  return (
    <section>
      <PageHeader
        eyebrow="Public setup discovery"
        title={passport.title}
        description="Public pages are for Setup Discovery and range-log sharing, with sanitized documentation only."
        action={
          <Link href="/discover" className="inline-flex rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink">
            Back to Discover
          </Link>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <article className="overflow-hidden rounded-md border border-ink/10 bg-white shadow-soft">
          <div className="h-64 bg-cover bg-center" style={{ backgroundImage: `url(${passport.coverPhotoUrl})` }} aria-hidden="true" />
          <div className="p-5">
            <div className="flex flex-wrap gap-2">
              <Tag>{passport.equipmentType}</Tag>
              {passport.useCaseTags.map((tag) => (
                <Tag key={tag}>{tag}</Tag>
              ))}
            </div>
            <dl className="mt-5">
              <DetailRow label="Manufacturer" value={passport.manufacturer} />
              <DetailRow label="Model" value={passport.model} />
              <DetailRow label="Caliber / category" value={passport.caliber ?? passport.category} />
              <DetailRow label="Optic / sight summary" value={passport.opticOrSightSummary} />
              <DetailRow label="Projectile / ammo summary" value={passport.projectileSummary} />
            </dl>
          </div>
        </article>

        <div className="space-y-6">
          <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
            <h3 className="text-xl font-bold text-ink">Public Notes</h3>
            <p className="mt-3 text-sm leading-6 text-ink/70">{passport.publicNotes ?? "No public notes shared."}</p>
          </article>

          <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
            <h3 className="text-xl font-bold text-ink">Reactions</h3>
            <div className="mt-4">
              <ReactionBar passport={passport} />
            </div>
          </article>

          <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
            <h3 className="text-xl font-bold text-ink">Report Content</h3>
            <p className="mt-2 text-sm leading-6 text-ink/65">Help keep discovery focused on safe, legal, privacy-preserving setup documentation.</p>
            <div className="mt-4">
              <ReportContentButton targetLabel={passport.title} />
            </div>
          </article>
        </div>
      </div>

      <section className="mt-6 rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <h3 className="text-xl font-bold text-ink">Public Range-Session Summaries</h3>
        <div className="mt-4">
          <PublicRangeSessionList passport={passport} />
        </div>
      </section>

      <section className="mt-6 rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <h3 className="text-xl font-bold text-ink">Public Target Photo Placeholders</h3>
        <div className="mt-4">
          <PublicPhotoPlaceholderList passport={passport} />
        </div>
      </section>

      <section className="mt-6 rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <h3 className="text-xl font-bold text-ink">Comments</h3>
        <p className="mt-2 text-sm leading-6 text-ink/65">Comments are a placeholder for future moderated discussion. Reporting and moderation workflows will be connected later.</p>
      </section>
    </section>
  );
}
