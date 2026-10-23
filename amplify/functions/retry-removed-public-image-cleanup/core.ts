const publicImageAssetIdPattern = /^img-[0-9a-f]{40}$/;
const persistentIdPattern = /^[a-z0-9][a-z0-9_-]{0,127}$/i;
const nonPersistentIdPattern = /^(?:(?:demo|sample)(?:[-_]|$)|(?:passport|session|target-photo)-\d+$)/i;
const derivativeMaxBytes = 2 * 1024 * 1024;
const cleanupClaimLeaseMilliseconds = 5 * 60 * 1_000;

export type CleanupRetryIdentity = {
  sub?: unknown;
  username?: unknown;
  groups?: unknown;
};

export type RemovedPublicImageAssetRecord = {
  id: string;
  ownerId: string;
  publicPassportSnapshotId: string;
  sourceType: string;
  sourceRecordId: string;
  publicImageKey?: string;
  publicImageAltText?: string;
  status: string;
  moderationStatus?: string;
  lastReportAt?: string;
  cleanupAttemptId?: string;
  cleanupAttemptStatus?: string;
  cleanupAttemptStartedAt?: string;
  cleanupAttemptFailureCode?: string;
  cleanupCompletedAt?: string;
  updatedAt?: string;
};

export type CleanupRetrySnapshotRecord = {
  id: string;
  ownerId: string;
  equipmentPassportId: string;
  publicImageAssetId?: string;
  publicImageKey?: string;
  publicImageAltText?: string;
  updatedAt?: string;
};

export type CleanupObjectHeadResult =
  | { state: "present"; eTag?: string; contentType?: string; contentLength?: number }
  | { state: "missing" }
  | { state: "inaccessible" }
  | { state: "transient" };

export type BucketVersioningResult =
  | { state: "unversioned" }
  | { state: "enabled" | "suspended" | "inaccessible" | "transient" };

export type CleanupClaimResult = "claimed" | "active_attempt" | "state_changed" | "failed";
export type ConditionalDeleteResult =
  | "deleted"
  | "missing"
  | "precondition_failed"
  | "inaccessible"
  | "transient";

export type RemovedPublicImageCleanupRetryDependencies = {
  now: () => Date;
  newAttemptId: () => string;
  getAsset: (id: string) => Promise<RemovedPublicImageAssetRecord | null>;
  getSnapshot: (id: string) => Promise<CleanupRetrySnapshotRecord | null>;
  getBucketVersioning: () => Promise<BucketVersioningResult>;
  claimAttempt: (input: {
    asset: RemovedPublicImageAssetRecord;
    snapshot: CleanupRetrySnapshotRecord;
    attemptId: string;
    claimedAt: string;
    leaseCutoff: string;
  }) => Promise<CleanupClaimResult>;
  headDerivative: (canonicalKey: string) => Promise<CleanupObjectHeadResult>;
  deleteDerivative: (canonicalKey: string, eTag: string) => Promise<ConditionalDeleteResult>;
  completeAttempt: (input: {
    asset: RemovedPublicImageAssetRecord;
    attemptId: string;
    completedAt: string;
  }) => Promise<boolean>;
  markAttemptRetryPending: (input: {
    asset: RemovedPublicImageAssetRecord;
    attemptId: string;
    failureCode: string;
    updatedAt: string;
  }) => Promise<boolean>;
};

export type RemovedPublicImageCleanupRetryStatus =
  | "disabled"
  | "not_eligible"
  | "already_missing"
  | "cleaned"
  | "retry_pending"
  | "state_changed"
  | "manual_review"
  | "failed";

export type RemovedPublicImageCleanupRetryResult = {
  cleanupStatus: RemovedPublicImageCleanupRetryStatus;
  failureCode?: string;
  retryable: boolean;
};

function normalizedPersistentId(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }
  const normalized = value.trim();
  return persistentIdPattern.test(normalized) && !nonPersistentIdPattern.test(normalized) ? normalized : "";
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function canonicalDerivativeKey(snapshotId: string, assetId: string) {
  return `public/passports/${snapshotId}/cover/${assetId}.jpg`;
}

