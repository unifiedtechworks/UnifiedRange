import type { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import {
  allowedPrivateImageTypes,
  privateImageMaxBytes,
  sanitizePrivateImagePathSegment,
  type PrivateImageUploadResult
} from "@/lib/privateImageStorage";

type AmplifyDataClient = ReturnType<typeof generateClient<Schema>>;
type PrivateImageAssetRecord = Schema["PrivateImageAsset"]["type"];

export type PrivateImageAssetSourceType = "equipment_cover" | "range_session_target";

const generatedPrivateImageFileNamePattern = /^\d{10,15}-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpe?g|png|webp)$/i;
const knownNonPersistentSourceIdPattern = /^(?:(?:demo|sample)(?:[-_]|$)|(?:passport|session|target-photo)-\d+$)/i;

export interface PrivateImageSourceBindingInput {
  ownerId: string;
  ownerAliases: string[];
  sourceOwnerId?: string | null;
  sourceType: PrivateImageAssetSourceType;
  sourceRecordId: string;
  upload: PrivateImageUploadResult;
}

export function isEligiblePrivateImageSourceRecordId(sourceRecordId: string) {
  const value = sourceRecordId.trim();
  return Boolean(value) && !knownNonPersistentSourceIdPattern.test(value);
}

function expectedFolder(sourceType: PrivateImageAssetSourceType) {
  return sourceType === "equipment_cover" ? "equipment" : "targets";
}

function parseStorageKey(storageKey: string) {
  const parts = storageKey.split("/");

  if (parts.length !== 5 || parts[0] !== "private") {
    throw new Error("The uploaded image does not use a recognized private storage path.");
  }

  return {
    folder: parts[1],
    storageIdentityId: parts[2],
    sourceRecordId: parts[3],
    sanitizedFileName: parts[4]
  };
}

export function buildPrivateImageAssetRegistration(input: PrivateImageSourceBindingInput) {
  const ownerAliases = [...new Set([input.ownerId, ...input.ownerAliases])].filter(Boolean);

  if (!input.ownerId || !input.ownerAliases.includes(input.ownerId)) {
    throw new Error("The signed-in data owner could not be verified.");
  }

  if (!input.sourceOwnerId || !ownerAliases.includes(input.sourceOwnerId)) {
    throw new Error("This private image source does not belong to the signed-in account.");
  }

  if (!isEligiblePrivateImageSourceRecordId(input.sourceRecordId)) {
    throw new Error("Demo and sample records cannot register private image sources.");
  }

  if (!allowedPrivateImageTypes.includes(input.upload.contentType)) {
    throw new Error("The private image content type is not allowed.");
  }

  if (input.upload.sizeBytes <= 0 || input.upload.sizeBytes > privateImageMaxBytes) {
    throw new Error("The private image size is outside the allowed range.");
  }

  const parsedKey = parseStorageKey(input.upload.storageKey);
  const expectedSourceRecordId = sanitizePrivateImagePathSegment(input.sourceRecordId);

  if (parsedKey.folder !== expectedFolder(input.sourceType)) {
    throw new Error("The private image path does not match its source type.");
  }

  if (!input.upload.storageIdentityId || parsedKey.storageIdentityId !== input.upload.storageIdentityId) {
    throw new Error("The private image path does not match the active storage identity.");
  }

  if (!expectedSourceRecordId || parsedKey.sourceRecordId !== expectedSourceRecordId) {
    throw new Error("The private image path does not match its source record.");
  }

  if (
    parsedKey.sanitizedFileName !== input.upload.sanitizedFileName ||
    !generatedPrivateImageFileNamePattern.test(parsedKey.sanitizedFileName)
  ) {
    throw new Error("The private image filename is not a generated safe filename.");
  }

  return {
    ownerId: input.ownerId,
    sourceType: input.sourceType,
    sourceRecordId: input.sourceRecordId,
    storageKey: input.upload.storageKey,
    sanitizedFileName: input.upload.sanitizedFileName,
    contentType: input.upload.contentType,
    sizeBytes: input.upload.sizeBytes
  };
}

export function validateRegisteredPrivateImageAsset({
  asset,
  ownerId,
  ownerAliases,
  sourceOwnerId,
  sourceType,
  sourceRecordId,
  trustedStorageIdentityId,
  requireVerified = false
}: {
  asset: PrivateImageAssetRecord;
  ownerId: string;
  ownerAliases: string[];
  sourceOwnerId?: string | null;
  sourceType: PrivateImageAssetSourceType;
  sourceRecordId: string;
  trustedStorageIdentityId: string;
  requireVerified?: boolean;
}) {
  const aliases = [...new Set([ownerId, ...ownerAliases])].filter(Boolean);

  if (!aliases.includes(asset.ownerId) || asset.ownerId !== ownerId) {
    throw new Error("The private image registration does not belong to the expected account.");
  }

  if (asset.sourceType !== sourceType || asset.sourceRecordId !== sourceRecordId) {
    throw new Error("The private image registration does not match the expected source record.");
  }

  if (requireVerified && asset.bindingStatus !== "verified") {
    throw new Error("The private image registration has not been verified by a trusted backend.");
  }

  return buildPrivateImageAssetRegistration({
    ownerId,
    ownerAliases: aliases,
    sourceOwnerId,
    sourceType,
    sourceRecordId,
    upload: {
      storageKey: asset.storageKey,
      storageIdentityId: trustedStorageIdentityId,
      sanitizedFileName: asset.sanitizedFileName,
      contentType: asset.contentType,
      sizeBytes: asset.sizeBytes
    }
  });
}

export async function registerPrivateImageCandidate(
  client: AmplifyDataClient,
  registration: ReturnType<typeof buildPrivateImageAssetRegistration>
) {
  const existing = await client.models.PrivateImageAsset.list({
    filter: {
      ownerId: { eq: registration.ownerId },
      sourceType: { eq: registration.sourceType },
      sourceRecordId: { eq: registration.sourceRecordId }
    }
  });

  if (existing.errors?.length) {
    throw new Error(existing.errors.map((item) => item.message).join(" ") || "Existing private image registrations could not be checked.");
  }

  const matchingCandidate = existing.data.find((asset) => asset.storageKey === registration.storageKey);

  if (matchingCandidate) {
    return matchingCandidate;
  }

  const created = await client.models.PrivateImageAsset.create(registration);

  if (created.errors?.length || !created.data) {
    throw new Error(created.errors?.map((item) => item.message).join(" ") || "The private image could not be registered.");
  }

  return created.data;
}
