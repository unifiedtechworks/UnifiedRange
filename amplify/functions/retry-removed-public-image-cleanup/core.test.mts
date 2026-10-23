import assert from "node:assert/strict";
import test from "node:test";
import {
  retryRemovedPublicImageCleanup,
  type BucketVersioningResult,
  type CleanupClaimResult,
  type CleanupObjectHeadResult,
  type CleanupRetrySnapshotRecord,
  type ConditionalDeleteResult,
  type RemovedPublicImageAssetRecord
} from "./core.ts";

const assetId = `img-${"c".repeat(40)}`;
const replacementAssetId = `img-${"d".repeat(40)}`;
const snapshotId = "snapshot-cleanup-123";
const sourceRecordId = "equipment-cleanup-123";
const canonicalKey = `public/passports/${snapshotId}/cover/${assetId}.jpg`;
const now = new Date("2026-10-23T20:00:00.000Z");
const adminIdentity = { sub: "admin-sub", username: "admin-user", groups: ["admin"] };

function asset(overrides: Partial<RemovedPublicImageAssetRecord> = {}): RemovedPublicImageAssetRecord {
  return {
    id: assetId,
    ownerId: "owner-alias",
    publicPassportSnapshotId: snapshotId,
    sourceType: "equipment_cover",
    sourceRecordId,
    publicImageKey: canonicalKey,
    status: "removed",
    moderationStatus: "clear",
    updatedAt: "2026-10-23T19:00:00.000Z",
    ...overrides
  };
}

function snapshot(overrides: Partial<CleanupRetrySnapshotRecord> = {}): CleanupRetrySnapshotRecord {
  return {
    id: snapshotId,
    ownerId: "owner-alias",
    equipmentPassportId: sourceRecordId,
    updatedAt: "2026-10-23T19:00:01.000Z",
    ...overrides
  };
}

function createHarness(options: {
  asset?: RemovedPublicImageAssetRecord | null;
  snapshot?: CleanupRetrySnapshotRecord | null;
  versioning?: BucketVersioningResult;
  claim?: CleanupClaimResult;
  heads?: CleanupObjectHeadResult[];
  deletion?: ConditionalDeleteResult;
  completeSucceeds?: boolean;
  markSucceeds?: boolean;
  afterClaimAsset?: RemovedPublicImageAssetRecord | null;
  afterClaimSnapshot?: CleanupRetrySnapshotRecord | null;
} = {}) {
  let currentAsset = options.asset === undefined ? asset() : options.asset;
  const currentSnapshot = options.snapshot === undefined ? snapshot() : options.snapshot;
  const calls: Array<{ operation: string; value?: string }> = [];
  const heads = [...(options.heads ?? [
    { state: "present", eTag: '"etag-1"', contentType: "image/jpeg", contentLength: 120_000 },
    { state: "missing" }
  ])];
  let claimed = false;
  let nowTick = 0;

  const dependencies = {
    now: () => new Date(now.getTime() + nowTick++ * 1_000),
    newAttemptId: () => "attempt-00000000-0000-4000-8000-000000000001",
    getAsset: async (id: string) => {
      calls.push({ operation: "getAsset", value: id });
      const selected = claimed && options.afterClaimAsset !== undefined
        ? options.afterClaimAsset
        : currentAsset;
      return selected ? { ...selected } : null;
    },
    getSnapshot: async (id: string) => {
      calls.push({ operation: "getSnapshot", value: id });
      const selected = claimed && options.afterClaimSnapshot !== undefined
        ? options.afterClaimSnapshot
        : currentSnapshot;
      return selected ? { ...selected } : null;
    },
    getBucketVersioning: async () => {
      calls.push({ operation: "getBucketVersioning" });
      return options.versioning ?? { state: "unversioned" as const };
    },
    claimAttempt: async (input: { attemptId: string; claimedAt: string }) => {
      calls.push({ operation: "claimAttempt" });
      const result = options.claim ?? "claimed";
      if (result === "claimed" && currentAsset) {
        claimed = true;
        currentAsset = {
          ...currentAsset,
          cleanupAttemptId: input.attemptId,
          cleanupAttemptStatus: "claimed",
          cleanupAttemptStartedAt: input.claimedAt,
          updatedAt: input.claimedAt
        };
      }
      return result;
    },
    headDerivative: async (key: string) => {
      calls.push({ operation: "headDerivative", value: key });
      return heads.shift() ?? { state: "transient" as const };
    },
    deleteDerivative: async (key: string, eTag: string) => {
      calls.push({ operation: "deleteDerivative", value: `${key}|${eTag}` });
      return options.deletion ?? "deleted";
    },
    completeAttempt: async () => {
      calls.push({ operation: "completeAttempt" });
      if (options.completeSucceeds === false) {
        return false;
      }
      if (currentAsset) {
        currentAsset = {
          ...currentAsset,
          publicImageKey: undefined,
          cleanupAttemptStatus: "complete",
          cleanupCompletedAt: now.toISOString()
        };
      }
      return true;
    },
    markAttemptRetryPending: async () => {
      calls.push({ operation: "markAttemptRetryPending" });
      if (options.markSucceeds === false) {
        return false;
      }
      if (currentAsset) {
        currentAsset = { ...currentAsset, cleanupAttemptStatus: "retry_pending" };
      }
      return true;
    }
  };

  return {
    calls,
    dependencies,
    currentAsset: () => currentAsset,
    currentSnapshot: () => currentSnapshot
  };
}

