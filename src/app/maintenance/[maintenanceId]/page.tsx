import { MaintenanceLogDetail } from "@/components/MaintenanceLogDetail";

export default async function MaintenanceDetailPage({ params }: { params: Promise<{ maintenanceId?: string }> }) {
  const { maintenanceId } = await params;
  return <MaintenanceLogDetail maintenanceId={maintenanceId} />;
}
