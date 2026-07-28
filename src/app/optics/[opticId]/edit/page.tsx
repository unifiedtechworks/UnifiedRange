import { OpticSightProfileEdit } from "@/components/OpticSightProfileEdit";
import { PageHeader } from "@/components/PageHeader";

export default async function EditOpticPage({ params }: { params: Promise<{ opticId?: string }> }) {
  const { opticId } = await params;

  return (
    <section>
      <PageHeader
        eyebrow="Edit optic / sight"
        title="Update a sight profile"
        description="Update a saved private record, or explore the clearly labeled sample editor while signed out."
      />
      <OpticSightProfileEdit opticId={opticId} />
    </section>
  );
}
