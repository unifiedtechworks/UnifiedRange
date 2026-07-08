import Link from "next/link";
import { notFound } from "next/navigation";
import { DetailRow } from "@/components/DetailRow";
import { PageHeader } from "@/components/PageHeader";
import { getMaintenanceById, getPassportById } from "@/data/selectors";

export default function MaintenanceDetailPage({ params }: { params: { maintenanceId: string } }) {
  const entry = getMaintenanceById(params.maintenanceId);

  if (!entry) notFound();

  const passport = getPassportById(entry.equipmentPassportId);

  return (
    <section>
      <PageHeader
        eyebrow="Private maintenance"
        title={entry.maintenanceType}
        description="Maintenance records are private by default and are excluded from public passport snapshots."
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/maintenance" className="inline-flex justify-center rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink">
              Back to Maintenance
            </Link>
            <Link href={`/maintenance/${entry.id}/edit`} className="inline-flex justify-center rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
              Edit record
            </Link>
          </div>
        }
      />
      <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <dl className="grid gap-x-6 md:grid-cols-2">
          <DetailRow label="Equipment" value={passport?.nickname} />
          <DetailRow label="Date" value={new Date(`${entry.date}T00:00:00`).toLocaleDateString()} />
          <DetailRow label="Round / shot count" value={entry.roundOrShotCount} />
          <DetailRow label="Parts changed" value={entry.partsChanged.length ? entry.partsChanged.join(", ") : "None"} />
          <DetailRow label="Cleaning notes" value={entry.cleaningNotes ?? entry.notes} />
          <DetailRow label="Torque / check notes" value={entry.torqueCheckNotes} />
          <DetailRow label="Private notes" value={entry.privateNotes ? "Private notes recorded" : "Not recorded"} />
        </dl>
      </article>
    </section>
  );
}
