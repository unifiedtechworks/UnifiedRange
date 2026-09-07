import { createHash } from "node:crypto";
import {
  DynamoDBClient,
  GetItemCommand,
  QueryCommand,
  TransactWriteItemsCommand,
  UpdateItemCommand,
  type AttributeValue,
  type TransactWriteItem
} from "@aws-sdk/client-dynamodb";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { AppSyncIdentityCognito } from "aws-lambda";
import type { Schema } from "../../data/resource.ts";

const idPattern = /^[a-z0-9][a-z0-9_-]{0,127}$/i;
const publicImageAssetIdPattern = /^img-[0-9a-f]{40}$/;
const nonPersistentIdPattern = /^(?:(?:demo|sample)(?:[-_]|$)|(?:passport|session|target-photo)-\d+$)/i;
const technicalContentPattern = /(?:\b(?:s3|https?|data|blob):\/\/|\b(?:private|public)[\\/](?:equipment|targets|passports)[\\/])/i;
const knownAssetStatuses = new Set(["draft", "processing", "ready", "failed", "removed"]);
const knownModerationStatuses = new Set(["clear", "hidden", "removed"]);
const moderatorGroups = new Set(["admin", "moderator"]);
const reasonMaxLength = 240;
const assetQueryLimit = 10;

type DynamoItem = Record<string, AttributeValue>;
type ModerationAction = "hide" | "remove";
type ActionStatus = "hidden" | "removed" | "not_attached" | "cleanup_pending" | "failed";
type ModerationStatus = "clear" | "hidden" | "removed";
type FailureCode =
  | "unauthorized"
  | "invalid_request"
  | "state_changed"
  | "projection_mismatch"
  | "unknown_state"
  | "storage_delete_failed"
  | "unknown_error";

type PublicPassportSnapshot = {
  id: string;
  ownerId: string;
  equipmentPassportId: string;
  publicImageAssetId?: string;
  publicImageKey?: string;
  publicImageAltText?: string;
  updatedAt?: string;
};

type PublicImageAsset = {
  id: string;
  ownerId: string;
  publicPassportSnapshotId: string;
  sourceType: string;
  sourceRecordId: string;
  publicImageKey?: string;
  publicImageAltText?: string;
  status: string;
  moderationStatus: string;
  updatedAt?: string;
};

class ModerationFailure extends Error {
  constructor(readonly code: FailureCode) {
    super(code);
    this.name = "ModerationFailure";
  }
}

function environmentValue(name: string) {
  return process.env[name]?.trim() ?? "";
}

const publicPassportSnapshotTableName = environmentValue("PUBLIC_PASSPORT_SNAPSHOT_TABLE_NAME");
const publicImageAssetTableName = environmentValue("PUBLIC_IMAGE_ASSET_TABLE_NAME");
const publicImageAssetSnapshotIndexName = environmentValue("PUBLIC_IMAGE_ASSET_SNAPSHOT_INDEX_NAME");
const imageBucketName = environmentValue("unifiedRangePrivateImages_BUCKET_NAME");

const dynamoClient = new DynamoDBClient({});
const s3Client = new S3Client({});

function validateRuntimeConfiguration() {
  if (
    !publicPassportSnapshotTableName ||
    !publicImageAssetTableName ||
    !publicImageAssetSnapshotIndexName ||
    !imageBucketName
  ) {
    throw new ModerationFailure("unknown_error");
  }
}

function isAuthorizedModerator(identity: unknown): identity is AppSyncIdentityCognito {
  if (!identity || typeof identity !== "object") {
    return false;
  }

  const candidate = identity as Partial<AppSyncIdentityCognito>;
  return Boolean(
    typeof candidate.sub === "string" &&
      typeof candidate.username === "string" &&
      Array.isArray(candidate.groups) &&
      candidate.groups.some((group) => moderatorGroups.has(group))
  );
}

