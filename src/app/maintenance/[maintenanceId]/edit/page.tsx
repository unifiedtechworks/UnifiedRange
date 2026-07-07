import { notFound } from "next/navigation";
import { MaintenanceLogForm, type MaintenanceLogFormValues } from "@/components/MaintenanceLogForm";
import { PageHeader } from "@/components/PageHeader";
import { equipmentPassports } from "@/data/mockData";
import { getMaintenanceById } from "@/data/selectors";

export default function EditMaintenancePage({ params }: { params: { maintenanceId: string } }) {
  const entry = getMaintenanceById(params.maintenanceId);

  if (!entry) notFound();

  const initialValues: MaintenanceLogFormValues = {
    equipmentPassportId: entry.equipmentPassportId,
    date: entry.date,
    roundOrShotCount: String(entry.roundOrShotCount),
    maintenanceType: entry.maintenanceType,
    partsChanged: entry.partsChanged.join(", "),
    cleaningNotes: entry.cleaningNotes ?? entry.notes ?? "",
    torqueCheckNotes: entry.torqueCheckNotes ?? "",
    privateNotes: entry.privateNotes ?? ""
  };

  return (
    <section>
      <PageHeader
        eyebrow="Edit maintenance"
        title={entry.maintenanceType}
        description="Update mock maintenance values. Saving is local-only until the AWS backend is implemented."
      />
      <MaintenanceLogForm
        mode="edit"
        initialValues={initialValues}
        cancelHref={`/maintenance/${entry.id}`}
        passportOptions={equipmentPassports.map((passport) => ({ id: passport.id, label: passport.nickname }))}
      />
    </section>
  );
}
