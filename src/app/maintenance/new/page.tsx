import { MaintenanceLogForm } from "@/components/MaintenanceLogForm";
import { PageHeader } from "@/components/PageHeader";
import { equipmentPassports } from "@/data/mockData";

export default function NewMaintenancePage() {
  return (
    <section>
      <PageHeader
        eyebrow="New maintenance record"
        title="Log private equipment care"
        description="Record cleaning, inspection, parts, and private notes without publishing anything to discovery."
      />
      <MaintenanceLogForm
        mode="create"
        cancelHref="/maintenance"
        passportOptions={equipmentPassports.map((passport) => ({ id: passport.id, label: passport.nickname }))}
      />
    </section>
  );
}
