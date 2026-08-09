import { DynamoDBClient, GetItemCommand, UpdateItemCommand, type AttributeValue } from "@aws-sdk/client-dynamodb";
import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { AppSyncIdentityIAM } from "aws-lambda";
import type { Schema } from "../../data/resource.ts";

const allowedContentTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const privateImageMaxBytes = 8 * 1024 * 1024;
const generatedFileNamePattern = /^\d{10,15}-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpe?g|png|webp)$/i;
const nonPersistentIdPattern = /^(?:(?:demo|sample)(?:[-_]|$)|(?:passport|session|target-photo)-\d+$)/i;
const storageIdentityPattern = /^[a-z0-9:_-]{3,160}$/i;

type DynamoItem = Record<string, AttributeValue>;
type SourceType = "equipment_cover" | "range_session_target";
type FailureCode =
  | "source_not_found"
  | "source_owner_mismatch"
  | "invalid_storage_key"
  | "object_not_found"
  | "unsupported_content_type"
  | "file_too_large"
  | "metadata_mismatch"
  | "unauthorized"
  | "unknown_error";

type PrivateImageAsset = {
  id: string;
  ownerId: string;
  ownerSub: string;
  sourceType: SourceType;
  sourceRecordId: string;
  storageKey: string;
  storageIdentityId: string;
  sanitizedFileName: string;
  contentType: string;
  sizeBytes: number;
};

class VerificationFailure extends Error {
  constructor(readonly code: FailureCode) {
    super(code);
    this.name = "VerificationFailure";
  }
}

