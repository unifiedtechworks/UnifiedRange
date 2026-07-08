import Link from "next/link";
import { notFound } from "next/navigation";
import { DetailRow } from "@/components/DetailRow";
import { PageHeader } from "@/components/PageHeader";
import { getOpticById, getPassportById, getProjectileById, getSessionById, getTargetPhotosForSession } from "@/data/selectors";

export default function SessionDetailPage({ params }: { params: { sessionId: string } }) {
  const session = getSessionById(params.sessionId);

  if (!session) {
    notFound();
  }

  const passport = getPassportById(session.equipmentPassportId);
  const projectile = getProjectileById(session.projectileProfileId);
  const optic = getOpticById(passport?.opticOrSightId);
  const photos = getTargetPhotosForSession(session.id);

  return (
    <section>
      <PageHeader
        eyebrow={new Date(`${session.date}T00:00:00`).toLocaleDateString()}
        title={session.discipline}
        description="A historical practice record with user-entered context, free-text notes, and target-photo references."
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/sessions" className="inline-flex justify-center rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink">
              Back to Range Sessions
            </Link>
            <Link href={`/sessions/${session.id}/edit`} className="inline-flex justify-center rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
              Edit session
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
          <h3 className="text-xl font-bold text-ink">Session Details</h3>
          <dl className="mt-4">
            <DetailRow label="Equipment" value={passport?.nickname} />
            <DetailRow label="Projectile" value={projectile ? `${projectile.manufacturer} ${projectile.productLine}` : undefined} />
            <DetailRow label="Optic / sight" value={optic ? `${optic.manufacturer} ${optic.model}` : undefined} />
            <DetailRow label="Distance" value={`${session.distance} ${session.distanceUnit}`} />
            <DetailRow label="Position" value={session.position} />
            <DetailRow label="Support" value={session.supportType} />
            <DetailRow label="Group / score" value={session.groupSize ?? session.score} />
            <DetailRow label="Cold-bore / first-shot marker" value={session.isColdBore ? "Yes" : "No"} />
            <DetailRow label="Clean / fouled marker" value={session.isCleanBarrel ? "Yes" : "No"} />
            <DetailRow label="Suppressed / accessory marker" value={session.isSuppressed ? "Yes" : "No"} />
            <DetailRow label="Confidence rating" value={`${session.confidenceRating}/5`} />
          </dl>
        </article>

        <div className="space-y-6">
          <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
            <h3 className="text-xl font-bold text-ink">Notes</h3>
            <p className="mt-3 text-sm leading-6 text-ink/70">{session.sessionNotes}</p>
            <p className="mt-3 text-sm leading-6 text-ink/70">{session.weatherNotes}</p>
            {session.windNotesFreeText ? <p className="mt-3 text-sm leading-6 text-ink/70">Wind notes: {session.windNotesFreeText}</p> : null}
          </article>

          <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
            <h3 className="text-xl font-bold text-ink">Target Photos</h3>
            <p className="mt-2 text-sm leading-6 text-ink/65">Target photos are private unless explicitly shared. Real upload is not implemented yet.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {photos.map((photo) => (
                <div key={photo.id} className="overflow-hidden rounded-md border border-ink/10">
                  <div className="h-44 bg-cover bg-center" style={{ backgroundImage: `url(${photo.imageUrl})` }} aria-hidden="true" />
                  <div className="p-3">
                    <p className="text-sm font-semibold text-ink">{photo.caption}</p>
                    <p className="mt-1 text-xs text-ink/60">Manual entry: {photo.manuallyEnteredGroupSize ?? photo.manuallyEnteredScore ?? "No measurement recorded"}</p>
                  </div>
                </div>
              ))}
              {photos.length === 0 ? (
                <div className="rounded-md border border-dashed border-ink/20 bg-paper p-5 text-sm text-ink/65">No target photos attached yet.</div>
              ) : null}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
