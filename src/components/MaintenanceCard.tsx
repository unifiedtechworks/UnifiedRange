import Link from "next/link";
import { DetailRow } from "@/components/DetailRow";
import { getPassportById } from "@/data/selectors";
import type { MaintenanceLogEntry } from "@/types";

export function MaintenanceCard({
  entry,
  sourceLabel,
  equipmentSummary
}: {
  entry: MaintenanceLogEntry;
  sourceLabel?: string;
  equipmentSummary?: string;
}) {
  const passport = getPassportById(entry.equipmentPassportId);
  const displayedEquipment = equipmentSummary ?? passport?.nickname ?? "Unknown equipment";

  return (
    <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
      <div className="flex flex-col justify-between gap-2 sm:flex-row">
        <div>
          <p className="text-sm font-semibold text-clay">{new Date(`${entry.date}T00:00:00`).toLocaleDateString()}</p>
          <h3 className="mt-1 text-xl font-bold text-ink">{entry.maintenanceType}</h3>
          <p className="mt-1 text-sm text-ink/65">{displayedEquipment}</p>
          {sourceLabel ? <p className="mt-1 text-xs font-semibold text-moss">{sourceLabel}</p> : null}
        </div>
        <span className="h-fit rounded-md bg-field px-3 py-2 text-sm font-semibold text-moss">{entry.roundOrShotCount} rounds / shots</span>
      </div>
      <dl className="mt-4">
        <DetailRow label="Parts changed" value={entry.partsChanged.length ? entry.partsChanged.join(", ") : "None"} />
        <DetailRow label="Notes" value={entry.cleaningNotes ?? entry.notes} />
      </dl>
      <Link href={`/maintenance/${entry.id}`} className="mt-4 inline-flex rounded-md border border-ink/15 bg-white px-3 py-2 text-sm font-semibold text-ink">
        View record
      </Link>
    </article>
  );
}
