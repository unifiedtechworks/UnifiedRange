const publicImageAssetIdPattern = /^img-[0-9a-f]{40}$/;
const persistentIdPattern = /^[a-z0-9][a-z0-9_-]{0,127}$/i;
const nonPersistentIdPattern = /^(?:(?:demo|sample)(?:[-_]|$)|(?:passport|session|target-photo)-\d+$)/i;
const knownAssetStatuses = new Set(["draft", "processing", "ready", "failed", "removed"]);
const knownModerationStatuses = new Set(["clear", "hidden", "removed"]);
const derivativeMaxBytes = 2 * 1024 * 1024;
const processingLeaseMilliseconds = 5 * 60 * 1_000;

export type InspectionIdentity = {
  sub?: unknown;
  username?: unknown;
  groups?: unknown;
};

export type PublicImageAssetInspectionRecord = {
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
  updatedAt?: string;
};

export type PublicPassportSnapshotInspectionRecord = {
  id: string;
  ownerId: string;
  equipmentPassportId: string;
  publicImageAssetId?: string;
  publicImageKey?: string;
  publicImageAltText?: string;
  updatedAt?: string;
};

export type DerivativeHeadResult =
  | { state: "present"; contentType?: string; contentLength?: number }
  | { state: "missing" | "inaccessible" | "transient" };

export type PublicImageCleanupInspectionDependencies = {
  now: () => Date;
  getAsset: (id: string) => Promise<PublicImageAssetInspectionRecord | null>;
  getSnapshot: (id: string) => Promise<PublicPassportSnapshotInspectionRecord | null>;
  headDerivative: (canonicalKey: string) => Promise<DerivativeHeadResult>;
};

export type CleanupAssessmentStatus = "assessed" | "unavailable" | "state_changed" | "failed";
export type CleanupRecommendation =
  | "no_action"
  | "manual_review"
  | "retry_inspection"
  | "cleanup_candidate_for_future_review";

export type PublicImageCleanupInspectionResult = {
  assessmentStatus: CleanupAssessmentStatus;
  findingCodes: string[];
  recommendedNextStep: CleanupRecommendation;
  inspectedAt: string;
  retryable: boolean;
};

type ProjectionState = "current" | "detached" | "different_generation" | "incomplete" | "missing_snapshot";

function normalizedPersistentId(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim();
  return persistentIdPattern.test(normalized) && !nonPersistentIdPattern.test(normalized) ? normalized : "";
}

function normalizedOptionalString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function canonicalDerivativeKey(snapshotId: string, assetId: string) {
  return `public/passports/${snapshotId}/cover/${assetId}.jpg`;
}

function addFinding(findings: string[], finding: string) {
  if (!findings.includes(finding)) {
    findings.push(finding);
  }
}

function result(
  inspectedAt: string,
  assessmentStatus: CleanupAssessmentStatus,
  findingCodes: string[],
  recommendedNextStep: CleanupRecommendation,
  retryable = false
): PublicImageCleanupInspectionResult {
  return {
    assessmentStatus,
    findingCodes: findingCodes.slice(0, 20),
    recommendedNextStep,
    inspectedAt,
    retryable
  };
}

export function isAuthorizedCleanupInspector(identity: unknown): identity is InspectionIdentity {
  if (!identity || typeof identity !== "object") {
    return false;
  }

  const candidate = identity as InspectionIdentity;
  return Boolean(
    typeof candidate.sub === "string" &&
      candidate.sub.length > 0 &&
      typeof candidate.username === "string" &&
      candidate.username.length > 0 &&
      Array.isArray(candidate.groups) &&
      candidate.groups.includes("admin")
  );
}

function assetFingerprint(asset: PublicImageAssetInspectionRecord | null) {
  if (!asset) {
    return "missing";
  }

  return JSON.stringify([
    asset.id,
    asset.ownerId,
    asset.publicPassportSnapshotId,
    asset.sourceType,
    asset.sourceRecordId,
    asset.publicImageKey ?? null,
    asset.publicImageAltText ?? null,
    asset.status,
    asset.moderationStatus ?? null,
    asset.lastReportAt ?? null,
    asset.updatedAt ?? null
  ]);
}

function snapshotFingerprint(snapshot: PublicPassportSnapshotInspectionRecord | null) {
  if (!snapshot) {
    return "missing";
  }

  return JSON.stringify([
    snapshot.id,
    snapshot.ownerId,
    snapshot.equipmentPassportId,
    snapshot.publicImageAssetId ?? null,
    snapshot.publicImageKey ?? null,
    snapshot.publicImageAltText ?? null,
    snapshot.updatedAt ?? null
  ]);
}

