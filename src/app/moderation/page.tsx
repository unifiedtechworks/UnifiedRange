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
          description="Moderation review is limited to Cognito admin and moderator group users."
        />
        <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
          <h2 className="text-xl font-bold text-ink">Report Review</h2>
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
          description="Moderation access is limited to users in the Cognito admin or moderator groups."
        />
        <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
          <h2 className="text-xl font-bold text-ink">Report Review</h2>
          <p className="mt-3 text-sm leading-6 text-ink/70">
            Report metadata is not available to normal signed-in accounts. Ask a workspace administrator to add your Cognito user to the admin or moderator group if you need hosted-dev review access.
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
        title="Hosted-dev review tools"
        description="Internal MVP tools for Cognito admin and moderator group users reviewing public setup and comment reports."
        action={
          <Link href="/moderation/reports" className="inline-flex rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
            Review reports
          </Link>
        }
      />
      <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-ink">Report Review</h2>
            <p className="mt-3 text-sm leading-6 text-ink/70">
              Review submitted report metadata. This MVP page does not change report status, delete content, hide public snapshots, suspend users, or expose private account data.
            </p>
          </div>
          <span className="w-fit rounded-md bg-clay px-3 py-1 text-sm font-bold text-white">{pendingCount} pending</span>
        </div>
        <p className="mt-3 text-sm leading-6 text-ink/70">
          Missing or open report statuses count as pending. Status updates remain read-only until an admin-only action path is added.
        </p>
        <Link href="/moderation/reports" className="mt-4 inline-flex rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink">
          Open report queue
        </Link>
      </section>
    </section>
  );
}
