import Link from "next/link";
import { notFound } from "next/navigation";
import { DetailRow } from "@/components/DetailRow";
import { PageHeader } from "@/components/PageHeader";
import { PublicPhotoPlaceholderList, PublicRangeSessionList } from "@/components/PublicPassportSections";
import { PublicPreviewActions } from "@/components/PublicPreviewActions";
import { Tag } from "@/components/Tag";
import { rangeSessions, targetPhotos } from "@/data/mockData";
import { getOpticById, getPassportById, getProjectileById } from "@/data/selectors";
import { sanitizePublicPassport } from "@/lib/sanitizePublicPassport";

export default function PublicPassportPreviewPage({ params }: { params: { passportId: string } }) {
  const passport = getPassportById(params.passportId);

  if (!passport) {
    notFound();
  }

  const optic = getOpticById(passport.opticOrSightId);
  const projectile = getProjectileById(passport.preferredProjectileId);
  const sanitized = sanitizePublicPassport({
    passport,
    optic,
    projectile,
    rangeSessions: rangeSessions.filter((session) => session.equipmentPassportId === passport.id),
    targetPhotos
  });

  return (
    <section>
      <PageHeader
        eyebrow="Public passport preview"
        title={passport.nickname}
        description="Review the private record beside the sanitized public version before publishing anything to discovery."
        action={
          <Link href={`/passports/${passport.id}`} className="inline-flex rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink">
            Back to passport
          </Link>
        }
      />

      <div className="mb-6 rounded-md border border-clay/25 bg-clay/10 p-4">
        <h3 className="text-base font-bold text-ink">Public Sharing Warning</h3>
        <p className="mt-2 text-sm leading-6 text-ink/70">
          Do not share serial numbers, exact locations, purchase records, private notes, image metadata, personal documents, or sensitive personal information.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
          <h3 className="text-xl font-bold text-ink">Private Passport Summary</h3>
          <p className="mt-2 text-sm leading-6 text-ink/65">This side may reference private-only records and is not the public output.</p>
          <dl className="mt-4">
            <DetailRow label="Nickname" value={passport.nickname} />
            <DetailRow label="Manufacturer" value={passport.manufacturer} />
            <DetailRow label="Model" value={passport.model} />
            <DetailRow label="Caliber / category" value={passport.caliber ?? passport.category} />
            <DetailRow label="Optic / sight" value={optic ? `${optic.manufacturer} ${optic.model}` : undefined} />
            <DetailRow label="Projectile / ammo" value={projectile ? `${projectile.manufacturer} ${projectile.productLine}` : undefined} />
            <DetailRow label="Private notes" value={passport.privateNotes ? "Private notes exist and will be hidden" : "Not recorded"} />
            <DetailRow label="Maintenance notes" value={passport.maintenanceNotes ? "Private maintenance notes exist and will be hidden" : "Not recorded"} />
          </dl>
        </article>

        <article className="rounded-md border border-moss/20 bg-white p-5 shadow-soft">
          <h3 className="text-xl font-bold text-ink">Sanitized Public Preview</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            <Tag>{sanitized.equipmentType}</Tag>
            {sanitized.useCaseTags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </div>
          <dl className="mt-4">
            <DetailRow label="Title" value={sanitized.title} />
            <DetailRow label="Manufacturer / model" value={`${sanitized.manufacturer} ${sanitized.model}`} />
            <DetailRow label="Caliber / category" value={sanitized.caliber ?? sanitized.category} />
            <DetailRow label="Optic / sight summary" value={sanitized.opticOrSightSummary} />
            <DetailRow label="Projectile / ammo summary" value={sanitized.projectileSummary} />
            <DetailRow label="Public notes" value={sanitized.publicNotes} />
          </dl>
        </article>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
          <h3 className="text-xl font-bold text-ink">Hidden From Public</h3>
          <ul className="mt-4 space-y-2 text-sm text-ink/70">
            {sanitized.hiddenFields.map((field) => (
              <li key={field}>- {field}</li>
            ))}
          </ul>
        </section>
        <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
          <h3 className="text-xl font-bold text-ink">May Be Public</h3>
          <ul className="mt-4 space-y-2 text-sm text-ink/70">
            {sanitized.publicFields.map((field) => (
              <li key={field}>- {field}</li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-6 rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <h3 className="text-xl font-bold text-ink">Public Range-Session Summaries</h3>
        <div className="mt-4">
          <PublicRangeSessionList passport={sanitized} />
        </div>
      </section>

      <section className="mt-6 rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <h3 className="text-xl font-bold text-ink">Public Target Photo Placeholders</h3>
        <div className="mt-4">
          <PublicPhotoPlaceholderList passport={sanitized} />
        </div>
      </section>

      <section className="mt-6 rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <h3 className="text-xl font-bold text-ink">Mock Publish Controls</h3>
        <p className="mt-2 text-sm leading-6 text-ink/65">These buttons only show local confirmation messages. No backend write occurs.</p>
        <div className="mt-4">
          <PublicPreviewActions />
        </div>
      </section>
    </section>
  );
}
