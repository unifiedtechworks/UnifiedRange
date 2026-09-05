#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const requiredConfirmation = "REMOVE_PUBLIC_PASSPORT_IMAGE_DERIVATIVE";
const idPattern = /^[a-z0-9][a-z0-9_-]{0,127}$/i;
const nonPersistentIdPattern = /^(?:(?:demo|sample)(?:[-_]|$)|(?:passport|session|target-photo)-\d+$)/i;
const allowedStatuses = new Set(["removed", "not_attached", "cleanup_pending", "failed"]);
const allowedFailureCodes = new Set([
  "unauthorized",
  "invalid_request",
  "state_changed",
  "projection_mismatch",
  "storage_delete_failed",
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

function validateSnapshotId(value) {
  if (!idPattern.test(value) || nonPersistentIdPattern.test(value)) {
    fail("UNIFIEDRANGE_PUBLIC_PASSPORT_SNAPSHOT_ID must be a persistent opaque record ID.");
  }
  return value;
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
  if (!value || typeof value !== "object" || !allowedStatuses.has(value.cleanupStatus)) {
    fail("The cleanup operation returned an unexpected response shape.");
  }

  const failureCode = value.failureCode ?? undefined;
  if (failureCode !== undefined && !allowedFailureCodes.has(failureCode)) {
    fail("The cleanup operation returned an unrecognized failure code.");
  }
  if ((value.cleanupStatus === "removed" || value.cleanupStatus === "not_attached") && failureCode !== undefined) {
    fail("The completed cleanup result included an unexpected failure code.");
  }
  if ((value.cleanupStatus === "cleanup_pending" || value.cleanupStatus === "failed") && failureCode === undefined) {
    fail("The incomplete cleanup result omitted its bounded failure code.");
  }

  return { cleanupStatus: value.cleanupStatus, failureCode };
}

async function main() {
  if (process.env.UNIFIEDRANGE_CONFIRM_REMOVE_PUBLIC_IMAGE !== requiredConfirmation) {
    fail(
      `Set UNIFIEDRANGE_CONFIRM_REMOVE_PUBLIC_IMAGE=${requiredConfirmation} only after confirming that the disposable public derivative should be detached and deleted.`
    );
  }

  const publicPassportSnapshotId = validateSnapshotId(
    requiredEnvironment("UNIFIEDRANGE_PUBLIC_PASSPORT_SNAPSHOT_ID")
  );
  const idToken = requiredEnvironment("UNIFIEDRANGE_DEV_ID_TOKEN");
  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const outputs = JSON.parse(await readFile(resolve(repositoryRoot, "amplify_outputs.json"), "utf8"));
  const endpoint = validateAppSyncEndpoint(outputs);
  validateIdToken(idToken, outputs);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
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
        query: `mutation RemovePublicPassportImage($publicPassportSnapshotId: ID!) {
          removePublicPassportImage(publicPassportSnapshotId: $publicPassportSnapshotId) {
            cleanupStatus
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

  console.log(JSON.stringify(validateResult(payload.data?.removePublicPassportImage), null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unexpected local test failure.";
  console.error(`Phase 2F.1 cleanup test stopped: ${message}`);
  process.exitCode = 1;
});
