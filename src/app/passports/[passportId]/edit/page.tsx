import { EquipmentPassportEdit } from "@/components/EquipmentPassportEdit";
import { PageHeader } from "@/components/PageHeader";

export default async function EditPassportPage({ params }: { params: Promise<{ passportId?: string }> }) {
  const { passportId } = await params;

  return (
    <section>
      <PageHeader
        eyebrow="Edit equipment passport"
        title="Update a setup record"
        description="Signed-in users edit saved AppSync records. Demo passports keep local placeholder behavior."
      />
      <EquipmentPassportEdit passportId={passportId} />
    </section>
  );
}
