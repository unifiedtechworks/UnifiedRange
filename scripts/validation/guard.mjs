import { lstat, realpath, rm, readFile } from "node:fs/promises";
import { join, resolve, relative, isAbsolute } from "node:path";

export const APPLICATION_SHA = "9db0692a66d7e217643cce63320d97ffb0505af2";
export const APP_NAME = "unifiedrange-validation-20261025";
export const BRANCH = "codex/validation-node24-20261025";
export function requireCheck(condition, code) { if (!condition) throw new Error(code); }
const eq = (a, b, code) => requireCheck(typeof a === "string" && a.length > 0 && a === b, code);
export function checkTarget(expected, observed) {
  requireCheck(/^\d{12}$/.test(expected.account ?? ""), "EXPECTED_ACCOUNT_REQUIRED");
  eq(expected.region, "us-west-2", "EXPECTED_REGION");
  eq(expected.appName, APP_NAME, "EXPECTED_APP_NAME");
  eq(expected.branch, BRANCH, "EXPECTED_BRANCH");
  eq(expected.applicationSha, APPLICATION_SHA, "APPLICATION_SHA");
  requireCheck(/^[a-f0-9]{40}$/.test(expected.toolingSha ?? ""), "TOOLING_SHA_REQUIRED");
  requireCheck(/^[a-z0-9]{5,30}$/.test(expected.appId ?? ""), "APP_ID_REQUIRED");
  requireCheck(Array.isArray(expected.forbiddenAppIds) && expected.forbiddenAppIds.length > 0 && expected.forbiddenAppIds.every(id => typeof id === "string" && id.length > 0), "LIVE_APP_EXCLUSION_REQUIRED");
  requireCheck(!expected.forbiddenAppIds.includes(expected.appId), "FORBIDDEN_APP");
  eq(observed.account, expected.account, "ACCOUNT_MISMATCH");
  eq(observed.region, expected.region, "REGION_MISMATCH");
  eq(observed.appId, expected.appId, "APP_MISMATCH");
  eq(observed.appName, expected.appName, "APP_NAME_MISMATCH");
  eq(observed.appArn, `arn:aws:amplify:${expected.region}:${expected.account}:apps/${expected.appId}`, "APP_OWNERSHIP");
  eq(observed.branch, expected.branch, "BRANCH_MISMATCH");
  eq(observed.commit, expected.toolingSha, "COMMIT_MISMATCH");
  eq(observed.buildAppId, expected.appId, "BUILD_APP_MISMATCH");
  eq(observed.buildBranch, expected.branch, "BUILD_BRANCH_MISMATCH");
  requireCheck(observed.autoBuild === false && observed.autoBranches === false && observed.previews === false, "AUTOMATION_ENABLED");
  requireCheck(observed.basicAuth === true, "ACCESS_CONTROL_REQUIRED");
}