function normalizePersistentId(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim();
  return idPattern.test(normalized) && !nonPersistentIdPattern.test(normalized) ? normalized : "";
}

function normalizeAction(value: unknown): ModerationAction | "" {
  return value === "hide" || value === "remove" ? value : "";
}

function normalizeReason(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  if (typeof value !== "string") {
    throw new ModerationFailure("invalid_request");
  }

  const normalized = value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized !== value.trim() || normalized.length > reasonMaxLength || technicalContentPattern.test(normalized)) {
    throw new ModerationFailure("invalid_request");
  }

  return normalized;
}

function stringValue(item: DynamoItem, field: string) {
  const value = item[field];
  return value && "S" in value ? value.S : undefined;
}

function projection(fields: string[]) {
  const names = Object.fromEntries(fields.map((field, index) => [`#field${index}`, field]));
  return {
    ProjectionExpression: Object.keys(names).join(", "),
    ExpressionAttributeNames: names
  };
}

async function getItem(tableName: string, id: string, fields: string[]) {
  const result = await dynamoClient.send(
    new GetItemCommand({
      TableName: tableName,
      Key: { id: { S: id } },
      ConsistentRead: true,
      ...projection(fields)
    })
  );

  return result.Item;
}

function readSnapshot(item: DynamoItem | undefined, expectedId: string): PublicPassportSnapshot | null {
  if (!item) {
    return null;
  }

  const snapshot: PublicPassportSnapshot = {
    id: stringValue(item, "id") ?? "",
    ownerId: stringValue(item, "ownerId") ?? "",
    equipmentPassportId: stringValue(item, "equipmentPassportId") ?? "",
    publicImageAssetId: stringValue(item, "publicImageAssetId"),
    publicImageKey: stringValue(item, "publicImageKey"),
    publicImageAltText: stringValue(item, "publicImageAltText"),
    updatedAt: stringValue(item, "updatedAt")
  };

  return snapshot.id === expectedId && snapshot.ownerId && normalizePersistentId(snapshot.equipmentPassportId)
    ? snapshot
    : null;
}

function readPublicImageAsset(item: DynamoItem | undefined, expectedId?: string): PublicImageAsset | null {
  if (!item) {
    return null;
  }

  const asset: PublicImageAsset = {
    id: stringValue(item, "id") ?? "",
    ownerId: stringValue(item, "ownerId") ?? "",
    publicPassportSnapshotId: stringValue(item, "publicPassportSnapshotId") ?? "",
    sourceType: stringValue(item, "sourceType") ?? "",
    sourceRecordId: stringValue(item, "sourceRecordId") ?? "",
    publicImageKey: stringValue(item, "publicImageKey"),
    publicImageAltText: stringValue(item, "publicImageAltText"),
    status: stringValue(item, "status") ?? "",
    moderationStatus: stringValue(item, "moderationStatus") ?? "",
    updatedAt: stringValue(item, "updatedAt")
  };

  if ((expectedId && asset.id !== expectedId) || !publicImageAssetIdPattern.test(asset.id)) {
    return null;
  }

  return asset;
}

function expectedPublicImageKey(snapshotId: string, publicImageAssetId: string) {
  return `public/passports/${snapshotId}/cover/${publicImageAssetId}.jpg`;
}

function assetIdFromCanonicalKey(snapshotId: string, publicImageKey?: string) {
  if (!publicImageKey) {
    return "";
  }

  const prefix = `public/passports/${snapshotId}/cover/`;
  if (!publicImageKey.startsWith(prefix)) {
    return "";
  }

  const fileName = publicImageKey.slice(prefix.length);
  const match = /^(img-[0-9a-f]{40})\.jpg$/.exec(fileName);
  return match?.[1] ?? "";
}

