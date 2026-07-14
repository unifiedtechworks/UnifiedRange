import { HuntingReadinessEdit } from "@/components/HuntingReadinessEdit";
import { PageHeader } from "@/components/PageHeader";

export default async function EditReadinessPage({ params }: { params: Promise<{ checklistId?: string }> }) {
  const { checklistId } = await params;
  return (
    <section>
      <PageHeader
        eyebrow="Edit Hunting Readiness"
        title="Update private readiness checklist"
        description="Hunting Readiness records stay private account data and are not included in public discovery."
      />
      <HuntingReadinessEdit checklistId={checklistId} />
    </section>
  );
}
