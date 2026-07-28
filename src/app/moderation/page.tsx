"use client";

import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { useModerationReports } from "@/hooks/useModerationReports";

export default function ModerationPage() {
  const { state, pendingCount, error } = useModerationReports();

  if (state === "loading") {
    return <p className="rounded-md border border-ink/10 bg-white p-4 text-sm text-ink/65 shadow-soft">Checking moderation access...</p>;
  }

  if (state === "signed-out") {
    return (
      <section>
        <PageHeader
          eyebrow="Moderation"
          title="Sign in to review reports"
          description="Moderation review is limited to authorized admin and moderator accounts."
        />
        <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
          <h2 className="text-xl font-bold text-ink">Report review</h2>
          <p className="mt-3 text-sm leading-6 text-ink/70">
            Signed-in access is required before viewing submitted report metadata. This page does not expose private account records or private images.
          </p>
          <Link href="/auth/sign-in" className="mt-4 inline-flex rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
            Sign in
          </Link>
        </section>
      </section>
    );
  }

  if (state === "access-denied") {
    return (
      <section>
        <PageHeader
          eyebrow="Moderation"
          title="You do not have access to moderation tools"
          description="Moderation access is limited to authorized admin and moderator accounts."
        />
        <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
          <h2 className="text-xl font-bold text-ink">Report review</h2>
          <p className="mt-3 text-sm leading-6 text-ink/70">
            Report metadata is not available to normal signed-in accounts. Ask an administrator if your role requires moderation access.
          </p>
        </section>
      </section>
    );
  }

  if (state === "error") {
    return (
      <section>
        <PageHeader
          eyebrow="Moderation"
          title="Reports unavailable"
          description="Moderation access was confirmed, but report metadata could not be loaded."
        />
        <section className="rounded-md border border-clay/30 bg-clay/10 p-5">
          <p className="text-sm leading-6 text-clay">{error || "Try refreshing before reviewing reports."}</p>
        </section>
      </section>
    );
  }

  return (
    <section>
      <PageHeader
        eyebrow="Moderation"
        title="Moderation review"
        description="Review public setup and comment report metadata. Access is limited to authorized admin and moderator accounts."
        action={
          <Link href="/moderation/reports" className="inline-flex rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
            Review reports
          </Link>
        }
      />
      <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-ink">Report review</h2>
            <p className="mt-3 text-sm leading-6 text-ink/70">
              Review submitted report metadata and update workflow status. Status changes do not delete content, hide public snapshots, suspend users, or expose private account data.
            </p>
          </div>
          <span className="w-fit rounded-md bg-clay px-3 py-1 text-sm font-bold text-white">{pendingCount} pending</span>
        </div>
        <p className="mt-3 text-sm leading-6 text-ink/70">
          Missing or open report statuses count as pending. Status updates change workflow metadata only.
        </p>
        <Link href="/moderation/reports" className="mt-4 inline-flex rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink">
          Open report queue
        </Link>
      </section>
    </section>
  );
}
