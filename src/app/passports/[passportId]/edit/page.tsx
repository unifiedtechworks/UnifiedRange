import { EquipmentPassportEdit } from "@/components/EquipmentPassportEdit";
import { PageHeader } from "@/components/PageHeader";

export default async function EditPassportPage({ params }: { params: Promise<{ passportId?: string }> }) {
  const { passportId } = await params;

  return (
    <section>
      <PageHeader
        eyebrow="Edit equipment passport"
        title="Update a setup record"
        description="Update a saved private record, or explore the clearly labeled sample editor while signed out."
      />
      <EquipmentPassportEdit passportId={passportId} />
    </section>
  );
}
