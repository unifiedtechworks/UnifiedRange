import { EquipmentPassportEdit } from "@/components/EquipmentPassportEdit";
import { PageHeader } from "@/components/PageHeader";

export default function EditPassportPage({ params }: { params: { passportId: string } }) {
  return (
    <section>
      <PageHeader
        eyebrow="Edit equipment passport"
        title="Update a setup record"
        description="Signed-in users edit saved AppSync records. Demo passports keep local placeholder behavior."
      />
      <EquipmentPassportEdit passportId={params.passportId} />
    </section>
  );
}