function classifyProjection(
  snapshot: PublicPassportSnapshotInspectionRecord | null,
  asset: PublicImageAssetInspectionRecord,
  canonicalKey: string,
  findings: string[]
): ProjectionState {
  if (!snapshot) {
    addFinding(findings, "snapshot_missing");
    return "missing_snapshot";
  }

  if (
    snapshot.id !== asset.publicPassportSnapshotId ||
    !snapshot.ownerId ||
    snapshot.ownerId !== asset.ownerId ||
    !normalizedPersistentId(snapshot.equipmentPassportId) ||
    snapshot.equipmentPassportId !== asset.sourceRecordId
  ) {
    addFinding(findings, "snapshot_binding_mismatch");
    return "incomplete";
  }

  const projectedAssetId = normalizedOptionalString(snapshot.publicImageAssetId);
  const projectedKey = normalizedOptionalString(snapshot.publicImageKey);
  const projectedAltText = normalizedOptionalString(snapshot.publicImageAltText);

  if (!projectedAssetId && !projectedKey && !projectedAltText) {
    addFinding(findings, "detached_generation");
    return "detached";
  }

  if (
    projectedAssetId === asset.id &&
    projectedKey === canonicalKey &&
    projectedAltText &&
    projectedAltText === normalizedOptionalString(asset.publicImageAltText)
  ) {
    addFinding(findings, "current_attached_generation");
    return "current";
  }

  if (
    projectedAssetId &&
    publicImageAssetIdPattern.test(projectedAssetId) &&
    projectedAssetId !== asset.id &&
    projectedKey === canonicalDerivativeKey(snapshot.id, projectedAssetId) &&
    projectedAltText
  ) {
    addFinding(findings, "snapshot_references_different_generation");
    return "different_generation";
  }

  addFinding(findings, "snapshot_projection_incomplete");
  return "incomplete";
}

function processingLeaseState(updatedAt: string | undefined, inspectedAt: Date) {
  if (!updatedAt) {
    return "invalid" as const;
  }

  const updatedAtTime = Date.parse(updatedAt);
  const ageMilliseconds = inspectedAt.getTime() - updatedAtTime;
  if (!Number.isFinite(updatedAtTime) || ageMilliseconds < 0) {
    return "invalid" as const;
  }
  return ageMilliseconds < processingLeaseMilliseconds ? "active" as const : "expired" as const;
}

function hasManualReviewFinding(findings: string[]) {
  const manualReviewFindings = new Set([
    "asset_binding_incomplete",
    "unsupported_source_type",
    "unknown_asset_status",
    "legacy_moderation_state",
    "unknown_moderation_state",
    "canonical_key_mismatch",
    "snapshot_missing",
    "snapshot_binding_mismatch",
    "snapshot_references_different_generation",
    "snapshot_projection_incomplete",
    "ledger_key_missing",
    "processing_timestamp_invalid",
    "derivative_metadata_invalid",
    "lifecycle_moderation_mismatch"
  ]);

  return findings.some((finding) => manualReviewFindings.has(finding));
}

