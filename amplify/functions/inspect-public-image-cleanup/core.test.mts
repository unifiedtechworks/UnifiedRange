import assert from "node:assert/strict";
import test from "node:test";
import {
  inspectPublicImageCleanup,
  type DerivativeHeadResult,
  type PublicImageAssetInspectionRecord,
  type PublicPassportSnapshotInspectionRecord
} from "./core.ts";

const assetId = `img-${"a".repeat(40)}`;
const replacementAssetId = `img-${"b".repeat(40)}`;
const snapshotId = "snapshot-production-123";
const sourceRecordId = "equipment-production-123";
const canonicalKey = `public/passports/${snapshotId}/cover/${assetId}.jpg`;
const inspectedAt = new Date("2026-10-23T19:00:00.000Z");
const adminIdentity = { sub: "admin-sub", username: "admin-user", groups: ["admin"] };

function asset(
  overrides: Partial<PublicImageAssetInspectionRecord> = {}
): PublicImageAssetInspectionRecord {
  return {
    id: assetId,
    ownerId: "owner-alias",
    publicPassportSnapshotId: snapshotId,
    sourceType: "equipment_cover",
    sourceRecordId,
    publicImageKey: canonicalKey,
    publicImageAltText: "Public equipment setup cover",
    status: "ready",
    moderationStatus: "clear",
    updatedAt: "2026-10-23T18:00:00.000Z",
    ...overrides
  };
}

function snapshot(
  overrides: Partial<PublicPassportSnapshotInspectionRecord> = {}
): PublicPassportSnapshotInspectionRecord {
  return {
    id: snapshotId,
    ownerId: "owner-alias",
    equipmentPassportId: sourceRecordId,
    publicImageAssetId: assetId,
    publicImageKey: canonicalKey,
    publicImageAltText: "Public equipment setup cover",
    updatedAt: "2026-10-23T18:00:01.000Z",
    ...overrides
  };
}

function createDependencies(options: {
  assets?: Array<PublicImageAssetInspectionRecord | null>;
  snapshots?: Array<PublicPassportSnapshotInspectionRecord | null>;
  head?: DerivativeHeadResult;
} = {}) {
  const calls: Array<{ operation: string; value?: string }> = [];
  const assets = options.assets ?? [asset()];
  const snapshots = options.snapshots ?? [snapshot()];
  let assetRead = 0;
  let snapshotRead = 0;

  return {
    calls,
    dependencies: {
      now: () => inspectedAt,
      getAsset: async (id: string) => {
        calls.push({ operation: "getAsset", value: id });
        const value = assets[Math.min(assetRead, assets.length - 1)] ?? null;
        assetRead += 1;
        return value ? { ...value } : null;
      },
      getSnapshot: async (id: string) => {
        calls.push({ operation: "getSnapshot", value: id });
        const value = snapshots[Math.min(snapshotRead, snapshots.length - 1)] ?? null;
        snapshotRead += 1;
        return value ? { ...value } : null;
      },
      headDerivative: async (key: string) => {
        calls.push({ operation: "headDerivative", value: key });
        return options.head ?? {
          state: "present" as const,
          contentType: "image/jpeg",
          contentLength: 128_000
        };
      }
    }
  };
}

function assertBoundedResult(result: unknown) {
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("public/passports/"), false);
  assert.equal(serialized.includes("owner-alias"), false);
  assert.equal(serialized.includes(sourceRecordId), false);
  assert.equal(serialized.includes(assetId), false);
}

test("admin can inspect a current attached generation without cleanup authorization", async () => {
  const { dependencies, calls } = createDependencies();
  const result = await inspectPublicImageCleanup(assetId, adminIdentity, dependencies);

  assert.equal(result.assessmentStatus, "assessed");
  assert.equal(result.recommendedNextStep, "no_action");
  assert.deepEqual(result.findingCodes, ["current_attached_generation", "derivative_present"]);
  assert.equal(result.retryable, false);
  assert.deepEqual(calls.map((call) => call.operation), [
    "getAsset",
    "getSnapshot",
    "headDerivative",
    "getAsset",
    "getSnapshot"
  ]);
  assertBoundedResult(result);
});

