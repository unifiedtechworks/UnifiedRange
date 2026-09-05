import { createHash } from "node:crypto";
import {
  DynamoDBClient,
  GetItemCommand,
  QueryCommand,
  TransactWriteItemsCommand,
  UpdateItemCommand,
  type AttributeValue
} from "@aws-sdk/client-dynamodb";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { AppSyncIdentityCognito } from "aws-lambda";
import { decode as decodeJpeg } from "jpeg-js";
import { Image, decodePng, encodeJpeg } from "image-js";
import type { Schema } from "../../data/resource.ts";

const sourceMaxBytes = 6 * 1024 * 1024;
const sourceMaxPixels = 12_000_000;
const sourceMaxDimension = 8_192;
const derivativeMaxBytes = 2 * 1024 * 1024;
const derivativeMaxDimension = 1_600;
const idPattern = /^[a-z0-9][a-z0-9_-]{0,127}$/i;
const usernamePattern = /^[a-z0-9_-]{3,24}$/;
const storageIdentityPattern = /^[a-z0-9:_-]{3,160}$/i;
const generatedFileNamePattern = /^\d{10,15}-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpe?g|png|webp)$/i;
const nonPersistentIdPattern = /^(?:(?:demo|sample)(?:[-_]|$)|(?:passport|session|target-photo)-\d+$)/i;
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const jpegStartOfFrameMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
const forbiddenJpegMetadataMarkers = new Set([0xe1, 0xe2, 0xed, 0xfe]);

type DynamoItem = Record<string, AttributeValue>;
type ProcessingStatus = "processing" | "ready" | "failed";
type FailureCode =
  | "unauthorized"
  | "invalid_request"
  | "invalid_alt_text"
  | "consent_required"
  | "candidate_not_verified"
  | "unsupported_source"
  | "source_not_found"
  | "source_mismatch"
  | "profile_not_public"
  | "username_unresolved"
  | "invalid_storage_key"
  | "object_not_found"
  | "unsupported_content_type"
  | "file_too_large"
  | "metadata_mismatch"
  | "invalid_image"
  | "animated_image"
  | "dimensions_exceeded"
  | "output_too_large"
  | "storage_write_failed"
  | "state_changed"
  | "unknown_error";

type PrivateImageAsset = {
  id: string;
  ownerId: string;
  ownerSub: string;
  sourceType: string;
  sourceRecordId: string;
  storageKey: string;
  storageIdentityId: string;
  sanitizedFileName: string;
  contentType: string;
  sizeBytes: number;
  bindingStatus: string;
};

type PublicPassportSnapshot = {
  id: string;
  ownerId: string;
  equipmentPassportId: string;
  publicImageAssetId?: string;
  publicImageKey?: string;
  publicImageAltText?: string;
  updatedAt?: string;
};

type EquipmentPassport = {
  id: string;
  ownerId: string;
  privateCoverPhotoKey: string;
  isPublic: boolean;
};

type UserProfile = {
  id: string;
  ownerId: string;
  username: string;
  accountVisibility: string;
};

type PublicImageAsset = {
  id: string;
  ownerId: string;
  publicPassportSnapshotId: string;
  privateImageAssetId: string;
  sourceType: string;
  sourceRecordId: string;
  publicImageKey?: string;
  publicImageAltText?: string;
  status: string;
};

type ImageHeader = {
  format: "jpeg" | "png";
  width: number;
  height: number;
  orientation: number;
};

