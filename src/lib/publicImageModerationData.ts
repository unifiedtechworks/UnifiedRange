import type { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";

type AmplifyDataClient = ReturnType<typeof generateClient<Schema>>;

export const publicImageModerationReasonMaxLength = 240;

export type PublicImageModerationAction = "hide" | "remove";
export type PublicImageModerationActionStatus =
  | "hidden"
  | "removed"
  | "not_attached"
  | "cleanup_pending"
  | "failed";

const persistentIdPattern = /^[a-z0-9][a-z0-9_-]{0,127}$/i;
const nonPersistentIdPattern = /^(?:(?:demo|sample)(?:[-_]|$)|(?:passport|session|target-photo)-\d+$)/i;
const technicalContentPattern = /(?:\b(?:s3|https?|data|blob):\/\/|\b(?:private|public)[\\/](?:equipment|targets|passports)[\\/])/i;
const allowedStatuses = new Set<PublicImageModerationActionStatus>([
  "hidden",
  "removed",
  "not_attached",
  "cleanup_pending",
  "failed"
]);

function normalizePersistentId(value: string) {
  const normalized = value.trim();
  return persistentIdPattern.test(normalized) && !nonPersistentIdPattern.test(normalized) ? normalized : "";
}

export function normalizePublicImageModerationReason(value: string) {
  const normalized = value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length > publicImageModerationReasonMaxLength) {
    return { value: "", error: `Keep the moderation reason to ${publicImageModerationReasonMaxLength} characters or fewer.` };
  }
  if (technicalContentPattern.test(normalized)) {
    return { value: "", error: "Remove links and storage paths from the moderation reason." };
  }

  return { value: normalized, error: "" };
}

export async function moderatePublicPassportImage(
  client: AmplifyDataClient,
  input: {
    publicPassportSnapshotId: string;
    action: PublicImageModerationAction;
    reason: string;
  }
): Promise<{ status: PublicImageModerationActionStatus }> {
  const snapshotId = normalizePersistentId(input.publicPassportSnapshotId);
  const reason = normalizePublicImageModerationReason(input.reason);

  if (!snapshotId || (input.action !== "hide" && input.action !== "remove") || reason.error) {
    return { status: "failed" };
  }

  try {
    const result = await client.mutations.moderatePublicPassportImage({
      publicPassportSnapshotId: snapshotId,
      action: input.action,
      reason: reason.value || undefined
    });
    const actionStatus = result.data?.actionStatus;

    if (result.errors?.length || !actionStatus || !allowedStatuses.has(actionStatus)) {
      return { status: "failed" };
    }

    return { status: actionStatus };
  } catch {
    return { status: "failed" };
  }
}