function request(overrides: Partial<{
  publicImageAssetId: unknown;
  confirmation: unknown;
  executionEnabled: boolean;
  identity: unknown;
}> = {}) {
  return {
    publicImageAssetId: assetId,
    confirmation: true,
    executionEnabled: true,
    identity: adminIdentity,
    ...overrides
  };
}

function assertBounded(result: unknown) {
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("public/passports/"), false);
  assert.equal(serialized.includes(assetId), false);
  assert.equal(serialized.includes("owner-alias"), false);
  assert.equal(serialized.includes("etag-1"), false);
}

test("disabled configuration performs zero reads, writes, or deletes", async () => {
  const harness = createHarness();
  const result = await retryRemovedPublicImageCleanup(
    request({ executionEnabled: false }),
    harness.dependencies
  );
  assert.deepEqual(result, {
    cleanupStatus: "disabled",
    failureCode: "execution_disabled",
    retryable: false
  });
  assert.equal(harness.calls.length, 0);
});

test("missing explicit confirmation performs zero reads, writes, or deletes", async () => {
  const harness = createHarness();
  const result = await retryRemovedPublicImageCleanup(
    request({ confirmation: false }),
    harness.dependencies
  );
  assert.equal(result.cleanupStatus, "not_eligible");
  assert.equal(result.failureCode, "confirmation_required");
  assert.equal(harness.calls.length, 0);
});

test("only admins pass Lambda authorization", async (t) => {
  const identities: Array<[string, unknown]> = [
    ["moderator", { sub: "sub", username: "user", groups: ["moderator"] }],
    ["ordinary", { sub: "sub", username: "user", groups: [] }],
    ["signed-out", null],
    ["api-key", { apiKey: "redacted" }]
  ];
  for (const [name, identity] of identities) {
    await t.test(name, async () => {
      const harness = createHarness();
      const result = await retryRemovedPublicImageCleanup(request({ identity }), harness.dependencies);
      assert.equal(result.cleanupStatus, "failed");
      assert.equal(result.failureCode, "unauthorized");
      assert.equal(harness.calls.length, 0);
    });
  }
});

test("invalid input is rejected before dependencies run", async () => {
  const harness = createHarness();
  const result = await retryRemovedPublicImageCleanup(
    request({ publicImageAssetId: "sample-image" }),
    harness.dependencies
  );
  assert.equal(result.failureCode, "invalid_request");
  assert.equal(harness.calls.length, 0);
});

test("valid removed detached candidate uses an ETag-bound delete and persists completion", async () => {
  const harness = createHarness();
  const result = await retryRemovedPublicImageCleanup(request(), harness.dependencies);
  assert.equal(result.cleanupStatus, "cleaned");
  assert.equal(result.retryable, false);
  assert.equal(harness.calls.filter((call) => call.operation === "deleteDerivative").length, 1);
  assert.equal(
    harness.calls.find((call) => call.operation === "deleteDerivative")?.value,
    `${canonicalKey}|"etag-1"`
  );
  assert.equal(harness.currentAsset()?.cleanupAttemptStatus, "complete");
  assert.equal(harness.currentAsset()?.publicImageKey, undefined);
  assertBounded(result);
});

test("already missing ledger state is idempotent and does not claim or access S3", async () => {
  const harness = createHarness({ asset: asset({ publicImageKey: undefined, cleanupAttemptStatus: "complete" }) });
  const result = await retryRemovedPublicImageCleanup(request(), harness.dependencies);
  assert.equal(result.cleanupStatus, "already_missing");
  assert.equal(harness.calls.some((call) => call.operation === "claimAttempt"), false);
  assert.equal(harness.calls.some((call) => call.operation === "headDerivative"), false);
  assert.equal(harness.calls.some((call) => call.operation === "deleteDerivative"), false);
});

