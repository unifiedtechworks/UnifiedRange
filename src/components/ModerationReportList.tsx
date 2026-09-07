"use client";

import Link from "next/link";
import { useState } from "react";
import { useModerationReports } from "@/hooks/useModerationReports";
import { isPendingReportStatus, reportStatuses, type ReportStatus } from "@/lib/moderationAccess";
import { getReporterPrimaryLabel, shortInternalId, type ReporterIdentity } from "@/lib/moderationReporterIdentity";

function formatDate(value?: string | null) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : value;
}

function getStatusLabel(status?: string | null) {
  if (!status) return "open";
  return status.replaceAll("_", " ");
}

function getStatusClass(status?: string | null) {
  if (isPendingReportStatus(status)) {
    return "bg-clay text-white";
  }

  if (status === "action_needed") return "bg-amber-100 text-amber-900";
  if (status === "dismissed") return "bg-ink/10 text-ink/65";

  return "bg-field text-ink";
}

function getTargetTypeLabel(targetType?: string | null) {
  if (targetType === "public_image") return "Public image";
  if (targetType === "public_passport") return "Public passport";
  if (!targetType) return "Unknown";

  return targetType.replaceAll("_", " ");
}

function getPublicPassportReviewHref(publicPassportSnapshotId: string) {
  const normalized = publicPassportSnapshotId.trim();
  const isPersistentId = /^[a-z0-9][a-z0-9_-]{0,127}$/i.test(normalized);
  const isSampleId = /^(?:(?:demo|sample)(?:[-_]|$)|(?:passport|session|target-photo)-\d+$)/i.test(normalized);

  return isPersistentId && !isSampleId ? `/discover/passports/${encodeURIComponent(normalized)}` : "";
}

