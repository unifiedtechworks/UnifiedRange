import Link from "next/link";
import { AuthStatusCard } from "@/components/AuthStatusCard";
import { PageHeader } from "@/components/PageHeader";

export default function SettingsPage() {
  return (
    <section>
      <PageHeader
        eyebrow="Settings"
        title="Privacy and account defaults"
        description="Manage account preferences, auth status, privacy defaults, and reminders for sanitized public sharing."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
          <h3 className="text-xl font-bold text-ink">Profile</h3>
          <p className="mt-3 text-sm leading-6 text-ink/70">
            Profile setup and editing now live in the dedicated Profile section. Settings stays focused on auth status, privacy defaults, and hosted-dev boundaries.
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
          <h3 className="text-xl font-bold text-ink">Hosted Dev Boundaries</h3>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-ink/70">
            <li>Cognito auth, AppSync records, DynamoDB tables, and private S3 uploads are active for hosted dev testing.</li>
            <li>Signed-out users can browse clearly labeled demo data without seeing private account records.</li>
            <li>Public Passport publishing creates sanitized text/setup snapshots only.</li>
            <li>Public image publishing, metadata-stripping workflows, and moderation dashboards are not part of this MVP slice.</li>
          </ul>
        </article>
        <AuthStatusCard />
        <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
          <h3 className="text-xl font-bold text-ink">Privacy Controls</h3>
          <p className="mt-3 text-sm leading-6 text-ink/70">
            Review privacy defaults for Public Passport preview, lot number hiding, private-note protection, and future metadata stripping.
          </p>
          <Link href="/settings/privacy" className="mt-4 inline-flex rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
            Open privacy settings
          </Link>
        </article>
      </div>
    </section>
  );
}
