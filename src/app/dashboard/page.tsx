import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { PassportCard } from "@/components/PassportCard";
import { ReadinessProgress } from "@/components/ReadinessProgress";
import { SessionCard } from "@/components/SessionCard";
import { StatCard } from "@/components/StatCard";
import { equipmentPassports, huntingChecklists, maintenanceEntries, optics, projectiles, rangeSessions } from "@/data/mockData";

export default function DashboardPage() {
  const openChecklistItems = huntingChecklists.flatMap((checklist) => checklist.checklistItems).filter((item) => !item.isComplete).length;
  const quickActions = [
    { href: "/passports/new", label: "Add passport" },
    { href: "/sessions/new", label: "Log range session" },
    { href: "/projectiles/new", label: "Add projectile / ammo" },
    { href: "/optics/new", label: "Add optic / sight" },
    { href: "/maintenance/new", label: "Add maintenance" },
    { href: "/readiness/new", label: "Create readiness checklist" }
  ];

  return (
    <section>
      <PageHeader
        eyebrow="Private by default"
        title="Your range logbook and setup passport"
        description="Document equipment, range sessions, maintenance, Hunting Readiness, and Public Passport snapshots in one private-first logbook."
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

        <div className="space-y-6">
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

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xl font-bold text-ink">Recent Maintenance</h3>
              <Link href="/maintenance" className="text-sm font-semibold text-moss">
                View all
              </Link>
            </div>
            <div className="space-y-3">
              {maintenanceEntries.slice(0, 2).map((entry) => (
                <article key={entry.id} className="rounded-md border border-ink/10 bg-white p-4 shadow-soft">
                  <p className="text-sm font-semibold text-clay">{new Date(`${entry.date}T00:00:00`).toLocaleDateString()}</p>
                  <h4 className="mt-1 font-bold text-ink">{entry.maintenanceType}</h4>
                  <p className="mt-1 text-sm text-ink/65">{entry.notes}</p>
                </article>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xl font-bold text-ink">Readiness Progress</h3>
              <Link href="/readiness" className="text-sm font-semibold text-moss">
                Open checklists
              </Link>
            </div>
            <div className="space-y-3">
              {huntingChecklists.slice(0, 2).map((checklist) => (
                <article key={checklist.id} className="rounded-md border border-ink/10 bg-white p-4 shadow-soft">
                  <h4 className="font-bold text-ink">{checklist.huntName}</h4>
                  <p className="mt-1 text-sm text-ink/65">{checklist.season}</p>
                  <div className="mt-3">
                    <ReadinessProgress checklist={checklist} />
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
          <h3 className="text-xl font-bold text-ink">Public Sharing Reminder</h3>
          <p className="mt-2 text-sm leading-6 text-ink/70">
            Public Passport sharing should happen only after preview. Keep serial numbers, exact locations, private purchase details, and sensitive personal info out of public snapshots.
          </p>
          <Link href="/discover" className="mt-4 inline-flex rounded-md border border-ink/15 bg-white px-3 py-2 text-sm font-semibold text-ink">
            Review Discover
          </Link>
        </section>
        <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
          <h3 className="text-xl font-bold text-ink">Privacy-First Reminder</h3>
          <p className="mt-2 text-sm leading-6 text-ink/70">
            AWS Amplify, Cognito, AppSync, DynamoDB, S3, and Lambda workflows will replace mock data later. Private records stay private by default.
          </p>
          <Link href="/settings/privacy" className="mt-4 inline-flex rounded-md border border-ink/15 bg-white px-3 py-2 text-sm font-semibold text-ink">
            Privacy settings
          </Link>
        </section>
      </div>
    </section>
  );
}