export async function inspectPublicImageCleanup(
  publicImageAssetId: unknown,
  identity: unknown,
  dependencies: PublicImageCleanupInspectionDependencies
): Promise<PublicImageCleanupInspectionResult> {
  const inspectedAtDate = dependencies.now();
  const inspectedAt = inspectedAtDate.toISOString();

  if (!isAuthorizedCleanupInspector(identity)) {
    return result(inspectedAt, "failed", ["unauthorized"], "manual_review");
  }

  const assetId = typeof publicImageAssetId === "string" ? publicImageAssetId.trim() : "";
  if (!publicImageAssetIdPattern.test(assetId)) {
    return result(inspectedAt, "failed", ["invalid_asset_id"], "manual_review");
  }

  const asset = await dependencies.getAsset(assetId);
  if (!asset) {
    const confirmMissing = await dependencies.getAsset(assetId);
    if (confirmMissing) {
      return result(inspectedAt, "state_changed", ["state_changed"], "retry_inspection", true);
    }
    return result(inspectedAt, "unavailable", ["asset_not_found"], "manual_review");
  }

  const findings: string[] = [];
  const snapshotId = normalizedPersistentId(asset.publicPassportSnapshotId);
  const sourceRecordId = normalizedPersistentId(asset.sourceRecordId);
  const ownerIdIsBounded = Boolean(asset.ownerId.trim() && asset.ownerId.length <= 256);
  const sourceTypeIsSupported = asset.sourceType === "equipment_cover";
  const statusIsKnown = knownAssetStatuses.has(asset.status);
  const moderationStatus = asset.moderationStatus ?? "";
  const moderationStatusIsKnown = knownModerationStatuses.has(moderationStatus);
  const canonicalKey = snapshotId ? canonicalDerivativeKey(snapshotId, asset.id) : "";
  const storedKey = normalizedOptionalString(asset.publicImageKey);

  if (asset.id !== assetId || !snapshotId || !sourceRecordId || !ownerIdIsBounded) {
    addFinding(findings, "asset_binding_incomplete");
  }
  if (!sourceTypeIsSupported) {
    addFinding(findings, "unsupported_source_type");
  }
  if (!statusIsKnown) {
    addFinding(findings, "unknown_asset_status");
  }
  if (!moderationStatus) {
    addFinding(findings, "legacy_moderation_state");
  } else if (!moderationStatusIsKnown) {
    addFinding(findings, "unknown_moderation_state");
  }
  if (storedKey && storedKey !== canonicalKey) {
    addFinding(findings, "canonical_key_mismatch");
  }
  if (!storedKey && asset.status !== "removed") {
    addFinding(findings, "ledger_key_missing");
  }
  if (asset.lastReportAt) {
    addFinding(findings, "report_evidence_present");
  }

  if (asset.status === "removed") {
    addFinding(findings, "asset_removed");
  } else if (asset.status === "failed") {
    addFinding(findings, "asset_failed");
  } else if (asset.status === "processing") {
    const leaseState = processingLeaseState(asset.updatedAt, inspectedAtDate);
    if (leaseState === "active") {
      addFinding(findings, "processing_lease_active");
    } else if (leaseState === "expired") {
      addFinding(findings, "processing_lease_expired");
    } else {
      addFinding(findings, "processing_timestamp_invalid");
    }
  }

  if (moderationStatus === "hidden") {
    addFinding(findings, "moderation_hidden_retained");
  }

  if (
    (moderationStatus === "removed" && asset.status !== "removed") ||
    (moderationStatus === "hidden" && asset.status === "removed")
  ) {
    addFinding(findings, "lifecycle_moderation_mismatch");
  }

  const snapshot = snapshotId ? await dependencies.getSnapshot(snapshotId) : null;
  const projectionState = snapshotId && canonicalKey
    ? classifyProjection(snapshot, asset, canonicalKey, findings)
    : "incomplete";

  const bindingIsSafeForHead = Boolean(
    asset.id === assetId &&
      snapshotId &&
      sourceRecordId &&
      ownerIdIsBounded &&
      sourceTypeIsSupported &&
      statusIsKnown &&
      moderationStatusIsKnown &&
      canonicalKey &&
      (!storedKey || storedKey === canonicalKey)
  );

  let derivative: DerivativeHeadResult | { state: "not_checked" } = { state: "not_checked" };
  if (bindingIsSafeForHead) {
    derivative = await dependencies.headDerivative(canonicalKey);
    if (derivative.state === "present") {
      addFinding(findings, "derivative_present");
      const contentType = derivative.contentType?.split(";", 1)[0]?.trim().toLowerCase();
      const contentLength = derivative.contentLength ?? 0;
      if (contentType !== "image/jpeg" || contentLength <= 0 || contentLength > derivativeMaxBytes) {
        addFinding(findings, "derivative_metadata_invalid");
      }
    } else if (derivative.state === "missing") {
      addFinding(findings, "derivative_missing");
    } else if (derivative.state === "inaccessible") {
      addFinding(findings, "derivative_inaccessible");
    } else {
      addFinding(findings, "derivative_check_failed");
    }
  } else {
    addFinding(findings, "derivative_not_checked");
  }

  const [confirmedAsset, confirmedSnapshot] = await Promise.all([
    dependencies.getAsset(assetId),
    snapshotId ? dependencies.getSnapshot(snapshotId) : Promise.resolve(null)
  ]);

  if (
    assetFingerprint(asset) !== assetFingerprint(confirmedAsset) ||
    snapshotFingerprint(snapshot) !== snapshotFingerprint(confirmedSnapshot)
  ) {
    return result(inspectedAt, "state_changed", ["state_changed"], "retry_inspection", true);
  }

  if (derivative.state === "inaccessible" || derivative.state === "transient") {
    return result(inspectedAt, "assessed", findings, "retry_inspection", true);
  }

  if (hasManualReviewFinding(findings)) {
    return result(inspectedAt, "assessed", findings, "manual_review");
  }

  if (moderationStatus === "hidden") {
    return result(
      inspectedAt,
      "assessed",
      findings,
      derivative.state === "present" ? "no_action" : "manual_review"
    );
  }

  if (projectionState === "current") {
    if (
      asset.status === "ready" &&
      moderationStatus === "clear" &&
      derivative.state === "present" &&
      !findings.includes("derivative_metadata_invalid")
    ) {
      return result(inspectedAt, "assessed", findings, "no_action");
    }
    return result(inspectedAt, "assessed", findings, "manual_review");
  }

  if (projectionState === "detached" && derivative.state === "present") {
    if (findings.includes("report_evidence_present")) {
      return result(inspectedAt, "assessed", findings, "manual_review");
    }
    if (asset.status === "processing" && findings.includes("processing_lease_active")) {
      return result(inspectedAt, "assessed", findings, "no_action");
    }
    if (
      (asset.status === "removed" ||
        asset.status === "failed" ||
        asset.status === "ready" ||
        (asset.status === "processing" && findings.includes("processing_lease_expired"))) &&
      moderationStatus === "clear"
    ) {
      return result(inspectedAt, "assessed", findings, "cleanup_candidate_for_future_review");
    }
  }

  if (
    projectionState === "detached" &&
    derivative.state === "missing" &&
    asset.status === "removed"
  ) {
    return result(inspectedAt, "assessed", findings, "no_action");
  }

  return result(inspectedAt, "assessed", findings, "manual_review");
}