function resolveProjectedAssetId(snapshot: PublicPassportSnapshot) {
  const fieldAssetId = snapshot.publicImageAssetId && publicImageAssetIdPattern.test(snapshot.publicImageAssetId)
    ? snapshot.publicImageAssetId
    : "";
  const keyAssetId = assetIdFromCanonicalKey(snapshot.id, snapshot.publicImageKey);

  return fieldAssetId && keyAssetId && fieldAssetId === keyAssetId ? fieldAssetId : "";
}

function isSafeAssetBinding(asset: PublicImageAsset, snapshot: PublicPassportSnapshot) {
  return (
    asset.ownerId === snapshot.ownerId &&
    asset.publicPassportSnapshotId === snapshot.id &&
    asset.sourceType === "equipment_cover" &&
    asset.sourceRecordId === snapshot.equipmentPassportId &&
    knownAssetStatuses.has(asset.status)
  );
}

function addExpectedValueCondition(
  conditionParts: string[],
  values: Record<string, AttributeValue>,
  fieldName: string,
  valueName: string,
  value?: string
) {
  if (value) {
    conditionParts.push(`${fieldName} = ${valueName}`);
    values[valueName] = { S: value };
  } else {
    conditionParts.push(`attribute_not_exists(${fieldName})`);
  }
}

function snapshotDetachUpdate(snapshot: PublicPassportSnapshot, now: string): TransactWriteItem {
  const names = {
    "#ownerId": "ownerId",
    "#sourceRecordId": "equipmentPassportId",
    "#publicAssetId": "publicImageAssetId",
    "#publicKey": "publicImageKey",
    "#altText": "publicImageAltText",
    "#updatedAt": "updatedAt"
  };
  const values: Record<string, AttributeValue> = {
    ":ownerId": { S: snapshot.ownerId },
    ":sourceRecordId": { S: snapshot.equipmentPassportId },
    ":now": { S: now }
  };
  const conditions = ["#ownerId = :ownerId", "#sourceRecordId = :sourceRecordId"];

  addExpectedValueCondition(conditions, values, "#publicAssetId", ":existingPublicAssetId", snapshot.publicImageAssetId);
  addExpectedValueCondition(conditions, values, "#publicKey", ":existingPublicKey", snapshot.publicImageKey);
  addExpectedValueCondition(conditions, values, "#altText", ":existingAltText", snapshot.publicImageAltText);
  addExpectedValueCondition(conditions, values, "#updatedAt", ":existingUpdatedAt", snapshot.updatedAt);

  return {
    Update: {
      TableName: publicPassportSnapshotTableName,
      Key: { id: { S: snapshot.id } },
      ConditionExpression: conditions.join(" AND "),
      UpdateExpression: "SET #updatedAt = :now REMOVE #publicAssetId, #publicKey, #altText",
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values
    }
  };
}

