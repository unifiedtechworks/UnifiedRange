import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";

export default function AccountDataSettingsPage() {
  return (
    <section>
      <PageHeader
        eyebrow="Account settings"
        title="Your data and account"
        description="Review planned controls for exporting your account data and safely deleting your account. These controls are not active yet."
        action={
          <Link href="/settings" className="inline-flex rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink">
            Back to settings
          </Link>
        }
      />

      <div className="space-y-6">
        <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-moss">Data export</p>
              <h3 className="mt-2 text-xl font-bold text-ink">Export my data</h3>
              <p className="mt-3 text-sm leading-6 text-ink/70">
                A future export will include account-owned records in a portable format, including your profile, saved setups, sessions, maintenance, readiness, and owned public snapshots. A later ZIP export may include your private images.
              </p>
              <p className="mt-2 text-sm leading-6 text-ink/60">
                Private image links will not be exposed as permanent public or signed URLs.
              </p>
            </div>
            <span className="w-fit shrink-0 rounded-md bg-field px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-moss">Coming soon</span>
          </div>
          <button type="button" disabled className="mt-5 w-full cursor-not-allowed rounded-md bg-ink/35 px-4 py-2 text-sm font-semibold text-white sm:w-auto">
            Export my data - coming soon
          </button>
        </article>

        <article className="rounded-md border border-clay/30 bg-white p-5 shadow-soft">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-clay">Danger zone</p>
              <h3 className="mt-2 text-xl font-bold text-ink">Delete my account</h3>
              <p className="mt-3 text-sm leading-6 text-ink/70">
                Account deletion must safely remove private records and private images through a protected backend process. Public snapshots, comments, reactions, username reuse, and reporting history also require clear retention and anonymization rules.
              </p>
              <p className="mt-2 text-sm leading-6 text-ink/60">
                A future deletion request will require re-authentication or strong confirmation. No destructive account action is available on this page today.
              </p>
            </div>
            <span className="w-fit shrink-0 rounded-md bg-clay/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-clay">Coming soon</span>
          </div>
          <button type="button" disabled className="mt-5 w-full cursor-not-allowed rounded-md border border-clay/20 bg-clay/10 px-4 py-2 text-sm font-semibold text-clay/60 sm:w-auto">
            Delete my account - coming soon
          </button>
        </article>
      </div>
    </section>
  );
}
