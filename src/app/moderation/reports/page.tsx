import Link from "next/link";
import { ModerationReportList } from "@/components/ModerationReportList";
import { PageHeader } from "@/components/PageHeader";

export default function ModerationReportsPage() {
  return (
    <section>
      <PageHeader
        eyebrow="Moderation"
        title="Report review"
        description="Review public passport and comment reports without loading private account records."
        action={
          <Link href="/moderation" className="inline-flex rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink">
            Back to Moderation
          </Link>
        }
      />
      <ModerationReportList />
    </section>
  );
}
