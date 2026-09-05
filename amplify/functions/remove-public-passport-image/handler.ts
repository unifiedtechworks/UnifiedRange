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
const knownAssetStatuses = new Set(["draft", "processing", "ready", "failed", "removed"]);
const cleanupQueryLimit = 10;
const stateChangeRetryLimit = 3;

type DynamoItem = Record<string, AttributeValue>;
type CleanupStatus = "removed" | "not_attached" | "cleanup_pending" | "failed";
type FailureCode =
  | "unauthorized"
  | "invalid_request"
  | "state_changed"
  | "projection_mismatch"
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
  status: string;
  updatedAt?: string;
};

class CleanupFailure extends Error {
  constructor(readonly code: FailureCode) {
    super(code);
    this.name = "CleanupFailure";
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
    throw new CleanupFailure("unknown_error");
  }
}

function isCognitoIdentity(identity: unknown): identity is AppSyncIdentityCognito {
  return Boolean(
    identity &&
      typeof identity === "object" &&
      "sub" in identity &&
      typeof (identity as { sub?: unknown }).sub === "string" &&
      "username" in identity &&
      typeof (identity as { username?: unknown }).username === "string"
  );
}

function normalizePersistentId(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim();
  return idPattern.test(normalized) && !nonPersistentIdPattern.test(normalized) ? normalized : "";
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

function readSnapshot(item: DynamoItem | undefined, expectedId: string) {
  if (!item) {
    return null;
  }

  const snapshot = {
    id: stringValue(item, "id") ?? "",
    ownerId: stringValue(item, "ownerId") ?? "",
    equipmentPassportId: stringValue(item, "equipmentPassportId") ?? "",
    publicImageAssetId: stringValue(item, "publicImageAssetId"),
    publicImageKey: stringValue(item, "publicImageKey"),
    publicImageAltText: stringValue(item, "publicImageAltText"),
    updatedAt: stringValue(item, "updatedAt")
  } satisfies PublicPassportSnapshot;

  return snapshot.id === expectedId ? snapshot : null;
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
    status: stringValue(item, "status") ?? "",
    updatedAt: stringValue(item, "updatedAt")
  };

  if ((expectedId && asset.id !== expectedId) || !publicImageAssetIdPattern.test(asset.id)) {
    return null;
  }

  return asset;
}

