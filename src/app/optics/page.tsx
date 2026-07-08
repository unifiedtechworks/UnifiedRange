import Link from "next/link";
import { OpticSightCard } from "@/components/OpticSightCard";
import { PageHeader } from "@/components/PageHeader";
import { optics } from "@/data/mockData";

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
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {optics.map((optic) => (
          <OpticSightCard key={optic.id} optic={optic} />
        ))}
      </div>
    </section>
  );
}