function attachedAssetModerationUpdate(
  asset: PublicImageAsset,
  snapshot: PublicPassportSnapshot,
  action: ModerationAction,
  reason: string,
  now: string
): TransactWriteItem {
  const names: Record<string, string> = {
    "#ownerId": "ownerId",
    "#snapshotId": "publicPassportSnapshotId",
    "#sourceType": "sourceType",
    "#sourceRecordId": "sourceRecordId",
    "#publicKey": "publicImageKey",
    "#altText": "publicImageAltText",
    "#status": "status",
    "#moderationStatus": "moderationStatus",
    "#hiddenAt": "hiddenAt",
    "#removedAt": "removedAt",
    "#moderationReason": "moderationReason",
    "#failureCode": "processingErrorCode",
    "#updatedAt": "updatedAt"
  };
  const values: Record<string, AttributeValue> = {
    ":ownerId": { S: asset.ownerId },
    ":snapshotId": { S: asset.publicPassportSnapshotId },
    ":sourceType": { S: "equipment_cover" },
    ":sourceRecordId": { S: asset.sourceRecordId },
    ":publicKey": { S: asset.publicImageKey ?? "" },
    ":altText": { S: asset.publicImageAltText ?? "" },
    ":ready": { S: "ready" },
    ":clear": { S: "clear" },
    ":nextModerationStatus": { S: action === "hide" ? "hidden" : "removed" },
    ":now": { S: now }
  };
  const conditions = [
    "#ownerId = :ownerId",
    "#snapshotId = :snapshotId",
    "#sourceType = :sourceType",
    "#sourceRecordId = :sourceRecordId",
    "#publicKey = :publicKey",
    "#altText = :altText",
    "#status = :ready",
    "#moderationStatus = :clear"
  ];

  addExpectedValueCondition(conditions, values, "#updatedAt", ":existingUpdatedAt", asset.updatedAt);

  let updateExpression = action === "hide"
    ? "SET #moderationStatus = :nextModerationStatus, #hiddenAt = :now, #updatedAt = :now REMOVE #removedAt"
    : "SET #status = :nextModerationStatus, #moderationStatus = :nextModerationStatus, #removedAt = :now, #updatedAt = :now REMOVE #hiddenAt, #altText, #failureCode";

  if (reason) {
    values[":reason"] = { S: reason };
    updateExpression = updateExpression.replace(" REMOVE", ", #moderationReason = :reason REMOVE");
  } else {
    updateExpression += ", #moderationReason";
  }

  return {
    Update: {
      TableName: publicImageAssetTableName,
      Key: { id: { S: asset.id } },
      ConditionExpression: conditions.join(" AND "),
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values
    }
  };
}

async function applyAttachedAction(
  snapshot: PublicPassportSnapshot,
  asset: PublicImageAsset,
  action: ModerationAction,
  reason: string
) {
  const now = new Date().toISOString();

  try {
    await dynamoClient.send(
      new TransactWriteItemsCommand({
        ClientRequestToken: createHash("sha256")
          .update(snapshot.id)
          .update("\0")
          .update(snapshot.updatedAt ?? "")
          .update("\0")
          .update(asset.id)
          .update("\0")
          .update(asset.updatedAt ?? "")
          .update("\0")
          .update(action)
          .update("\0")
          .update(now)
          .digest("hex")
          .slice(0, 36),
        TransactItems: [
          snapshotDetachUpdate(snapshot, now),
          attachedAssetModerationUpdate(asset, snapshot, action, reason, now)
        ]
      })
    );
  } catch (error) {
    const errorName = (error as { name?: string }).name;
    if (errorName === "TransactionCanceledException" || errorName === "ConditionalCheckFailedException") {
      throw new ModerationFailure("state_changed");
    }
    throw new ModerationFailure("unknown_error");
  }
}

async function deleteDerivative(publicImageKey: string) {
  try {
    await s3Client.send(new DeleteObjectCommand({ Bucket: imageBucketName, Key: publicImageKey }));
    return true;
  } catch {
    return false;
  }
}

