"use client";

import Link from "next/link";
import { useModerationReports } from "@/hooks/useModerationReports";
import { isPendingReportStatus } from "@/lib/moderationAccess";
import { getReporterPrimaryLabel, shortInternalId, type ReporterIdentity } from "@/lib/moderationReporterIdentity";

function formatDate(value?: string | null) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : value;
}

function getStatusLabel(status?: string | null) {
  return isPendingReportStatus(status) ? "pending" : (status ?? "unknown");
}

function getStatusClass(status?: string | null) {
  if (isPendingReportStatus(status)) {
    return "bg-clay text-white";
  }

  return "bg-field text-ink";
}

export function ModerationReportList() {
  const { state, reports, reporterIdentities, pendingCount, error, identityWarning } = useModerationReports();

  if (state === "loading") {
    return <p className="rounded-md border border-ink/10 bg-white p-4 text-sm text-ink/65 shadow-soft">Loading reports...</p>;
  }

  if (state === "signed-out") {
    return (
      <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <h2 className="text-xl font-bold text-ink">Sign in to review reports</h2>
        <p className="mt-2 text-sm leading-6 text-ink/70">
          Moderation review is limited to Cognito admin and moderator group users.
        </p>
        <Link href="/auth/sign-in" className="mt-4 inline-flex rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
          Sign in
        </Link>
      </section>
    );
  }

  if (state === "access-denied") {
    return (
      <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <h2 className="text-xl font-bold text-ink">You do not have access to moderation tools</h2>
        <p className="mt-2 text-sm leading-6 text-ink/70">
          Moderation access is limited to users in the Cognito admin or moderator groups. Report data is not available to normal signed-in accounts.
        </p>
      </section>
    );
  }

  if (state === "error") {
    return (
      <section className="rounded-md border border-clay/30 bg-clay/10 p-5">
        <h2 className="text-xl font-bold text-ink">Reports unavailable</h2>
        <p className="mt-2 text-sm leading-6 text-clay">{error || "Try refreshing before reviewing reports."}</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-moss/20 bg-field p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-bold text-ink">Hosted-Dev Review Boundary</h2>
          <span className="rounded-md bg-white px-3 py-1 text-sm font-bold text-ink">{pendingCount} pending</span>
        </div>
        <p className="mt-2 text-sm leading-6 text-ink/70">
          This page shows report metadata only. It does not load private passports, private images, private notes, purchase records, lot numbers, exact locations, or private profile fields.
        </p>
        <p className="mt-2 text-sm leading-6 text-ink/70">
          Reports with missing or open status are counted as pending. Status updates are intentionally read-only in this MVP until a dedicated admin-only action path is added.
        </p>
      </section>

      {error ? <p className="rounded-md border border-clay/30 bg-clay/10 px-4 py-3 text-sm font-semibold text-clay">{error}</p> : null}
      {identityWarning ? <p className="rounded-md border border-ink/10 bg-paper px-4 py-3 text-sm text-ink/65">{identityWarning}</p> : null}

      {reports.length === 0 ? (
        <section className="rounded-md border border-ink/10 bg-white p-5 text-center shadow-soft">
          <h2 className="text-xl font-bold text-ink">No reports yet</h2>
          <p className="mt-2 text-sm leading-6 text-ink/70">Submitted public passport and comment reports will appear here.</p>
        </section>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <article key={report.id} className="rounded-md border border-ink/10 bg-white p-4 shadow-soft sm:p-5">
              <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-md px-3 py-1 text-xs font-semibold ${getStatusClass(report.status)}`}>{getStatusLabel(report.status)}</span>
                    <span className="text-xs font-semibold text-moss">Report {shortInternalId(report.id)}</span>
                  </div>
                  <h3 className="mt-3 break-words text-lg font-bold text-ink sm:text-xl">{report.reason}</h3>
                  <dl className="mt-4 grid min-w-0 gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
                    <ReportDetail label="Target type" value={report.targetType ?? "Unknown"} />
                    <ReportDetail label="Target ID" value={report.targetId} />
                    <ReporterDetail reporterId={report.reporterId} identity={reporterIdentities[report.reporterId]} />
                    <ReportDetail label="Created" value={formatDate(report.createdAt)} />
                    <ReportDetail label="Updated" value={formatDate(report.updatedAt)} />
                    <ReportDetail label="Report ID" value={report.id} />
                  </dl>
                  {report.details ? (
                    <div className="mt-4 rounded-md border border-ink/10 bg-paper p-4">
                      <p className="text-sm font-semibold text-ink">Details</p>
                      <p className="mt-2 break-words text-sm leading-6 text-ink/70">{report.details}</p>
                    </div>
                  ) : null}
                </div>

                <div className="w-full rounded-md border border-ink/10 bg-paper p-4 sm:min-w-56 xl:w-64">
                  <p className="text-sm font-semibold text-ink">Review status</p>
                  <p className="mt-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-ink">{getStatusLabel(report.status)}</p>
                  <p className="mt-3 text-xs leading-5 text-ink/60">Status changes need a future admin-only action path.</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function ReporterDetail({ reporterId, identity }: { reporterId: string; identity?: ReporterIdentity }) {
  return (
    <div>
      <dt className="font-semibold text-ink">Reporter</dt>
      <dd className="break-words font-semibold text-ink/75">{getReporterPrimaryLabel(reporterId, identity)}</dd>
      {identity?.username && identity.displayName ? <dd className="break-words text-xs text-ink/55">{identity.displayName}</dd> : null}
      <dd className="mt-1 break-all font-mono text-xs text-ink/45">Internal ID: {reporterId}</dd>
    </div>
  );
}

function ReportDetail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="font-semibold text-ink">{label}</dt>
      <dd className="break-all text-ink/65">{value || "Not provided"}</dd>
    </div>
  );
}
