import { EquipmentPassportCreate } from "@/components/EquipmentPassportCreate";
import { PageHeader } from "@/components/PageHeader";

export default function NewPassportPage() {
  return (
    <section>
      <PageHeader
        eyebrow="New equipment passport"
        title="Create a private setup record"
        description="Start with the setup details you want to track. Signed-in users save this record to their private AppSync account data."
      />
      <EquipmentPassportCreate />
    </section>
  );
}