class ProcessingFailure extends Error {
  constructor(readonly code: FailureCode) {
    super(code);
    this.name = "ProcessingFailure";
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
const publicPassportSnapshotTableName = requiredEnvironment("PUBLIC_PASSPORT_SNAPSHOT_TABLE_NAME");
const publicImageAssetTableName = requiredEnvironment("PUBLIC_IMAGE_ASSET_TABLE_NAME");
const userProfileTableName = requiredEnvironment("USER_PROFILE_TABLE_NAME");
const usernameReservationTableName = requiredEnvironment("USERNAME_RESERVATION_TABLE_NAME");
const userProfileOwnerIndexName = requiredEnvironment("USER_PROFILE_OWNER_INDEX_NAME");
const imageBucketName = requiredEnvironment("unifiedRangePrivateImages_BUCKET_NAME");

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

function booleanValue(item: DynamoItem, field: string) {
  const value = item[field];
  return value && "BOOL" in value ? value.BOOL : undefined;
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

function normalizeId(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim();
  return idPattern.test(normalized) && !nonPersistentIdPattern.test(normalized) ? normalized : "";
}

function normalizeContentType(value?: string) {
  return value?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

function isObjectUnavailableError(error: unknown) {
  const statusCode = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
  const errorName = (error as { name?: string }).name;
  // S3 may return 403 rather than 404 for a missing object when the role has
  // object access but intentionally lacks bucket-list permission. Do not turn
  // that distinction into a key-existence oracle.
  return statusCode === 403 || statusCode === 404 || errorName === "AccessDenied" || errorName === "NotFound" || errorName === "NoSuchKey";
}

function sanitizeAltText(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string" || value.length > 1_000) {
    throw new ProcessingFailure("invalid_alt_text");
  }

  const normalized = value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized || normalized.length > 200) {
    throw new ProcessingFailure("invalid_alt_text");
  }

  return normalized;
}

function sanitizePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").slice(0, 80);
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

function readPrivateImageAsset(item: DynamoItem | undefined, expectedId: string) {
  if (!item) return null;

  const asset: PrivateImageAsset = {
    id: stringValue(item, "id") ?? "",
    ownerId: stringValue(item, "ownerId") ?? "",
    ownerSub: stringValue(item, "ownerSub") ?? "",
    sourceType: stringValue(item, "sourceType") ?? "",
    sourceRecordId: stringValue(item, "sourceRecordId") ?? "",
    storageKey: stringValue(item, "storageKey") ?? "",
    storageIdentityId: stringValue(item, "storageIdentityId") ?? "",
    sanitizedFileName: stringValue(item, "sanitizedFileName") ?? "",
    contentType: stringValue(item, "contentType") ?? "",
    sizeBytes: numberValue(item, "sizeBytes") ?? Number.NaN,
    bindingStatus: stringValue(item, "bindingStatus") ?? ""
  };

  if (asset.id !== expectedId) {
    throw new ProcessingFailure("metadata_mismatch");
  }

  return asset;
}

function readSnapshot(item: DynamoItem | undefined, expectedId: string) {
  if (!item) return null;

  const snapshot: PublicPassportSnapshot = {
    id: stringValue(item, "id") ?? "",
    ownerId: stringValue(item, "ownerId") ?? "",
    equipmentPassportId: stringValue(item, "equipmentPassportId") ?? "",
    publicImageAssetId: stringValue(item, "publicImageAssetId"),
    publicImageKey: stringValue(item, "publicImageKey"),
    publicImageAltText: stringValue(item, "publicImageAltText"),
    updatedAt: stringValue(item, "updatedAt")
  };

  if (snapshot.id !== expectedId) {
    throw new ProcessingFailure("metadata_mismatch");
  }

  return snapshot;
}

function readEquipmentPassport(item: DynamoItem | undefined, expectedId: string) {
  if (!item) return null;

  const passport: EquipmentPassport = {
    id: stringValue(item, "id") ?? "",
    ownerId: stringValue(item, "ownerId") ?? "",
    privateCoverPhotoKey: stringValue(item, "privateCoverPhotoKey") ?? "",
    isPublic: booleanValue(item, "isPublic") === true
  };

  if (passport.id !== expectedId) {
    throw new ProcessingFailure("metadata_mismatch");
  }

  return passport;
}

function readUserProfile(item: DynamoItem) {
  return {
    id: stringValue(item, "id") ?? "",
    ownerId: stringValue(item, "ownerId") ?? "",
    username: stringValue(item, "username") ?? "",
    accountVisibility: stringValue(item, "accountVisibility") ?? ""
  } satisfies UserProfile;
}

function readPublicImageAsset(item: DynamoItem | undefined, expectedId: string) {
  if (!item) return null;

  const asset: PublicImageAsset = {
    id: stringValue(item, "id") ?? "",
    ownerId: stringValue(item, "ownerId") ?? "",
    publicPassportSnapshotId: stringValue(item, "publicPassportSnapshotId") ?? "",
    privateImageAssetId: stringValue(item, "privateImageAssetId") ?? "",
    sourceType: stringValue(item, "sourceType") ?? "",
    sourceRecordId: stringValue(item, "sourceRecordId") ?? "",
    publicImageKey: stringValue(item, "publicImageKey"),
    publicImageAltText: stringValue(item, "publicImageAltText"),
    status: stringValue(item, "status") ?? ""
  };

  if (asset.id !== expectedId) {
    throw new ProcessingFailure("metadata_mismatch");
  }

  return asset;
}

async function findOwnedUserProfile(ownerAliases: string[]) {
  const profiles = new Map<string, UserProfile>();

  for (const ownerId of [...new Set(ownerAliases)]) {
    const result = await dynamoClient.send(
      new QueryCommand({
        TableName: userProfileTableName,
        IndexName: userProfileOwnerIndexName,
        KeyConditionExpression: "#ownerId = :ownerId",
        ExpressionAttributeNames: { "#ownerId": "ownerId", "#id": "id", "#username": "username", "#visibility": "accountVisibility" },
        ExpressionAttributeValues: { ":ownerId": { S: ownerId } },
        ProjectionExpression: "#id, #ownerId, #username, #visibility",
        Limit: 2
      })
    );

    for (const item of result.Items ?? []) {
      const profile = readUserProfile(item);
      if (profile.id) profiles.set(profile.id, profile);
    }
  }

  if (profiles.size !== 1) {
    throw new ProcessingFailure("profile_not_public");
  }

  return [...profiles.values()][0];
}

function validatePrivateCandidate(asset: PrivateImageAsset, identity: AppSyncIdentityCognito) {
  const callerAliases = new Set([identity.username, identity.sub]);

  if (!asset.ownerId || !callerAliases.has(asset.ownerId) || asset.ownerSub !== identity.sub) {
    throw new ProcessingFailure("unauthorized");
  }

  if (asset.bindingStatus !== "verified") {
    throw new ProcessingFailure("candidate_not_verified");
  }

  if (asset.sourceType !== "equipment_cover") {
    throw new ProcessingFailure("unsupported_source");
  }

  if (!normalizeId(asset.sourceRecordId) || !asset.storageKey || !asset.sanitizedFileName) {
    throw new ProcessingFailure("metadata_mismatch");
  }

  const contentType = normalizeContentType(asset.contentType);
  if (contentType !== "image/jpeg" && contentType !== "image/png") {
    throw new ProcessingFailure("unsupported_content_type");
  }

  if (!Number.isFinite(asset.sizeBytes) || asset.sizeBytes <= 0) {
    throw new ProcessingFailure("metadata_mismatch");
  }

  if (asset.sizeBytes > sourceMaxBytes) {
    throw new ProcessingFailure("file_too_large");
  }

  const parts = asset.storageKey.split("/");
  if (
    parts.length !== 5 ||
    parts[0] !== "private" ||
    parts[1] !== "equipment" ||
    !storageIdentityPattern.test(asset.storageIdentityId) ||
    parts[2] !== asset.storageIdentityId ||
    parts[3] !== sanitizePathSegment(asset.sourceRecordId) ||
    parts[4] !== asset.sanitizedFileName ||
    !generatedFileNamePattern.test(asset.sanitizedFileName)
  ) {
    throw new ProcessingFailure("invalid_storage_key");
  }
}

function validateOwnershipGraph({
  asset,
  snapshot,
  passport,
  profile,
  reservationOwnerId
}: {
  asset: PrivateImageAsset;
  snapshot: PublicPassportSnapshot;
  passport: EquipmentPassport;
  profile: UserProfile;
  reservationOwnerId: string;
}) {
  const ownerAliases = new Set([asset.ownerId, asset.ownerSub]);

  if (!ownerAliases.has(snapshot.ownerId) || !ownerAliases.has(passport.ownerId) || !ownerAliases.has(profile.ownerId)) {
    throw new ProcessingFailure("source_mismatch");
  }

  if (
    snapshot.equipmentPassportId !== asset.sourceRecordId ||
    passport.id !== asset.sourceRecordId ||
    passport.privateCoverPhotoKey !== asset.storageKey ||
    !passport.isPublic
  ) {
    throw new ProcessingFailure("source_mismatch");
  }

  if (profile.accountVisibility !== "public") {
    throw new ProcessingFailure("profile_not_public");
  }

  const username = profile.username.trim().toLowerCase();
  if (!usernamePattern.test(username) || !ownerAliases.has(reservationOwnerId)) {
    throw new ProcessingFailure("username_unresolved");
  }
}

async function readPrivateSourceObject(asset: PrivateImageAsset) {
  let head;

  try {
    head = await s3Client.send(new HeadObjectCommand({ Bucket: imageBucketName, Key: asset.storageKey }));
  } catch (error) {
    if (isObjectUnavailableError(error)) {
      throw new ProcessingFailure("object_not_found");
    }
    throw new ProcessingFailure("unknown_error");
  }

  const headContentType = normalizeContentType(head.ContentType);
  if (headContentType !== normalizeContentType(asset.contentType)) {
    throw new ProcessingFailure("metadata_mismatch");
  }

  if (!head.ContentLength || head.ContentLength !== asset.sizeBytes) {
    throw new ProcessingFailure("metadata_mismatch");
  }

  if (head.ContentLength > sourceMaxBytes) {
    throw new ProcessingFailure("file_too_large");
  }

  if (!head.ETag) {
    throw new ProcessingFailure("metadata_mismatch");
  }

  let object;
  try {
    object = await s3Client.send(
      new GetObjectCommand({
        Bucket: imageBucketName,
        Key: asset.storageKey,
        IfMatch: head.ETag,
        Range: `bytes=0-${sourceMaxBytes}`
      })
    );
  } catch (error) {
    const statusCode = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (isObjectUnavailableError(error)) {
      throw new ProcessingFailure("object_not_found");
    }
    if (statusCode === 412 || (error as { name?: string }).name === "PreconditionFailed") {
      throw new ProcessingFailure("state_changed");
    }
    throw new ProcessingFailure("unknown_error");
  }

  if (!object.Body) {
    throw new ProcessingFailure("object_not_found");
  }

  const bytes = Buffer.from(await object.Body.transformToByteArray());
  if (bytes.length !== asset.sizeBytes || bytes.length > sourceMaxBytes || object.ETag !== head.ETag) {
    throw new ProcessingFailure("metadata_mismatch");
  }

  if (normalizeContentType(object.ContentType) !== normalizeContentType(asset.contentType)) {
    throw new ProcessingFailure("metadata_mismatch");
  }

  return bytes;
}

function readExifOrientation(buffer: Buffer, start: number, end: number) {
  if (end - start < 14 || buffer.toString("ascii", start, start + 6) !== "Exif\0\0") return 1;
  const tiffStart = start + 6;
  const littleEndian = buffer.toString("ascii", tiffStart, tiffStart + 2) === "II";
  const bigEndian = buffer.toString("ascii", tiffStart, tiffStart + 2) === "MM";
  if (!littleEndian && !bigEndian) return 1;

  const readUInt16 = (offset: number) => (littleEndian ? buffer.readUInt16LE(offset) : buffer.readUInt16BE(offset));
  const readUInt32 = (offset: number) => (littleEndian ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset));

  if (readUInt16(tiffStart + 2) !== 42) return 1;
  const ifdOffset = readUInt32(tiffStart + 4);
  const ifdStart = tiffStart + ifdOffset;
  if (ifdStart < tiffStart || ifdStart + 2 > end) return 1;

  const entryCount = readUInt16(ifdStart);
  if (entryCount > 256 || ifdStart + 2 + entryCount * 12 > end) return 1;

  for (let index = 0; index < entryCount; index += 1) {
    const entry = ifdStart + 2 + index * 12;
    if (readUInt16(entry) === 0x0112 && readUInt16(entry + 2) === 3 && readUInt32(entry + 4) >= 1) {
      const orientation = readUInt16(entry + 8);
      return orientation >= 1 && orientation <= 8 ? orientation : 1;
    }
  }

  return 1;
}

function parseJpegHeader(buffer: Buffer, rejectMetadata = false): ImageHeader {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer.at(-2) !== 0xff || buffer.at(-1) !== 0xd9) {
    throw new ProcessingFailure("invalid_image");
  }

