import { randomUUID } from "node:crypto";
import {
  DynamoDBClient,
  GetItemCommand,
  QueryCommand,
  TransactWriteItemsCommand,
  type AttributeValue,
  type TransactWriteItem
} from "@aws-sdk/client-dynamodb";
import type { AppSyncIdentityCognito } from "aws-lambda";
import type { Schema } from "../../data/resource.ts";

const idPattern = /^[a-z0-9][a-z0-9_-]{0,127}$/i;
const publicImageAssetIdPattern = /^img-[0-9a-f]{40}$/;
const usernamePattern = /^[a-z0-9_-]{3,24}$/;
const nonPersistentIdPattern = /^(?:(?:demo|sample)(?:[-_]|$)|(?:passport|session|target-photo)-\d+$)/i;
const forbiddenTechnicalContentPattern = /(?:\b(?:s3|https?|data|blob):\/\/|\bwww\.|\b(?:private|public)[\\/](?:equipment|targets|passports)[\\/])/i;
const publicAltTextMaxLength = 140;
const detailsMaxLength = 500;
const reporterIdMaxLength = 160;
const allowedReasons = new Set([
  "unsafe content",
  "personal information",
  "harassment or threat",
  "illegal hunting / poaching",
  "sales or marketplace activity",
  "other"
]);

type DynamoItem = Record<string, AttributeValue>;
type SubmissionStatus = "submitted" | "failed";
type FailureCode =
  | "unauthorized"
  | "invalid_request"
  | "image_unavailable"
  | "state_changed"
  | "unknown_error";

type PublicPassportSnapshot = {
  id: string;
  ownerId: string;
  equipmentPassportId: string;
  publicImageAssetId: string;
  publicImageKey: string;
  publicImageAltText: string;
};

type PublicImageAsset = {
  id: string;
  ownerId: string;
  publicPassportSnapshotId: string;
  sourceType: string;
  sourceRecordId: string;
  publicImageKey: string;
  publicImageAltText: string;
  status: string;
  moderationStatus: string;
};

type EquipmentPassport = {
  id: string;
  ownerId: string;
  isPublic: boolean;
};

type UserProfile = {
  id: string;
  ownerId: string;
  username: string;
  accountVisibility: string;
};

class ReportCreationFailure extends Error {
  constructor(readonly code: FailureCode) {
    super(code);
    this.name = "ReportCreationFailure";
  }
}

function environmentValue(name: string) {
  return process.env[name]?.trim() ?? "";
}

const reportTableName = environmentValue("REPORT_TABLE_NAME");
const publicPassportSnapshotTableName = environmentValue("PUBLIC_PASSPORT_SNAPSHOT_TABLE_NAME");
const publicImageAssetTableName = environmentValue("PUBLIC_IMAGE_ASSET_TABLE_NAME");
const equipmentPassportTableName = environmentValue("EQUIPMENT_PASSPORT_TABLE_NAME");
const userProfileTableName = environmentValue("USER_PROFILE_TABLE_NAME");
const userProfileOwnerIndexName = environmentValue("USER_PROFILE_OWNER_INDEX_NAME");

const dynamoClient = new DynamoDBClient({});

function validateRuntimeConfiguration() {
  if (
    !reportTableName ||
    !publicPassportSnapshotTableName ||
    !publicImageAssetTableName ||
    !equipmentPassportTableName ||
    !userProfileTableName ||
    !userProfileOwnerIndexName
  ) {
    throw new ReportCreationFailure("unknown_error");
  }
}

function isCognitoIdentity(identity: unknown): identity is AppSyncIdentityCognito {
  if (!identity || typeof identity !== "object") {
    return false;
  }

  const candidate = identity as Partial<AppSyncIdentityCognito>;
  return Boolean(
    typeof candidate.sub === "string" &&
      candidate.sub.length > 0 &&
      typeof candidate.username === "string" &&
      candidate.username.length > 0
  );
}

function normalizePersistentId(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim();
  return idPattern.test(normalized) && !nonPersistentIdPattern.test(normalized) ? normalized : "";
}

function normalizeReporterId(value: string) {
  const normalized = value.trim();
  return normalized && normalized.length <= reporterIdMaxLength && !/[\u0000-\u001f\u007f]/.test(normalized)
    ? normalized
    : "";
}

function normalizeReason(value: unknown) {
  return typeof value === "string" && allowedReasons.has(value) ? value : "";
}

function normalizeDetails(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return "";
  }
  // Enforce the public contract against the raw request as well as the
  // normalized value. Otherwise an over-limit string made mostly of stripped
  // controls or collapsed whitespace could become short enough to pass.
  if (typeof value !== "string" || value.length > detailsMaxLength) {
    throw new ReportCreationFailure("invalid_request");
  }

  const normalized = value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length > detailsMaxLength || forbiddenTechnicalContentPattern.test(normalized)) {
    throw new ReportCreationFailure("invalid_request");
  }

  return normalized;
}

