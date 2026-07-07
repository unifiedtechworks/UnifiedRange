import { DetailRow } from "@/components/DetailRow";
import { PageHeader } from "@/components/PageHeader";
import { getPassportById } from "@/data/selectors";
import { maintenanceEntries } from "@/data/mockData";

export default function MaintenancePage() {
  return (
    <section>
      <PageHeader
        eyebrow="Maintenance"
        title="Care and inspection history"
        description="Keep equipment maintenance, cleaning, parts changes, and inspection records tied to each passport."
      />
      <div className="space-y-4">
        {maintenanceEntries.map((entry) => {
          const passport = getPassportById(entry.equipmentPassportId);
          return (
            <article key={entry.id} className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
              <div className="flex flex-col justify-between gap-2 sm:flex-row">
                <div>
                  <p className="text-sm font-semibold text-clay">{new Date(`${entry.date}T00:00:00`).toLocaleDateString()}</p>
                  <h3 className="mt-1 text-xl font-bold text-ink">{entry.maintenanceType}</h3>
                  <p className="mt-1 text-sm text-ink/65">{passport?.nickname}</p>
                </div>
                <span className="rounded-md bg-field px-3 py-2 text-sm font-semibold text-moss">{entry.roundOrShotCount} rounds / shots</span>
              </div>
              <dl className="mt-4">
                <DetailRow label="Parts changed" value={entry.partsChanged.length ? entry.partsChanged.join(", ") : "None"} />
                <DetailRow label="Notes" value={entry.notes} />
              </dl>
            </article>
          );
        })}
      </div>
    </section>
  );
}