function response(
  cleanupStatus: RemovedPublicImageCleanupRetryStatus,
  failureCode?: string,
  retryable = false
): RemovedPublicImageCleanupRetryResult {
  return { cleanupStatus, failureCode, retryable };
}

export function isAuthorizedCleanupRetryAdmin(identity: unknown): identity is CleanupRetryIdentity {
  if (!identity || typeof identity !== "object") {
    return false;
  }
  const candidate = identity as CleanupRetryIdentity;
  return Boolean(
    typeof candidate.sub === "string" &&
      candidate.sub.length > 0 &&
      typeof candidate.username === "string" &&
      candidate.username.length > 0 &&
      Array.isArray(candidate.groups) &&
      candidate.groups.includes("admin")
  );
}

function projectionState(
  snapshot: CleanupRetrySnapshotRecord,
  asset: RemovedPublicImageAssetRecord
) {
  const projectedAssetId = optionalString(snapshot.publicImageAssetId);
  const projectedKey = optionalString(snapshot.publicImageKey);
  const projectedAltText = optionalString(snapshot.publicImageAltText);

  if (!projectedAssetId && !projectedKey && !projectedAltText) {
    return "detached" as const;
  }

  const expectedCurrentKey = canonicalDerivativeKey(snapshot.id, asset.id);
  if (projectedAssetId === asset.id || projectedKey === expectedCurrentKey) {
    return "attached" as const;
  }

  if (
    projectedAssetId &&
    publicImageAssetIdPattern.test(projectedAssetId) &&
    projectedKey === canonicalDerivativeKey(snapshot.id, projectedAssetId) &&
    projectedAltText
  ) {
    return "different_generation" as const;
  }

  return "incomplete" as const;
}

function validateAssetAndSnapshot(
  asset: RemovedPublicImageAssetRecord,
  snapshot: CleanupRetrySnapshotRecord | null,
  expectedAssetId: string
) {
  const snapshotId = normalizedPersistentId(asset.publicPassportSnapshotId);
  const sourceRecordId = normalizedPersistentId(asset.sourceRecordId);
  const validOwner = Boolean(asset.ownerId.trim() && asset.ownerId.length <= 256);

  if (
    asset.id !== expectedAssetId ||
    !snapshotId ||
    !sourceRecordId ||
    !validOwner ||
    asset.sourceType !== "equipment_cover"
  ) {
    return { valid: false as const, status: "manual_review" as const, failureCode: "invalid_binding" };
  }

  if (asset.moderationStatus === "hidden") {
    return { valid: false as const, status: "manual_review" as const, failureCode: "hidden_retained" };
  }
  if (asset.status !== "removed") {
    return {
      valid: false as const,
      status: asset.status === "draft" || asset.status === "processing" || asset.status === "ready"
        ? "not_eligible" as const
        : "manual_review" as const,
      failureCode: asset.status === "processing" ? "processing_unresolved" : "invalid_lifecycle"
    };
  }
  if (asset.moderationStatus !== "clear" && asset.moderationStatus !== "removed") {
    return { valid: false as const, status: "manual_review" as const, failureCode: "legacy_moderation_state" };
  }
  if (!snapshot) {
    return { valid: false as const, status: "manual_review" as const, failureCode: "snapshot_unavailable" };
  }
  if (
    snapshot.id !== snapshotId ||
    snapshot.ownerId !== asset.ownerId ||
    snapshot.equipmentPassportId !== sourceRecordId
  ) {
    return { valid: false as const, status: "manual_review" as const, failureCode: "snapshot_binding_mismatch" };
  }

  const currentProjectionState = projectionState(snapshot, asset);
  if (currentProjectionState === "attached") {
    return { valid: false as const, status: "not_eligible" as const, failureCode: "snapshot_attached" };
  }
  if (currentProjectionState === "different_generation") {
    return { valid: false as const, status: "manual_review" as const, failureCode: "replacement_generation" };
  }
  if (currentProjectionState !== "detached") {
    return { valid: false as const, status: "manual_review" as const, failureCode: "projection_incomplete" };
  }

  return {
    valid: true as const,
    snapshot,
    snapshotId,
    sourceRecordId,
    canonicalKey: canonicalDerivativeKey(snapshotId, asset.id)
  };
}

