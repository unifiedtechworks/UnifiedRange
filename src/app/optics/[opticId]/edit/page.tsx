import { OpticSightProfileEdit } from "@/components/OpticSightProfileEdit";
import { PageHeader } from "@/components/PageHeader";

export default function EditOpticPage({ params }: { params: { opticId: string } }) {
  return (
    <section>
      <PageHeader
        eyebrow="Edit optic / sight"
        title="Update a sight profile"
        description="Signed-in users edit saved AppSync records. Demo profiles keep local placeholder behavior."
      />
      <OpticSightProfileEdit opticId={params.opticId} />
    </section>
  );
}
