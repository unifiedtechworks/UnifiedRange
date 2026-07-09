import Link from "next/link";
import { OpticSightProfileList } from "@/components/OpticSightProfileList";
import { PageHeader } from "@/components/PageHeader";

export default function OpticsPage() {
  return (
    <section>
      <PageHeader
        eyebrow="Optics / sights"
        title="Sight profile documentation"
        description="Record optic and sight details for setup history. This page stores documentation notes only."
        action={
          <Link href="/optics/new" className="inline-flex rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
            Add optic / sight
          </Link>
        }
      />
      <OpticSightProfileList />
    </section>
  );
}
