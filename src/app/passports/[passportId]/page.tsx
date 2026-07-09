import { EquipmentPassportDetail } from "@/components/EquipmentPassportDetail";

export default function PassportDetailPage({ params }: { params: { passportId: string } }) {
  return <EquipmentPassportDetail passportId={params.passportId} />;
}
