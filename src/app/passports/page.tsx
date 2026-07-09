import Link from "next/link";
import { EquipmentPassportList } from "@/components/EquipmentPassportList";
import { PageHeader } from "@/components/PageHeader";

export default function PassportsPage() {
  return (
    <section>
      <PageHeader
        eyebrow="Equipment passports"
        title="Document every setup"
        description="Track setup identity, components, preferred projectiles, maintenance notes, and sanitized public sharing settings."
        action={
          <Link href="/passports/new" className="inline-flex rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
            New passport
          </Link>
        }
      />
      <EquipmentPassportList />
    </section>
  );
}