  let offset = 2;
  let width = 0;
  let height = 0;
  let orientation = 1;

  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) throw new ProcessingFailure("invalid_image");
    while (buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset++];

    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > buffer.length) throw new ProcessingFailure("invalid_image");

    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) throw new ProcessingFailure("invalid_image");
    const segmentStart = offset + 2;
    const segmentEnd = offset + segmentLength;

    if (rejectMetadata && forbiddenJpegMetadataMarkers.has(marker)) {
      throw new ProcessingFailure("metadata_mismatch");
    }

    if (marker === 0xe1) {
      try {
        orientation = readExifOrientation(buffer, segmentStart, segmentEnd);
      } catch {
        throw new ProcessingFailure("invalid_image");
      }
    }
    if (jpegStartOfFrameMarkers.has(marker)) {
      if (segmentEnd - segmentStart < 6) throw new ProcessingFailure("invalid_image");
      height = buffer.readUInt16BE(segmentStart + 1);
      width = buffer.readUInt16BE(segmentStart + 3);
    }

    offset = segmentEnd;
  }

  validateDimensions(width, height);
  return { format: "jpeg", width, height, orientation };
}

function parsePngHeader(buffer: Buffer): ImageHeader {
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(pngSignature)) {
    throw new ProcessingFailure("invalid_image");
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let sawHeader = false;
  let sawEnd = false;

  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const chunkEnd = offset + 12 + length;
    if (chunkEnd > buffer.length) throw new ProcessingFailure("invalid_image");

    if (!sawHeader) {
      if (type !== "IHDR" || length !== 13) throw new ProcessingFailure("invalid_image");
      width = buffer.readUInt32BE(offset + 8);
      height = buffer.readUInt32BE(offset + 12);
      sawHeader = true;
    }

    if (type === "acTL") throw new ProcessingFailure("animated_image");
    if (type === "IEND") {
      if (length !== 0 || chunkEnd !== buffer.length) throw new ProcessingFailure("invalid_image");
      sawEnd = true;
      break;
    }

    offset = chunkEnd;
  }

  if (!sawEnd) throw new ProcessingFailure("invalid_image");
  validateDimensions(width, height);
  return { format: "png", width, height, orientation: 1 };
}