async function finalizeRemovedAsset(asset: PublicImageAsset, expectedKey: string) {
  try {
    await dynamoClient.send(
      new UpdateItemCommand({
        TableName: publicImageAssetTableName,
        Key: { id: { S: asset.id } },
        ConditionExpression:
          "#ownerId = :ownerId AND #snapshotId = :snapshotId AND #sourceType = :sourceType AND #sourceRecordId = :sourceRecordId AND #status = :removed AND #moderationStatus = :removed AND #publicKey = :publicKey",
        UpdateExpression: "SET #updatedAt = :now REMOVE #publicKey, #altText, #failureCode",
        ExpressionAttributeNames: {
          "#ownerId": "ownerId",
          "#snapshotId": "publicPassportSnapshotId",
          "#sourceType": "sourceType",
          "#sourceRecordId": "sourceRecordId",
          "#status": "status",
          "#moderationStatus": "moderationStatus",
          "#publicKey": "publicImageKey",
          "#altText": "publicImageAltText",
          "#failureCode": "processingErrorCode",
          "#updatedAt": "updatedAt"
        },
        ExpressionAttributeValues: {
          ":ownerId": { S: asset.ownerId },
          ":snapshotId": { S: asset.publicPassportSnapshotId },
          ":sourceType": { S: "equipment_cover" },
          ":sourceRecordId": { S: asset.sourceRecordId },
          ":removed": { S: "removed" },
          ":publicKey": { S: expectedKey },
          ":now": { S: new Date().toISOString() }
        }
      })
    );
    return true;
  } catch {
    const latest = readPublicImageAsset(
      await getItem(publicImageAssetTableName, asset.id, [
        "id",
        "ownerId",
        "publicPassportSnapshotId",
        "sourceType",
        "sourceRecordId",
        "publicImageKey",
        "publicImageAltText",
        "status",
        "moderationStatus",
        "updatedAt"
      ]),
      asset.id
    );

    return Boolean(
      latest &&
        latest.ownerId === asset.ownerId &&
        latest.publicPassportSnapshotId === asset.publicPassportSnapshotId &&
        latest.status === "removed" &&
        latest.moderationStatus === "removed" &&
        !latest.publicImageKey
    );
  }
}

async function cleanupRemovedAsset(asset: PublicImageAsset) {
  const expectedKey = expectedPublicImageKey(asset.publicPassportSnapshotId, asset.id);
  if (
    asset.status !== "removed" ||
    asset.moderationStatus !== "removed" ||
    asset.sourceType !== "equipment_cover" ||
    !asset.publicImageKey ||
    asset.publicImageKey !== expectedKey
  ) {
    return { status: "projection_mismatch" as const };
  }

  if (!(await deleteDerivative(expectedKey))) {
    return { status: "storage_delete_failed" as const };
  }

  return (await finalizeRemovedAsset(asset, expectedKey))
    ? { status: "removed" as const }
    : { status: "state_changed" as const };
}

function detachedSnapshotCondition(snapshot: PublicPassportSnapshot): TransactWriteItem {
  const values: Record<string, AttributeValue> = {
    ":ownerId": { S: snapshot.ownerId },
    ":sourceRecordId": { S: snapshot.equipmentPassportId }
  };
  const conditions = [
    "#ownerId = :ownerId",
    "#sourceRecordId = :sourceRecordId",
    "attribute_not_exists(#publicAssetId)",
    "attribute_not_exists(#publicKey)",
    "attribute_not_exists(#altText)"
  ];

  addExpectedValueCondition(conditions, values, "#updatedAt", ":existingUpdatedAt", snapshot.updatedAt);

  return {
    ConditionCheck: {
      TableName: publicPassportSnapshotTableName,
      Key: { id: { S: snapshot.id } },
      ConditionExpression: conditions.join(" AND "),
      ExpressionAttributeNames: {
        "#ownerId": "ownerId",
        "#sourceRecordId": "equipmentPassportId",
        "#publicAssetId": "publicImageAssetId",
        "#publicKey": "publicImageKey",
        "#altText": "publicImageAltText",
        "#updatedAt": "updatedAt"
      },
      ExpressionAttributeValues: values
    }
  };
}

