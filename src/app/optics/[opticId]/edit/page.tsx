import { OpticSightProfileEdit } from "@/components/OpticSightProfileEdit";
import { PageHeader } from "@/components/PageHeader";

export default async function EditOpticPage({ params }: { params: Promise<{ opticId?: string }> }) {
  const { opticId } = await params;

  return (
    <section>
      <PageHeader
        eyebrow="Edit optic / sight"
        title="Update a sight profile"
        description="Signed-in users edit saved AppSync records. Demo profiles keep local placeholder behavior."
      />
      <OpticSightProfileEdit opticId={opticId} />
    </section>
  );
}
