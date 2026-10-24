import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import { syncBuiltinESMExports } from "node:module";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";

for (const key of Object.keys(process.env)) assert.ok(!/^(AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN|GITHUB_TOKEN|GH_TOKEN)$/.test(key));
for (const flag of ["--no-experimental-require-module", "--no-experimental-detect-module"]) assert.ok(process.execArgv.includes(flag), flag);
if (process.env.EXPECTED_NODE_MAJOR) {
  assert.equal(process.versions.node.split(".")[0], "24");
  assert.equal(process.platform, "linux"); assert.equal(process.arch, "x64");
}
console.log(`Runtime ${process.version}; ${process.platform}/${process.arch}; ${existsSync("/etc/os-release") ? readFileSync("/etc/os-release", "utf8").split("\n").find(line => line.startsWith("PRETTY_NAME=")) : "local diagnostic only"}`);
for (const name of ["PRIVATE_IMAGE_ASSET_TABLE_NAME", "EQUIPMENT_PASSPORT_TABLE_NAME", "RANGE_SESSION_TABLE_NAME", "PUBLIC_PASSPORT_SNAPSHOT_TABLE_NAME", "PUBLIC_IMAGE_ASSET_TABLE_NAME", "USER_PROFILE_TABLE_NAME", "USERNAME_RESERVATION_TABLE_NAME", "USER_PROFILE_OWNER_INDEX_NAME", "PUBLIC_IMAGE_ASSET_SNAPSHOT_INDEX_NAME", "REPORT_TABLE_NAME", "unifiedRangePrivateImages_BUCKET_NAME"]) process.env[name] = `fixture-${name.toLowerCase()}`;
Object.assign(process.env, { AWS_REGION: "us-east-1", AWS_EC2_METADATA_DISABLED: "true", AMPLIFY_SSM_ENV_CONFIG: "{}", REMOVED_PUBLIC_IMAGE_CLEANUP_ENABLED: "false" });
const calls = [];
function forbidden(kind) { calls.push(kind); throw new Error(`Unexpected ${kind}`); }
DynamoDBClient.prototype.send = async () => forbidden("DynamoDB send");
S3Client.prototype.send = async () => forbidden("S3 send");
// Also guard plain bundles at the transport boundary; containers have no network.
http.request = https.request = () => forbidden("HTTP request");
http.get = https.get = () => forbidden("HTTP get");
globalThis.fetch = async () => forbidden("fetch");
syncBuiltinESMExports();
const loaders = {
  "create-public-image-report": () => import("../../amplify/functions/create-public-image-report/handler.ts"),
  "inspect-public-image-cleanup": () => import("../../amplify/functions/inspect-public-image-cleanup/handler.ts"),
  "moderate-public-passport-image": () => import("../../amplify/functions/moderate-public-passport-image/handler.ts"),
  "process-public-passport-image": () => import("../../amplify/functions/process-public-passport-image/handler.ts"),
  "remove-public-passport-image": () => import("../../amplify/functions/remove-public-passport-image/handler.ts"),
  "resolve-public-passport-image": () => import("../../amplify/functions/resolve-public-passport-image/handler.ts"),
  "retry-removed-public-image-cleanup": () => import("../../amplify/functions/retry-removed-public-image-cleanup/handler.ts"),
  "verify-private-image": () => import("../../amplify/functions/verify-private-image/handler.ts"),
};
const admin = { sub: "fixture-admin", username: "fixture-admin", groups: ["admin"] };
const assetId = `img-${"a".repeat(40)}`;
const base = { publicPassportSnapshotId: "fixture-snapshot", privateImageAssetId: "fixture-asset", publicImageAssetId: assetId, consentConfirmed: true, confirmation: true, reason: "other", action: "hide", altText: "Synthetic" };
let passed = 0;
async function check(label, fn) { await fn(); assert.deepEqual(calls, [], label); passed++; console.log(`PASS ${label}; zero unexpected operations`); }
for (const [name, load] of Object.entries(loaders)) {
  for (const mode of ["plain", "SDK-boundary"]) {
    // Variable URL prevents esbuild from bundling the plain production artifact.
    const plainUrl = new URL(name === "process-public-passport-image" ? "./index.mjs" : `./${name}/index.mjs`, import.meta.url);
    const loaded = mode === "plain" ? await import(plainUrl.href) : await load();
    await check(`${name} ${mode} initializes/exports async handler`, async () => {
      assert.equal(typeof loaded.handler, "function");
      assert.equal(loaded.handler.constructor.name, "AsyncFunction");
    });
    await check(`${name} ${mode} rejection`, async () => {
      const result = await loaded.handler({ arguments: { ...base, ...(name === "resolve-public-passport-image" ? { publicPassportSnapshotId: "" } : {}) }, identity: null });
      if (name === "resolve-public-passport-image") assert.equal(result.status, "unavailable");
      else if (name === "inspect-public-image-cleanup") assert.deepEqual(result.findingCodes, ["unauthorized"]);
      else assert.equal(result.failureCode, "unauthorized");
    });
    if (name === "retry-removed-public-image-cleanup") {
      await check(`${name} ${mode} authorized request remains disabled`, async () => {
        const result = await loaded.handler({ arguments: base, identity: admin });
        assert.equal(result.cleanupStatus, "disabled");
        assert.equal(result.failureCode, "execution_disabled");
      });
    }
  }
}
console.log(`PASS ${passed} all-function checks; zero DynamoDB/S3 operations in SDK-boundary cases; no network requests in plain cases.`);
process.exit(0); // The unchanged Amplify banner schedules refresh timers.
