import type { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";

type AmplifyDataClient = ReturnType<typeof generateClient<Schema>>;

export const publicImageAltTextMaxLength = 140;

const persistentIdPattern = /^[a-z0-9][a-z0-9_-]{0,127}$/i;
const nonPersistentIdPattern = /^(?:(?:demo|sample)(?:[-_]|$)|(?:passport|session|target-photo)-\d+$)/i;
const urlPattern = /(?:\b[a-z][a-z0-9+.-]*:\/\/|\bwww\.|\b(?:data|blob):)/i;
const storagePathPattern = /\b(?:private[\\/](?:equipment|targets)|public[\\/]passports)[\\/]/i;

const processingFailureCodes = [
  "unauthorized",
  "invalid_request",
  "invalid_alt_text",
  "consent_required",
  "candidate_not_verified",
  "unsupported_source",
  "source_not_found",
  "source_mismatch",
  "profile_not_public",
  "username_unresolved",
  "invalid_storage_key",
  "object_not_found",
  "unsupported_content_type",
  "file_too_large",
  "metadata_mismatch",
  "invalid_image",
  "animated_image",
  "dimensions_exceeded",
  "output_too_large",
  "storage_write_failed",
  "state_changed",
  "unknown_error"
] as const;

export type PublicImageProcessingFailureCode = (typeof processingFailureCodes)[number];

const knownFailureCodes = new Set<string>(processingFailureCodes);

export type PublicImageProcessingResult =
  | { status: "ready" }
  | { status: "failed"; failureCode: PublicImageProcessingFailureCode };

export function normalizePublicImageAltText(value: string) {
  const normalized = value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return { value: "", error: "Add a short description of the selected equipment image." };
  }

  if (normalized.length > publicImageAltTextMaxLength) {
    return { value: "", error: `Keep alt text to ${publicImageAltTextMaxLength} characters or fewer.` };
  }

  if (urlPattern.test(normalized) || storagePathPattern.test(normalized)) {
    return { value: "", error: "Describe the image without links or storage paths." };
  }

  return { value: normalized, error: "" };
}

function normalizePersistentId(value: string) {
  const normalized = value.trim();
  return persistentIdPattern.test(normalized) && !nonPersistentIdPattern.test(normalized) ? normalized : "";
}

function normalizeFailureCode(value?: string | null): PublicImageProcessingFailureCode {
  return value && knownFailureCodes.has(value) ? (value as PublicImageProcessingFailureCode) : "unknown_error";
}

export function getPublicImageProcessingFailureMessage(code: PublicImageProcessingFailureCode) {
  if (code === "unauthorized") {
    return "We could not verify access to this snapshot and image. Refresh your session and try again.";
  }

  if (code === "invalid_request" || code === "invalid_alt_text" || code === "consent_required") {
    return "Review the selected image, safety confirmations, and alt text, then try again.";
  }

  if (code === "candidate_not_verified") {
    return "This private equipment image is not currently verified. Verify it from the saved passport before trying again.";
  }

  if (code === "unsupported_source") {
    return "Only a verified Equipment Passport cover image can be processed.";
  }

  if (
    code === "source_not_found" ||
    code === "source_mismatch" ||
    code === "invalid_storage_key" ||
    code === "metadata_mismatch" ||
    code === "object_not_found"
  ) {
    return "The private source changed or is no longer available. Re-upload or verify the current equipment cover and try again.";
  }

  if (code === "profile_not_public" || code === "username_unresolved") {
    return "Public sharing is not currently available for this account. Review profile visibility and username ownership.";
  }

  if (code === "state_changed") {
    return "The public snapshot or image changed while processing. Refresh Public Preview and confirm the new current cover is uploaded and verified before retrying.";
  }

  if (
    code === "unsupported_content_type" ||
    code === "file_too_large" ||
    code === "invalid_image" ||
    code === "animated_image" ||
    code === "dimensions_exceeded" ||
    code === "output_too_large"
  ) {
    return "This image cannot be prepared safely. Use a different supported JPEG or PNG equipment cover.";
  }

  return "The public-safe image could not be completed. Your private original was not changed. Try again later.";
}

export async function processPublicPassportImageSelection(
  client: AmplifyDataClient,
  {
    publicPassportSnapshotId,
    privateImageAssetId,
    altText
  }: {
    publicPassportSnapshotId: string;
    privateImageAssetId: string;
    altText?: string;
  }
): Promise<PublicImageProcessingResult> {
  const snapshotId = normalizePersistentId(publicPassportSnapshotId);
  const candidateId = normalizePersistentId(privateImageAssetId);
  const normalizedAltText = altText === undefined ? undefined : normalizePublicImageAltText(altText);

  if (!snapshotId || !candidateId || normalizedAltText?.error) {
    return { status: "failed", failureCode: "invalid_request" };
  }

  try {
    const result = await client.mutations.processPublicPassportImage(
      {
        publicPassportSnapshotId: snapshotId,
        privateImageAssetId: candidateId,
        altText: normalizedAltText?.value,
        consentConfirmed: true
      },
      { authMode: "userPool" }
    );

    if (result.errors?.length || !result.data) {
      return { status: "failed", failureCode: "unknown_error" };
    }

    if (result.data.processingStatus === "ready") {
      return { status: "ready" };
    }

    return { status: "failed", failureCode: normalizeFailureCode(result.data.failureCode) };
  } catch {
    return { status: "failed", failureCode: "unknown_error" };
  }
}
