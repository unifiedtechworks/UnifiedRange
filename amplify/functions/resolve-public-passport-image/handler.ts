import { DynamoDBClient, GetItemCommand, QueryCommand, type AttributeValue } from "@aws-sdk/client-dynamodb";
import { GetObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Schema } from "../../data/resource.ts";

const urlExpiresInSeconds = 60;
const responseCacheSeconds = 0;
const derivativeMaxBytes = 2 * 1024 * 1024;
const publicAltTextMaxLength = 140;
const idPattern = /^[a-z0-9][a-z0-9_-]{0,127}$/i;
const publicImageAssetIdPattern = /^img-[0-9a-f]{40}$/;
const usernamePattern = /^[a-z0-9_-]{3,24}$/;
const nonPersistentIdPattern = /^(?:(?:demo|sample)(?:[-_]|$)|(?:passport|session|target-photo)-\d+$)/i;
const urlPattern = /(?:\b[a-z][a-z0-9+.-]*:\/\/|\bwww\.|\b(?:data|blob):)/i;
const storagePathPattern = /\b(?:private[\\/](?:equipment|targets)|public[\\/]passports)[\\/]/i;

type DynamoItem = Record<string, AttributeValue>;
type DeliveryUnavailableCode =
  | "invalid_request"
  | "snapshot_unavailable"
  | "projection_unavailable"
  | "asset_unavailable"
  | "source_unavailable"
  | "profile_unavailable"
  | "object_unavailable"
  | "signing_unavailable"
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

class DeliveryUnavailable extends Error {
  constructor(readonly code: DeliveryUnavailableCode) {
    super(code);
    this.name = "DeliveryUnavailable";
  }
}