export function checkOutputs(expected, outputs, metadata) {
  const r = expected.resources;
  requireCheck(r && ["userPool", "userPoolClient", "identityPool", "apiId", "bucket"].every(key => typeof r[key] === "string" && r[key].length > 0), "EXPECTED_RESOURCES_REQUIRED");
  const root = expected.rootStackArn;
  requireCheck(typeof root === "string" && root.startsWith(`arn:aws:cloudformation:${expected.region}:${expected.account}:stack/`) && !root.includes("sandbox"), "ROOT_REQUIRED");
  eq(metadata.linkedRoot, root, "BRANCH_ROOT_MISMATCH");
  eq(metadata.rootArn, root, "ROOT_MISMATCH");
  requireCheck(metadata.rootParent == null, "ROOT_IS_NESTED");
  eq(metadata.tags?.["amplify:app-id"], expected.appId, "ROOT_APP_TAG");
  eq(metadata.tags?.["amplify:branch-name"], expected.branch, "ROOT_BRANCH_TAG");
  eq(metadata.tags?.["amplify:deployment-type"], "branch", "ROOT_TYPE");
  const types = { userPool: "AWS::Cognito::UserPool", userPoolClient: "AWS::Cognito::UserPoolClient", identityPool: "AWS::Cognito::IdentityPool", apiId: "AWS::AppSync::GraphQLApi", bucket: "AWS::S3::Bucket" };
  for (const [key, type] of Object.entries(types)) requireCheck(metadata.ownedResources?.some(item => item.type === type && item.id === r[key]), "RESOURCE_NOT_IN_STACK");
  requireCheck(outputs && typeof outputs === "object", "OUTPUTS_MALFORMED");
  eq(outputs.auth?.aws_region, expected.region, "AUTH_REGION");
  eq(outputs.data?.aws_region, expected.region, "DATA_REGION");
  eq(outputs.storage?.aws_region, expected.region, "STORAGE_REGION");
  eq(outputs.auth?.user_pool_id, r.userPool, "USER_POOL_MISMATCH");
  eq(outputs.auth?.user_pool_client_id, r.userPoolClient, "CLIENT_MISMATCH");
  eq(outputs.auth?.identity_pool_id, r.identityPool, "IDENTITY_MISMATCH");
  eq(outputs.storage?.bucket_name, r.bucket, "BUCKET_MISMATCH");
  eq(metadata.userPoolArn, `arn:aws:cognito-idp:${expected.region}:${expected.account}:userpool/${r.userPool}`, "POOL_OWNERSHIP");
  eq(metadata.clientPool, r.userPool, "CLIENT_POOL_ASSOCIATION");
  eq(metadata.clientId, r.userPoolClient, "CLIENT_ID");
  eq(metadata.identityId, r.identityPool, "IDENTITY_ID");
  requireCheck(metadata.identityProviders?.some(p => p.ClientId === r.userPoolClient && p.ProviderName === `cognito-idp.${expected.region}.amazonaws.com/${r.userPool}`), "IDENTITY_PROVIDER_ASSOCIATION");
  eq(metadata.apiArn, `arn:aws:appsync:${expected.region}:${expected.account}:apis/${r.apiId}`, "API_OWNERSHIP");
  eq(outputs.data?.url, metadata.apiUrl, "API_URL_MISMATCH");
  requireCheck(new URL(metadata.apiUrl).protocol === "https:", "API_URL_PROTOCOL");
  eq(metadata.bucketRegion, expected.region, "BUCKET_REGION");
  requireCheck(metadata.bucketOwnerVerified === true, "BUCKET_OWNER");
  // No unverified alternate buckets or cross-environment override sections.
  requireCheck(outputs.custom == null, "UNVERIFIED_CUSTOM_OUTPUTS");
  if (outputs.storage.buckets) for (const bucket of outputs.storage.buckets) {
    eq(bucket.bucket_name, r.bucket, "ALTERNATE_BUCKET");
    eq(bucket.aws_region, expected.region, "ALTERNATE_BUCKET_REGION");
  }
}

export async function clearBuildArtifacts(workspace) {
  const root = await realpath(workspace);
  for (const name of ["amplify_outputs.json", ".next"]) {
    const path = resolve(root, name);
    const rel = relative(root, path);
    requireCheck(rel && !rel.startsWith("..") && !isAbsolute(rel), "UNSAFE_BUILD_PATH");
    let stat;
    try { stat = await lstat(path); } catch (error) { if (error.code === "ENOENT") continue; throw new Error("BUILD_PATH_READ_FAILED"); }
    requireCheck(!stat.isSymbolicLink(), "BUILD_PATH_LINK_REJECTED");
    // Do not follow Windows junctions/symlinks through an artifact directory.
    eq(await realpath(path), path, "BUILD_PATH_REDIRECTED");
    await rm(path, { recursive: stat.isDirectory(), force: false });
  }
}
export async function loadOutputs(workspace) {
  try {
    const path = join(workspace, "amplify_outputs.json");
    const stat = await lstat(path);
    requireCheck(stat.isFile() && !stat.isSymbolicLink() && stat.size <= 2_000_000, "OUTPUTS_FILE");
    return JSON.parse(await readFile(path, "utf8"));
  } catch { throw new Error("OUTPUTS_UNREADABLE"); }
}

// Dependency injection is only a test/tooling boundary, never application code.
// The live entry point deliberately does not supply deployment callbacks yet.
export async function validationSequence(expected, io) {
  try {
    checkTarget(expected, await io.target());
    await io.clear();
    await io.install();
    await io.deploy(); // must resolve successfully before output generation
    await io.generate();
    checkOutputs(expected, await io.outputs(), await io.metadata());
    await io.frontend();
    // Recheck immediately before permitting the publisher to consume artifacts.
    checkTarget(expected, await io.target());
    checkOutputs(expected, await io.outputs(), await io.metadata());
    await io.publish();
    io.log("VALIDATION_OK");
    return 0;
  } catch {
    // Never echo SDK/CLI errors, outputs, identifiers, or nested exception text.
    io.log("VALIDATION_BLOCKED");
    return 1;
  }
}
