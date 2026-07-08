import Link from "next/link";
import { AuthStatusCard } from "@/components/AuthStatusCard";
import { DetailRow } from "@/components/DetailRow";
import { PageHeader } from "@/components/PageHeader";
import { UserProfilePanel } from "@/components/UserProfilePanel";
import { currentUser } from "@/data/mockData";

export default function SettingsPage() {
  return (
    <section>
      <PageHeader
        eyebrow="Settings"
        title="Privacy and account defaults"
        description="Prepare account preferences for future Cognito auth, private S3 storage, and sanitized public sharing controls."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <UserProfilePanel />
        <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
          <h3 className="text-xl font-bold text-ink">Mock Profile</h3>
          <dl className="mt-4">
            <DetailRow label="Display name" value={currentUser.displayName} />
            <DetailRow label="Username" value={currentUser.username} />
            <DetailRow label="Bio" value={currentUser.bio} />
            <DetailRow label="Default privacy" value={currentUser.privacyDefault} />
          </dl>
        </article>
        <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
          <h3 className="text-xl font-bold text-ink">Future AWS Work</h3>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-ink/70">
            <li>TODO: Connect Amazon Cognito authentication and user profile records after the Amplify sandbox is available.</li>
            <li>TODO: Store target photos and setup images in private S3 buckets with metadata cleanup.</li>
            <li>TODO: Use AppSync authorization and DynamoDB access patterns for private passports, sessions, and maintenance records.</li>
            <li>TODO: Use Lambda workflows to publish only sanitized public passport snapshots to discovery.</li>
          </ul>
        </article>
        <AuthStatusCard />
        <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
          <h3 className="text-xl font-bold text-ink">Privacy Controls</h3>
          <p className="mt-3 text-sm leading-6 text-ink/70">
            Configure mock privacy defaults for Public Passport preview, metadata stripping, lot number hiding, and private-note protection.
          </p>
          <Link href="/settings/privacy" className="mt-4 inline-flex rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
            Open privacy settings
          </Link>
        </article>
      </div>
    </section>
  );
}
