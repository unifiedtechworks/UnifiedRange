import { PageHeader } from "@/components/PageHeader";
import { RangeSessionEdit } from "@/components/RangeSessionEdit";

export default async function EditSessionPage({ params }: { params: Promise<{ sessionId?: string }> }) {
  const { sessionId } = await params;

  return (
    <section>
      <PageHeader
        eyebrow="Edit range session"
        title="Update a practice record"
        description="Signed-in users edit saved AppSync records. Demo sessions keep local placeholder behavior."
      />
      <RangeSessionEdit sessionId={sessionId} />
    </section>
  );
}