function validateDimensions(width: number, height: number) {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    width > sourceMaxDimension ||
    height > sourceMaxDimension ||
    width * height > sourceMaxPixels
  ) {
    throw new ProcessingFailure("dimensions_exceeded");
  }
}

function inspectSourceImage(buffer: Buffer, contentType: string) {
  if (contentType === "image/jpeg") return parseJpegHeader(buffer);
  if (contentType === "image/png") return parsePngHeader(buffer);
  throw new ProcessingFailure("unsupported_content_type");
}

function applyOrientation(image: Image, orientation: number) {
  switch (orientation) {
    case 2:
      return image.flip({ axis: "horizontal" });
    case 3:
      return image.rotate(180);
    case 4:
      return image.flip({ axis: "vertical" });
    case 5:
      return image.flip({ axis: "horizontal" }).rotate(270);
    case 6:
      return image.rotate(90);
    case 7:
      return image.flip({ axis: "horizontal" }).rotate(90);
    case 8:
      return image.rotate(270);
    default:
      return image;
  }
}

function flattenOnWhite(image: Image) {
  const rgba = image.convertColor("RGBA").convertBitDepth(8);
  const source = rgba.getRawImage().data;
  const output = new Uint8Array(source.length);

  for (let offset = 0; offset < source.length; offset += 4) {
    const alpha = source[offset + 3] / 255;
    output[offset] = Math.round(source[offset] * alpha + 255 * (1 - alpha));
    output[offset + 1] = Math.round(source[offset + 1] * alpha + 255 * (1 - alpha));
    output[offset + 2] = Math.round(source[offset + 2] * alpha + 255 * (1 - alpha));
    output[offset + 3] = 255;
  }

  return new Image(rgba.width, rgba.height, { data: output, colorModel: "RGBA", bitDepth: 8 });
}

function decodeSourceImage(buffer: Buffer, header: ImageHeader) {
  let image: Image;

  try {
    if (header.format === "jpeg") {
      const decoded = decodeJpeg(buffer, {
        useTArray: true,
        formatAsRGBA: true,
        tolerantDecoding: false,
        maxResolutionInMP: 12,
        maxMemoryUsageInMB: 256
      });
      image = new Image(decoded.width, decoded.height, { data: decoded.data, colorModel: "RGBA", bitDepth: 8 });
    } else {
      image = decodePng(buffer);
    }
  } catch (error) {
    if (error instanceof ProcessingFailure) throw error;
    throw new ProcessingFailure("invalid_image");
  }

  if (image.width !== header.width || image.height !== header.height) {
    throw new ProcessingFailure("metadata_mismatch");
  }

  return flattenOnWhite(applyOrientation(image, header.orientation));
}