function hiddenAssetRemovalUpdate(asset: PublicImageAsset, reason: string, now: string): TransactWriteItem {
  const values: Record<string, AttributeValue> = {
    ":ownerId": { S: asset.ownerId },
    ":snapshotId": { S: asset.publicPassportSnapshotId },
    ":sourceType": { S: "equipment_cover" },
    ":sourceRecordId": { S: asset.sourceRecordId },
    ":publicKey": { S: asset.publicImageKey ?? "" },
    ":ready": { S: "ready" },
    ":hidden": { S: "hidden" },
    ":removed": { S: "removed" },
    ":now": { S: now }
  };
  const conditions = [
    "#ownerId = :ownerId",
    "#snapshotId = :snapshotId",
    "#sourceType = :sourceType",
    "#sourceRecordId = :sourceRecordId",
    "#publicKey = :publicKey",
    "#status = :ready",
    "#moderationStatus = :hidden"
  ];
  addExpectedValueCondition(conditions, values, "#updatedAt", ":existingUpdatedAt", asset.updatedAt);

  let updateExpression =
    "SET #status = :removed, #moderationStatus = :removed, #removedAt = :now, #updatedAt = :now REMOVE #hiddenAt, #altText, #failureCode";
  if (reason) {
    values[":reason"] = { S: reason };
    updateExpression = updateExpression.replace(" REMOVE", ", #moderationReason = :reason REMOVE");
  }

  return {
    Update: {
      TableName: publicImageAssetTableName,
      Key: { id: { S: asset.id } },
      ConditionExpression: conditions.join(" AND "),
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: {
        "#ownerId": "ownerId",
        "#snapshotId": "publicPassportSnapshotId",
        "#sourceType": "sourceType",
        "#sourceRecordId": "sourceRecordId",
        "#publicKey": "publicImageKey",
        "#altText": "publicImageAltText",
        "#status": "status",
        "#moderationStatus": "moderationStatus",
        "#hiddenAt": "hiddenAt",
        "#removedAt": "removedAt",
        "#moderationReason": "moderationReason",
        "#failureCode": "processingErrorCode",
        "#updatedAt": "updatedAt"
      },
      ExpressionAttributeValues: values
    }
  };
}

async function transitionHiddenAssetToRemoved(
  snapshot: PublicPassportSnapshot,
  asset: PublicImageAsset,
  reason: string
) {
  const now = new Date().toISOString();

  try {
    await dynamoClient.send(
      new TransactWriteItemsCommand({
        ClientRequestToken: createHash("sha256")
          .update(snapshot.id)
          .update("\0")
          .update(snapshot.updatedAt ?? "")
          .update("\0")
          .update(asset.id)
          .update("\0")
          .update(asset.updatedAt ?? "")
          .update("\0remove\0")
          .update(now)
          .digest("hex")
          .slice(0, 36),
        TransactItems: [
          detachedSnapshotCondition(snapshot),
          hiddenAssetRemovalUpdate(asset, reason, now)
        ]
      })
    );
  } catch (error) {
    const errorName = (error as { name?: string }).name;
    if (errorName === "TransactionCanceledException" || errorName === "ConditionalCheckFailedException") {
      throw new ModerationFailure("state_changed");
    }
    throw new ModerationFailure("unknown_error");
  }
}

async function queryBoundAssets(snapshot: PublicPassportSnapshot) {
  const selectedFields = projection(["id", "publicPassportSnapshotId"]);
  const result = await dynamoClient.send(
    new QueryCommand({
      TableName: publicImageAssetTableName,
      IndexName: publicImageAssetSnapshotIndexName,
      KeyConditionExpression: "#snapshotId = :snapshotId",
      ExpressionAttributeNames: {
        ...selectedFields.ExpressionAttributeNames,
        "#snapshotId": "publicPassportSnapshotId"
      },
      ExpressionAttributeValues: { ":snapshotId": { S: snapshot.id } },
      Limit: assetQueryLimit,
      ProjectionExpression: selectedFields.ProjectionExpression
    })
  );

  const rawItems = result.Items ?? [];
  const assetIds = rawItems
    .map((item) => stringValue(item, "id") ?? "")
    .filter((id) => publicImageAssetIdPattern.test(id));
  const resolvedAssets = (await Promise.all(
    assetIds.map(async (id) =>
      readPublicImageAsset(
        await getItem(publicImageAssetTableName, id, [
          "id",
          "ownerId",
          "publicPassportSnapshotId",
          "sourceType",
          "sourceRecordId",
          "publicImageKey",
          "publicImageAltText",
          "status",
          "moderationStatus",
          "updatedAt"
        ]),
        id
      )
    )
  )).filter((asset): asset is PublicImageAsset => Boolean(asset));
  const boundAssets = resolvedAssets.filter((asset) => isSafeAssetBinding(asset, snapshot));

  return {
    assets: boundAssets,
    truncated: Boolean(result.LastEvaluatedKey),
    unsafeRows:
      assetIds.length !== rawItems.length ||
      resolvedAssets.length !== assetIds.length ||
      boundAssets.length !== resolvedAssets.length
  };
}

