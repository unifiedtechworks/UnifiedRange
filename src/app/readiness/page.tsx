import Link from "next/link";
import { HuntingReadinessList } from "@/components/HuntingReadinessList";
import { PageHeader } from "@/components/PageHeader";

export default function ReadinessPage() {
  return (
    <section>
      <PageHeader
        eyebrow="Hunting readiness"
        title="Season prep checklists"
        description="Track license confirmation, equipment checks, field-practice logs, pack prep, maps, weather, and emergency planning."
        action={
          <Link href="/readiness/new" className="inline-flex rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
            Create checklist
          </Link>
        }
      />
      <HuntingReadinessList />
    </section>
  );
}
