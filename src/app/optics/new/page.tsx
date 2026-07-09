import { OpticSightProfileCreate } from "@/components/OpticSightProfileCreate";
import { PageHeader } from "@/components/PageHeader";

export default function NewOpticPage() {
  return (
    <section>
      <PageHeader
        eyebrow="New optic / sight"
        title="Create a sight profile"
        description="Document optic, sight, reticle, or pin setup details for setup history and private records. Signed-in users save this record to AppSync."
      />
      <OpticSightProfileCreate />
    </section>
  );
}