function requiredEnvironment(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment configuration: ${name}`);
  }

  return value;
}

const publicPassportSnapshotTableName = requiredEnvironment("PUBLIC_PASSPORT_SNAPSHOT_TABLE_NAME");
const publicImageAssetTableName = requiredEnvironment("PUBLIC_IMAGE_ASSET_TABLE_NAME");
const equipmentPassportTableName = requiredEnvironment("EQUIPMENT_PASSPORT_TABLE_NAME");
const userProfileTableName = requiredEnvironment("USER_PROFILE_TABLE_NAME");
const userProfileOwnerIndexName = requiredEnvironment("USER_PROFILE_OWNER_INDEX_NAME");
const imageBucketName = requiredEnvironment("unifiedRangePrivateImages_BUCKET_NAME");

const dynamoClient = new DynamoDBClient({});
const s3Client = new S3Client({});

function stringValue(item: DynamoItem, field: string) {
  const value = item[field];
  return value && "S" in value ? value.S : undefined;
}

function booleanValue(item: DynamoItem, field: string) {
  const value = item[field];
  return value && "BOOL" in value ? value.BOOL : undefined;
}

function normalizePersistentId(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim();
  return idPattern.test(normalized) && !nonPersistentIdPattern.test(normalized) ? normalized : "";
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
    urlPattern.test(normalized) ||
    storagePathPattern.test(normalized)
  ) {
    return "";
  }

  return normalized;
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
    throw new DeliveryUnavailable("snapshot_unavailable");
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
    throw new DeliveryUnavailable("projection_unavailable");
  }

  return snapshot;
}

function readPublicImageAsset(item: DynamoItem | undefined, expectedId: string) {
  if (!item) {
    throw new DeliveryUnavailable("asset_unavailable");
  }

  const asset = {
    id: stringValue(item, "id") ?? "",
    ownerId: stringValue(item, "ownerId") ?? "",
    publicPassportSnapshotId: stringValue(item, "publicPassportSnapshotId") ?? "",
    sourceType: stringValue(item, "sourceType") ?? "",
    sourceRecordId: stringValue(item, "sourceRecordId") ?? "",
    publicImageKey: stringValue(item, "publicImageKey") ?? "",
    publicImageAltText: stringValue(item, "publicImageAltText") ?? "",
    status: stringValue(item, "status") ?? ""
  } satisfies PublicImageAsset;

  if (asset.id !== expectedId) {
    throw new DeliveryUnavailable("asset_unavailable");
  }

  return asset;
}

function readEquipmentPassport(item: DynamoItem | undefined, expectedId: string) {
  if (!item) {
    throw new DeliveryUnavailable("source_unavailable");
  }

  const passport = {
    id: stringValue(item, "id") ?? "",
    ownerId: stringValue(item, "ownerId") ?? "",
    isPublic: booleanValue(item, "isPublic") ?? false
  } satisfies EquipmentPassport;

  if (passport.id !== expectedId) {
    throw new DeliveryUnavailable("source_unavailable");
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
    throw new DeliveryUnavailable("profile_unavailable");
  }

  const profileId = stringValue(result.Items[0], "id") ?? "";
  if (!normalizePersistentId(profileId)) {
    throw new DeliveryUnavailable("profile_unavailable");
  }

  // Global secondary index reads are eventually consistent. Re-read the
  // resolved profile by primary key so a recent privacy change fails closed.
  const item = await getItem(userProfileTableName, profileId, ["id", "ownerId", "username", "accountVisibility"]);
  if (!item) {
    throw new DeliveryUnavailable("profile_unavailable");
  }

  const profile = {
    id: stringValue(item, "id") ?? "",
    ownerId: stringValue(item, "ownerId") ?? "",
    username: (stringValue(item, "username") ?? "").trim().toLowerCase(),
    accountVisibility: stringValue(item, "accountVisibility") ?? ""
  } satisfies UserProfile;

  if (!profile.id || profile.ownerId !== ownerId || profile.accountVisibility !== "public" || !usernamePattern.test(profile.username)) {
    throw new DeliveryUnavailable("profile_unavailable");
  }

  return profile;
}

function validateEligibility(
  snapshot: PublicPassportSnapshot,
  asset: PublicImageAsset,
  passport: EquipmentPassport,
  safeAltText: string
) {
  const expectedPublicKey = `public/passports/${snapshot.id}/cover/${snapshot.publicImageAssetId}.jpg`;

  if (
    asset.ownerId !== snapshot.ownerId ||
    asset.publicPassportSnapshotId !== snapshot.id ||
    asset.sourceType !== "equipment_cover" ||
    asset.sourceRecordId !== snapshot.equipmentPassportId ||
    asset.status !== "ready" ||
    asset.publicImageKey !== snapshot.publicImageKey ||
    asset.publicImageAltText !== snapshot.publicImageAltText ||
    snapshot.publicImageKey !== expectedPublicKey ||
    !safeAltText
  ) {
    throw new DeliveryUnavailable("asset_unavailable");
  }

  if (passport.ownerId !== snapshot.ownerId || passport.id !== snapshot.equipmentPassportId || !passport.isPublic) {
    throw new DeliveryUnavailable("source_unavailable");
  }
}

async function validateDerivativeObject(publicImageKey: string) {
  try {
    const result = await s3Client.send(new HeadObjectCommand({ Bucket: imageBucketName, Key: publicImageKey }));
    const contentType = result.ContentType?.split(";", 1)[0]?.trim().toLowerCase();
    const contentLength = result.ContentLength ?? 0;

    if (contentType !== "image/jpeg" || contentLength <= 0 || contentLength > derivativeMaxBytes) {
      throw new DeliveryUnavailable("object_unavailable");
    }
  } catch (error) {
    if (error instanceof DeliveryUnavailable) {
      throw error;
    }
    throw new DeliveryUnavailable("object_unavailable");
  }
}

function unavailableResponse(): Schema["resolvePublicPassportImage"]["returnType"] {
  return {
    status: "unavailable",
    cacheSeconds: responseCacheSeconds,
    failureCode: "unavailable"
  };
}

export const handler: Schema["resolvePublicPassportImage"]["functionHandler"] = async (event) => {
  try {
    const snapshotId = normalizePersistentId(event.arguments.publicPassportSnapshotId);
    if (!snapshotId) {
      throw new DeliveryUnavailable("invalid_request");
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
    const safeAltText = normalizePublicAltText(snapshot.publicImageAltText);
    const [assetItem, passportItem] = await Promise.all([
      getItem(publicImageAssetTableName, snapshot.publicImageAssetId, [
        "id",
        "ownerId",
        "publicPassportSnapshotId",
        "sourceType",
        "sourceRecordId",
        "publicImageKey",
        "publicImageAltText",
        "status"
      ]),
      getItem(equipmentPassportTableName, snapshot.equipmentPassportId, ["id", "ownerId", "isPublic"]),
      getPublicProfile(snapshot.ownerId)
    ]);
    const asset = readPublicImageAsset(assetItem, snapshot.publicImageAssetId);
    const passport = readEquipmentPassport(passportItem, snapshot.equipmentPassportId);

    validateEligibility(snapshot, asset, passport, safeAltText);
    await validateDerivativeObject(snapshot.publicImageKey);

    const signedAt = Date.now();
    let imageUrl: string;
    try {
      imageUrl = await getSignedUrl(
        s3Client,
        new GetObjectCommand({
          Bucket: imageBucketName,
          Key: snapshot.publicImageKey,
          ResponseContentType: "image/jpeg",
          ResponseContentDisposition: "inline",
          ResponseCacheControl: "private, no-store, max-age=0"
        }),
        { expiresIn: urlExpiresInSeconds }
      );
    } catch {
      throw new DeliveryUnavailable("signing_unavailable");
    }

    const expiresAt = new Date(signedAt + urlExpiresInSeconds * 1_000).toISOString();
    console.info(
      JSON.stringify({
        event: "public_image_delivery_available",
        expiresInSeconds: urlExpiresInSeconds,
        cacheSeconds: responseCacheSeconds
      })
    );

    return {
      status: "available",
      imageUrl,
      altText: safeAltText,
      expiresAt,
      cacheSeconds: responseCacheSeconds
    };
  } catch (error) {
    const failureCode = error instanceof DeliveryUnavailable ? error.code : "unknown_error";
    console.warn(JSON.stringify({ event: "public_image_delivery_unavailable", failureCode }));
    return unavailableResponse();
  }
};