function normalizePublicAltText(value: string) {
  const normalized = value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (
    !normalized ||
    normalized !== value ||
    normalized.length > publicAltTextMaxLength ||
    forbiddenTechnicalContentPattern.test(normalized)
  ) {
    return "";
  }

  return normalized;
}

function stringValue(item: DynamoItem, field: string) {
  const value = item[field];
  return value && "S" in value ? value.S : undefined;
}

function booleanValue(item: DynamoItem, field: string) {
  const value = item[field];
  return value && "BOOL" in value ? value.BOOL : undefined;
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
    throw new ReportCreationFailure("image_unavailable");
  }

  const snapshot = {
    id: stringValue(item, "id") ?? "",
    ownerId: stringValue(item, "ownerId") ?? "",
    equipmentPassportId: stringValue(item, "equipmentPassportId") ?? "",
    publicImageAssetId: stringValue(item, "publicImageAssetId") ?? "",
    publicImageKey: stringValue(item, "publicImageKey") ?? "",
    publicImageAltText: stringValue(item, "publicImageAltText") ?? ""
  } satisfies PublicPassportSnapshot;

  if (
    snapshot.id !== expectedId ||
    !snapshot.ownerId ||
    !normalizePersistentId(snapshot.equipmentPassportId) ||
    !publicImageAssetIdPattern.test(snapshot.publicImageAssetId) ||
    !snapshot.publicImageKey ||
    !snapshot.publicImageAltText
  ) {
    throw new ReportCreationFailure("image_unavailable");
  }

  return snapshot;
}

function readPublicImageAsset(item: DynamoItem | undefined, expectedId: string) {
  if (!item) {
    throw new ReportCreationFailure("image_unavailable");
  }

  const asset = {
    id: stringValue(item, "id") ?? "",
    ownerId: stringValue(item, "ownerId") ?? "",
    publicPassportSnapshotId: stringValue(item, "publicPassportSnapshotId") ?? "",
    sourceType: stringValue(item, "sourceType") ?? "",
    sourceRecordId: stringValue(item, "sourceRecordId") ?? "",
    publicImageKey: stringValue(item, "publicImageKey") ?? "",
    publicImageAltText: stringValue(item, "publicImageAltText") ?? "",
    status: stringValue(item, "status") ?? "",
    moderationStatus: stringValue(item, "moderationStatus") ?? ""
  } satisfies PublicImageAsset;

  if (asset.id !== expectedId || !publicImageAssetIdPattern.test(asset.id)) {
    throw new ReportCreationFailure("image_unavailable");
  }

  return asset;
}

function readEquipmentPassport(item: DynamoItem | undefined, expectedId: string) {
  if (!item) {
    throw new ReportCreationFailure("image_unavailable");
  }

  const passport = {
    id: stringValue(item, "id") ?? "",
    ownerId: stringValue(item, "ownerId") ?? "",
    isPublic: booleanValue(item, "isPublic") ?? false
  } satisfies EquipmentPassport;

  if (passport.id !== expectedId) {
    throw new ReportCreationFailure("image_unavailable");
  }

  return passport;
}

async function getPublicProfile(ownerId: string) {
  const result = await dynamoClient.send(
    new QueryCommand({
      TableName: userProfileTableName,
      IndexName: userProfileOwnerIndexName,
      KeyConditionExpression: "#ownerId = :ownerId",
      ExpressionAttributeNames: {
        "#ownerId": "ownerId",
        "#id": "id",
        "#username": "username",
        "#visibility": "accountVisibility"
      },
      ExpressionAttributeValues: { ":ownerId": { S: ownerId } },
      ProjectionExpression: "#id, #ownerId, #username, #visibility",
      Limit: 2
    })
  );

  if (result.Items?.length !== 1) {
    throw new ReportCreationFailure("image_unavailable");
  }

  const profileId = stringValue(result.Items[0], "id") ?? "";
  if (!normalizePersistentId(profileId)) {
    throw new ReportCreationFailure("image_unavailable");
  }

  const item = await getItem(userProfileTableName, profileId, ["id", "ownerId", "username", "accountVisibility"]);
  if (!item) {
    throw new ReportCreationFailure("image_unavailable");
  }

  const profile = {
    id: stringValue(item, "id") ?? "",
    ownerId: stringValue(item, "ownerId") ?? "",
    username: (stringValue(item, "username") ?? "").trim().toLowerCase(),
    accountVisibility: stringValue(item, "accountVisibility") ?? ""
  } satisfies UserProfile;

  if (
    profile.id !== profileId ||
    profile.ownerId !== ownerId ||
    profile.accountVisibility !== "public" ||
    !usernamePattern.test(profile.username)
  ) {
    throw new ReportCreationFailure("image_unavailable");
  }

  return profile;
}

