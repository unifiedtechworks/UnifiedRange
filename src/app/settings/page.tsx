import { DetailRow } from "@/components/DetailRow";
import { PageHeader } from "@/components/PageHeader";
import { currentUser } from "@/data/mockData";

export default function SettingsPage() {
  return (
    <section>
      <PageHeader
        eyebrow="Settings"
        title="Privacy and account defaults"
        description="Prepare account preferences for future Supabase auth, private storage, and sanitized public sharing controls."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
          <h3 className="text-xl font-bold text-ink">Profile</h3>
          <dl className="mt-4">
            <DetailRow label="Display name" value={currentUser.displayName} />
            <DetailRow label="Username" value={currentUser.username} />
            <DetailRow label="Bio" value={currentUser.bio} />
            <DetailRow label="Default privacy" value={currentUser.privacyDefault} />
          </dl>
        </article>
        <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
          <h3 className="text-xl font-bold text-ink">Future Supabase Work</h3>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-ink/70">
            <li>TODO: Add Supabase authentication and profile tables.</li>
            <li>TODO: Store target photos in private buckets with metadata cleanup.</li>
            <li>TODO: Enforce row-level security for private passports, sessions, and maintenance records.</li>
            <li>TODO: Publish only sanitized public passport snapshots to discovery.</li>
          </ul>
        </article>
      </div>
    </section>
  );
}