export function ModerationReportList() {
  const { state, reports, reporterIdentities, pendingCount, error, identityWarning, updateReportStatus } = useModerationReports();

  if (state === "loading") {
    return <p className="rounded-md border border-ink/10 bg-white p-4 text-sm text-ink/65 shadow-soft">Loading reports...</p>;
  }

  if (state === "signed-out") {
    return (
      <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <h2 className="text-xl font-bold text-ink">Sign in to review reports</h2>
        <p className="mt-2 text-sm leading-6 text-ink/70">
          Moderation review is limited to authorized admin and moderator accounts.
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
          Moderation access is limited to authorized admin and moderator accounts. Report data is not available to normal signed-in accounts.
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
          <h2 className="text-base font-bold text-ink">Moderation privacy boundary</h2>
          <span className="rounded-md bg-white px-3 py-1 text-sm font-bold text-ink">{pendingCount} pending</span>
        </div>
        <p className="mt-2 text-sm leading-6 text-ink/70">
          This page shows report metadata only. It does not load private passports, private images, private notes, purchase records, lot numbers, exact locations, or private profile fields.
        </p>
        <p className="mt-2 text-sm leading-6 text-ink/70">
          Reports with missing or open status are counted as pending. Status changes update report workflow metadata only; they do not delete, hide, suspend, or mutate reported content.
        </p>
        <p className="mt-2 text-sm leading-6 text-ink/70">
          Public image reports link only to the sanitized public setup visitors can currently see. This review page does not load private originals, image keys, or image workflow records.
        </p>
      </section>

      {error ? <p className="rounded-md border border-clay/30 bg-clay/10 px-4 py-3 text-sm font-semibold text-clay">{error}</p> : null}
      {identityWarning ? <p className="rounded-md border border-ink/10 bg-paper px-4 py-3 text-sm text-ink/65">{identityWarning}</p> : null}

      {reports.length === 0 ? (
        <section className="rounded-md border border-ink/10 bg-white p-5 text-center shadow-soft">
          <h2 className="text-xl font-bold text-ink">No reports yet</h2>
          <p className="mt-2 text-sm leading-6 text-ink/70">Submitted public passport, public image, and comment reports will appear here.</p>
        </section>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => {
            const isPublicImageReport = report.targetType === "public_image";

            return (
              <article key={report.id} className="rounded-md border border-ink/10 bg-white p-4 shadow-soft sm:p-5">
                <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-md px-3 py-1 text-xs font-semibold ${getStatusClass(report.status)}`}>{getStatusLabel(report.status)}</span>
                      <span className="text-xs font-semibold text-moss">Report {shortInternalId(report.id)}</span>
                      {isPublicImageReport ? <span className="rounded-md bg-moss/10 px-3 py-1 text-xs font-semibold text-moss">Public image report</span> : null}
                    </div>
                    <h3 className="mt-3 break-words text-lg font-bold text-ink sm:text-xl">{report.reason}</h3>
                    <dl className="mt-4 grid min-w-0 gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
                      <ReportDetail label="Target type" value={getTargetTypeLabel(report.targetType)} />
                      {isPublicImageReport ? (
                        <TechnicalReportDetail label="Public snapshot ID" value={report.targetId} />
                      ) : (
                        <ReportDetail label="Target ID" value={report.targetId} />
                      )}
                      <ReporterDetail reporterId={report.reporterId} identity={reporterIdentities[report.reporterId]} />
                      <ReportDetail label="Created" value={formatDate(report.createdAt)} />
                      <ReportDetail label="Updated" value={formatDate(report.updatedAt)} />
                      <ReportDetail label="Report ID" value={report.id} />
                    </dl>
                    {isPublicImageReport ? <PublicImageReportReviewContext publicPassportSnapshotId={report.targetId} /> : null}
                    {report.details ? (
                      <div className="mt-4 rounded-md border border-ink/10 bg-paper p-4">
                        <p className="text-sm font-semibold text-ink">Details</p>
                        <p className="mt-2 break-words text-sm leading-6 text-ink/70">{report.details}</p>
                      </div>
                    ) : null}
                  </div>

                  <ReportStatusControl
                    key={`${report.id}:${report.status ?? "open"}`}
                    reportId={report.id}
                    status={(report.status as ReportStatus | null | undefined) ?? "open"}
                    onUpdate={updateReportStatus}
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ReportStatusControl({
  reportId,
  status,
  onUpdate
}: {
  reportId: string;
  status: ReportStatus;
  onUpdate: (reportId: string, status: ReportStatus) => Promise<void>;
}) {
  const [selectedStatus, setSelectedStatus] = useState<ReportStatus>(status);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function saveStatus() {
    if (selectedStatus === status) return;
    setIsSaving(true);
    setError("");
    try {
      await onUpdate(reportId, selectedStatus);
    } catch {
      setError("Report status could not be updated. Refresh and try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="w-full rounded-md border border-ink/10 bg-paper p-4 sm:min-w-56 xl:w-64">
      <label className="block">
        <span className="text-sm font-semibold text-ink">Review status</span>
        <select
          value={selectedStatus}
          disabled={isSaving}
          onChange={(event) => {
            setSelectedStatus(event.target.value as ReportStatus);
            setError("");
          }}
          className="mt-2 min-h-10 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm font-semibold text-ink outline-none focus:border-moss disabled:opacity-60"
        >
          {reportStatuses.map((item) => <option key={item} value={item}>{getStatusLabel(item)}</option>)}
        </select>
      </label>
      <button
        type="button"
        disabled={isSaving || selectedStatus === status}
        onClick={() => void saveStatus()}
        className="mt-3 w-full rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSaving ? "Saving..." : "Save status"}
      </button>
      <p className="mt-3 text-xs leading-5 text-ink/60">Workflow status only. No content action is performed.</p>
      {error ? <p className="mt-2 text-xs font-semibold leading-5 text-clay">{error}</p> : null}
    </div>
  );
}

function PublicImageReportReviewContext({ publicPassportSnapshotId }: { publicPassportSnapshotId: string }) {
  const reviewHref = getPublicPassportReviewHref(publicPassportSnapshotId);

  return (
    <aside className="mt-4 rounded-md border border-moss/20 bg-field p-4">
      <p className="text-sm font-bold text-ink">Public image review</p>
      <p className="mt-2 text-sm leading-6 text-ink/70">
        This report concerns the public image attached to a sanitized public setup. Use the public setup link to review what public visitors can currently see.
      </p>
      <p className="mt-2 text-xs leading-5 text-ink/60">
        Changing report status does not hide or remove the image. Image hide/remove actions are planned for a later phase, and this generation-unbound report cannot drive an image action.
      </p>
      {reviewHref ? (
        <Link
          href={reviewHref}
          prefetch={false}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex rounded-md border border-moss/25 bg-white px-3 py-2 text-sm font-semibold text-moss"
        >
          Open public setup
          <span className="sr-only"> in a new tab</span>
        </Link>
      ) : (
        <p className="mt-3 text-xs font-semibold text-ink/55">The public setup link is unavailable for this report.</p>
      )}
    </aside>
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

function TechnicalReportDetail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="font-semibold text-ink">{label}</dt>
      <dd className="break-all font-mono text-xs leading-5 text-ink/45">{value || "Not provided"}</dd>
    </div>
  );
}