function requiredEnvironment(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment configuration: ${name}`);
  }

  return value;
}

const privateImageAssetTableName = requiredEnvironment("PRIVATE_IMAGE_ASSET_TABLE_NAME");
const equipmentPassportTableName = requiredEnvironment("EQUIPMENT_PASSPORT_TABLE_NAME");
const rangeSessionTableName = requiredEnvironment("RANGE_SESSION_TABLE_NAME");
const privateImageBucketName = requiredEnvironment("unifiedRangePrivateImages_BUCKET_NAME");

const dynamoClient = new DynamoDBClient({});
const s3Client = new S3Client({});

function stringValue(item: DynamoItem, field: string) {
  const value = item[field];
  return value && "S" in value ? value.S : undefined;
}

function numberValue(item: DynamoItem, field: string) {
  const value = item[field];

  if (!value || !("N" in value)) {
    return undefined;
  }

  const parsed = Number(value.N);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isIamIdentity(identity: unknown): identity is AppSyncIdentityIAM {
  return Boolean(
    identity &&
      typeof identity === "object" &&
      "cognitoIdentityId" in identity &&
      typeof (identity as { cognitoIdentityId?: unknown }).cognitoIdentityId === "string" &&
      "cognitoIdentityAuthProvider" in identity &&
      typeof (identity as { cognitoIdentityAuthProvider?: unknown }).cognitoIdentityAuthProvider === "string"
  );
}

function cognitoUserSubFromIamIdentity(identity: AppSyncIdentityIAM) {
  const providerParts = identity.cognitoIdentityAuthProvider.split(",");

  for (const providerPart of providerParts) {
    const match = providerPart.trim().match(/:CognitoSignIn:([^,\s]+)$/);

    if (match?.[1]) {
      return match[1];
    }
  }

  return "";
}

async function getItem(tableName: string, id: string) {
  const result = await dynamoClient.send(
    new GetItemCommand({
      TableName: tableName,
      Key: { id: { S: id } },
      ConsistentRead: true
    })
  );

  return result.Item;
}

function readPrivateImageAsset(item: DynamoItem | undefined, expectedId: string) {
  if (!item) {
    return null;
  }

  const sourceType = stringValue(item, "sourceType");
  const asset: PrivateImageAsset = {
    id: stringValue(item, "id") ?? "",
    ownerId: stringValue(item, "ownerId") ?? "",
    ownerSub: stringValue(item, "ownerSub") ?? "",
    sourceType: sourceType === "equipment_cover" || sourceType === "range_session_target" ? sourceType : "equipment_cover",
    sourceRecordId: stringValue(item, "sourceRecordId") ?? "",
    storageKey: stringValue(item, "storageKey") ?? "",
    storageIdentityId: stringValue(item, "storageIdentityId") ?? "",
    sanitizedFileName: stringValue(item, "sanitizedFileName") ?? "",
    contentType: stringValue(item, "contentType") ?? "",
    sizeBytes: numberValue(item, "sizeBytes") ?? Number.NaN
  };

  if (asset.id !== expectedId || sourceType !== asset.sourceType) {
    throw new VerificationFailure("metadata_mismatch");
  }

  return asset;
}

function normalizeContentType(value: string | undefined) {
  return value?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

function parseStorageKey(storageKey: string) {
  if (!storageKey || storageKey.length > 1024 || storageKey.includes("\\")) {
    throw new VerificationFailure("invalid_storage_key");
  }

  const parts = storageKey.split("/");

  if (parts.length !== 5 || parts[0] !== "private") {
    throw new VerificationFailure("invalid_storage_key");
  }

  return {
    folder: parts[1],
    storageIdentityId: parts[2],
    sourceRecordId: parts[3],
    sanitizedFileName: parts[4]
  };
}

function sanitizePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").slice(0, 80);
}

async function updateBindingStatus({
  assetId,
  ownerId,
  status,
  failureCode,
  verifiedAt
}: {
  assetId: string;
  ownerId: string;
  status: "verifying" | "verified" | "failed";
  failureCode?: FailureCode;
  verifiedAt?: string;
}) {
  const now = new Date().toISOString();
  const names: Record<string, string> = {
    "#ownerId": "ownerId",
    "#bindingStatus": "bindingStatus",
    "#bindingFailureCode": "bindingFailureCode",
    "#verifiedAt": "verifiedAt",
    "#updatedAt": "updatedAt"
  };
  const values: Record<string, AttributeValue> = {
    ":ownerId": { S: ownerId },
    ":bindingStatus": { S: status },
    ":updatedAt": { S: now }
  };
  const setExpressions = ["#bindingStatus = :bindingStatus", "#updatedAt = :updatedAt"];
  const removeExpressions: string[] = [];

  if (failureCode) {
    values[":bindingFailureCode"] = { S: failureCode };
    setExpressions.push("#bindingFailureCode = :bindingFailureCode");
  } else {
    removeExpressions.push("#bindingFailureCode");
  }

  if (verifiedAt) {
    values[":verifiedAt"] = { S: verifiedAt };
    setExpressions.push("#verifiedAt = :verifiedAt");
  } else {
    removeExpressions.push("#verifiedAt");
  }

  const updateExpression = [
    `SET ${setExpressions.join(", ")}`,
    removeExpressions.length ? `REMOVE ${removeExpressions.join(", ")}` : ""
  ]
    .filter(Boolean)
    .join(" ");

  await dynamoClient.send(
    new UpdateItemCommand({
      TableName: privateImageAssetTableName,
      Key: { id: { S: assetId } },
      ConditionExpression: "#ownerId = :ownerId",
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values
    })
  );
}

async function validateSource(asset: PrivateImageAsset) {
  const tableName = asset.sourceType === "equipment_cover" ? equipmentPassportTableName : rangeSessionTableName;
  const source = await getItem(tableName, asset.sourceRecordId);

  if (!source) {
    throw new VerificationFailure("source_not_found");
  }

  const sourceOwnerId = stringValue(source, "ownerId");

  if (!sourceOwnerId || !new Set([asset.ownerId, asset.ownerSub]).has(sourceOwnerId)) {
    throw new VerificationFailure("source_owner_mismatch");
  }

  if (asset.sourceType === "equipment_cover" && stringValue(source, "privateCoverPhotoKey") !== asset.storageKey) {
    throw new VerificationFailure("metadata_mismatch");
  }
}

function validateCandidateMetadata(asset: PrivateImageAsset, trustedStorageIdentityId: string) {
  if (!asset.ownerId || !asset.ownerSub || !asset.sourceRecordId || !asset.storageKey || !asset.sanitizedFileName) {
    throw new VerificationFailure("metadata_mismatch");
  }

  if (nonPersistentIdPattern.test(asset.id) || nonPersistentIdPattern.test(asset.sourceRecordId)) {
    throw new VerificationFailure("metadata_mismatch");
  }

  if (!storageIdentityPattern.test(trustedStorageIdentityId) || asset.storageIdentityId !== trustedStorageIdentityId) {
    throw new VerificationFailure("unauthorized");
  }

  const parsedKey = parseStorageKey(asset.storageKey);
  const expectedFolder = asset.sourceType === "equipment_cover" ? "equipment" : "targets";
  const expectedRecordId = sanitizePathSegment(asset.sourceRecordId);

  if (
    parsedKey.folder !== expectedFolder ||
    parsedKey.storageIdentityId !== trustedStorageIdentityId ||
    parsedKey.sourceRecordId !== expectedRecordId ||
    parsedKey.sanitizedFileName !== asset.sanitizedFileName ||
    !generatedFileNamePattern.test(parsedKey.sanitizedFileName)
  ) {
    throw new VerificationFailure("invalid_storage_key");
  }

  if (!allowedContentTypes.has(normalizeContentType(asset.contentType))) {
    throw new VerificationFailure("unsupported_content_type");
  }

  if (!Number.isFinite(asset.sizeBytes) || asset.sizeBytes <= 0) {
    throw new VerificationFailure("metadata_mismatch");
  }

  if (asset.sizeBytes > privateImageMaxBytes) {
    throw new VerificationFailure("file_too_large");
  }
}

async function headAndValidateObject(asset: PrivateImageAsset) {
  let objectMetadata;

  try {
    objectMetadata = await s3Client.send(
      new HeadObjectCommand({
        Bucket: privateImageBucketName,
        Key: asset.storageKey
      })
    );
  } catch (error) {
    const statusCode = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    const errorName = (error as { name?: string }).name;

    if (statusCode === 404 || errorName === "NotFound" || errorName === "NoSuchKey") {
      throw new VerificationFailure("object_not_found");
    }

    throw new VerificationFailure("unknown_error");
  }

  const objectContentType = normalizeContentType(objectMetadata.ContentType);
  const registeredContentType = normalizeContentType(asset.contentType);

  if (!allowedContentTypes.has(objectContentType)) {
    throw new VerificationFailure("unsupported_content_type");
  }

  if (objectContentType !== registeredContentType) {
    throw new VerificationFailure("metadata_mismatch");
  }

  if (!objectMetadata.ContentLength || objectMetadata.ContentLength <= 0) {
    throw new VerificationFailure("metadata_mismatch");
  }

  if (objectMetadata.ContentLength > privateImageMaxBytes) {
    throw new VerificationFailure("file_too_large");
  }

  if (objectMetadata.ContentLength !== asset.sizeBytes) {
    throw new VerificationFailure("metadata_mismatch");
  }
}

function result(
  privateImageAssetId: string,
  bindingStatus: "verified" | "failed",
  failureCode?: FailureCode,
  verifiedAt?: string
): Schema["verifyPrivateImageAsset"]["returnType"] {
  return {
    privateImageAssetId,
    bindingStatus,
    failureCode,
    verifiedAt
  };
}

export const handler: Schema["verifyPrivateImageAsset"]["functionHandler"] = async (event) => {
  const assetId = event.arguments.privateImageAssetId.trim();
  const identity = event.identity;

  if (!assetId || nonPersistentIdPattern.test(assetId) || !isIamIdentity(identity) || identity.cognitoIdentityAuthType !== "authenticated") {
    return result(assetId || "unknown", "failed", "unauthorized");
  }

  const trustedOwnerSub = cognitoUserSubFromIamIdentity(identity);
  const trustedStorageIdentityId = identity.cognitoIdentityId;
  const asset = readPrivateImageAsset(await getItem(privateImageAssetTableName, assetId), assetId);

  // Missing legacy bridge fields are intentionally not backfilled from caller
  // input. Re-upload creates a candidate that can be bound to both auth modes.
  if (
    !asset ||
    !trustedOwnerSub ||
    asset.ownerSub !== trustedOwnerSub ||
    !asset.storageIdentityId ||
    asset.storageIdentityId !== trustedStorageIdentityId
  ) {
    return result(assetId, "failed", "unauthorized");
  }

  try {
    await updateBindingStatus({ assetId, ownerId: asset.ownerId, status: "verifying" });
    validateCandidateMetadata(asset, trustedStorageIdentityId);
    await validateSource(asset);
    await headAndValidateObject(asset);

    const verifiedAt = new Date().toISOString();
    await updateBindingStatus({ assetId, ownerId: asset.ownerId, status: "verified", verifiedAt });

    console.info(JSON.stringify({ event: "private_image_verified", privateImageAssetId: assetId }));
    return result(assetId, "verified", undefined, verifiedAt);
  } catch (error) {
    const failureCode = error instanceof VerificationFailure ? error.code : "unknown_error";

    try {
      await updateBindingStatus({ assetId, ownerId: asset.ownerId, status: "failed", failureCode });
    } catch {
      console.error(JSON.stringify({ event: "private_image_verification_status_write_failed", privateImageAssetId: assetId }));
    }

    console.warn(JSON.stringify({ event: "private_image_verification_failed", privateImageAssetId: assetId, failureCode }));
    return result(assetId, "failed", failureCode);
  }
};
