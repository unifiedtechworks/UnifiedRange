#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const requiredConfirmation = "PROCESS_VERIFIED_EQUIPMENT_COVER";
const idPattern = /^[a-z0-9][a-z0-9_-]{0,127}$/i;
const nonPersistentIdPattern = /^(?:(?:demo|sample)(?:[-_]|$)|(?:passport|session|target-photo)-\d+$)/i;
const allowedStatuses = new Set(["processing", "ready", "failed"]);
const allowedFailureCodes = new Set([
  "unauthorized",
  "invalid_request",
  "invalid_alt_text",
  "consent_required",
  "candidate_not_verified",
  "unsupported_source",
  "source_not_found",
  "source_mismatch",
  "profile_not_public",
  "username_unresolved",
  "invalid_storage_key",
  "object_not_found",
  "unsupported_content_type",
  "file_too_large",
  "metadata_mismatch",
  "invalid_image",
  "animated_image",
  "dimensions_exceeded",
  "output_too_large",
  "storage_write_failed",
  "state_changed",
  "unknown_error"
]);

function fail(message) {
  throw new Error(message);
}

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) fail(`Missing required environment variable: ${name}`);
  return value;
}

function validateOpaqueId(name, value) {
  if (!idPattern.test(value) || nonPersistentIdPattern.test(value)) {
    fail(`${name} must be a persistent opaque record ID.`);
  }
  return value;
}

function normalizeAltText(value) {
  if (value === undefined || value === "") return undefined;
  if (value.length > 1_000) fail("UNIFIEDRANGE_PUBLIC_IMAGE_ALT_TEXT is too long.");

  const normalized = value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized || normalized.length > 200) {
    fail("UNIFIEDRANGE_PUBLIC_IMAGE_ALT_TEXT must contain 1-200 safe characters when provided.");
  }
  return normalized;
}

function decodeJwtPayload(token) {
  const parts = token.split(".");
  if (parts.length !== 3) fail("UNIFIEDRANGE_DEV_ID_TOKEN is not a JWT.");

  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    fail("UNIFIEDRANGE_DEV_ID_TOKEN has an invalid payload.");
  }
}

function validateIdToken(token, outputs) {
  const claims = decodeJwtPayload(token);
  const region = outputs.auth?.aws_region;
  const userPoolId = outputs.auth?.user_pool_id;
  const userPoolClientId = outputs.auth?.user_pool_client_id;

  if (!region || !userPoolId || !userPoolClientId) {
    fail("amplify_outputs.json is missing Cognito configuration.");
  }

  const expectedIssuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;
  if (claims.token_use !== "id" || claims.iss !== expectedIssuer || claims.aud !== userPoolClientId) {
    fail("UNIFIEDRANGE_DEV_ID_TOKEN does not match the configured Cognito user pool/client.");
  }
  if (!Number.isFinite(claims.exp) || claims.exp * 1_000 <= Date.now() + 30_000) {
    fail("UNIFIEDRANGE_DEV_ID_TOKEN is expired or too close to expiration.");
  }
}

function validateAppSyncEndpoint(outputs) {
  const endpointValue = outputs.data?.url;
  const region = outputs.data?.aws_region;
  if (!endpointValue || !region) fail("amplify_outputs.json is missing AppSync configuration.");

  const endpoint = new URL(endpointValue);
  const escapedRegion = region.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const trustedHost = new RegExp(`^[a-z0-9-]+\\.appsync-api\\.${escapedRegion}\\.amazonaws\\.com(?:\\.cn)?$`, "i");
  if (endpoint.protocol !== "https:" || endpoint.pathname !== "/graphql" || !trustedHost.test(endpoint.hostname)) {
    fail("Refusing to send a Cognito token to an unexpected AppSync endpoint.");
  }
  return endpoint.toString();
}

function validateResult(value) {
  if (!value || typeof value !== "object" || !allowedStatuses.has(value.processingStatus)) {
    fail("The processor returned an unexpected response shape.");
  }
  if (value.failureCode !== null && value.failureCode !== undefined && !allowedFailureCodes.has(value.failureCode)) {
    fail("The processor returned an unrecognized failure code.");
  }
  if (
    value.publicImageAssetId !== null &&
    value.publicImageAssetId !== undefined &&
    !/^img-[0-9a-f]{40}$/.test(value.publicImageAssetId)
  ) {
    fail("The processor returned an invalid public asset ID.");
  }

  return {
    processingStatus: value.processingStatus,
    publicImageAssetId: value.publicImageAssetId ?? undefined,
    failureCode: value.failureCode ?? undefined
  };
}

async function main() {
  if (process.env.UNIFIEDRANGE_CONFIRM_PROCESS_PUBLIC_IMAGE !== requiredConfirmation) {
    fail(
      `Set UNIFIEDRANGE_CONFIRM_PROCESS_PUBLIC_IMAGE=${requiredConfirmation} only after reviewing the synthetic test image and confirming this developer-only derivative request.`
    );
  }

  const publicPassportSnapshotId = validateOpaqueId(
    "UNIFIEDRANGE_PUBLIC_PASSPORT_SNAPSHOT_ID",
    requiredEnvironment("UNIFIEDRANGE_PUBLIC_PASSPORT_SNAPSHOT_ID")
  );
  const privateImageAssetId = validateOpaqueId(
    "UNIFIEDRANGE_PRIVATE_IMAGE_ASSET_ID",
    requiredEnvironment("UNIFIEDRANGE_PRIVATE_IMAGE_ASSET_ID")
  );
  const altText = normalizeAltText(process.env.UNIFIEDRANGE_PUBLIC_IMAGE_ALT_TEXT);
  const idToken = requiredEnvironment("UNIFIEDRANGE_DEV_ID_TOKEN");

  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const outputs = JSON.parse(await readFile(resolve(repositoryRoot, "amplify_outputs.json"), "utf8"));
  const endpoint = validateAppSyncEndpoint(outputs);
  validateIdToken(idToken, outputs);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 70_000);
  let response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        authorization: idToken,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        query: `mutation ProcessPublicPassportImage(
          $publicPassportSnapshotId: ID!
          $privateImageAssetId: ID!
          $altText: String
          $consentConfirmed: Boolean!
        ) {
          processPublicPassportImage(
            publicPassportSnapshotId: $publicPassportSnapshotId
            privateImageAssetId: $privateImageAssetId
            altText: $altText
            consentConfirmed: $consentConfirmed
          ) {
            publicImageAssetId
            processingStatus
            failureCode
          }
        }`,
        variables: {
          publicPassportSnapshotId,
          privateImageAssetId,
          altText,
          consentConfirmed: true
        }
      })
    });
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

  const result = validateResult(payload.data?.processPublicPassportImage);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unexpected local test failure.";
  console.error(`Phase 2C processor test stopped: ${message}`);
  process.exitCode = 1;
});
