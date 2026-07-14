import { MaintenanceLogEdit } from "@/components/MaintenanceLogEdit";
import { PageHeader } from "@/components/PageHeader";

export default async function EditMaintenancePage({ params }: { params: Promise<{ maintenanceId?: string }> }) {
  const { maintenanceId } = await params;
  return (
    <section>
      <PageHeader
        eyebrow="Edit maintenance"
        title="Update private equipment care"
        description="Maintenance records stay private account data and are not included in public discovery."
      />
      <MaintenanceLogEdit maintenanceId={maintenanceId} />
    </section>
  );
}