function validateEligibility(
  snapshot: PublicPassportSnapshot,
  asset: PublicImageAsset,
  passport: EquipmentPassport,
  profile: UserProfile
) {
  const expectedPublicKey = `public/passports/${snapshot.id}/cover/${snapshot.publicImageAssetId}.jpg`;

  if (
    asset.ownerId !== snapshot.ownerId ||
    asset.publicPassportSnapshotId !== snapshot.id ||
    asset.sourceType !== "equipment_cover" ||
    asset.sourceRecordId !== snapshot.equipmentPassportId ||
    asset.status !== "ready" ||
    asset.moderationStatus !== "clear" ||
    asset.publicImageKey !== snapshot.publicImageKey ||
    asset.publicImageAltText !== snapshot.publicImageAltText ||
    snapshot.publicImageKey !== expectedPublicKey ||
    !normalizePublicAltText(snapshot.publicImageAltText)
  ) {
    throw new ReportCreationFailure("image_unavailable");
  }

  if (
    passport.ownerId !== snapshot.ownerId ||
    passport.id !== snapshot.equipmentPassportId ||
    !passport.isPublic ||
    profile.ownerId !== snapshot.ownerId ||
    profile.accountVisibility !== "public"
  ) {
    throw new ReportCreationFailure("image_unavailable");
  }
}

function snapshotCondition(snapshot: PublicPassportSnapshot): TransactWriteItem {
  return {
    ConditionCheck: {
      TableName: publicPassportSnapshotTableName,
      Key: { id: { S: snapshot.id } },
      ConditionExpression:
        "#id = :id AND #ownerId = :ownerId AND #sourceId = :sourceId AND #assetId = :assetId AND #publicKey = :publicKey AND #altText = :altText",
      ExpressionAttributeNames: {
        "#id": "id",
        "#ownerId": "ownerId",
        "#sourceId": "equipmentPassportId",
        "#assetId": "publicImageAssetId",
        "#publicKey": "publicImageKey",
        "#altText": "publicImageAltText"
      },
      ExpressionAttributeValues: {
        ":id": { S: snapshot.id },
        ":ownerId": { S: snapshot.ownerId },
        ":sourceId": { S: snapshot.equipmentPassportId },
        ":assetId": { S: snapshot.publicImageAssetId },
        ":publicKey": { S: snapshot.publicImageKey },
        ":altText": { S: snapshot.publicImageAltText }
      }
    }
  };
}

function passportCondition(passport: EquipmentPassport): TransactWriteItem {
  return {
    ConditionCheck: {
      TableName: equipmentPassportTableName,
      Key: { id: { S: passport.id } },
      ConditionExpression: "#id = :id AND #ownerId = :ownerId AND #isPublic = :isPublic",
      ExpressionAttributeNames: { "#id": "id", "#ownerId": "ownerId", "#isPublic": "isPublic" },
      ExpressionAttributeValues: {
        ":id": { S: passport.id },
        ":ownerId": { S: passport.ownerId },
        ":isPublic": { BOOL: true }
      }
    }
  };
}

function profileCondition(profile: UserProfile): TransactWriteItem {
  return {
    ConditionCheck: {
      TableName: userProfileTableName,
      Key: { id: { S: profile.id } },
      ConditionExpression: "#id = :id AND #ownerId = :ownerId AND #username = :username AND #visibility = :visibility",
      ExpressionAttributeNames: {
        "#id": "id",
        "#ownerId": "ownerId",
        "#username": "username",
        "#visibility": "accountVisibility"
      },
      ExpressionAttributeValues: {
        ":id": { S: profile.id },
        ":ownerId": { S: profile.ownerId },
        ":username": { S: profile.username },
        ":visibility": { S: "public" }
      }
    }
  };
}

function assetReportTimestampUpdate(asset: PublicImageAsset, now: string): TransactWriteItem {
  return {
    Update: {
      TableName: publicImageAssetTableName,
      Key: { id: { S: asset.id } },
      UpdateExpression: "SET #lastReportAt = :now, #updatedAt = :now",
      ConditionExpression:
        "#id = :id AND #ownerId = :ownerId AND #snapshotId = :snapshotId AND #sourceType = :sourceType AND #sourceId = :sourceId AND #publicKey = :publicKey AND #altText = :altText AND #status = :ready AND #moderationStatus = :clear",
      ExpressionAttributeNames: {
        "#id": "id",
        "#ownerId": "ownerId",
        "#snapshotId": "publicPassportSnapshotId",
        "#sourceType": "sourceType",
        "#sourceId": "sourceRecordId",
        "#publicKey": "publicImageKey",
        "#altText": "publicImageAltText",
        "#status": "status",
        "#moderationStatus": "moderationStatus",
        "#lastReportAt": "lastReportAt",
        "#updatedAt": "updatedAt"
      },
      ExpressionAttributeValues: {
        ":id": { S: asset.id },
        ":ownerId": { S: asset.ownerId },
        ":snapshotId": { S: asset.publicPassportSnapshotId },
        ":sourceType": { S: "equipment_cover" },
        ":sourceId": { S: asset.sourceRecordId },
        ":publicKey": { S: asset.publicImageKey },
        ":altText": { S: asset.publicImageAltText },
        ":ready": { S: "ready" },
        ":clear": { S: "clear" },
        ":now": { S: now }
      }
    }
  };
}