function callerOwnsSnapshot(snapshot: PublicPassportSnapshot, identity: AppSyncIdentityCognito) {
  return Boolean(snapshot.ownerId && (snapshot.ownerId === identity.username || snapshot.ownerId === identity.sub));
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

  if (fieldAssetId && keyAssetId && fieldAssetId !== keyAssetId) {
    return "";
  }

  return fieldAssetId || keyAssetId;
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

function snapshotDetachUpdate(snapshot: PublicPassportSnapshot, now: string) {
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

function assetRemovalUpdate(asset: PublicImageAsset, snapshot: PublicPassportSnapshot, now: string, retainCleanupKey: boolean) {
  const names = {
    "#ownerId": "ownerId",
    "#snapshotId": "publicPassportSnapshotId",
    "#sourceType": "sourceType",
    "#sourceRecordId": "sourceRecordId",
    "#publicKey": "publicImageKey",
    "#altText": "publicImageAltText",
    "#status": "status",
    "#failureCode": "processingErrorCode",
    "#updatedAt": "updatedAt"
  };
  const values: Record<string, AttributeValue> = {
    ":ownerId": { S: asset.ownerId },
    ":snapshotId": { S: asset.publicPassportSnapshotId },
    ":sourceType": { S: "equipment_cover" },
    ":sourceRecordId": { S: asset.sourceRecordId },
    ":currentStatus": { S: asset.status },
    ":removed": { S: "removed" },
    ":now": { S: now }
  };
  const conditions = [
    "#ownerId = :ownerId",
    "#snapshotId = :snapshotId",
    "#sourceType = :sourceType",
    "#sourceRecordId = :sourceRecordId",
    "#status = :currentStatus"
  ];

  addExpectedValueCondition(conditions, values, "#publicKey", ":existingPublicKey", asset.publicImageKey);
  addExpectedValueCondition(conditions, values, "#updatedAt", ":existingUpdatedAt", asset.updatedAt);

  return {
    Update: {
      TableName: publicImageAssetTableName,
      Key: { id: { S: asset.id } },
      ConditionExpression: conditions.join(" AND "),
      UpdateExpression: retainCleanupKey
        ? "SET #status = :removed, #updatedAt = :now REMOVE #altText, #failureCode"
        : "SET #status = :removed, #updatedAt = :now REMOVE #publicKey, #altText, #failureCode",
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values
    }
  };
}

async function detachProjection(snapshot: PublicPassportSnapshot, asset: PublicImageAsset | null, retainCleanupKey: boolean) {
  const now = new Date().toISOString();
  const transactItems: TransactWriteItem[] = [snapshotDetachUpdate(snapshot, now)];

  if (asset) {
    transactItems.push(assetRemovalUpdate(asset, snapshot, now, retainCleanupKey));
  }

  try {
    await dynamoClient.send(
      new TransactWriteItemsCommand({
        ClientRequestToken: createHash("sha256")
          .update(snapshot.id)
          .update("\0")
          .update(snapshot.updatedAt ?? "")
          .update("\0")
          .update(asset?.id ?? "")
          .update("\0")
          .update(now)
          .digest("hex")
          .slice(0, 36),
        TransactItems: transactItems
      })
    );
  } catch (error) {
    const errorName = (error as { name?: string }).name;
    if (errorName === "TransactionCanceledException" || errorName === "ConditionalCheckFailedException") {
      throw new CleanupFailure("state_changed");
    }
    throw new CleanupFailure("unknown_error");
  }
}

async function finalizeLedgerCleanup(asset: PublicImageAsset, expectedKey: string) {
  try {
    await dynamoClient.send(
      new UpdateItemCommand({
        TableName: publicImageAssetTableName,
        Key: { id: { S: asset.id } },
        ConditionExpression:
          "#ownerId = :ownerId AND #snapshotId = :snapshotId AND #sourceType = :sourceType AND #sourceRecordId = :sourceRecordId AND #status = :removed AND #publicKey = :publicKey",
        UpdateExpression: "SET #updatedAt = :now REMOVE #publicKey, #altText, #failureCode",
        ExpressionAttributeNames: {
          "#ownerId": "ownerId",
          "#snapshotId": "publicPassportSnapshotId",
          "#sourceType": "sourceType",
          "#sourceRecordId": "sourceRecordId",
          "#status": "status",
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
        "status",
        "updatedAt"
      ]),
      asset.id
    );

    return Boolean(latest && latest.status === "removed" && !latest.publicImageKey);
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

async function cleanupRemovedAsset(asset: PublicImageAsset) {
  const expectedKey = expectedPublicImageKey(asset.publicPassportSnapshotId, asset.id);
  if (
    asset.status !== "removed" ||
    asset.sourceType !== "equipment_cover" ||
    !asset.publicImageKey ||
    asset.publicImageKey !== expectedKey
  ) {
    return { status: "projection_mismatch" as const };
  }

  if (!(await deleteDerivative(expectedKey))) {
    return { status: "storage_delete_failed" as const };
  }

  return (await finalizeLedgerCleanup(asset, expectedKey))
    ? { status: "removed" as const }
    : { status: "state_changed" as const };
}

async function queryRemovedAssets(snapshot: PublicPassportSnapshot) {
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
      Limit: cleanupQueryLimit,
      ProjectionExpression: selectedFields.ProjectionExpression
    })
  );

  // The GSI is eventually consistent. Its partition key is stable for the
  // asset lifetime, so use it only to find candidate IDs and then re-read each
  // ledger row consistently before deciding whether cleanup is pending.
  const assetIds = (result.Items ?? [])
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
          "status",
          "updatedAt"
        ]),
        id
      )
    )
  )).filter((asset): asset is PublicImageAsset => Boolean(asset));
  const boundAssets = resolvedAssets.filter(
      (asset) =>
        asset.ownerId === snapshot.ownerId &&
        asset.publicPassportSnapshotId === snapshot.id &&
        asset.sourceType === "equipment_cover" &&
        asset.sourceRecordId === snapshot.equipmentPassportId &&
        knownAssetStatuses.has(asset.status)
    );
  const assets = boundAssets.filter((asset) => asset.status === "removed");

  return {
    assets,
    truncated: Boolean(result.LastEvaluatedKey),
    unsafeRows:
      assetIds.length !== (result.Items ?? []).length ||
      resolvedAssets.length !== assetIds.length ||
      boundAssets.length !== resolvedAssets.length
  };
}

async function retryPendingCleanup(snapshot: PublicPassportSnapshot) {
  const { assets, truncated, unsafeRows } = await queryRemovedAssets(snapshot);
  const pendingAssets = assets.filter((asset) => Boolean(asset.publicImageKey));

  if (pendingAssets.length === 0) {
    return truncated || unsafeRows
      ? { cleanupStatus: "cleanup_pending" as const, failureCode: "projection_mismatch" as const }
      : { cleanupStatus: "not_attached" as const };
  }

  const results = await Promise.all(pendingAssets.map((asset) => cleanupRemovedAsset(asset)));
  if (results.some((result) => result.status === "storage_delete_failed")) {
    return { cleanupStatus: "cleanup_pending" as const, failureCode: "storage_delete_failed" as const };
  }
  if (truncated || unsafeRows || results.some((result) => result.status !== "removed")) {
    return { cleanupStatus: "cleanup_pending" as const, failureCode: "projection_mismatch" as const };
  }

  return { cleanupStatus: "removed" as const };
}

