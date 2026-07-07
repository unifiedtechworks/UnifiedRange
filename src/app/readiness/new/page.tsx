import { HuntingReadinessForm } from "@/components/HuntingReadinessForm";
import { PageHeader } from "@/components/PageHeader";
import { equipmentPassports } from "@/data/mockData";

export default function NewReadinessPage() {
  return (
    <section>
      <PageHeader
        eyebrow="New Hunting Readiness"
        title="Create a private readiness checklist"
        description="Track preparation tasks, equipment confirmation, field prep, and planning notes in a private checklist."
      />
      <HuntingReadinessForm
        mode="create"
        cancelHref="/readiness"
        passportOptions={equipmentPassports.map((passport) => ({ id: passport.id, label: passport.nickname }))}
      />
    </section>
  );
}
