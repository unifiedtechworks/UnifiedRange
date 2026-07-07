import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { PassportCard } from "@/components/PassportCard";
import { equipmentPassports } from "@/data/mockData";

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
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {equipmentPassports.map((passport) => (
          <PassportCard key={passport.id} passport={passport} />
        ))}
      </div>
    </section>
  );
}
