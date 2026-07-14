import Link from "next/link";
import { MaintenanceLogList } from "@/components/MaintenanceLogList";
import { PageHeader } from "@/components/PageHeader";

export default function MaintenancePage() {
  return (
    <section>
      <PageHeader
        eyebrow="Maintenance"
        title="Care and inspection history"
        description="Keep equipment maintenance, cleaning, parts changes, and inspection records tied to each passport."
        action={
          <Link href="/maintenance/new" className="inline-flex rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
            Add maintenance
          </Link>
        }
      />
      <MaintenanceLogList />
    </section>
  );
}