function createDerivative(source: Image) {
  const attempts = [
    { maxDimension: derivativeMaxDimension, quality: 82 },
    { maxDimension: derivativeMaxDimension, quality: 72 },
    { maxDimension: 1_280, quality: 72 },
    { maxDimension: 1_024, quality: 70 }
  ];

  for (const attempt of attempts) {
    const scale = Math.min(1, attempt.maxDimension / Math.max(source.width, source.height));
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));
    const resized = width === source.width && height === source.height ? source : source.resize({ width, height, preserveAspectRatio: false });
    const output = Buffer.from(encodeJpeg(resized, { quality: attempt.quality }));

    if (output.length <= derivativeMaxBytes) {
      const outputHeader = parseJpegHeader(output, true);
      if (outputHeader.width !== width || outputHeader.height !== height || Math.max(width, height) > derivativeMaxDimension) {
        throw new ProcessingFailure("metadata_mismatch");
      }
      return output;
    }
  }

  throw new ProcessingFailure("output_too_large");
}

function createPublicImageAssetId(snapshotId: string, privateImageAssetId: string, derivative: Buffer) {
  return `img-${createHash("sha256").update(snapshotId).update("\0").update(privateImageAssetId).update("\0").update(derivative).digest("hex").slice(0, 40)}`;
}

function validateExistingLedger(
  ledger: PublicImageAsset | null,
  ownerId: string,
  snapshotId: string,
  privateImageAssetId: string,
  sourceRecordId: string
) {
  if (
    ledger &&
    (ledger.ownerId !== ownerId ||
      ledger.publicPassportSnapshotId !== snapshotId ||
      ledger.privateImageAssetId !== privateImageAssetId ||
      ledger.sourceType !== "equipment_cover" ||
      ledger.sourceRecordId !== sourceRecordId)
  ) {
    throw new ProcessingFailure("unauthorized");
  }
}

async function publicObjectExists(publicKey: string) {
  try {
    const head = await s3Client.send(new HeadObjectCommand({ Bucket: imageBucketName, Key: publicKey }));
    return head.ContentType === "image/jpeg" && Boolean(head.ContentLength && head.ContentLength <= derivativeMaxBytes);
  } catch (error) {
    if (isObjectUnavailableError(error)) return false;
    throw new ProcessingFailure("unknown_error");
  }
}

async function startProcessingLedger({
  publicImageAssetId,
  ownerId,
  snapshotId,
  privateImageAssetId,
  sourceRecordId,
  consentConfirmedAt
}: {
  publicImageAssetId: string;
  ownerId: string;
  snapshotId: string;
  privateImageAssetId: string;
  sourceRecordId: string;
  consentConfirmedAt: string;
}) {
  const leaseCutoff = new Date(Date.parse(consentConfirmedAt) - 5 * 60 * 1_000).toISOString();

  await dynamoClient.send(
    new UpdateItemCommand({
      TableName: publicImageAssetTableName,
      Key: { id: { S: publicImageAssetId } },
      ConditionExpression:
        "attribute_not_exists(#id) OR (#ownerId = :ownerId AND #snapshotId = :snapshotId AND #privateAssetId = :privateAssetId AND #sourceType = :sourceType AND #sourceRecordId = :sourceRecordId AND #status <> :removed AND (#status <> :processing OR #updatedAt < :leaseCutoff))",
      UpdateExpression:
        "SET #ownerId = :ownerId, #snapshotId = :snapshotId, #privateAssetId = :privateAssetId, #sourceType = :sourceType, #sourceRecordId = :sourceRecordId, #status = :processing, #consent = :consent, #createdAt = if_not_exists(#createdAt, :now), #updatedAt = :now REMOVE #failureCode, #publicKey, #altText",
      ExpressionAttributeNames: {
        "#id": "id",
        "#ownerId": "ownerId",
        "#snapshotId": "publicPassportSnapshotId",
        "#privateAssetId": "privateImageAssetId",
        "#sourceType": "sourceType",
        "#sourceRecordId": "sourceRecordId",
        "#status": "status",
        "#consent": "consentConfirmedAt",
        "#createdAt": "createdAt",
        "#updatedAt": "updatedAt",
        "#failureCode": "processingErrorCode",
        "#publicKey": "publicImageKey",
        "#altText": "publicImageAltText"
      },
      ExpressionAttributeValues: {
        ":ownerId": { S: ownerId },
        ":snapshotId": { S: snapshotId },
        ":privateAssetId": { S: privateImageAssetId },
        ":sourceType": { S: "equipment_cover" },
        ":sourceRecordId": { S: sourceRecordId },
        ":processing": { S: "processing" },
        ":removed": { S: "removed" },
        ":leaseCutoff": { S: leaseCutoff },
        ":consent": { S: consentConfirmedAt },
        ":now": { S: consentConfirmedAt }
      }
    })
  );
}