async function handleDetachedSnapshot(snapshot: PublicPassportSnapshot, action: ModerationAction, reason: string) {
  const { assets, truncated, unsafeRows } = await queryBoundAssets(snapshot);
  if (truncated || unsafeRows) {
    throw new ModerationFailure("projection_mismatch");
  }

  const unknownModerationState = assets.some(
    (asset) => asset.moderationStatus && !knownModerationStatuses.has(asset.moderationStatus)
  );
  if (unknownModerationState) {
    throw new ModerationFailure("unknown_state");
  }

  const hiddenAssets = assets.filter((asset) => asset.status === "ready" && asset.moderationStatus === "hidden");
  const removedAssets = assets.filter((asset) => asset.status === "removed" && asset.moderationStatus === "removed");
  const invalidModeratedAsset = [...hiddenAssets, ...removedAssets].some((asset) => {
    const expectedKey = expectedPublicImageKey(snapshot.id, asset.id);
    return Boolean(asset.publicImageKey && asset.publicImageKey !== expectedKey);
  });

  if (invalidModeratedAsset) {
    throw new ModerationFailure("projection_mismatch");
  }

  if (action === "hide") {
    return hiddenAssets.length > 0
      ? { actionStatus: "hidden" as const, moderationStatus: "hidden" as const }
      : { actionStatus: "not_attached" as const };
  }

  if (hiddenAssets.some((asset) => !asset.publicImageKey || !asset.publicImageAltText)) {
    throw new ModerationFailure("projection_mismatch");
  }

  const removedAssetsPendingCleanup = removedAssets.filter((asset) => Boolean(asset.publicImageKey));
  if (hiddenAssets.length + removedAssetsPendingCleanup.length > 1) {
    throw new ModerationFailure("projection_mismatch");
  }

  for (const asset of hiddenAssets) {
    await transitionHiddenAssetToRemoved(snapshot, asset, reason);
  }

  const assetsToClean = [
    ...hiddenAssets.map((asset) => ({ ...asset, status: "removed", moderationStatus: "removed" })),
    ...removedAssetsPendingCleanup
  ];
  const alreadyClean = removedAssets.some((asset) => !asset.publicImageKey);

  if (assetsToClean.length === 0) {
    return alreadyClean
      ? { actionStatus: "removed" as const, moderationStatus: "removed" as const }
      : { actionStatus: "not_attached" as const };
  }

  const cleanupResults = await Promise.all(assetsToClean.map((asset) => cleanupRemovedAsset(asset)));
  if (cleanupResults.some((result) => result.status === "storage_delete_failed")) {
    return {
      actionStatus: "cleanup_pending" as const,
      moderationStatus: "removed" as const,
      failureCode: "storage_delete_failed" as const
    };
  }
  if (cleanupResults.some((result) => result.status !== "removed")) {
    return {
      actionStatus: "cleanup_pending" as const,
      moderationStatus: "removed" as const,
      failureCode: "state_changed" as const
    };
  }

  return { actionStatus: "removed" as const, moderationStatus: "removed" as const };
}