function claimedStateMatches(
  asset: RemovedPublicImageAssetRecord | null,
  snapshot: CleanupRetrySnapshotRecord | null,
  expectedAsset: RemovedPublicImageAssetRecord,
  attemptId: string
) {
  if (!asset || !snapshot) {
    return false;
  }
  const validation = validateAssetAndSnapshot(asset, snapshot, expectedAsset.id);
  return Boolean(
    validation.valid &&
      asset.ownerId === expectedAsset.ownerId &&
      asset.publicPassportSnapshotId === expectedAsset.publicPassportSnapshotId &&
      asset.sourceRecordId === expectedAsset.sourceRecordId &&
      asset.publicImageKey === expectedAsset.publicImageKey &&
      asset.cleanupAttemptId === attemptId &&
      asset.cleanupAttemptStatus === "claimed"
  );
}

function validDerivativeMetadata(head: Extract<CleanupObjectHeadResult, { state: "present" }>) {
  const contentType = head.contentType?.split(";", 1)[0]?.trim().toLowerCase();
  const contentLength = head.contentLength ?? 0;
  const eTag = head.eTag?.trim() ?? "";
  return Boolean(
    contentType === "image/jpeg" &&
      contentLength > 0 &&
      contentLength <= derivativeMaxBytes &&
      eTag.length > 0 &&
      eTag.length <= 1_024 &&
      !/[\u0000-\u001f\u007f]/.test(eTag)
  );
}

async function persistRetryPending(
  dependencies: RemovedPublicImageCleanupRetryDependencies,
  asset: RemovedPublicImageAssetRecord,
  attemptId: string,
  failureCode: string,
  now: string
) {
  const persisted = await dependencies.markAttemptRetryPending({
    asset,
    attemptId,
    failureCode,
    updatedAt: now
  });
  return persisted
    ? response("retry_pending", failureCode, true)
    : response("state_changed", "attempt_state_changed", true);
}

async function persistCompletion(
  dependencies: RemovedPublicImageCleanupRetryDependencies,
  asset: RemovedPublicImageAssetRecord,
  attemptId: string,
  completedAt: string,
  status: "cleaned" | "already_missing"
) {
  const persisted = await dependencies.completeAttempt({ asset, attemptId, completedAt });
  return persisted
    ? response(status)
    : response("retry_pending", "result_persistence_failed", true);
}