async function markLedgerFailed(
  publicImageAssetId: string,
  ownerId: string,
  consentConfirmedAt: string,
  failureCode: FailureCode
) {
  try {
    await dynamoClient.send(
      new UpdateItemCommand({
        TableName: publicImageAssetTableName,
        Key: { id: { S: publicImageAssetId } },
        ConditionExpression: "#ownerId = :ownerId AND #status = :processing AND #consent = :consent",
        UpdateExpression: "SET #status = :failed, #failureCode = :failureCode, #updatedAt = :now REMOVE #publicKey, #altText",
        ExpressionAttributeNames: {
          "#ownerId": "ownerId",
          "#status": "status",
          "#consent": "consentConfirmedAt",
          "#failureCode": "processingErrorCode",
          "#updatedAt": "updatedAt",
          "#publicKey": "publicImageKey",
          "#altText": "publicImageAltText"
        },
        ExpressionAttributeValues: {
          ":ownerId": { S: ownerId },
          ":processing": { S: "processing" },
          ":consent": { S: consentConfirmedAt },
          ":failed": { S: "failed" },
          ":failureCode": { S: failureCode },
          ":now": { S: new Date().toISOString() }
        }
      })
    );
  } catch {
    console.error(JSON.stringify({ event: "public_image_failure_status_write_failed" }));
  }
}

async function finalizeProjection({
  asset,
  snapshot,
  passport,
  profile,
  username,
  publicImageAssetId,
  publicKey,
  altText,
  consentConfirmedAt
}: {
  asset: PrivateImageAsset;
  snapshot: PublicPassportSnapshot;
  passport: EquipmentPassport;
  profile: UserProfile;
  username: string;
  publicImageAssetId: string;
  publicKey: string;
  altText?: string;
  consentConfirmedAt: string;
}) {
  const now = new Date().toISOString();
  const ledgerNames: Record<string, string> = {
    "#ownerId": "ownerId",
    "#snapshotId": "publicPassportSnapshotId",
    "#privateAssetId": "privateImageAssetId",
    "#sourceType": "sourceType",
    "#sourceRecordId": "sourceRecordId",
    "#status": "status",
    "#publicKey": "publicImageKey",
    "#altText": "publicImageAltText",
    "#failureCode": "processingErrorCode",
    "#consent": "consentConfirmedAt",
    "#updatedAt": "updatedAt"
  };
  const ledgerValues: Record<string, AttributeValue> = {
    ":ownerId": { S: snapshot.ownerId },
    ":snapshotId": { S: snapshot.id },
    ":privateAssetId": { S: asset.id },
    ":sourceType": { S: "equipment_cover" },
    ":sourceRecordId": { S: asset.sourceRecordId },
    ":ready": { S: "ready" },
    ":publicKey": { S: publicKey },
    ":consent": { S: consentConfirmedAt },
    ":now": { S: now }
  };
  let ledgerUpdate =
    "SET #status = :ready, #publicKey = :publicKey, #consent = :consent, #updatedAt = :now";
  if (altText) {
    ledgerValues[":altText"] = { S: altText };
    ledgerUpdate += ", #altText = :altText REMOVE #failureCode";
  } else {
    ledgerUpdate += " REMOVE #failureCode, #altText";
  }

  const snapshotNames: Record<string, string> = {
    "#ownerId": "ownerId",
    "#sourceRecordId": "equipmentPassportId",
    "#publicAssetId": "publicImageAssetId",
    "#publicKey": "publicImageKey",
    "#altText": "publicImageAltText",
    "#updatedAt": "updatedAt"
  };
  const snapshotValues: Record<string, AttributeValue> = {
    ":ownerId": { S: snapshot.ownerId },
    ":sourceRecordId": { S: asset.sourceRecordId },
    ":publicAssetId": { S: publicImageAssetId },
    ":publicKey": { S: publicKey },
    ":now": { S: now }
  };
  let snapshotCondition = "#ownerId = :ownerId AND #sourceRecordId = :sourceRecordId";
  if (snapshot.updatedAt) {
    snapshotValues[":existingUpdatedAt"] = { S: snapshot.updatedAt };
    snapshotCondition += " AND #updatedAt = :existingUpdatedAt";
  } else {
    snapshotCondition += " AND attribute_not_exists(#updatedAt)";
  }
  if (snapshot.publicImageAssetId) {
    snapshotValues[":existingPublicAssetId"] = { S: snapshot.publicImageAssetId };
    snapshotCondition += " AND #publicAssetId = :existingPublicAssetId";
  } else {
    snapshotCondition += " AND attribute_not_exists(#publicAssetId)";
  }
  if (snapshot.publicImageKey) {
    snapshotValues[":existingPublicKey"] = { S: snapshot.publicImageKey };
    snapshotCondition += " AND #publicKey = :existingPublicKey";
  } else {
    snapshotCondition += " AND attribute_not_exists(#publicKey)";
  }
  if (snapshot.publicImageAltText) {
    snapshotValues[":existingAltText"] = { S: snapshot.publicImageAltText };
    snapshotCondition += " AND #altText = :existingAltText";
  } else {
    snapshotCondition += " AND attribute_not_exists(#altText)";
  }
  let snapshotUpdate = "SET #publicAssetId = :publicAssetId, #publicKey = :publicKey, #updatedAt = :now";
  if (altText) {
    snapshotValues[":altText"] = { S: altText };
    snapshotUpdate += ", #altText = :altText";
  } else {
    snapshotUpdate += " REMOVE #altText";
  }

  await dynamoClient.send(
    new TransactWriteItemsCommand({
      ClientRequestToken: createHash("sha256")
        .update(publicImageAssetId)
        .update("\0")
        .update(altText ?? "")
        .update("\0")
        .update(consentConfirmedAt)
        .digest("hex")
        .slice(0, 36),
      TransactItems: [
        {
          ConditionCheck: {
            TableName: privateImageAssetTableName,
            Key: { id: { S: asset.id } },
            ConditionExpression:
              "#ownerId = :ownerId AND #ownerSub = :ownerSub AND #bindingStatus = :verified AND #sourceType = :sourceType AND #sourceRecordId = :sourceRecordId AND #storageKey = :storageKey AND #storageIdentityId = :storageIdentityId AND #contentType = :contentType AND #sizeBytes = :sizeBytes",
            ExpressionAttributeNames: {
              "#ownerId": "ownerId",
              "#ownerSub": "ownerSub",
              "#bindingStatus": "bindingStatus",
              "#sourceType": "sourceType",
              "#sourceRecordId": "sourceRecordId",
              "#storageKey": "storageKey",
              "#storageIdentityId": "storageIdentityId",
              "#contentType": "contentType",
              "#sizeBytes": "sizeBytes"
            },
            ExpressionAttributeValues: {
              ":ownerId": { S: asset.ownerId },
              ":ownerSub": { S: asset.ownerSub },
              ":verified": { S: "verified" },
              ":sourceType": { S: "equipment_cover" },
              ":sourceRecordId": { S: asset.sourceRecordId },
              ":storageKey": { S: asset.storageKey },
              ":storageIdentityId": { S: asset.storageIdentityId },
              ":contentType": { S: asset.contentType },
              ":sizeBytes": { N: String(asset.sizeBytes) }
            }
          }
        },
        {
          ConditionCheck: {
            TableName: equipmentPassportTableName,
            Key: { id: { S: passport.id } },
            ConditionExpression: "#ownerId = :ownerId AND #privateKey = :privateKey AND #isPublic = :isPublic",
            ExpressionAttributeNames: { "#ownerId": "ownerId", "#privateKey": "privateCoverPhotoKey", "#isPublic": "isPublic" },
            ExpressionAttributeValues: {
              ":ownerId": { S: passport.ownerId },
              ":privateKey": { S: asset.storageKey },
              ":isPublic": { BOOL: true }
            }
          }
        },
        {
          ConditionCheck: {
            TableName: userProfileTableName,
            Key: { id: { S: profile.id } },
            ConditionExpression: "#ownerId = :ownerId AND #username = :username AND #visibility = :public",
            ExpressionAttributeNames: { "#ownerId": "ownerId", "#username": "username", "#visibility": "accountVisibility" },
            ExpressionAttributeValues: {
              ":ownerId": { S: profile.ownerId },
              ":username": { S: username },
              ":public": { S: "public" }
            }
          }
        },
        {
          ConditionCheck: {
            TableName: usernameReservationTableName,
            Key: { id: { S: username } },
            ConditionExpression: "#ownerId = :ownerId OR #ownerId = :ownerSub",
            ExpressionAttributeNames: { "#ownerId": "ownerId" },
            ExpressionAttributeValues: { ":ownerId": { S: asset.ownerId }, ":ownerSub": { S: asset.ownerSub } }
          }
        },
        {
          Update: {
            TableName: publicImageAssetTableName,
            Key: { id: { S: publicImageAssetId } },
            ConditionExpression:
              "#ownerId = :ownerId AND #snapshotId = :snapshotId AND #privateAssetId = :privateAssetId AND #sourceType = :sourceType AND #sourceRecordId = :sourceRecordId AND (#status = :processing OR #status = :ready)",
            UpdateExpression: ledgerUpdate,
            ExpressionAttributeNames: ledgerNames,
            ExpressionAttributeValues: { ...ledgerValues, ":processing": { S: "processing" } }
          }
        },
        {
          Update: {
            TableName: publicPassportSnapshotTableName,
            Key: { id: { S: snapshot.id } },
            ConditionExpression: snapshotCondition,
            UpdateExpression: snapshotUpdate,
            ExpressionAttributeNames: snapshotNames,
            ExpressionAttributeValues: snapshotValues
          }
        }
      ]
    })
  );
}

