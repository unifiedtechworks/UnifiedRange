import { HuntingReadinessCreate } from "@/components/HuntingReadinessCreate";
import { PageHeader } from "@/components/PageHeader";

export default function NewReadinessPage() {
  return (
    <section>
      <PageHeader
        eyebrow="New Hunting Readiness"
        title="Create a private readiness checklist"
        description="Track preparation tasks, equipment confirmation, field prep, and planning notes in a private checklist."
      />
      <HuntingReadinessCreate />
    </section>
  );
}
