import type { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";

type AmplifyDataClient = ReturnType<typeof generateClient<Schema>>;

const persistentIdPattern = /^[a-z0-9][a-z0-9_-]{0,127}$/i;
const nonPersistentIdPattern = /^(?:(?:demo|sample)(?:[-_]|$)|(?:passport|session|target-photo)-\d+$)/i;

const cleanupFailureCodes = [
  "unauthorized",
  "invalid_request",
  "state_changed",
  "projection_mismatch",
  "storage_delete_failed",
  "unknown_error"
] as const;

export type PublicImageCleanupFailureCode = (typeof cleanupFailureCodes)[number];

export type PublicImageCleanupResult =
  | { status: "removed" }
  | { status: "not_attached" }
  | { status: "cleanup_pending" | "failed"; failureCode: PublicImageCleanupFailureCode };

const knownFailureCodes = new Set<string>(cleanupFailureCodes);

function normalizePersistentId(value: string) {
  const normalized = value.trim();
  return persistentIdPattern.test(normalized) && !nonPersistentIdPattern.test(normalized) ? normalized : "";
}

function normalizeFailureCode(value?: string | null): PublicImageCleanupFailureCode {
  return value && knownFailureCodes.has(value) ? (value as PublicImageCleanupFailureCode) : "unknown_error";
}

export function getPublicImageCleanupFailureMessage(failureCode: PublicImageCleanupFailureCode) {
  switch (failureCode) {
    case "unauthorized":
      return "The public image could not be removed because ownership could not be confirmed. Refresh and sign in again before retrying.";
    case "invalid_request":
      return "The public image removal request was not valid. Refresh the Public Preview before retrying.";
    case "state_changed":
      return "The public image changed while removal was in progress. Refresh the Public Preview to see its current state.";
    case "projection_mismatch":
      return "The public image reference was detached, but final derivative cleanup needs another safe retry.";
    case "storage_delete_failed":
      return "The public image reference was detached, but derivative cleanup is still pending. Public delivery remains unavailable.";
    default:
      return "The public image could not be removed. Your private original was not changed. Try again later.";
  }
}

export async function removePublicPassportImage(
  client: AmplifyDataClient,
  publicPassportSnapshotId: string
): Promise<PublicImageCleanupResult> {
  const snapshotId = normalizePersistentId(publicPassportSnapshotId);

  if (!snapshotId) {
    return { status: "failed", failureCode: "invalid_request" };
  }

  try {
    const result = await client.mutations.removePublicPassportImage(
      { publicPassportSnapshotId: snapshotId },
      { authMode: "userPool" }
    );

    if (result.errors?.length || !result.data) {
      return { status: "failed", failureCode: "unknown_error" };
    }

    if (result.data.cleanupStatus === "removed" || result.data.cleanupStatus === "not_attached") {
      return { status: result.data.cleanupStatus };
    }

    if (result.data.cleanupStatus === "cleanup_pending" || result.data.cleanupStatus === "failed") {
      return {
        status: result.data.cleanupStatus,
        failureCode: normalizeFailureCode(result.data.failureCode)
      };
    }

    return { status: "failed", failureCode: "unknown_error" };
  } catch {
    return { status: "failed", failureCode: "unknown_error" };
  }
}
