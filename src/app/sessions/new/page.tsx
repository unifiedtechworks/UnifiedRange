import { PageHeader } from "@/components/PageHeader";
import { RangeSessionCreate } from "@/components/RangeSessionCreate";

export default function NewSessionPage() {
  return (
    <section>
      <PageHeader
        eyebrow="New range session"
        title="Log a practice record"
        description="Link saved equipment, projectile, and sight records to a historical range-session note. Wind notes stay free text only."
      />
      <RangeSessionCreate />
    </section>
  );
}