async function moderateCurrentImage(snapshotId: string, action: ModerationAction, reason: string) {
  const snapshot = readSnapshot(
    await getItem(publicPassportSnapshotTableName, snapshotId, [
      "id",
      "ownerId",
      "equipmentPassportId",
      "publicImageAssetId",
      "publicImageKey",
      "publicImageAltText",
      "updatedAt"
    ]),
    snapshotId
  );

  if (!snapshot) {
    return { actionStatus: "not_attached" as const };
  }

  const hasProjection = Boolean(
    snapshot.publicImageAssetId || snapshot.publicImageKey || snapshot.publicImageAltText
  );
  if (!hasProjection) {
    return handleDetachedSnapshot(snapshot, action, reason);
  }

  if (!snapshot.publicImageAssetId || !snapshot.publicImageKey || !snapshot.publicImageAltText) {
    throw new ModerationFailure("projection_mismatch");
  }

  const projectedAssetId = resolveProjectedAssetId(snapshot);
  if (!projectedAssetId) {
    throw new ModerationFailure("projection_mismatch");
  }

  const asset = readPublicImageAsset(
    await getItem(publicImageAssetTableName, projectedAssetId, [
      "id",
      "ownerId",
      "publicPassportSnapshotId",
      "sourceType",
      "sourceRecordId",
      "publicImageKey",
      "publicImageAltText",
      "status",
      "moderationStatus",
      "updatedAt"
    ]),
    projectedAssetId
  );

  if (!asset || !isSafeAssetBinding(asset, snapshot)) {
    throw new ModerationFailure("projection_mismatch");
  }
  if (!knownModerationStatuses.has(asset.moderationStatus)) {
    throw new ModerationFailure("unknown_state");
  }

  const expectedKey = expectedPublicImageKey(snapshot.id, asset.id);
  if (
    asset.status !== "ready" ||
    asset.moderationStatus !== "clear" ||
    asset.publicImageKey !== expectedKey ||
    snapshot.publicImageKey !== expectedKey ||
    asset.publicImageAltText !== snapshot.publicImageAltText
  ) {
    throw new ModerationFailure("state_changed");
  }

  await applyAttachedAction(snapshot, asset, action, reason);

  if (action === "hide") {
    return { actionStatus: "hidden" as const, moderationStatus: "hidden" as const };
  }

  const cleanupResult = await cleanupRemovedAsset({ ...asset, status: "removed", moderationStatus: "removed" });
  if (cleanupResult.status === "removed") {
    return { actionStatus: "removed" as const, moderationStatus: "removed" as const };
  }

  return {
    actionStatus: "cleanup_pending" as const,
    moderationStatus: "removed" as const,
    failureCode: cleanupResult.status === "storage_delete_failed"
      ? "storage_delete_failed" as const
      : "state_changed" as const
  };
}

function response(
  actionStatus: ActionStatus,
  moderationStatus?: ModerationStatus,
  failureCode?: FailureCode
): Schema["moderatePublicPassportImage"]["returnType"] {
  return { actionStatus, moderationStatus, failureCode };
}

export const handler: Schema["moderatePublicPassportImage"]["functionHandler"] = async (event) => {
  try {
    validateRuntimeConfiguration();
    const identity = event.identity;
    const snapshotId = normalizePersistentId(event.arguments.publicPassportSnapshotId);
    const action = normalizeAction(event.arguments.action);
    const reason = normalizeReason(event.arguments.reason);

    if (!isAuthorizedModerator(identity)) {
      throw new ModerationFailure("unauthorized");
    }
    if (!snapshotId || !action) {
      throw new ModerationFailure("invalid_request");
    }

    const result = await moderateCurrentImage(snapshotId, action, reason);
    console.info(JSON.stringify({
      event: "public_image_moderation_completed",
      action,
      actionStatus: result.actionStatus
    }));
    return response(result.actionStatus, result.moderationStatus, result.failureCode);
  } catch (error) {
    const failureCode = error instanceof ModerationFailure ? error.code : "unknown_error";
    console.warn(JSON.stringify({ event: "public_image_moderation_failed", failureCode }));
    return response("failed", undefined, failureCode);
  }
};
