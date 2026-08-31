import type { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import outputs from "../../amplify_outputs.json";

type AmplifyDataClient = ReturnType<typeof generateClient<Schema>>;

const publicImageAltTextMaxLength = 140;
const signedUrlMaxLength = 4_096;
const resolverRequestTimeoutMilliseconds = 10_000;
const signedUrlLifetimeSeconds = 60;
const persistentIdPattern = /^[a-z0-9][a-z0-9_-]{0,127}$/i;
const nonPersistentIdPattern = /^(?:(?:demo|sample)(?:[-_]|$)|(?:passport|session|target-photo)-\d+$)/i;
const publicImageAssetFilenamePattern = /^img-[0-9a-f]{40}\.jpg$/;
const urlPattern = /(?:\b[a-z][a-z0-9+.-]*:\/\/|\bwww\.|\b(?:data|blob):)/i;
const storagePathPattern = /\b(?:private[\\/](?:equipment|targets)|public[\\/]passports)[\\/]/i;
const signingAlgorithm = "AWS4-HMAC-SHA256";
const signedResponseCacheControl = "private, no-store, max-age=0";

export type PublicPassportImageDelivery =
  | { status: "available"; imageUrl: string; altText: string }
  | { status: "unavailable" };

function normalizePersistentId(value: string) {
  const normalized = value.trim();
  return persistentIdPattern.test(normalized) && !nonPersistentIdPattern.test(normalized) ? normalized : "";
}

function normalizeAltText(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (
    !normalized ||
    normalized !== value ||
    normalized.length > publicImageAltTextMaxLength ||
    urlPattern.test(normalized) ||
    storagePathPattern.test(normalized)
  ) {
    return "";
  }

  return normalized;
}

function expectedStorageHostname() {
  const bucketName = outputs.storage?.bucket_name;
  const region = outputs.storage?.aws_region;

  if (
    !bucketName ||
    !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucketName) ||
    !region ||
    !/^[a-z]{2}(?:-gov)?-[a-z]+-\d$/.test(region)
  ) {
    return "";
  }

  return `${bucketName}.s3.${region}.${region.startsWith("cn-") ? "amazonaws.com.cn" : "amazonaws.com"}`;
}

function singleCaseInsensitiveSearchParameter(url: URL, expectedName: string) {
  const matches: string[] = [];

  for (const [name, value] of url.searchParams) {
    if (name.toLowerCase() === expectedName.toLowerCase()) {
      matches.push(value);
    }
  }

  return matches.length === 1 ? matches[0] : "";
}

function parseAwsSigningDate(value: string) {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value);
  if (!match) {
    return Number.NaN;
  }

  return Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6])
  );
}

function hasExpectedSigningCredential(url: URL, signingDate: string) {
  const credential = singleCaseInsensitiveSearchParameter(url, "X-Amz-Credential");
  const region = outputs.storage?.aws_region;
  const [accessKeyId, credentialDate, credentialRegion, service, terminator, ...extra] = credential.split("/");

  return (
    extra.length === 0 &&
    /^[A-Z0-9]{16,128}$/.test(accessKeyId) &&
    credentialDate === signingDate.slice(0, 8) &&
    credentialRegion === region &&
    service === "s3" &&
    terminator === "aws4_request"
  );
}

function normalizeCurrentExpiry(value: unknown) {
  if (typeof value !== "string") {
    return 0;
  }

  const expiresAt = Date.parse(value);
  const remainingMilliseconds = expiresAt - Date.now();
  return Number.isFinite(expiresAt) && remainingMilliseconds > 5_000 && remainingMilliseconds <= 65_000 ? expiresAt : 0;
}

function validateDeliveryUrl(value: unknown, publicPassportSnapshotId: string, expiresAt: number) {
  if (typeof value !== "string" || !value || value.length > signedUrlMaxLength) {
    return "";
  }

  try {
    const url = new URL(value);
    const decodedPath = decodeURIComponent(url.pathname);
    const expectedPathPrefix = `/public/passports/${publicPassportSnapshotId}/cover/`;
    const publicImageAssetFilename = decodedPath.startsWith(expectedPathPrefix)
      ? decodedPath.slice(expectedPathPrefix.length)
      : "";
    const signingDate = singleCaseInsensitiveSearchParameter(url, "X-Amz-Date");
    const signedAt = parseAwsSigningDate(signingDate);
    const signedHeaders = singleCaseInsensitiveSearchParameter(url, "X-Amz-SignedHeaders")
      .split(";")
      .map((header) => header.trim().toLowerCase())
      .filter(Boolean);

    if (
      url.protocol !== "https:" ||
      url.hostname !== expectedStorageHostname() ||
      url.port ||
      url.username ||
      url.password ||
      url.hash ||
      !publicImageAssetFilenamePattern.test(publicImageAssetFilename) ||
      singleCaseInsensitiveSearchParameter(url, "X-Amz-Algorithm") !== signingAlgorithm ||
      singleCaseInsensitiveSearchParameter(url, "X-Amz-Expires") !== String(signedUrlLifetimeSeconds) ||
      !hasExpectedSigningCredential(url, signingDate) ||
      !/^[0-9a-f]{64}$/i.test(singleCaseInsensitiveSearchParameter(url, "X-Amz-Signature")) ||
      !signedHeaders.includes("host") ||
      !Number.isFinite(signedAt) ||
      Math.abs(expiresAt - (signedAt + signedUrlLifetimeSeconds * 1_000)) > 5_000 ||
      singleCaseInsensitiveSearchParameter(url, "response-cache-control") !== signedResponseCacheControl ||
      singleCaseInsensitiveSearchParameter(url, "response-content-type") !== "image/jpeg" ||
      singleCaseInsensitiveSearchParameter(url, "response-content-disposition") !== "inline"
    ) {
      return "";
    }

    return value;
  } catch {
    return "";
  }
}

async function queryResolver(client: AmplifyDataClient, publicPassportSnapshotId: string) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutResult = new Promise<null>((resolve) => {
    timeout = setTimeout(() => resolve(null), resolverRequestTimeoutMilliseconds);
  });

  try {
    return await Promise.race([
      client.queries.resolvePublicPassportImage(
        { publicPassportSnapshotId },
        { authMode: "apiKey" }
      ),
      timeoutResult
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export async function loadPublicPassportImageDelivery(
  client: AmplifyDataClient,
  publicPassportSnapshotId: string
): Promise<PublicPassportImageDelivery> {
  const snapshotId = normalizePersistentId(publicPassportSnapshotId);

  if (!snapshotId) {
    return { status: "unavailable" };
  }

  try {
    const result = await queryResolver(client, snapshotId);

    if (
      !result ||
      result.errors?.length ||
      !result.data ||
      result.data.status !== "available" ||
      result.data.cacheSeconds !== 0 ||
      (result.data.failureCode !== null && result.data.failureCode !== undefined)
    ) {
      return { status: "unavailable" };
    }

    const expiresAt = normalizeCurrentExpiry(result.data.expiresAt);
    const imageUrl = expiresAt ? validateDeliveryUrl(result.data.imageUrl, snapshotId, expiresAt) : "";
    const altText = normalizeAltText(result.data.altText);

    if (!imageUrl || !altText) {
      return { status: "unavailable" };
    }

    return { status: "available", imageUrl, altText };
  } catch {
    return { status: "unavailable" };
  }
}
