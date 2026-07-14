import { MaintenanceLogCreate } from "@/components/MaintenanceLogCreate";
import { PageHeader } from "@/components/PageHeader";

export default function NewMaintenancePage() {
  return (
    <section>
      <PageHeader
        eyebrow="New maintenance record"
        title="Log private equipment care"
        description="Record cleaning, inspection, parts, and private notes without publishing anything to discovery."
      />
      <MaintenanceLogCreate />
    </section>
  );
}
