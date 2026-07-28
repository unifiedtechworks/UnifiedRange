import { PageHeader } from "@/components/PageHeader";
import { RangeSessionEdit } from "@/components/RangeSessionEdit";

export default async function EditSessionPage({ params }: { params: Promise<{ sessionId?: string }> }) {
  const { sessionId } = await params;

  return (
    <section>
      <PageHeader
        eyebrow="Edit range session"
        title="Update a practice record"
        description="Update a saved private record, or explore the clearly labeled sample editor while signed out."
      />
      <RangeSessionEdit sessionId={sessionId} />
    </section>
  );
}
