import { DynamoDBClient, GetItemCommand, type AttributeValue } from "@aws-sdk/client-dynamodb";
import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { Schema } from "../../data/resource.ts";
import {
  inspectPublicImageCleanup,
  type DerivativeHeadResult,
  type PublicImageAssetInspectionRecord,
  type PublicPassportSnapshotInspectionRecord
} from "./core.ts";

type DynamoItem = Record<string, AttributeValue>;

function environmentValue(name: string) {
  return process.env[name]?.trim() ?? "";
}

const publicPassportSnapshotTableName = environmentValue("PUBLIC_PASSPORT_SNAPSHOT_TABLE_NAME");
const publicImageAssetTableName = environmentValue("PUBLIC_IMAGE_ASSET_TABLE_NAME");
const imageBucketName = environmentValue("unifiedRangePrivateImages_BUCKET_NAME");

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

function readAsset(item: DynamoItem | undefined): PublicImageAssetInspectionRecord | null {
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
    updatedAt: stringValue(item, "updatedAt")
  };
}

function readSnapshot(item: DynamoItem | undefined): PublicPassportSnapshotInspectionRecord | null {
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

async function headDerivative(canonicalKey: string): Promise<DerivativeHeadResult> {
  validateRuntimeConfiguration();
  try {
    const response = await s3Client.send(
      new HeadObjectCommand({ Bucket: imageBucketName, Key: canonicalKey })
    );
    return {
      state: "present",
      contentType: response.ContentType,
      contentLength: response.ContentLength
    };
  } catch (error) {
    const statusCode = errorStatusCode(error);
    const name = errorName(error);
    if (statusCode === 404 || name === "NotFound" || name === "NoSuchKey") {
      return { state: "missing" };
    }
    if (statusCode === 403 || name === "AccessDenied" || name === "Forbidden") {
      return { state: "inaccessible" };
    }
    return { state: "transient" };
  }
}

function failedResult(): Schema["inspectPublicImageCleanup"]["returnType"] {
  return {
    assessmentStatus: "failed",
    findingCodes: ["unknown_error"],
    recommendedNextStep: "retry_inspection",
    inspectedAt: new Date().toISOString(),
    retryable: true
  };
}

export const handler: Schema["inspectPublicImageCleanup"]["functionHandler"] = async (event) => {
  try {
    const assessment = await inspectPublicImageCleanup(
      event.arguments.publicImageAssetId,
      event.identity,
      {
        now: () => new Date(),
        getAsset: async (id) => readAsset(
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
            "lastReportAt",
            "updatedAt"
          ])
        ),
        getSnapshot: async (id) => readSnapshot(
          await getItem(publicPassportSnapshotTableName, id, [
            "id",
            "ownerId",
            "equipmentPassportId",
            "publicImageAssetId",
            "publicImageKey",
            "publicImageAltText",
            "updatedAt"
          ])
        ),
        headDerivative
      }
    );

    console.info(JSON.stringify({
      event: "public_image_cleanup_inspection_completed",
      assessmentStatus: assessment.assessmentStatus,
      recommendedNextStep: assessment.recommendedNextStep,
      findingCount: assessment.findingCodes.length,
      retryable: assessment.retryable
    }));
    return assessment;
  } catch {
    console.warn(JSON.stringify({
      event: "public_image_cleanup_inspection_failed",
      failureCode: "unknown_error"
    }));
    return failedResult();
  }
};
