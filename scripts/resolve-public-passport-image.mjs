#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const idPattern = /^[a-z0-9][a-z0-9_-]{0,127}$/i;
const nonPersistentIdPattern = /^(?:(?:demo|sample)(?:[-_]|$)|(?:passport|session|target-photo)-\d+$)/i;
const publicImageAssetPathPattern = /^\/public\/passports\/[a-z0-9][a-z0-9_-]{0,127}\/cover\/img-[0-9a-f]{40}\.jpg$/i;
const allowedResultFields = new Set(["status", "imageUrl", "altText", "expiresAt", "cacheSeconds", "failureCode"]);
const urlPattern = /(?:\b[a-z][a-z0-9+.-]*:\/\/|\bwww\.|\b(?:data|blob):)/i;
const storagePathPattern = /\b(?:private[\\/](?:equipment|targets)|public[\\/]passports)[\\/]/i;
const derivativeMaxBytes = 2 * 1024 * 1024;

function fail(message) {
  throw new Error(message);
}

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) fail(`Missing required environment variable: ${name}`);
  return value;
}

function validateSnapshotId(value) {
  if (!idPattern.test(value) || nonPersistentIdPattern.test(value)) {
    fail("UNIFIEDRANGE_PUBLIC_PASSPORT_SNAPSHOT_ID must be a persistent opaque record ID.");
  }
  return value;
}

function validateAppSyncEndpoint(outputs) {
  const endpointValue = outputs.data?.url;
  const region = outputs.data?.aws_region;
  if (!endpointValue || !region) fail("amplify_outputs.json is missing AppSync configuration.");

  const endpoint = new URL(endpointValue);
  const escapedRegion = region.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const trustedHost = new RegExp(`^[a-z0-9-]+\\.appsync-api\\.${escapedRegion}\\.amazonaws\\.com(?:\\.cn)?$`, "i");
  if (endpoint.protocol !== "https:" || endpoint.pathname !== "/graphql" || !trustedHost.test(endpoint.hostname)) {
    fail("Refusing to use an unexpected AppSync endpoint.");
  }
  return endpoint.toString();
}

function validateApiKey(outputs) {
  const apiKey = outputs.data?.api_key;
  if (typeof apiKey !== "string" || apiKey.length < 20 || apiKey.length > 512 || /\s/.test(apiKey)) {
    fail("amplify_outputs.json is missing a usable AppSync API key.");
  }
  return apiKey;
}

function validateStorageHostname(outputs) {
  const bucketName = outputs.storage?.bucket_name;
  const region = outputs.storage?.aws_region;
  if (
    typeof bucketName !== "string" ||
    !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucketName) ||
    bucketName.includes("..") ||
    typeof region !== "string" ||
    !/^[a-z]{2}(?:-gov)?-[a-z]+-\d$/.test(region)
  ) {
    fail("amplify_outputs.json is missing valid Storage delivery configuration.");
  }

  return `${bucketName}.s3.${region}.${region.startsWith("cn-") ? "amazonaws.com.cn" : "amazonaws.com"}`;
}

function caseInsensitiveSearchParameter(url, expectedName) {
  for (const [name, value] of url.searchParams) {
    if (name.toLowerCase() === expectedName.toLowerCase()) return value;
  }
  return "";
}

function validateAvailableResult(value, snapshotId, expectedStorageHostname) {
  if (value.failureCode !== null && value.failureCode !== undefined) {
    fail("The available resolver result included a failure code.");
  }
  if (value.cacheSeconds !== 0) fail("The resolver result is not marked non-cacheable.");
  if (typeof value.altText !== "string" || value.altText.length < 1 || value.altText.length > 140) {
    fail("The resolver returned invalid alt text.");
  }
  const normalizedAltText = value.altText
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (
    value.altText !== normalizedAltText ||
    urlPattern.test(value.altText) ||
    storagePathPattern.test(value.altText)
  ) {
    fail("The resolver returned unsafe alt text.");
  }
  if (typeof value.imageUrl !== "string" || value.imageUrl.length > 4_096) {
    fail("The resolver returned an invalid delivery URL.");
  }

  let deliveryUrl;
  try {
    deliveryUrl = new URL(value.imageUrl);
  } catch {
    fail("The resolver returned an invalid delivery URL.");
  }

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(deliveryUrl.pathname);
  } catch {
    fail("The resolver returned an invalid delivery path.");
  }

  if (
    deliveryUrl.protocol !== "https:" ||
    deliveryUrl.hostname !== expectedStorageHostname ||
    deliveryUrl.username ||
    deliveryUrl.password ||
    deliveryUrl.hash ||
    !publicImageAssetPathPattern.test(decodedPath) ||
    !decodedPath.startsWith(`/public/passports/${snapshotId}/cover/`) ||
    decodedPath.toLowerCase().includes("/private/") ||
    caseInsensitiveSearchParameter(deliveryUrl, "X-Amz-Expires") !== "60"
  ) {
    fail("The resolver returned a delivery URL outside the approved public derivative boundary.");
  }

  if (typeof value.expiresAt !== "string") fail("The resolver did not return an expiry timestamp.");
  const expiresAtMilliseconds = Date.parse(value.expiresAt);
  const remainingLifetimeSeconds = Math.round((expiresAtMilliseconds - Date.now()) / 1_000);
  if (!Number.isFinite(expiresAtMilliseconds) || remainingLifetimeSeconds < 30 || remainingLifetimeSeconds > 65) {
    fail("The resolver returned an unexpected URL lifetime.");
  }

  return {
    status: "available",
    cacheSeconds: 0,
    urlValidated: true,
    urlExpiresInSeconds: 60,
    altTextPresent: true,
    altTextLength: value.altText.length,
    imageUrl: value.imageUrl
  };
}