test("moderator-only, ordinary, unauthenticated, and API-key-shaped identities are rejected before reads", async (t) => {
  const identities: Array<[string, unknown]> = [
    ["moderator", { sub: "sub", username: "user", groups: ["moderator"] }],
    ["ordinary", { sub: "sub", username: "user", groups: [] }],
    ["unauthenticated", null],
    ["api-key", { apiKey: "redacted" }]
  ];

  for (const [name, identity] of identities) {
    await t.test(name, async () => {
      const { dependencies, calls } = createDependencies();
      const result = await inspectPublicImageCleanup(assetId, identity, dependencies);
      assert.equal(result.assessmentStatus, "failed");
      assert.deepEqual(result.findingCodes, ["unauthorized"]);
      assert.equal(calls.length, 0);
      assertBoundedResult(result);
    });
  }
});

test("invalid and missing asset ids fail closed", async (t) => {
  await t.test("invalid id", async () => {
    const { dependencies, calls } = createDependencies();
    const result = await inspectPublicImageCleanup("sample-image", adminIdentity, dependencies);
    assert.deepEqual(result.findingCodes, ["invalid_asset_id"]);
    assert.equal(calls.length, 0);
  });

  await t.test("missing id", async () => {
    const { dependencies, calls } = createDependencies({ assets: [null, null] });
    const result = await inspectPublicImageCleanup(assetId, adminIdentity, dependencies);
    assert.equal(result.assessmentStatus, "unavailable");
    assert.deepEqual(result.findingCodes, ["asset_not_found"]);
    assert.deepEqual(calls.map((call) => call.operation), ["getAsset", "getAsset"]);
  });
});

test("detached removed generation with a remaining derivative is only a future cleanup candidate", async () => {
  const { dependencies } = createDependencies({
    assets: [asset({ status: "removed" })],
    snapshots: [snapshot({
      publicImageAssetId: undefined,
      publicImageKey: undefined,
      publicImageAltText: undefined
    })]
  });
  const result = await inspectPublicImageCleanup(assetId, adminIdentity, dependencies);

  assert.equal(result.recommendedNextStep, "cleanup_candidate_for_future_review");
  assert.equal(result.findingCodes.includes("asset_removed"), true);
  assert.equal(result.findingCodes.includes("detached_generation"), true);
  assert.equal(result.findingCodes.includes("derivative_present"), true);
  assertBoundedResult(result);
});

test("intentionally hidden generation is retained", async () => {
  const { dependencies } = createDependencies({
    assets: [asset({ moderationStatus: "hidden" })],
    snapshots: [snapshot({
      publicImageAssetId: undefined,
      publicImageKey: undefined,
      publicImageAltText: undefined
    })]
  });
  const result = await inspectPublicImageCleanup(assetId, adminIdentity, dependencies);

  assert.equal(result.recommendedNextStep, "no_action");
  assert.equal(result.findingCodes.includes("moderation_hidden_retained"), true);
});

test("processing leases distinguish active work from an expired detached candidate", async (t) => {
  const detachedSnapshot = snapshot({
    publicImageAssetId: undefined,
    publicImageKey: undefined,
    publicImageAltText: undefined
  });

  await t.test("active lease remains untouched", async () => {
    const { dependencies } = createDependencies({
      assets: [asset({ status: "processing", updatedAt: "2026-10-23T18:58:00.000Z" })],
      snapshots: [detachedSnapshot]
    });
    const result = await inspectPublicImageCleanup(assetId, adminIdentity, dependencies);
    assert.equal(result.findingCodes.includes("processing_lease_active"), true);
    assert.equal(result.recommendedNextStep, "no_action");
  });

  await t.test("expired lease is review-only candidate", async () => {
    const { dependencies } = createDependencies({
      assets: [asset({ status: "processing", updatedAt: "2026-10-23T18:00:00.000Z" })],
      snapshots: [detachedSnapshot]
    });
    const result = await inspectPublicImageCleanup(assetId, adminIdentity, dependencies);
    assert.equal(result.findingCodes.includes("processing_lease_expired"), true);
    assert.equal(result.recommendedNextStep, "cleanup_candidate_for_future_review");
  });

  await t.test("invalid future timestamp fails closed", async () => {
    const { dependencies } = createDependencies({
      assets: [asset({ status: "processing", updatedAt: "2026-10-24T18:00:00.000Z" })],
      snapshots: [detachedSnapshot]
    });
    const result = await inspectPublicImageCleanup(assetId, adminIdentity, dependencies);
    assert.equal(result.findingCodes.includes("processing_timestamp_invalid"), true);
    assert.equal(result.recommendedNextStep, "manual_review");
  });
});

test("missing snapshot is indeterminate and never a cleanup authorization", async () => {
  const { dependencies } = createDependencies({ snapshots: [null, null] });
  const result = await inspectPublicImageCleanup(assetId, adminIdentity, dependencies);

  assert.equal(result.recommendedNextStep, "manual_review");
  assert.equal(result.findingCodes.includes("snapshot_missing"), true);
});