async function removeOnce(identity: AppSyncIdentityCognito, snapshotId: string) {
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

  // Missing and foreign opaque IDs intentionally share the same response so
  // this owner action cannot be used as a record-existence oracle.
  if (!snapshot || !callerOwnsSnapshot(snapshot, identity) || !normalizePersistentId(snapshot.equipmentPassportId)) {
    throw new CleanupFailure("unauthorized");
  }

  const hasProjection = Boolean(
    snapshot.publicImageAssetId || snapshot.publicImageKey || snapshot.publicImageAltText
  );
  const projectedAssetId = resolveProjectedAssetId(snapshot);
  const assetItem = projectedAssetId
    ? await getItem(publicImageAssetTableName, projectedAssetId, [
        "id",
        "ownerId",
        "publicPassportSnapshotId",
        "sourceType",
        "sourceRecordId",
        "publicImageKey",
        "status",
        "updatedAt"
      ])
    : undefined;
  const candidateAsset = readPublicImageAsset(assetItem, projectedAssetId || undefined);
  const safeAsset = candidateAsset && isSafeAssetBinding(candidateAsset, snapshot) ? candidateAsset : null;
  const expectedKey = projectedAssetId ? expectedPublicImageKey(snapshot.id, projectedAssetId) : "";
  const snapshotKeyIsCanonical = Boolean(expectedKey && snapshot.publicImageKey === expectedKey);
  const assetKeyIsCanonical = Boolean(expectedKey && safeAsset?.publicImageKey === expectedKey);
  const retainCleanupKey = Boolean(safeAsset && assetKeyIsCanonical);

  await detachProjection(snapshot, safeAsset, retainCleanupKey);

  if (!hasProjection) {
    return retryPendingCleanup(snapshot);
  }

  if (candidateAsset && !safeAsset) {
    return { cleanupStatus: "cleanup_pending" as const, failureCode: "projection_mismatch" as const };
  }

  const cleanupKey = assetKeyIsCanonical || snapshotKeyIsCanonical ? expectedKey : "";
  if (!cleanupKey) {
    return { cleanupStatus: "cleanup_pending" as const, failureCode: "projection_mismatch" as const };
  }

  if (safeAsset && retainCleanupKey) {
    const cleanupResult = await cleanupRemovedAsset({ ...safeAsset, status: "removed" });
    if (cleanupResult.status === "removed") {
      return { cleanupStatus: "removed" as const };
    }
    return {
      cleanupStatus: "cleanup_pending" as const,
      failureCode: cleanupResult.status === "storage_delete_failed" ? "storage_delete_failed" as const : "state_changed" as const
    };
  }

  return (await deleteDerivative(cleanupKey))
    ? { cleanupStatus: "removed" as const }
    : { cleanupStatus: "cleanup_pending" as const, failureCode: "storage_delete_failed" as const };
}

function response(
  cleanupStatus: CleanupStatus,
  failureCode?: FailureCode
): Schema["removePublicPassportImage"]["returnType"] {
  return { cleanupStatus, failureCode };
}

export const handler: Schema["removePublicPassportImage"]["functionHandler"] = async (event) => {
  try {
    validateRuntimeConfiguration();
    const snapshotId = normalizePersistentId(event.arguments.publicPassportSnapshotId);
    const identity = event.identity;

    if (!snapshotId) {
      throw new CleanupFailure("invalid_request");
    }
    if (!isCognitoIdentity(identity)) {
      throw new CleanupFailure("unauthorized");
    }

    for (let attempt = 0; attempt < stateChangeRetryLimit; attempt += 1) {
      try {
        const result = await removeOnce(identity, snapshotId);
        console.info(JSON.stringify({ event: "public_image_cleanup_completed", cleanupStatus: result.cleanupStatus }));
        return response(result.cleanupStatus, result.failureCode);
      } catch (error) {
        if (error instanceof CleanupFailure && error.code === "state_changed" && attempt + 1 < stateChangeRetryLimit) {
          continue;
        }
        throw error;
      }
    }

    throw new CleanupFailure("state_changed");
  } catch (error) {
    const failureCode = error instanceof CleanupFailure ? error.code : "unknown_error";
    console.warn(JSON.stringify({ event: "public_image_cleanup_failed", failureCode }));
    return response("failed", failureCode);
  }
};
