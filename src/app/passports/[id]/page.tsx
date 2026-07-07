import { notFound } from "next/navigation";
import { DetailRow } from "@/components/DetailRow";
import { PageHeader } from "@/components/PageHeader";
import { SessionCard } from "@/components/SessionCard";
import { Tag } from "@/components/Tag";
import { getChecklistForPassport, getMaintenanceForPassport, getOpticById, getPassportById, getProjectileById, getSessionsForPassport } from "@/data/selectors";

export default function PassportDetailPage({ params }: { params: { id: string } }) {
  const passport = getPassportById(params.id);

  if (!passport) {
    notFound();
  }

  const optic = getOpticById(passport.opticOrSightId);
  const projectile = getProjectileById(passport.preferredProjectileId);
  const sessions = getSessionsForPassport(passport.id);
  const maintenance = getMaintenanceForPassport(passport.id);
  const checklist = getChecklistForPassport(passport.id);

  return (
    <section>
      <PageHeader
        eyebrow={passport.equipmentType}
        title={passport.nickname}
        description={passport.publicNotes ?? "Private setup documentation and readiness notes."}
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <article className="overflow-hidden rounded-md border border-ink/10 bg-white shadow-soft">
          <div className="h-64 bg-cover bg-center" style={{ backgroundImage: `url(${passport.coverPhotoUrl})` }} aria-hidden="true" />
          <div className="p-5">
            <div className="flex flex-wrap gap-2">
              {passport.useCaseTags.map((tag) => (
                <Tag key={tag}>{tag}</Tag>
              ))}
            </div>
            <dl className="mt-5">
              <DetailRow label="Manufacturer" value={passport.manufacturer} />
              <DetailRow label="Model" value={passport.model} />
              <DetailRow label="Category" value={passport.category} />
              <DetailRow label="Caliber / category" value={passport.caliber} />
              <DetailRow label="Round or shot count" value={passport.roundOrShotCount} />
              <DetailRow label="Optic / sight" value={optic ? `${optic.manufacturer} ${optic.model}` : undefined} />
              <DetailRow label="Preferred projectile" value={projectile ? `${projectile.manufacturer} ${projectile.productLine}` : undefined} />
              <DetailRow label="Public sharing" value={passport.isPublic ? "Sanitized public snapshot enabled" : "Private"} />
            </dl>
          </div>
        </article>

        <div className="space-y-6">
          <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
            <h3 className="text-xl font-bold text-ink">Setup Notes</h3>
            <p className="mt-3 text-sm leading-6 text-ink/70">{passport.maintenanceNotes ?? "No maintenance notes recorded."}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {passport.accessories.map((accessory) => (
                <Tag key={accessory}>{accessory}</Tag>
              ))}
            </div>
          </article>

          <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
            <h3 className="text-xl font-bold text-ink">Related Sessions</h3>
            <div className="mt-4 space-y-4">
              {sessions.map((session) => (
                <SessionCard key={session.id} session={session} />
              ))}
            </div>
          </article>

          <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
            <h3 className="text-xl font-bold text-ink">Maintenance and Readiness</h3>
            <p className="mt-2 text-sm text-ink/65">{maintenance.length} maintenance records linked to this passport.</p>
            <p className="mt-1 text-sm text-ink/65">
              {checklist ? `${checklist.checklistItems.filter((item) => item.isComplete).length}/${checklist.checklistItems.length} readiness items complete.` : "No hunting checklist linked yet."}
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