test("confirmed S3 404 after claim finalizes as already missing", async () => {
  const harness = createHarness({ heads: [{ state: "missing" }] });
  const result = await retryRemovedPublicImageCleanup(request(), harness.dependencies);
  assert.equal(result.cleanupStatus, "already_missing");
  assert.equal(harness.calls.some((call) => call.operation === "deleteDerivative"), false);
  assert.equal(harness.calls.some((call) => call.operation === "completeAttempt"), true);
});

test("hidden derivatives are retained intentionally", async () => {
  const harness = createHarness({ asset: asset({ status: "ready", moderationStatus: "hidden" }) });
  const result = await retryRemovedPublicImageCleanup(request(), harness.dependencies);
  assert.equal(result.cleanupStatus, "manual_review");
  assert.equal(result.failureCode, "hidden_retained");
  assert.equal(harness.calls.some((call) => call.operation === "claimAttempt"), false);
});

test("still-attached and replacement-generation projections fail closed", async (t) => {
  await t.test("same generation attached", async () => {
    const harness = createHarness({
      snapshot: snapshot({
        publicImageAssetId: assetId,
        publicImageKey: canonicalKey,
        publicImageAltText: "Attached cover"
      })
    });
    const result = await retryRemovedPublicImageCleanup(request(), harness.dependencies);
    assert.equal(result.cleanupStatus, "not_eligible");
    assert.equal(result.failureCode, "snapshot_attached");
  });

  await t.test("different generation attached", async () => {
    const harness = createHarness({
      snapshot: snapshot({
        publicImageAssetId: replacementAssetId,
        publicImageKey: `public/passports/${snapshotId}/cover/${replacementAssetId}.jpg`,
        publicImageAltText: "Replacement cover"
      })
    });
    const result = await retryRemovedPublicImageCleanup(request(), harness.dependencies);
    assert.equal(result.cleanupStatus, "manual_review");
    assert.equal(result.failureCode, "replacement_generation");
  });
});

test("active and unresolved lifecycle states remain ineligible", async (t) => {
  for (const status of ["draft", "processing", "ready"]) {
    await t.test(status, async () => {
      const harness = createHarness({ asset: asset({ status }) });
      const result = await retryRemovedPublicImageCleanup(request(), harness.dependencies);
      assert.equal(result.cleanupStatus, "not_eligible");
      assert.equal(harness.calls.some((call) => call.operation === "claimAttempt"), false);
    });
  }
});

test("malformed key, missing ledger, and legacy moderation state are rejected", async (t) => {
  await t.test("malformed key", async () => {
    const harness = createHarness({ asset: asset({ publicImageKey: "public/passports/foreign.jpg" }) });
    const result = await retryRemovedPublicImageCleanup(request(), harness.dependencies);
    assert.equal(result.cleanupStatus, "manual_review");
    assert.equal(result.failureCode, "canonical_key_mismatch");
  });
  await t.test("missing ledger", async () => {
    const harness = createHarness({ asset: null });
    const result = await retryRemovedPublicImageCleanup(request(), harness.dependencies);
    assert.equal(result.cleanupStatus, "not_eligible");
    assert.equal(result.failureCode, "asset_unavailable");
  });
  await t.test("legacy moderation state", async () => {
    const harness = createHarness({ asset: asset({ moderationStatus: undefined }) });
    const result = await retryRemovedPublicImageCleanup(request(), harness.dependencies);
    assert.equal(result.cleanupStatus, "manual_review");
    assert.equal(result.failureCode, "legacy_moderation_state");
  });
});

test("unsupported target-photo source never reaches S3", async () => {
  const harness = createHarness({
    asset: asset({ sourceType: "range_session_target", sourceRecordId: "range-session-123" })
  });
  const result = await retryRemovedPublicImageCleanup(request(), harness.dependencies);
  assert.equal(result.cleanupStatus, "manual_review");
  assert.equal(result.failureCode, "invalid_binding");
  assert.equal(harness.calls.some((call) => call.operation === "headDerivative"), false);
});

test("S3 403 is inaccessible while 404 is confirmed missing", async (t) => {
  await t.test("403", async () => {
    const harness = createHarness({ heads: [{ state: "inaccessible" }] });
    const result = await retryRemovedPublicImageCleanup(request(), harness.dependencies);
    assert.equal(result.cleanupStatus, "retry_pending");
    assert.equal(result.failureCode, "object_inaccessible");
    assert.equal(harness.calls.some((call) => call.operation === "deleteDerivative"), false);
  });
  await t.test("404", async () => {
    const harness = createHarness({ heads: [{ state: "missing" }] });
    const result = await retryRemovedPublicImageCleanup(request(), harness.dependencies);
    assert.equal(result.cleanupStatus, "already_missing");
  });
});

