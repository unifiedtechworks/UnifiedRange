import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { PassportCard } from "@/components/PassportCard";
import { SessionCard } from "@/components/SessionCard";
import { StatCard } from "@/components/StatCard";
import { equipmentPassports, huntingChecklists, maintenanceEntries, optics, projectiles, rangeSessions } from "@/data/mockData";

export default function DashboardPage() {
  const openChecklistItems = huntingChecklists.flatMap((checklist) => checklist.checklistItems).filter((item) => !item.isComplete).length;
  const quickActions = [
    { href: "/passports/new", label: "Add passport" },
    { href: "/sessions/new", label: "Log range session" },
    { href: "/projectiles/new", label: "Add projectile / ammo" },
    { href: "/optics/new", label: "Add optic / sight" }
  ];

  return (
    <section>
      <PageHeader
        eyebrow="Private by default"
        title="Your range logbook and setup passport"
        description="Document equipment, range sessions, maintenance, hunting readiness, and public setup snapshots without turning records into aiming guidance."
        action={
          <Link href="/passports" className="inline-flex rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
            View passports
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Equipment passports" value={String(equipmentPassports.length)} helper="Private setup records and sanitized public snapshots." />
        <StatCard label="Recent range sessions" value={String(rangeSessions.length)} helper="Practice history with notes, scores, and target photos." />
        <StatCard label="Projectiles / ammo" value={String(projectiles.length)} helper="Ammo plus future arrow and bolt inventory records." />
        <StatCard label="Optics / sights" value={String(optics.length)} helper="Sight profiles linked to setup documentation." />
        <StatCard label="Maintenance due" value="Soon" helper={`${maintenanceEntries.length} mock care records. Scheduling comes later.`} />
        <StatCard label="Hunting readiness" value={`${openChecklistItems} open`} helper="Checklist placeholders keep season prep visible." />
      </div>

      <section className="mt-8 rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <h3 className="text-xl font-bold text-ink">Quick Actions</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action) => (
            <Link key={action.href} href={action.href} className="inline-flex justify-center rounded-md border border-ink/10 bg-paper px-4 py-3 text-sm font-semibold text-ink transition hover:border-moss/40 hover:text-moss">
              {action.label}
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xl font-bold text-ink">Active Passports</h3>
            <Link href="/passports" className="text-sm font-semibold text-moss">
              See all
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {equipmentPassports.map((passport) => (
              <PassportCard key={passport.id} passport={passport} />
            ))}
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xl font-bold text-ink">Recent Sessions</h3>
            <Link href="/sessions" className="text-sm font-semibold text-moss">
              Open log
            </Link>
          </div>
          <div className="space-y-4">
            {rangeSessions.slice(0, 2).map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
        </div>
      </div>

      <section className="mt-8 rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <h3 className="text-xl font-bold text-ink">Privacy Reminder</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/70">
          Public discovery uses sanitized setup snapshots. Private notes, serial numbers, exact locations, personal records, and photo metadata should stay out of public profiles.
        </p>
        <p className="mt-3 text-sm font-semibold text-clay">AWS Amplify, Cognito, AppSync, DynamoDB, S3, and Lambda workflows will replace this mock dashboard in a later task.</p>
      </section>
    </section>
  );
}
