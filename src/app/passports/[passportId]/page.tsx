import { EquipmentPassportDetail } from "@/components/EquipmentPassportDetail";

export default async function PassportDetailPage({ params }: { params: Promise<{ passportId?: string }> }) {
  const { passportId } = await params;
  return <EquipmentPassportDetail passportId={passportId} />;
}
