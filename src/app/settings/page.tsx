import Link from "next/link";
import { AuthStatusCard } from "@/components/AuthStatusCard";
import { PageHeader } from "@/components/PageHeader";

export default function SettingsPage() {
  return (
    <section>
      <PageHeader
        eyebrow="Settings"
        title="Privacy and account settings"
        description="Manage account access, privacy defaults, public profile visibility, and sanitized sharing preferences."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
          <h3 className="text-xl font-bold text-ink">Profile</h3>
          <p className="mt-3 text-sm leading-6 text-ink/70">
            View your profile, update the fields you control, and keep your permanent username separate from account and privacy settings.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Link href="/profile" className="inline-flex justify-center rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
              Open profile
            </Link>
            <Link href="/profile/edit" className="inline-flex justify-center rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink">
              Edit profile
            </Link>
          </div>
        </article>
        <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
          <h3 className="text-xl font-bold text-ink">Privacy boundaries</h3>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-ink/70">
            <li>Private records and private images remain visible only to the signed-in owner.</li>
            <li>Signed-out visitors can browse public pages and clearly labeled sample data without seeing private account records.</li>
            <li>Public Passport publishing creates sanitized text and setup snapshots only.</li>
            <li>Private images, private notes, purchase details, lot numbers, and exact locations are excluded from public pages.</li>
          </ul>
        </article>
        <AuthStatusCard />
        <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
          <h3 className="text-xl font-bold text-ink">Privacy controls</h3>
          <p className="mt-3 text-sm leading-6 text-ink/70">
            Review defaults for public profile visibility, Public Passport previews, lot number hiding, private-note protection, and image privacy.
          </p>
          <Link href="/settings/privacy" className="mt-4 inline-flex rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
            Open privacy settings
          </Link>
        </article>
        <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xl font-bold text-ink">Account data</h3>
            <span className="rounded-md bg-field px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-moss">Planned</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-ink/70">
            Review the planned data-export and account-deletion lifecycle. Export and destructive deletion are not implemented yet.
          </p>
          <Link href="/settings/account" className="mt-4 inline-flex rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink">
            View account data controls
          </Link>
        </article>
      </div>
    </section>
  );
}
