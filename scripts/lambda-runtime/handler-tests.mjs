import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { DynamoDBClient, GetItemCommand, QueryCommand, UpdateItemCommand, TransactWriteItemsCommand } from "@aws-sdk/client-dynamodb";
import { S3Client, HeadObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { Image, encodePng } from "image-js";
import { encode, decode } from "jpeg-js";

// This file is bundled with the real handler and real SDKs. Only SDK send()
// boundaries are mocked; no production authorization/codec code is replaced.
const tables = {
  PRIVATE_IMAGE_ASSET_TABLE_NAME: "fixture-private",
  EQUIPMENT_PASSPORT_TABLE_NAME: "fixture-equipment",
  PUBLIC_PASSPORT_SNAPSHOT_TABLE_NAME: "fixture-snapshot",
  PUBLIC_IMAGE_ASSET_TABLE_NAME: "fixture-public",
  USER_PROFILE_TABLE_NAME: "fixture-profile",
  USERNAME_RESERVATION_TABLE_NAME: "fixture-username",
  USER_PROFILE_OWNER_INDEX_NAME: "fixture-owner-index",
  unifiedRangePrivateImages_BUCKET_NAME: "fixture-bucket",
};
Object.assign(process.env, tables, { AWS_REGION: "us-east-1", AWS_EC2_METADATA_DISABLED: "true", AMPLIFY_SSM_ENV_CONFIG: "{}" });
for (const key of Object.keys(process.env)) assert.ok(!/^(AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN|GITHUB_TOKEN|GH_TOKEN)$/.test(key));
console.log(`Runtime ${process.version}; ${process.platform}/${process.arch}; ${existsSync("/etc/os-release") ? readFileSync("/etc/os-release", "utf8").split("\n").find(line => line.startsWith("PRETTY_NAME=")) : "local diagnostic, not Lambda evidence"}`);
if (process.env.EXPECTED_NODE_MAJOR) {
  assert.equal(Number(process.versions.node.split(".")[0]), Number(process.env.EXPECTED_NODE_MAJOR));
  assert.equal(process.platform, "linux");
  assert.equal(process.arch, "x64");
}

const event = () => ({ arguments: { publicPassportSnapshotId: "snapshot-fixture", privateImageAssetId: "asset-fixture", consentConfirmed: true, altText: "Synthetic image" }, identity: { sub: "owner-fixture", username: "owner-fixture" } });
let passed = 0;
async function check(name, body) { await body(); passed++; console.log(`PASS ${name}`); }

// Independently load the uninstrumented representative production bundle.
const plain = await import("./index.mjs");
await check("uninstrumented bundle initializes and exports handler", async () => assert.equal(typeof plain.handler, "function"));
await check("uninstrumented bundle rejects invalid IDs before I/O", async () => {
  const e = event(); e.arguments.privateImageAssetId = "";
  assert.equal((await plain.handler(e)).failureCode, "invalid_request");
});
await check("uninstrumented bundle rejects missing identity before I/O", async () => {
  const e = event(); e.identity = null;
  assert.equal((await plain.handler(e)).failureCode, "unauthorized");
});

const { handler } = await import("../../amplify/functions/process-public-passport-image/handler.ts");
const fileName = "1700000000000-00000000-0000-4000-8000-000000000001.jpg";
const storageKey = `private/equipment/identity-fixture/equipment-fixture/${fileName}`;
const av = object => Object.fromEntries(Object.entries(object).map(([k, v]) => [k, typeof v === "boolean" ? { BOOL: v } : typeof v === "number" ? { N: String(v) } : { S: v }]));
let state;
function reset(bytes, contentType = "image/jpeg") { state = { bytes, contentType, calls: [], puts: [], violations: [], transaction: null, foreign: false }; }
function unexpected(message) { state.violations.push(message); throw new Error(message); }
DynamoDBClient.prototype.send = async function (command) {
  state.calls.push("dynamo");
  const input = command.input;
  if (command instanceof GetItemCommand) {
    const id = input.Key.id.S;
    if (input.TableName === tables.PRIVATE_IMAGE_ASSET_TABLE_NAME) return { Item: av({ id, ownerId: state.foreign ? "other-owner" : "owner-fixture", ownerSub: "owner-fixture", sourceType: "equipment_cover", sourceRecordId: "equipment-fixture", storageKey, storageIdentityId: "identity-fixture", sanitizedFileName: fileName, contentType: state.contentType, sizeBytes: state.bytes.length, bindingStatus: "verified" }) };
    if (input.TableName === tables.PUBLIC_PASSPORT_SNAPSHOT_TABLE_NAME) return { Item: av({ id, ownerId: "owner-fixture", equipmentPassportId: "equipment-fixture" }) };
    if (input.TableName === tables.EQUIPMENT_PASSPORT_TABLE_NAME) return { Item: av({ id, ownerId: "owner-fixture", privateCoverPhotoKey: storageKey, isPublic: true }) };
    if (input.TableName === tables.USERNAME_RESERVATION_TABLE_NAME) return { Item: av({ id, ownerId: "owner-fixture" }) };
    if (input.TableName === tables.PUBLIC_IMAGE_ASSET_TABLE_NAME) return {};
  }
  if (command instanceof QueryCommand && input.TableName === tables.USER_PROFILE_TABLE_NAME) return { Items: [av({ id: "profile-fixture", ownerId: "owner-fixture", username: "fixture-user", accountVisibility: "public" })] };
  if (command instanceof UpdateItemCommand && input.TableName === tables.PUBLIC_IMAGE_ASSET_TABLE_NAME) return {};
  if (command instanceof TransactWriteItemsCommand) { state.transaction = input.TransactItems; return {}; }
  return unexpected("Unmocked DynamoDB command");
};
S3Client.prototype.send = async function (command) {
  state.calls.push("s3");
  const input = command.input;
  if (input.Bucket !== tables.unifiedRangePrivateImages_BUCKET_NAME) return unexpected("Unexpected bucket");
  if (command instanceof HeadObjectCommand && input.Key === storageKey) return { ContentType: state.contentType, ContentLength: state.bytes.length, ETag: "synthetic-etag" };
  if (command instanceof GetObjectCommand && input.Key === storageKey) {
    assert.equal(input.IfMatch, "synthetic-etag");
    return { ContentType: state.contentType, ETag: "synthetic-etag", Body: { transformToByteArray: async () => state.bytes } };
  }
  if (command instanceof PutObjectCommand && input.Key.startsWith("public/passports/snapshot-fixture/cover/")) { state.puts.push(input); return {}; }
  return unexpected("Unmocked S3 command");
};

function pixels(width, height, rgba = [30, 90, 180, 255]) {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) data.set(rgba, i);
  return { width, height, data };
}
function png(f) { return Buffer.from(encodePng(new Image(f.width, f.height, { data: f.data, colorModel: "RGBA", bitDepth: 8 }))); }
function segment(marker, data) { const header = Buffer.alloc(4); header[0] = 255; header[1] = marker; header.writeUInt16BE(data.length + 2, 2); return Buffer.concat([header, data]); }
function orientedJpeg() {
  const f = pixels(24, 12);
  for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) f.data.set([230, 20, 20, 255], (y * 24 + x) * 4);
  const jpeg = encode(f, 95).data;
  const exif = Buffer.from("45786966000049492a0008000000010012010300010000000600000000000000", "hex");
  return Buffer.concat([jpeg.subarray(0, 2), segment(0xe1, exif), segment(0xfe, Buffer.from("synthetic comment")), jpeg.subarray(2)]);
}
function checkMetadata(bytes) {
  assert.equal(bytes.readUInt16BE(0), 0xffd8);
  let offset = 2;
  while (offset < bytes.length) {
    assert.equal(bytes[offset], 255);
    const marker = bytes[offset + 1];
    if (marker === 0xda || marker === 0xd9) break;
    assert.ok(![0xe1, 0xe2, 0xed, 0xfe].includes(marker), "Derivative must not contain EXIF/ICC/IPTC/comments");
    offset += 2 + bytes.readUInt16BE(offset + 2);
  }
}
async function success(bytes, type, width, height) {
  reset(bytes, type);
  const result = await handler(event());
  assert.deepEqual(state.violations, []);
  assert.equal(result.processingStatus, "ready");
  assert.equal(state.puts.length, 1);
  assert.equal(state.transaction.length, 6);
  const put = state.puts[0];
  assert.equal(put.ContentType, "image/jpeg");
  assert.equal(put.ServerSideEncryption, "AES256");
  assert.equal(put.ContentLength, put.Body.length);
  assert.ok(put.Body.length <= 2 * 1024 * 1024);
  const expectedId = `img-${createHash("sha256").update("snapshot-fixture").update("\0").update("asset-fixture").update("\0").update(put.Body).digest("hex").slice(0, 40)}`;
  assert.equal(result.publicImageAssetId, expectedId);
  checkMetadata(put.Body);
  const decoded = decode(put.Body, { useTArray: true, tolerantDecoding: false });
  if (width !== undefined) { assert.equal(decoded.width, width); assert.equal(decoded.height, height); }
  assert.ok(Math.max(decoded.width, decoded.height) <= 1600);
  return decoded;
}
await check("full handler JPEG decode/re-encode and bounded derivative", async () => {
  const output = await success(encode(pixels(16, 8), 90).data, "image/jpeg", 16, 8);
  [30, 90, 180].forEach((v, i) => assert.ok(Math.abs(output.data[i] - v) < 15));
});
await check("full handler PNG transparency flattens to white", async () => {
  const output = await success(png(pixels(8, 4, [255, 0, 0, 0])), "image/png", 8, 4);
  assert.ok(output.data.slice(0, 3).every(v => v >= 250));
});
await check("full handler EXIF orientation and metadata removal", async () => {
  const output = await success(orientedJpeg(), "image/jpeg", 12, 24);
  assert.ok(output.data[0] > 180 && output.data[2] < 60, "Red left half rotates to top");
  const bottom = (23 * 12) * 4;
  assert.ok(output.data[bottom + 2] > 120, "Blue right half rotates to bottom");
});
await check("full handler resize respects 1600 dimension bound", async () => { await success(png(pixels(1800, 18)), "image/png", 1600, 16); });
await check("full handler high-entropy image remains under derivative byte limit", async () => {
  const f = pixels(1600, 1600);
  let seed = 12345;
  for (let i = 0; i < f.data.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    if (i % 4 !== 3) f.data[i] = seed >>> 24;
  }
  const bytes = encode(f, 90).data;
  assert.ok(bytes.length <= 6 * 1024 * 1024, "Synthetic source must meet the real input limit");
  await success(bytes, "image/jpeg");
});
for (const [name, bytes, type, failure] of [
  ["invalid image", Buffer.from("not-an-image"), "image/jpeg", "invalid_image"],
  ["unsupported type", Buffer.from("synthetic"), "image/webp", "unsupported_content_type"],
  ["source byte limit", Buffer.alloc(6 * 1024 * 1024 + 1), "image/jpeg", "file_too_large"],
  ["dimension limit", png(pixels(8193, 1)), "image/png", "dimensions_exceeded"],
]) await check(`full handler rejects ${name}`, async () => {
  reset(bytes, type); assert.equal((await handler(event())).failureCode, failure);
  assert.deepEqual(state.violations, []); assert.equal(state.puts.length, 0); assert.equal(state.transaction, null);
});
await check("full handler rejects cross-owner candidate", async () => {
  reset(encode(pixels(4, 4), 90).data); state.foreign = true;
  assert.equal((await handler(event())).failureCode, "unauthorized");
  assert.deepEqual(state.violations, []); assert.ok(!state.calls.includes("s3"));
});
await check("full handler requires explicit consent without I/O", async () => {
  reset(Buffer.from("unused")); const e = event(); e.arguments.consentConfirmed = false;
  assert.equal((await handler(e)).failureCode, "consent_required"); assert.deepEqual(state.calls, []);
});
console.log(`PASS ${passed} checks; uninstrumented initialization/rejections and full compiled handler with fail-closed SDK mocks. No AWS calls.`);
// Amplify's unchanged SSM banner schedules a refresh timer. End this bounded
// standalone test process after all awaited assertions, not a Lambda server.
process.exit(0);
