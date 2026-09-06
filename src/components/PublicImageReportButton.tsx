"use client";

import { generateClient } from "aws-amplify/data";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { useAuthUser, type AuthUserState } from "@/hooks/useAuthUser";
import { configureAmplifyClient } from "@/lib/amplifyClient";
import {
  normalizePublicImageReportDetails,
  publicImageReportDetailsMaxLength,
  publicImageReportReasons,
  submitPublicImageReport,
  type PublicImageReportReason
} from "@/lib/publicImageReportData";

export function PublicImageReportButton({ publicPassportSnapshotId }: { publicPassportSnapshotId: string }) {
  const { authState } = useAuthUser();

  if (authState.status === "loading") {
    return <span className="text-xs text-ink/50">Checking sign-in status...</span>;
  }

  if (authState.status !== "signed-in") {
    return (
      <span className="text-xs text-ink/60">
        <Link href="/auth/sign-in" className="font-semibold text-moss">Sign in</Link> to report this image.
      </span>
    );
  }

  return (
    <SignedInPublicImageReportButton
      key={`${publicPassportSnapshotId}:${authState.username}`}
      publicPassportSnapshotId={publicPassportSnapshotId}
      authState={authState}
    />
  );
}

function SignedInPublicImageReportButton({
  publicPassportSnapshotId,
  authState
}: {
  publicPassportSnapshotId: string;
  authState: Extract<AuthUserState, { status: "signed-in" }>;
}) {
  const client = useMemo(() => {
    configureAmplifyClient();
    return generateClient<Schema>();
  }, []);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [reason, setReason] = useState<PublicImageReportReason>(publicImageReportReasons[0].value);
  const [details, setDetails] = useState("");
  const [detailsError, setDetailsError] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const mountedRef = useRef(true);
  const submissionIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      submissionIdRef.current += 1;
    };
  }, []);

  async function submitReport() {
    if (isSaving || success) {
      return;
    }

    const normalizedDetails = normalizePublicImageReportDetails(details);
    if (normalizedDetails.error) {
      setDetailsError(normalizedDetails.error);
      return;
    }

    const submissionId = submissionIdRef.current + 1;
    submissionIdRef.current = submissionId;
    setIsSaving(true);
    setError("");
    setDetailsError("");

    const result = await submitPublicImageReport(client, {
      publicPassportSnapshotId,
      reporterId: authState.username,
      reason,
      details: normalizedDetails.value
    });

    if (!mountedRef.current || submissionIdRef.current !== submissionId) {
      return;
    }

    setIsSaving(false);

    if (result.status === "submitted") {
      setSuccess("Image report submitted for review.");
      setDetails("");
      setIsOpen(false);
      return;
    }

    if (result.status === "invalid" && result.detailsError) {
      setDetailsError(result.detailsError);
      return;
    }

    setError("The image report could not be submitted. Confirm you are signed in and try again.");
  }

  if (success) {
    return <span className="text-xs font-semibold text-moss" role="status">{success}</span>;
  }

  return (
    <div className="w-full max-w-full lg:w-auto">
      <button
        type="button"
        disabled={isSaving}
        onClick={() => {
          setIsOpen((current) => !current);
          setError("");
          setDetailsError("");
        }}
        className="inline-flex rounded-md border border-clay/35 bg-white px-3 py-1.5 text-xs font-semibold text-clay disabled:cursor-not-allowed disabled:opacity-60"
      >
        Report image
      </button>

      {isOpen ? (
        <div className="mt-3 w-full max-w-full rounded-md border border-ink/10 bg-paper p-4 text-left lg:w-[28rem]">
          <h3 className="text-sm font-bold text-ink">Report this public image</h3>
          <p className="mt-2 text-xs leading-5 text-ink/65">
            Report images that appear to expose serial numbers, exact locations, license plates, private documents, bystanders, or sensitive personal information.
          </p>
          <p className="mt-2 text-xs leading-5 text-ink/55">
            A report starts a review. It does not automatically hide or remove the image. Do not include private information, links, or storage paths in your report.
          </p>

          <label className="mt-3 block">
            <span className="text-xs font-semibold text-ink">Reason</span>
            <select
              value={reason}
              disabled={isSaving}
              onChange={(event) => setReason(event.target.value as PublicImageReportReason)}
              className="mt-2 min-h-10 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-moss disabled:opacity-60"
            >
              {publicImageReportReasons.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>

          <label className="mt-3 block">
            <span className="flex items-center justify-between gap-3 text-xs font-semibold text-ink">
              <span>Details <span className="font-normal text-ink/50">(optional)</span></span>
              <span className="font-normal text-ink/50">{details.length}/{publicImageReportDetailsMaxLength}</span>
            </span>
            <textarea
              value={details}
              rows={4}
              maxLength={publicImageReportDetailsMaxLength}
              disabled={isSaving}
              onChange={(event) => {
                setDetails(event.target.value);
                setDetailsError("");
                setError("");
              }}
              className="mt-2 w-full resize-y rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-moss disabled:opacity-60"
            />
          </label>

          {detailsError ? <p className="mt-2 text-xs font-semibold text-clay">{detailsError}</p> : null}
          {error ? <p className="mt-2 text-xs font-semibold leading-5 text-clay" role="alert">{error}</p> : null}

          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => {
                setIsOpen(false);
                setError("");
                setDetailsError("");
              }}
              className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm font-semibold text-ink disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void submitReport()}
              className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Submitting..." : "Submit image report"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