function reportPut(
  reportId: string,
  reporterId: string,
  snapshotId: string,
  publicImageAssetId: string,
  reason: string,
  details: string,
  now: string
): TransactWriteItem {
  return {
    Put: {
      TableName: reportTableName,
      Item: {
        id: { S: reportId },
        reporterId: { S: reporterId },
        targetType: { S: "public_image" },
        targetId: { S: snapshotId },
        publicImageAssetId: { S: publicImageAssetId },
        reason: { S: reason },
        ...(details ? { details: { S: details } } : {}),
        status: { S: "open" },
        createdAt: { S: now },
        updatedAt: { S: now }
      },
      ConditionExpression: "attribute_not_exists(#id)",
      ExpressionAttributeNames: { "#id": "id" }
    }
  };
}

function isStateChangeError(error: unknown) {
  const name = (error as { name?: unknown }).name;
  return name === "TransactionCanceledException" || name === "ConditionalCheckFailedException";
}

async function createBoundReport(
  reporterId: string,
  snapshot: PublicPassportSnapshot,
  asset: PublicImageAsset,
  passport: EquipmentPassport,
  profile: UserProfile,
  reason: string,
  details: string
) {
  const now = new Date().toISOString();
  const reportId = randomUUID();

  try {
    await dynamoClient.send(
      new TransactWriteItemsCommand({
        TransactItems: [
          snapshotCondition(snapshot),
          passportCondition(passport),
          profileCondition(profile),
          assetReportTimestampUpdate(asset, now),
          reportPut(reportId, reporterId, snapshot.id, asset.id, reason, details, now)
        ]
      })
    );
  } catch (error) {
    throw new ReportCreationFailure(isStateChangeError(error) ? "state_changed" : "unknown_error");
  }
}

function response(
  submissionStatus: SubmissionStatus,
  failureCode?: FailureCode
): Schema["createPublicImageReport"]["returnType"] {
  return { submissionStatus, failureCode };
}

export const handler: Schema["createPublicImageReport"]["functionHandler"] = async (event) => {
  try {
    validateRuntimeConfiguration();
    const identity = event.identity;
    const snapshotId = normalizePersistentId(event.arguments.publicPassportSnapshotId);
    const reason = normalizeReason(event.arguments.reason);
    const details = normalizeDetails(event.arguments.details);

    if (!isCognitoIdentity(identity)) {
      throw new ReportCreationFailure("unauthorized");
    }

    const reporterId = normalizeReporterId(identity.username);
    if (!snapshotId || !reason || !reporterId) {
      throw new ReportCreationFailure("invalid_request");
    }

    const snapshot = readSnapshot(
      await getItem(publicPassportSnapshotTableName, snapshotId, [
        "id",
        "ownerId",
        "equipmentPassportId",
        "publicImageAssetId",
        "publicImageKey",
        "publicImageAltText"
      ]),
      snapshotId
    );

    const [assetItem, passportItem, profile] = await Promise.all([
      getItem(publicImageAssetTableName, snapshot.publicImageAssetId, [
        "id",
        "ownerId",
        "publicPassportSnapshotId",
        "sourceType",
        "sourceRecordId",
        "publicImageKey",
        "publicImageAltText",
        "status",
        "moderationStatus"
      ]),
      getItem(equipmentPassportTableName, snapshot.equipmentPassportId, ["id", "ownerId", "isPublic"]),
      getPublicProfile(snapshot.ownerId)
    ]);
    const asset = readPublicImageAsset(assetItem, snapshot.publicImageAssetId);
    const passport = readEquipmentPassport(passportItem, snapshot.equipmentPassportId);

    validateEligibility(snapshot, asset, passport, profile);
    await createBoundReport(reporterId, snapshot, asset, passport, profile, reason, details);

    console.info(JSON.stringify({ event: "public_image_report_submitted", submissionStatus: "submitted" }));
    return response("submitted");
  } catch (error) {
    const failureCode = error instanceof ReportCreationFailure ? error.code : "unknown_error";
    console.warn(JSON.stringify({ event: "public_image_report_failed", failureCode }));
    return response("failed", failureCode);
  }
};
