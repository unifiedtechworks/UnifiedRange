import { OpticSightForm } from "@/components/OpticSightForm";
import { PageHeader } from "@/components/PageHeader";

export default function NewOpticPage() {
  return (
    <section>
      <PageHeader
        eyebrow="New optic / sight"
        title="Create a sight profile"
        description="Document optic, sight, reticle, or pin setup details for setup history. No adjustment or aiming guidance is generated."
      />
      <OpticSightForm mode="create" cancelHref="/optics" />
    </section>
  );
}
