import { DiscoverPublicPassportList } from "@/components/DiscoverPublicPassportList";
import { PageHeader } from "@/components/PageHeader";

export default function DiscoverPage() {
  return (
    <section>
      <PageHeader
        eyebrow="Discover"
        title="Public setup snapshots"
        description="Browse sanitized equipment profiles shared for setup discovery, range-log context, and community documentation."
      />
      <DiscoverPublicPassportList />
    </section>
  );
}