function validateUnavailableResult(value) {
  if (
    value.failureCode !== "unavailable" ||
    value.cacheSeconds !== 0 ||
    value.imageUrl !== null ||
    value.altText !== null ||
    value.expiresAt !== null
  ) {
    fail("The unavailable resolver result did not fail closed.");
  }

  return {
    status: "unavailable",
    failureCode: "unavailable",
    cacheSeconds: 0,
    urlPresent: false,
    altTextPresent: false,
    expiresAtPresent: false
  };
}

function validateResult(value, snapshotId, expectedStorageHostname) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("The resolver returned an unexpected response shape.");
  }
  if (Object.keys(value).some((field) => !allowedResultFields.has(field))) {
    fail("The resolver returned an unexpected field.");
  }
  if (value.status === "available") return validateAvailableResult(value, snapshotId, expectedStorageHostname);
  if (value.status === "unavailable") return validateUnavailableResult(value);
  fail("The resolver returned an unrecognized status.");
}

async function validateDeliveryFetch(imageUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  let response;

  try {
    response = await fetch(imageUrl, {
      method: "GET",
      redirect: "error",
      cache: "no-store",
      signal: controller.signal
    });
  } catch {
    fail("The short-lived derivative request could not be completed. The URL was intentionally not printed.");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) fail(`The short-lived derivative request failed with HTTP ${response.status}.`);

  const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  const cacheDirectives = new Set(
    (response.headers.get("cache-control") ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );
  const contentDisposition = (response.headers.get("content-disposition") ?? "").trim().toLowerCase();

  if (
    contentType !== "image/jpeg" ||
    contentDisposition !== "inline" ||
    !cacheDirectives.has("private") ||
    !cacheDirectives.has("no-store") ||
    !cacheDirectives.has("max-age=0")
  ) {
    fail("The derivative response did not preserve the approved content and non-cacheable headers.");
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (
    bytes.byteLength < 3 ||
    bytes.byteLength > derivativeMaxBytes ||
    bytes[0] !== 0xff ||
    bytes[1] !== 0xd8 ||
    bytes[2] !== 0xff
  ) {
    fail("The derivative response was not a bounded JPEG.");
  }

  return {
    deliveryFetchValidated: true,
    responseCacheHeadersValidated: true,
    derivativeSizeBytes: bytes.byteLength
  };
}

async function main() {
  const publicPassportSnapshotId = validateSnapshotId(
    requiredEnvironment("UNIFIEDRANGE_PUBLIC_PASSPORT_SNAPSHOT_ID")
  );

  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const outputs = JSON.parse(await readFile(resolve(repositoryRoot, "amplify_outputs.json"), "utf8"));
  const endpoint = validateAppSyncEndpoint(outputs);
  const apiKey = validateApiKey(outputs);
  const expectedStorageHostname = validateStorageHostname(outputs);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  let response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey
      },
      body: JSON.stringify({
        query: `query ResolvePublicPassportImage($publicPassportSnapshotId: ID!) {
          resolvePublicPassportImage(publicPassportSnapshotId: $publicPassportSnapshotId) {
            status
            imageUrl
            altText
            expiresAt
            cacheSeconds
            failureCode
          }
        }`,
        variables: { publicPassportSnapshotId }
      })
    });
  } catch {
    fail("The AppSync request could not be completed. No endpoint or credential details were printed.");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    fail(`AppSync request failed with HTTP ${response.status}. No response body was printed.`);
  }

  const payload = await response.json();
  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    const errorTypes = payload.errors
      .map((error) => (typeof error?.errorType === "string" ? error.errorType.replace(/[^a-zA-Z0-9_.-]/g, "") : "GraphQLError"))
      .slice(0, 3);
    fail(`AppSync rejected the request (${errorTypes.join(", ")}). Error messages were intentionally not printed.`);
  }

  const result = validateResult(
    payload.data?.resolvePublicPassportImage,
    publicPassportSnapshotId,
    expectedStorageHostname
  );
  if (result.status === "available") {
    const { imageUrl, ...safeResult } = result;
    const deliveryCheck = await validateDeliveryFetch(imageUrl);
    console.log(JSON.stringify({ ...safeResult, ...deliveryCheck }, null, 2));
    return;
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unexpected local test failure.";
  console.error(`Phase 2E.1 delivery resolver test stopped: ${message}`);
  process.exitCode = 1;
});