function response(
  processingStatus: ProcessingStatus,
  publicImageAssetId?: string,
  failureCode?: FailureCode
): Schema["processPublicPassportImage"]["returnType"] {
  return { processingStatus, publicImageAssetId, failureCode };
}

export const handler: Schema["processPublicPassportImage"]["functionHandler"] = async (event) => {
  const snapshotId = normalizeId(event.arguments.publicPassportSnapshotId);
  const privateImageAssetId = normalizeId(event.arguments.privateImageAssetId);
  const identity = event.identity;
  let publicImageAssetId: string | undefined;
  let publicKey: string | undefined;
  let ledgerStarted = false;
  let objectWritten = false;
  let processingOwnerId = "";
  let processingAttemptAt = "";

  try {
    if (!snapshotId || !privateImageAssetId) throw new ProcessingFailure("invalid_request");
    if (!isCognitoIdentity(identity)) throw new ProcessingFailure("unauthorized");
    if (event.arguments.consentConfirmed !== true) throw new ProcessingFailure("consent_required");
    const altText = sanitizeAltText(event.arguments.altText);

    const [candidateItem, snapshotItem] = await Promise.all([
      getItem(privateImageAssetTableName, privateImageAssetId, [
        "id",
        "ownerId",
        "ownerSub",
        "sourceType",
        "sourceRecordId",
        "storageKey",
        "storageIdentityId",
        "sanitizedFileName",
        "contentType",
        "sizeBytes",
        "bindingStatus"
      ]),
      getItem(publicPassportSnapshotTableName, snapshotId, [
        "id",
        "ownerId",
        "equipmentPassportId",
        "publicImageAssetId",
        "publicImageKey",
        "publicImageAltText",
        "updatedAt"
      ])
    ]);
    const asset = readPrivateImageAsset(candidateItem, privateImageAssetId);
    const snapshot = readSnapshot(snapshotItem, snapshotId);
    // Missing and foreign opaque IDs intentionally share the same response so
    // the action cannot be used as a cross-owner existence oracle.
    if (!asset || !snapshot) throw new ProcessingFailure("unauthorized");

    validatePrivateCandidate(asset, identity);
    processingOwnerId = snapshot.ownerId;
    const ownerAliases = [...new Set([asset.ownerId, asset.ownerSub])];
    if (!ownerAliases.includes(snapshot.ownerId)) throw new ProcessingFailure("unauthorized");

    const [passportItem, profile] = await Promise.all([
      getItem(equipmentPassportTableName, asset.sourceRecordId, ["id", "ownerId", "privateCoverPhotoKey", "isPublic"]),
      findOwnedUserProfile(ownerAliases)
    ]);
    const passport = readEquipmentPassport(passportItem, asset.sourceRecordId);
    if (!passport) throw new ProcessingFailure("source_not_found");

    const username = profile.username.trim().toLowerCase();
    if (!usernamePattern.test(username)) throw new ProcessingFailure("username_unresolved");
    const reservationItem = await getItem(usernameReservationTableName, username, ["id", "ownerId"]);
    const reservationOwnerId = reservationItem ? stringValue(reservationItem, "ownerId") ?? "" : "";
    validateOwnershipGraph({ asset, snapshot, passport, profile, reservationOwnerId });

    const sourceBytes = await readPrivateSourceObject(asset);
    const header = inspectSourceImage(sourceBytes, normalizeContentType(asset.contentType));
    const derivative = createDerivative(decodeSourceImage(sourceBytes, header));
    publicImageAssetId = createPublicImageAssetId(snapshot.id, asset.id, derivative);
    publicKey = `public/passports/${snapshot.id}/cover/${publicImageAssetId}.jpg`;

    const existingLedger = readPublicImageAsset(
      await getItem(publicImageAssetTableName, publicImageAssetId, [
        "id",
        "ownerId",
        "publicPassportSnapshotId",
        "privateImageAssetId",
        "sourceType",
        "sourceRecordId",
        "publicImageKey",
        "publicImageAltText",
        "status"
      ]),
      publicImageAssetId
    );
    validateExistingLedger(existingLedger, snapshot.ownerId, snapshot.id, asset.id, asset.sourceRecordId);

    const consentConfirmedAt = new Date().toISOString();
    const readyObjectExists =
      existingLedger?.status === "ready" && existingLedger.publicImageKey === publicKey && (await publicObjectExists(publicKey));

    if (!readyObjectExists) {
      try {
        await startProcessingLedger({
          publicImageAssetId,
          ownerId: snapshot.ownerId,
          snapshotId: snapshot.id,
          privateImageAssetId: asset.id,
          sourceRecordId: asset.sourceRecordId,
          consentConfirmedAt
        });
      } catch {
        throw new ProcessingFailure("state_changed");
      }
      ledgerStarted = true;
      processingAttemptAt = consentConfirmedAt;

      try {
        await s3Client.send(
          new PutObjectCommand({
            Bucket: imageBucketName,
            Key: publicKey,
            Body: derivative,
            ContentType: "image/jpeg",
            ContentLength: derivative.length,
            CacheControl: "public, max-age=31536000, immutable",
            ServerSideEncryption: "AES256"
          })
        );
        objectWritten = true;
      } catch {
        throw new ProcessingFailure("storage_write_failed");
      }
    }

    try {
      await finalizeProjection({
        asset,
        snapshot,
        passport,
        profile,
        username,
        publicImageAssetId,
        publicKey,
        altText,
        consentConfirmedAt
      });
    } catch {
      throw new ProcessingFailure("state_changed");
    }

    console.info(
      JSON.stringify({
        event: "public_image_derivative_ready",
        outputContentType: "image/jpeg",
        outputBytes: derivative.length
      })
    );
    return response("ready", publicImageAssetId);
  } catch (error) {
    const failureCode = error instanceof ProcessingFailure ? error.code : "unknown_error";

    if (objectWritten && publicKey) {
      try {
        await s3Client.send(new DeleteObjectCommand({ Bucket: imageBucketName, Key: publicKey }));
      } catch {
        console.error(JSON.stringify({ event: "public_image_rollback_delete_failed" }));
      }
    }

    if (ledgerStarted && publicImageAssetId && processingOwnerId && processingAttemptAt) {
      await markLedgerFailed(publicImageAssetId, processingOwnerId, processingAttemptAt, failureCode);
    }

    console.warn(
      JSON.stringify({
        event: "public_image_derivative_failed",
        failureCode
      })
    );
    return response("failed", publicImageAssetId, failureCode);
  }
};