test("conditional delete precondition failure remains state-changed and retryable", async () => {
  const harness = createHarness({ deletion: "precondition_failed" });
  const result = await retryRemovedPublicImageCleanup(request(), harness.dependencies);
  assert.equal(result.cleanupStatus, "state_changed");
  assert.equal(result.failureCode, "delete_precondition_failed");
  assert.equal(result.retryable, true);
});

test("concurrent state change after claim prevents all S3 operations", async () => {
  const harness = createHarness({
    afterClaimSnapshot: snapshot({
      publicImageAssetId: replacementAssetId,
      publicImageKey: `public/passports/${snapshotId}/cover/${replacementAssetId}.jpg`,
      publicImageAltText: "Replacement cover"
    })
  });
  const result = await retryRemovedPublicImageCleanup(request(), harness.dependencies);
  assert.equal(result.cleanupStatus, "state_changed");
  assert.equal(harness.calls.some((call) => call.operation === "headDerivative"), false);
  assert.equal(harness.calls.some((call) => call.operation === "deleteDerivative"), false);
});

test("active cleanup claim is not stolen", async () => {
  const harness = createHarness({ claim: "active_attempt" });
  const result = await retryRemovedPublicImageCleanup(request(), harness.dependencies);
  assert.equal(result.cleanupStatus, "retry_pending");
  assert.equal(result.failureCode, "attempt_in_progress");
  assert.equal(harness.calls.some((call) => call.operation === "headDerivative"), false);
});

test("repeated call converges without a second delete", async () => {
  const harness = createHarness();
  const first = await retryRemovedPublicImageCleanup(request(), harness.dependencies);
  const second = await retryRemovedPublicImageCleanup(request(), harness.dependencies);
  assert.equal(first.cleanupStatus, "cleaned");
  assert.equal(second.cleanupStatus, "already_missing");
  assert.equal(harness.calls.filter((call) => call.operation === "deleteDerivative").length, 1);
});

test("ambiguous deletion timeout stays retry-pending when object remains", async () => {
  const harness = createHarness({
    deletion: "transient",
    heads: [
      { state: "present", eTag: '"etag-1"', contentType: "image/jpeg", contentLength: 120_000 },
      { state: "present", eTag: '"etag-1"', contentType: "image/jpeg", contentLength: 120_000 }
    ]
  });
  const result = await retryRemovedPublicImageCleanup(request(), harness.dependencies);
  assert.equal(result.cleanupStatus, "retry_pending");
  assert.equal(result.failureCode, "delete_uncertain");
  assert.equal(result.retryable, true);
});

test("successful S3 deletion with failed result persistence remains retry-pending", async () => {
  const harness = createHarness({ completeSucceeds: false });
  const result = await retryRemovedPublicImageCleanup(request(), harness.dependencies);
  assert.equal(result.cleanupStatus, "retry_pending");
  assert.equal(result.failureCode, "result_persistence_failed");
});

test("stale attempt cannot persist a retry result over newer state", async () => {
  const harness = createHarness({
    heads: [{ state: "transient" }],
    markSucceeds: false
  });
  const result = await retryRemovedPublicImageCleanup(request(), harness.dependencies);
  assert.equal(result.cleanupStatus, "state_changed");
  assert.equal(result.failureCode, "attempt_state_changed");
});

test("enabled or suspended versioning is unsupported and causes zero writes/deletes", async (t) => {
  for (const state of ["enabled", "suspended"] as const) {
    await t.test(state, async () => {
      const harness = createHarness({ versioning: { state } });
      const result = await retryRemovedPublicImageCleanup(request(), harness.dependencies);
      assert.equal(result.cleanupStatus, "manual_review");
      assert.equal(result.failureCode, "versioning_unsupported");
      assert.equal(harness.calls.some((call) => call.operation === "claimAttempt"), false);
      assert.equal(harness.calls.some((call) => call.operation === "deleteDerivative"), false);
    });
  }
});

test("cleanup dependency surface has no private-object, listing, copy, or download operation", async () => {
  const harness = createHarness();
  await retryRemovedPublicImageCleanup(request(), harness.dependencies);
  assert.deepEqual(
    new Set(harness.calls.map((call) => call.operation)),
    new Set([
      "getAsset",
      "getSnapshot",
      "getBucketVersioning",
      "claimAttempt",
      "headDerivative",
      "deleteDerivative",
      "completeAttempt"
    ])
  );
});