export async function retryRemovedPublicImageCleanup(
  input: {
    publicImageAssetId: unknown;
    confirmation: unknown;
    executionEnabled: boolean;
    identity: unknown;
  },
  dependencies: RemovedPublicImageCleanupRetryDependencies
): Promise<RemovedPublicImageCleanupRetryResult> {
  if (!isAuthorizedCleanupRetryAdmin(input.identity)) {
    return response("failed", "unauthorized");
  }

  const assetId = typeof input.publicImageAssetId === "string" ? input.publicImageAssetId.trim() : "";
  if (!publicImageAssetIdPattern.test(assetId)) {
    return response("not_eligible", "invalid_request");
  }
  if (input.confirmation !== true) {
    return response("not_eligible", "confirmation_required");
  }
  if (!input.executionEnabled) {
    return response("disabled", "execution_disabled");
  }

  const asset = await dependencies.getAsset(assetId);
  if (!asset) {
    return response("not_eligible", "asset_unavailable");
  }
  const snapshotId = normalizedPersistentId(asset.publicPassportSnapshotId);
  const snapshot = snapshotId ? await dependencies.getSnapshot(snapshotId) : null;
  const validation = validateAssetAndSnapshot(asset, snapshot, assetId);
  if (!validation.valid) {
    return response(validation.status, validation.failureCode);
  }

  if (!asset.publicImageKey) {
    return response("already_missing");
  }
  if (asset.publicImageKey !== validation.canonicalKey) {
    return response("manual_review", "canonical_key_mismatch");
  }

  const versioning = await dependencies.getBucketVersioning();
  if (versioning.state === "enabled" || versioning.state === "suspended") {
    return response("manual_review", "versioning_unsupported");
  }
  if (versioning.state === "inaccessible" || versioning.state === "transient") {
    return response("retry_pending", "versioning_check_failed", true);
  }

  const now = dependencies.now();
  const claimedAt = now.toISOString();
  const leaseCutoff = new Date(now.getTime() - cleanupClaimLeaseMilliseconds).toISOString();
  const attemptId = dependencies.newAttemptId();
  const claim = await dependencies.claimAttempt({
    asset,
    snapshot: validation.snapshot,
    attemptId,
    claimedAt,
    leaseCutoff
  });

  if (claim === "active_attempt") {
    return response("retry_pending", "attempt_in_progress", true);
  }
  if (claim === "state_changed") {
    return response("state_changed", "state_changed", true);
  }
  if (claim !== "claimed") {
    return response("retry_pending", "claim_failed", true);
  }

  const [claimedAsset, claimedSnapshot] = await Promise.all([
    dependencies.getAsset(assetId),
    dependencies.getSnapshot(validation.snapshotId)
  ]);
  if (!claimedStateMatches(claimedAsset, claimedSnapshot, asset, attemptId)) {
    return response("state_changed", "state_changed", true);
  }

  const head = await dependencies.headDerivative(validation.canonicalKey);
  if (head.state === "missing") {
    return persistCompletion(dependencies, asset, attemptId, dependencies.now().toISOString(), "already_missing");
  }
  if (head.state === "inaccessible") {
    return persistRetryPending(dependencies, asset, attemptId, "object_inaccessible", dependencies.now().toISOString());
  }
  if (head.state === "transient") {
    return persistRetryPending(dependencies, asset, attemptId, "object_check_failed", dependencies.now().toISOString());
  }
  if (!validDerivativeMetadata(head)) {
    return persistRetryPending(dependencies, asset, attemptId, "object_metadata_invalid", dependencies.now().toISOString());
  }

  const [preDeleteAsset, preDeleteSnapshot] = await Promise.all([
    dependencies.getAsset(assetId),
    dependencies.getSnapshot(validation.snapshotId)
  ]);
  if (!claimedStateMatches(preDeleteAsset, preDeleteSnapshot, asset, attemptId)) {
    return response("state_changed", "state_changed", true);
  }

  const deletion = await dependencies.deleteDerivative(validation.canonicalKey, head.eTag!.trim());
  if (deletion === "precondition_failed") {
    const marked = await persistRetryPending(
      dependencies,
      asset,
      attemptId,
      "delete_precondition_failed",
      dependencies.now().toISOString()
    );
    return marked.cleanupStatus === "retry_pending"
      ? response("state_changed", "delete_precondition_failed", true)
      : marked;
  }
  if (deletion === "inaccessible") {
    return persistRetryPending(dependencies, asset, attemptId, "delete_inaccessible", dependencies.now().toISOString());
  }

  const confirmationHead = await dependencies.headDerivative(validation.canonicalKey);
  if (confirmationHead.state === "missing") {
    return persistCompletion(
      dependencies,
      asset,
      attemptId,
      dependencies.now().toISOString(),
      deletion === "missing" ? "already_missing" : "cleaned"
    );
  }

  const failureCode = deletion === "transient"
    ? "delete_uncertain"
    : confirmationHead.state === "inaccessible"
      ? "deletion_confirmation_inaccessible"
      : confirmationHead.state === "transient"
        ? "deletion_confirmation_failed"
        : "deletion_not_observed";
  return persistRetryPending(dependencies, asset, attemptId, failureCode, dependencies.now().toISOString());
}
