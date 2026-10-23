import { createHash, randomUUID } from "node:crypto";
import {
  DynamoDBClient,
  GetItemCommand,
  TransactWriteItemsCommand,
  UpdateItemCommand,
  type AttributeValue
} from "@aws-sdk/client-dynamodb";
import {
  DeleteObjectCommand,
  GetBucketVersioningCommand,
  HeadObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import type { Schema } from "../../data/resource.ts";
import { isRemovedPublicImageCleanupExecutionEnabled } from "./configuration.ts";
import {
  retryRemovedPublicImageCleanup,
  type BucketVersioningResult,
  type CleanupClaimResult,
  type CleanupObjectHeadResult,
  type CleanupRetrySnapshotRecord,
  type ConditionalDeleteResult,
  type RemovedPublicImageAssetRecord
} from "./core.ts";

type DynamoItem = Record<string, AttributeValue>;

function environmentValue(name: string) {
  return process.env[name]?.trim() ?? "";
}

const publicPassportSnapshotTableName = environmentValue("PUBLIC_PASSPORT_SNAPSHOT_TABLE_NAME");
const publicImageAssetTableName = environmentValue("PUBLIC_IMAGE_ASSET_TABLE_NAME");
const imageBucketName = environmentValue("unifiedRangePrivateImages_BUCKET_NAME");
const executionEnabled = isRemovedPublicImageCleanupExecutionEnabled(
  process.env.REMOVED_PUBLIC_IMAGE_CLEANUP_ENABLED
);

const dynamoClient = new DynamoDBClient({});
const s3Client = new S3Client({});

function validateRuntimeConfiguration() {
  if (!publicPassportSnapshotTableName || !publicImageAssetTableName || !imageBucketName) {
    throw new Error("runtime_configuration_unavailable");
  }
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
  validateRuntimeConfiguration();
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

const assetFields = [
  "id",
  "ownerId",
  "publicPassportSnapshotId",
  "sourceType",
  "sourceRecordId",
  "publicImageKey",
  "publicImageAltText",
  "status",
  "moderationStatus",
  "lastReportAt",
  "cleanupAttemptId",
  "cleanupAttemptStatus",
  "cleanupAttemptStartedAt",
  "cleanupAttemptFailureCode",
  "cleanupCompletedAt",
  "updatedAt"
];

const snapshotFields = [
  "id",
  "ownerId",
  "equipmentPassportId",
  "publicImageAssetId",
  "publicImageKey",
  "publicImageAltText",
  "updatedAt"
];

function readAsset(item: DynamoItem | undefined): RemovedPublicImageAssetRecord | null {
  if (!item) {
    return null;
  }
  return {
    id: stringValue(item, "id") ?? "",
    ownerId: stringValue(item, "ownerId") ?? "",
    publicPassportSnapshotId: stringValue(item, "publicPassportSnapshotId") ?? "",
    sourceType: stringValue(item, "sourceType") ?? "",
    sourceRecordId: stringValue(item, "sourceRecordId") ?? "",
    publicImageKey: stringValue(item, "publicImageKey"),
    publicImageAltText: stringValue(item, "publicImageAltText"),
    status: stringValue(item, "status") ?? "",
    moderationStatus: stringValue(item, "moderationStatus"),
    lastReportAt: stringValue(item, "lastReportAt"),
    cleanupAttemptId: stringValue(item, "cleanupAttemptId"),
    cleanupAttemptStatus: stringValue(item, "cleanupAttemptStatus"),
    cleanupAttemptStartedAt: stringValue(item, "cleanupAttemptStartedAt"),
    cleanupAttemptFailureCode: stringValue(item, "cleanupAttemptFailureCode"),
    cleanupCompletedAt: stringValue(item, "cleanupCompletedAt"),
    updatedAt: stringValue(item, "updatedAt")
  };
}

function readSnapshot(item: DynamoItem | undefined): CleanupRetrySnapshotRecord | null {
  if (!item) {
    return null;
  }
  return {
    id: stringValue(item, "id") ?? "",
    ownerId: stringValue(item, "ownerId") ?? "",
    equipmentPassportId: stringValue(item, "equipmentPassportId") ?? "",
    publicImageAssetId: stringValue(item, "publicImageAssetId"),
    publicImageKey: stringValue(item, "publicImageKey"),
    publicImageAltText: stringValue(item, "publicImageAltText"),
    updatedAt: stringValue(item, "updatedAt")
  };
}

function addExpectedValueCondition(
  conditions: string[],
  values: Record<string, AttributeValue>,
  fieldName: string,
  valueName: string,
  value?: string
) {
  if (value) {
    conditions.push(`${fieldName} = ${valueName}`);
    values[valueName] = { S: value };
  } else {
    conditions.push(`attribute_not_exists(${fieldName})`);
  }
}

async function claimAttempt(input: {
  asset: RemovedPublicImageAssetRecord;
  snapshot: CleanupRetrySnapshotRecord;
  attemptId: string;
  claimedAt: string;
  leaseCutoff: string;
}): Promise<CleanupClaimResult> {
  validateRuntimeConfiguration();
  const snapshotNames = {
    "#ownerId": "ownerId",
    "#sourceRecordId": "equipmentPassportId",
    "#publicAssetId": "publicImageAssetId",
    "#publicKey": "publicImageKey",
    "#altText": "publicImageAltText",
    "#updatedAt": "updatedAt"
  };
  const snapshotValues: Record<string, AttributeValue> = {
    ":ownerId": { S: input.snapshot.ownerId },
    ":sourceRecordId": { S: input.snapshot.equipmentPassportId }
  };
  const snapshotConditions = [
    "#ownerId = :ownerId",
    "#sourceRecordId = :sourceRecordId",
    "attribute_not_exists(#publicAssetId)",
    "attribute_not_exists(#publicKey)",
    "attribute_not_exists(#altText)"
  ];
  addExpectedValueCondition(
    snapshotConditions,
    snapshotValues,
    "#updatedAt",
    ":expectedSnapshotUpdatedAt",
    input.snapshot.updatedAt
  );

  const assetNames = {
    "#ownerId": "ownerId",
    "#snapshotId": "publicPassportSnapshotId",
    "#sourceType": "sourceType",
    "#sourceRecordId": "sourceRecordId",
    "#publicKey": "publicImageKey",
    "#status": "status",
    "#moderationStatus": "moderationStatus",
    "#attemptId": "cleanupAttemptId",
    "#attemptStatus": "cleanupAttemptStatus",
    "#attemptStartedAt": "cleanupAttemptStartedAt",
    "#attemptFailure": "cleanupAttemptFailureCode",
    "#completedAt": "cleanupCompletedAt",
    "#updatedAt": "updatedAt"
  };
  const assetValues: Record<string, AttributeValue> = {
    ":ownerId": { S: input.asset.ownerId },
    ":snapshotId": { S: input.asset.publicPassportSnapshotId },
    ":sourceType": { S: "equipment_cover" },
    ":sourceRecordId": { S: input.asset.sourceRecordId },
    ":publicKey": { S: input.asset.publicImageKey ?? "" },
    ":removed": { S: "removed" },
    ":moderationClear": { S: "clear" },
    ":moderationRemoved": { S: "removed" },
    ":attemptId": { S: input.attemptId },
    ":claimed": { S: "claimed" },
    ":retryPending": { S: "retry_pending" },
    ":claimedAt": { S: input.claimedAt },
    ":leaseCutoff": { S: input.leaseCutoff }
  };
  const assetConditions = [
    "#ownerId = :ownerId",
    "#snapshotId = :snapshotId",
    "#sourceType = :sourceType",
    "#sourceRecordId = :sourceRecordId",
    "#publicKey = :publicKey",
    "#status = :removed",
    "(#moderationStatus = :moderationClear OR #moderationStatus = :moderationRemoved)",
    "(attribute_not_exists(#attemptId) OR #attemptStatus = :retryPending OR (#attemptStatus = :claimed AND #attemptStartedAt < :leaseCutoff))"
  ];
  addExpectedValueCondition(
    assetConditions,
    assetValues,
    "#updatedAt",
    ":expectedAssetUpdatedAt",
    input.asset.updatedAt
  );

  try {
    await dynamoClient.send(
      new TransactWriteItemsCommand({
        ClientRequestToken: createHash("sha256").update(input.attemptId).digest("hex").slice(0, 36),
        TransactItems: [
          {
            ConditionCheck: {
              TableName: publicPassportSnapshotTableName,
              Key: { id: { S: input.snapshot.id } },
              ConditionExpression: snapshotConditions.join(" AND "),
              ExpressionAttributeNames: snapshotNames,
              ExpressionAttributeValues: snapshotValues
            }
          },
          {
            Update: {
              TableName: publicImageAssetTableName,
              Key: { id: { S: input.asset.id } },
              ConditionExpression: assetConditions.join(" AND "),
              UpdateExpression:
                "SET #attemptId = :attemptId, #attemptStatus = :claimed, #attemptStartedAt = :claimedAt, #updatedAt = :claimedAt REMOVE #attemptFailure, #completedAt",
              ExpressionAttributeNames: assetNames,
              ExpressionAttributeValues: assetValues
            }
          }
        ]
      })
    );
    return "claimed";
  } catch (error) {
    const name = errorName(error);
    if (name !== "TransactionCanceledException" && name !== "ConditionalCheckFailedException") {
      return "failed";
    }
    const latest = readAsset(await getItem(publicImageAssetTableName, input.asset.id, assetFields));
    if (
      latest?.cleanupAttemptStatus === "claimed" &&
      latest.cleanupAttemptStartedAt &&
      latest.cleanupAttemptStartedAt >= input.leaseCutoff
    ) {
      return "active_attempt";
    }
    return "state_changed";
  }
}

function exactAttemptCondition(input: {
  asset: RemovedPublicImageAssetRecord;
  attemptId: string;
}) {
  return {
    names: {
      "#ownerId": "ownerId",
      "#snapshotId": "publicPassportSnapshotId",
      "#sourceType": "sourceType",
      "#sourceRecordId": "sourceRecordId",
      "#publicKey": "publicImageKey",
      "#status": "status",
      "#moderationStatus": "moderationStatus",
      "#attemptId": "cleanupAttemptId",
      "#attemptStatus": "cleanupAttemptStatus"
    },
    values: {
      ":ownerId": { S: input.asset.ownerId },
      ":snapshotId": { S: input.asset.publicPassportSnapshotId },
      ":sourceType": { S: "equipment_cover" },
      ":sourceRecordId": { S: input.asset.sourceRecordId },
      ":publicKey": { S: input.asset.publicImageKey ?? "" },
      ":removed": { S: "removed" },
      ":moderationStatus": { S: input.asset.moderationStatus ?? "" },
      ":attemptId": { S: input.attemptId },
      ":claimed": { S: "claimed" }
    } satisfies Record<string, AttributeValue>,
    expression:
      "#ownerId = :ownerId AND #snapshotId = :snapshotId AND #sourceType = :sourceType AND #sourceRecordId = :sourceRecordId AND #publicKey = :publicKey AND #status = :removed AND #moderationStatus = :moderationStatus AND #attemptId = :attemptId AND #attemptStatus = :claimed"
  };
}

async function completeAttempt(input: {
  asset: RemovedPublicImageAssetRecord;
  attemptId: string;
  completedAt: string;
}) {
  const condition = exactAttemptCondition(input);
  try {
    await dynamoClient.send(
      new UpdateItemCommand({
        TableName: publicImageAssetTableName,
        Key: { id: { S: input.asset.id } },
        ConditionExpression: condition.expression,
        UpdateExpression:
          "SET #attemptStatus = :complete, #completedAt = :completedAt, #updatedAt = :completedAt REMOVE #publicKey, #altText, #processingFailure, #attemptFailure",
        ExpressionAttributeNames: {
          ...condition.names,
          "#completedAt": "cleanupCompletedAt",
          "#updatedAt": "updatedAt",
          "#altText": "publicImageAltText",
          "#processingFailure": "processingErrorCode",
          "#attemptFailure": "cleanupAttemptFailureCode"
        },
        ExpressionAttributeValues: {
          ...condition.values,
          ":complete": { S: "complete" },
          ":completedAt": { S: input.completedAt }
        }
      })
    );
    return true;
  } catch {
    return false;
  }
}

async function markAttemptRetryPending(input: {
  asset: RemovedPublicImageAssetRecord;
  attemptId: string;
  failureCode: string;
  updatedAt: string;
}) {
  const condition = exactAttemptCondition(input);
  try {
    await dynamoClient.send(
      new UpdateItemCommand({
        TableName: publicImageAssetTableName,
        Key: { id: { S: input.asset.id } },
        ConditionExpression: condition.expression,
        UpdateExpression:
          "SET #attemptStatus = :retryPending, #attemptFailure = :failureCode, #updatedAt = :updatedAt",
        ExpressionAttributeNames: {
          ...condition.names,
          "#attemptFailure": "cleanupAttemptFailureCode",
          "#updatedAt": "updatedAt"
        },
        ExpressionAttributeValues: {
          ...condition.values,
          ":retryPending": { S: "retry_pending" },
          ":failureCode": { S: input.failureCode },
          ":updatedAt": { S: input.updatedAt }
        }
      })
    );
    return true;
  } catch {
    return false;
  }
}

function errorName(error: unknown) {
  if (!error || typeof error !== "object") {
    return "";
  }
  const candidate = error as { name?: unknown; Code?: unknown; code?: unknown };
  for (const value of [candidate.name, candidate.Code, candidate.code]) {
    if (typeof value === "string") {
      return value;
    }
  }
  return "";
}

function errorStatusCode(error: unknown) {
  if (!error || typeof error !== "object") {
    return undefined;
  }
  const candidate = error as { $metadata?: { httpStatusCode?: unknown } };
  return typeof candidate.$metadata?.httpStatusCode === "number"
    ? candidate.$metadata.httpStatusCode
    : undefined;
}

async function getBucketVersioning(): Promise<BucketVersioningResult> {
  validateRuntimeConfiguration();
  try {
    const result = await s3Client.send(new GetBucketVersioningCommand({ Bucket: imageBucketName }));
    if (result.Status === "Enabled") {
      return { state: "enabled" };
    }
    if (result.Status === "Suspended") {
      return { state: "suspended" };
    }
    return { state: "unversioned" };
  } catch (error) {
    const status = errorStatusCode(error);
    const name = errorName(error);
    return status === 403 || name === "AccessDenied" || name === "Forbidden"
      ? { state: "inaccessible" }
      : { state: "transient" };
  }
}

async function headDerivative(canonicalKey: string): Promise<CleanupObjectHeadResult> {
  validateRuntimeConfiguration();
  try {
    const result = await s3Client.send(
      new HeadObjectCommand({ Bucket: imageBucketName, Key: canonicalKey })
    );
    return {
      state: "present",
      eTag: result.ETag,
      contentType: result.ContentType,
      contentLength: result.ContentLength
    };
  } catch (error) {
    const status = errorStatusCode(error);
    const name = errorName(error);
    if (status === 404 || name === "NotFound" || name === "NoSuchKey") {
      return { state: "missing" };
    }
    if (status === 403 || name === "AccessDenied" || name === "Forbidden") {
      return { state: "inaccessible" };
    }
    return { state: "transient" };
  }
}

async function deleteDerivative(canonicalKey: string, eTag: string): Promise<ConditionalDeleteResult> {
  validateRuntimeConfiguration();
  try {
    const result = await s3Client.send(
      new DeleteObjectCommand({ Bucket: imageBucketName, Key: canonicalKey, IfMatch: eTag })
    );
    return result.DeleteMarker || result.VersionId ? "transient" : "deleted";
  } catch (error) {
    const status = errorStatusCode(error);
    const name = errorName(error);
    if (status === 412 || name === "PreconditionFailed") {
      return "precondition_failed";
    }
    if (status === 404 || name === "NotFound" || name === "NoSuchKey") {
      return "missing";
    }
    if (status === 403 || name === "AccessDenied" || name === "Forbidden") {
      return "inaccessible";
    }
    return "transient";
  }
}

function failedResult(): Schema["retryRemovedPublicImageCleanup"]["returnType"] {
  return { cleanupStatus: "failed", failureCode: "unknown_error", retryable: true };
}

export const handler: Schema["retryRemovedPublicImageCleanup"]["functionHandler"] = async (event) => {
  try {
    const result = await retryRemovedPublicImageCleanup(
      {
        publicImageAssetId: event.arguments.publicImageAssetId,
        confirmation: event.arguments.confirmation,
        executionEnabled,
        identity: event.identity
      },
      {
        now: () => new Date(),
        newAttemptId: () => randomUUID(),
        getAsset: async (id) => readAsset(await getItem(publicImageAssetTableName, id, assetFields)),
        getSnapshot: async (id) => readSnapshot(await getItem(publicPassportSnapshotTableName, id, snapshotFields)),
        getBucketVersioning,
        claimAttempt,
        headDerivative,
        deleteDerivative,
        completeAttempt,
        markAttemptRetryPending
      }
    );
    console.info(JSON.stringify({
      event: "removed_public_image_cleanup_retry_completed",
      cleanupStatus: result.cleanupStatus,
      failureCode: result.failureCode,
      retryable: result.retryable,
      executionEnabled
    }));
    return result;
  } catch {
    console.warn(JSON.stringify({
      event: "removed_public_image_cleanup_retry_failed",
      failureCode: "unknown_error",
      executionEnabled
    }));
    return failedResult();
  }
};