test("replacement generation mismatch requires manual review", async () => {
  const replacementKey = `public/passports/${snapshotId}/cover/${replacementAssetId}.jpg`;
  const { dependencies } = createDependencies({
    snapshots: [snapshot({
      publicImageAssetId: replacementAssetId,
      publicImageKey: replacementKey,
      publicImageAltText: "Replacement public cover"
    })]
  });
  const result = await inspectPublicImageCleanup(assetId, adminIdentity, dependencies);

  assert.equal(result.recommendedNextStep, "manual_review");
  assert.equal(result.findingCodes.includes("snapshot_references_different_generation"), true);
});

test("malformed stored canonical key blocks every S3 request", async () => {
  const { dependencies, calls } = createDependencies({
    assets: [asset({ publicImageKey: "public/passports/foreign/cover/foreign.jpg" })]
  });
  const result = await inspectPublicImageCleanup(assetId, adminIdentity, dependencies);

  assert.equal(result.recommendedNextStep, "manual_review");
  assert.equal(result.findingCodes.includes("canonical_key_mismatch"), true);
  assert.equal(calls.some((call) => call.operation === "headDerivative"), false);
});

test("unsupported target-photo-like source is never inspected in S3", async () => {
  const { dependencies, calls } = createDependencies({
    assets: [asset({ sourceType: "range_session_target", sourceRecordId: "range-session-123" })]
  });
  const result = await inspectPublicImageCleanup(assetId, adminIdentity, dependencies);

  assert.equal(result.recommendedNextStep, "manual_review");
  assert.equal(result.findingCodes.includes("unsupported_source_type"), true);
  assert.equal(calls.some((call) => call.operation === "headDerivative"), false);
});

test("S3 HeadObject outcomes are conservative", async (t) => {
  const cases: Array<{
    name: string;
    head: DerivativeHeadResult;
    finding: string;
    recommendation: string;
    retryable: boolean;
  }> = [
    {
      name: "200 metadata success",
      head: { state: "present", contentType: "image/jpeg", contentLength: 64_000 },
      finding: "derivative_present",
      recommendation: "no_action",
      retryable: false
    },
    {
      name: "403 is inaccessible, not absent",
      head: { state: "inaccessible" },
      finding: "derivative_inaccessible",
      recommendation: "retry_inspection",
      retryable: true
    },
    {
      name: "404 is confirmed missing",
      head: { state: "missing" },
      finding: "derivative_missing",
      recommendation: "manual_review",
      retryable: false
    },
    {
      name: "transient failure is retryable",
      head: { state: "transient" },
      finding: "derivative_check_failed",
      recommendation: "retry_inspection",
      retryable: true
    }
  ];

  for (const fixture of cases) {
    await t.test(fixture.name, async () => {
      const { dependencies } = createDependencies({ head: fixture.head });
      const result = await inspectPublicImageCleanup(assetId, adminIdentity, dependencies);
      assert.equal(result.findingCodes.includes(fixture.finding), true);
      assert.equal(result.recommendedNextStep, fixture.recommendation);
      assert.equal(result.retryable, fixture.retryable);
    });
  }
});

test("state changes during inspection return retry without a stale assessment", async () => {
  const { dependencies } = createDependencies({
    assets: [asset(), asset({ status: "removed" })]
  });
  const result = await inspectPublicImageCleanup(assetId, adminIdentity, dependencies);

  assert.equal(result.assessmentStatus, "state_changed");
  assert.deepEqual(result.findingCodes, ["state_changed"]);
  assert.equal(result.recommendedNextStep, "retry_inspection");
  assert.equal(result.retryable, true);
});

test("inspection dependencies permit only reads and metadata head checks", async () => {
  const { dependencies, calls } = createDependencies({
    assets: [asset({ status: "removed" })],
    snapshots: [snapshot({
      publicImageAssetId: undefined,
      publicImageKey: undefined,
      publicImageAltText: undefined
    })]
  });
  const result = await inspectPublicImageCleanup(assetId, adminIdentity, dependencies);

  assert.equal(result.recommendedNextStep, "cleanup_candidate_for_future_review");
  assert.deepEqual(new Set(calls.map((call) => call.operation)), new Set([
    "getAsset",
    "getSnapshot",
    "headDerivative"
  ]));
  assert.equal(calls.filter((call) => call.operation === "headDerivative").length, 1);
  assert.equal(calls.find((call) => call.operation === "headDerivative")?.value, canonicalKey);
});
