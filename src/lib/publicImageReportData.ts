import type { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";

type AmplifyDataClient = ReturnType<typeof generateClient<Schema>>;

export const publicImageReportDetailsMaxLength = 500;

export const publicImageReportReasons = [
  { value: "unsafe content", label: "Unsafe content" },
  { value: "personal information", label: "Personal information" },
  { value: "harassment or threat", label: "Harassment or threat" },
  { value: "illegal hunting / poaching", label: "Illegal hunting / poaching" },
  { value: "sales or marketplace activity", label: "Sales or marketplace activity" },
  { value: "other", label: "Other" }
] as const;

export type PublicImageReportReason = (typeof publicImageReportReasons)[number]["value"];

const allowedReasons = new Set<string>(publicImageReportReasons.map((reason) => reason.value));
const persistentIdPattern = /^[a-z0-9][a-z0-9_-]{0,127}$/i;
const nonPersistentIdPattern = /^(?:(?:demo|sample)(?:[-_]|$)|(?:passport|session|target-photo)-\d+$)/i;
const forbiddenTechnicalContentPattern = /(?:\b(?:s3|https?|data|blob):\/\/|\bwww\.|\b(?:private|public)[\\/](?:equipment|targets|passports)[\\/])/i;

function normalizePersistentId(value: string) {
  const normalized = value.trim();
  return persistentIdPattern.test(normalized) && !nonPersistentIdPattern.test(normalized) ? normalized : "";
}

export function normalizePublicImageReportDetails(value: string) {
  if (value.length > publicImageReportDetailsMaxLength) {
    return { value: "", error: `Keep details to ${publicImageReportDetailsMaxLength} characters or fewer.` };
  }

  const normalized = value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length > publicImageReportDetailsMaxLength) {
    return { value: "", error: `Keep details to ${publicImageReportDetailsMaxLength} characters or fewer.` };
  }

  if (forbiddenTechnicalContentPattern.test(normalized)) {
    return { value: "", error: "Remove links and storage paths from the report details." };
  }

  return { value: normalized, error: "" };
}

export async function submitPublicImageReport(
  client: AmplifyDataClient,
  input: {
    publicPassportSnapshotId: string;
    reason: PublicImageReportReason;
    details: string;
  }
) {
  const snapshotId = normalizePersistentId(input.publicPassportSnapshotId);
  const normalizedDetails = normalizePublicImageReportDetails(input.details);

  if (!snapshotId || !allowedReasons.has(input.reason) || normalizedDetails.error) {
    return { status: "invalid" as const, detailsError: normalizedDetails.error };
  }

  try {
    const result = await client.mutations.createPublicImageReport(
      {
        publicPassportSnapshotId: snapshotId,
        reason: input.reason,
        details: normalizedDetails.value || undefined
      },
      { authMode: "userPool" }
    );

    if (result.errors?.length || !result.data) {
      return { status: "failed" as const };
    }

    if (result.data.submissionStatus === "submitted") {
      return { status: "submitted" as const };
    }

    if (result.data.failureCode === "invalid_request") {
      return { status: "invalid" as const, detailsError: "Review the reason and details, then try again." };
    }

    if (result.data.failureCode === "image_unavailable" || result.data.failureCode === "state_changed") {
      return { status: "unavailable" as const };
    }

    return { status: "failed" as const };
  } catch {
    return { status: "failed" as const };
  }
}
