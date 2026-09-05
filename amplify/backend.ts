import { defineBackend } from "@aws-amplify/backend";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { auth } from "./auth/resource.ts";
import { data } from "./data/resource.ts";
import { processPublicPassportImage } from "./functions/process-public-passport-image/resource.ts";
import { removePublicPassportImage } from "./functions/remove-public-passport-image/resource.ts";
import { resolvePublicPassportImage } from "./functions/resolve-public-passport-image/resource.ts";
import { verifyPrivateImage } from "./functions/verify-private-image/resource.ts";
import { storage } from "./storage/resource.ts";

const backend = defineBackend({
  auth,
  data,
  processPublicPassportImage,
  removePublicPassportImage,
  resolvePublicPassportImage,
  verifyPrivateImage,
  storage
});

const verifierLambda = backend.verifyPrivateImage.resources.lambda;
const privateImageAssetTable = backend.data.resources.tables.PrivateImageAsset;
const equipmentPassportTable = backend.data.resources.tables.EquipmentPassport;
const rangeSessionTable = backend.data.resources.tables.RangeSession;
const publicPassportSnapshotTable = backend.data.resources.tables.PublicPassportSnapshot;
const publicImageAssetTable = backend.data.resources.tables.PublicImageAsset;
const userProfileTable = backend.data.resources.tables.UserProfile;
const usernameReservationTable = backend.data.resources.tables.UsernameReservation;
const imageDeliveryLambda = backend.resolvePublicPassportImage.resources.lambda;
const imageCleanupLambda = backend.removePublicPassportImage.resources.lambda;

function restrictDynamoAttributes(attributes: string[]) {
  return {
    "ForAllValues:StringEquals": {
      "dynamodb:Attributes": attributes
    }
  };
}

function restrictDynamoTransactionAttributes(attributes: string[]) {
  return {
    ...restrictDynamoAttributes(attributes),
    "ForAnyValue:StringEquals": {
      "dynamodb:EnclosingOperation": ["TransactWriteItems"]
    }
  };
}

backend.resolvePublicPassportImage.addEnvironment("PUBLIC_PASSPORT_SNAPSHOT_TABLE_NAME", publicPassportSnapshotTable.tableName);
backend.resolvePublicPassportImage.addEnvironment("PUBLIC_IMAGE_ASSET_TABLE_NAME", publicImageAssetTable.tableName);
backend.resolvePublicPassportImage.addEnvironment("EQUIPMENT_PASSPORT_TABLE_NAME", equipmentPassportTable.tableName);
backend.resolvePublicPassportImage.addEnvironment("USER_PROFILE_TABLE_NAME", userProfileTable.tableName);
backend.resolvePublicPassportImage.addEnvironment("USER_PROFILE_OWNER_INDEX_NAME", "userProfilesByOwnerId");

backend.removePublicPassportImage.addEnvironment("PUBLIC_PASSPORT_SNAPSHOT_TABLE_NAME", publicPassportSnapshotTable.tableName);
backend.removePublicPassportImage.addEnvironment("PUBLIC_IMAGE_ASSET_TABLE_NAME", publicImageAssetTable.tableName);
backend.removePublicPassportImage.addEnvironment("PUBLIC_IMAGE_ASSET_SNAPSHOT_INDEX_NAME", "publicImageAssetsBySnapshotId");

imageCleanupLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:GetItem"],
    resources: [publicPassportSnapshotTable.tableArn],
    conditions: restrictDynamoAttributes([
      "id",
      "ownerId",
      "equipmentPassportId",
      "publicImageAssetId",
      "publicImageKey",
      "publicImageAltText",
      "updatedAt"
    ])
  })
);

imageCleanupLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:GetItem"],
    resources: [publicImageAssetTable.tableArn],
    conditions: restrictDynamoAttributes([
      "id",
      "ownerId",
      "publicPassportSnapshotId",
      "sourceType",
      "sourceRecordId",
      "publicImageKey",
      "status",
      "updatedAt"
    ])
  })
);

imageCleanupLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:Query"],
    resources: [`${publicImageAssetTable.tableArn}/index/publicImageAssetsBySnapshotId`],
    conditions: restrictDynamoAttributes(["id", "publicPassportSnapshotId"])
  })
);

imageCleanupLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:UpdateItem"],
    resources: [publicPassportSnapshotTable.tableArn],
    conditions: restrictDynamoTransactionAttributes([
      "id",
      "ownerId",
      "equipmentPassportId",
      "publicImageAssetId",
      "publicImageKey",
      "publicImageAltText",
      "updatedAt"
    ])
  })
);

imageCleanupLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:UpdateItem"],
    resources: [publicImageAssetTable.tableArn],
    conditions: restrictDynamoTransactionAttributes([
      "id",
      "ownerId",
      "publicPassportSnapshotId",
      "sourceType",
      "sourceRecordId",
      "publicImageKey",
      "publicImageAltText",
      "status",
      "processingErrorCode",
      "updatedAt"
    ])
  })
);

imageCleanupLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:UpdateItem"],
    resources: [publicImageAssetTable.tableArn],
    conditions: restrictDynamoAttributes([
      "id",
      "ownerId",
      "publicPassportSnapshotId",
      "sourceType",
      "sourceRecordId",
      "publicImageKey",
      "publicImageAltText",
      "status",
      "processingErrorCode",
      "updatedAt"
    ])
  })
);

imageDeliveryLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:GetItem"],
    resources: [publicPassportSnapshotTable.tableArn],
    conditions: restrictDynamoAttributes([
      "id",
      "ownerId",
      "equipmentPassportId",
      "publicImageAssetId",
      "publicImageKey",
      "publicImageAltText"
    ])
  })
);

imageDeliveryLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:GetItem"],
    resources: [publicImageAssetTable.tableArn],
    conditions: restrictDynamoAttributes([
      "id",
      "ownerId",
      "publicPassportSnapshotId",
      "sourceType",
      "sourceRecordId",
      "publicImageKey",
      "publicImageAltText",
      "status"
    ])
  })
);

imageDeliveryLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:GetItem"],
    resources: [equipmentPassportTable.tableArn],
    conditions: restrictDynamoAttributes(["id", "ownerId", "isPublic"])
  })
);

imageDeliveryLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:Query"],
    resources: [`${userProfileTable.tableArn}/index/userProfilesByOwnerId`],
    conditions: restrictDynamoAttributes(["id", "ownerId", "username", "accountVisibility"])
  })
);

imageDeliveryLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:GetItem"],
    resources: [userProfileTable.tableArn],
    conditions: restrictDynamoAttributes(["id", "ownerId", "username", "accountVisibility"])
  })
);

backend.verifyPrivateImage.addEnvironment("PRIVATE_IMAGE_ASSET_TABLE_NAME", privateImageAssetTable.tableName);
backend.verifyPrivateImage.addEnvironment("EQUIPMENT_PASSPORT_TABLE_NAME", equipmentPassportTable.tableName);
backend.verifyPrivateImage.addEnvironment("RANGE_SESSION_TABLE_NAME", rangeSessionTable.tableName);

verifierLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:GetItem"],
    resources: [privateImageAssetTable.tableArn],
    conditions: restrictDynamoAttributes([
      "id",
      "ownerId",
      "ownerSub",
      "sourceType",
      "sourceRecordId",
      "storageKey",
      "storageIdentityId",
      "sanitizedFileName",
      "contentType",
      "sizeBytes"
    ])
  })
);

const imageProcessorLambda = backend.processPublicPassportImage.resources.lambda;

backend.processPublicPassportImage.addEnvironment("PRIVATE_IMAGE_ASSET_TABLE_NAME", privateImageAssetTable.tableName);
backend.processPublicPassportImage.addEnvironment("EQUIPMENT_PASSPORT_TABLE_NAME", equipmentPassportTable.tableName);
backend.processPublicPassportImage.addEnvironment("PUBLIC_PASSPORT_SNAPSHOT_TABLE_NAME", publicPassportSnapshotTable.tableName);
backend.processPublicPassportImage.addEnvironment("PUBLIC_IMAGE_ASSET_TABLE_NAME", publicImageAssetTable.tableName);
backend.processPublicPassportImage.addEnvironment("USER_PROFILE_TABLE_NAME", userProfileTable.tableName);
backend.processPublicPassportImage.addEnvironment("USERNAME_RESERVATION_TABLE_NAME", usernameReservationTable.tableName);
backend.processPublicPassportImage.addEnvironment("USER_PROFILE_OWNER_INDEX_NAME", "userProfilesByOwnerId");

imageProcessorLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:GetItem"],
    resources: [privateImageAssetTable.tableArn],
    conditions: restrictDynamoAttributes([
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
    ])
  })
);

imageProcessorLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:GetItem"],
    resources: [equipmentPassportTable.tableArn],
    conditions: restrictDynamoAttributes(["id", "ownerId", "privateCoverPhotoKey", "isPublic"])
  })
);

imageProcessorLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:GetItem"],
    resources: [publicPassportSnapshotTable.tableArn],
    conditions: restrictDynamoAttributes([
      "id",
      "ownerId",
      "equipmentPassportId",
      "publicImageAssetId",
      "publicImageKey",
      "publicImageAltText",
      "updatedAt"
    ])
  })
);

imageProcessorLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:GetItem"],
    resources: [publicImageAssetTable.tableArn],
    conditions: restrictDynamoAttributes([
      "id",
      "ownerId",
      "publicPassportSnapshotId",
      "privateImageAssetId",
      "sourceType",
      "sourceRecordId",
      "publicImageKey",
      "publicImageAltText",
      "status"
    ])
  })
);

imageProcessorLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:GetItem"],
    resources: [usernameReservationTable.tableArn],
    conditions: restrictDynamoAttributes(["id", "ownerId"])
  })
);

imageProcessorLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:Query"],
    resources: [`${userProfileTable.tableArn}/index/userProfilesByOwnerId`],
    conditions: restrictDynamoAttributes(["id", "ownerId", "username", "accountVisibility"])
  })
);

imageProcessorLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:UpdateItem"],
    resources: [publicImageAssetTable.tableArn],
    conditions: restrictDynamoAttributes([
      "id",
      "ownerId",
      "publicPassportSnapshotId",
      "privateImageAssetId",
      "sourceType",
      "sourceRecordId",
      "publicImageKey",
      "publicImageAltText",
      "status",
      "processingErrorCode",
      "consentConfirmedAt",
      "createdAt",
      "updatedAt"
    ])
  })
);

imageProcessorLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:ConditionCheckItem"],
    resources: [privateImageAssetTable.tableArn],
    conditions: restrictDynamoTransactionAttributes([
      "id",
      "ownerId",
      "ownerSub",
      "bindingStatus",
      "sourceType",
      "sourceRecordId",
      "storageKey",
      "storageIdentityId",
      "contentType",
      "sizeBytes"
    ])
  })
);

imageProcessorLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:ConditionCheckItem"],
    resources: [equipmentPassportTable.tableArn],
    conditions: restrictDynamoTransactionAttributes(["id", "ownerId", "privateCoverPhotoKey", "isPublic"])
  })
);

imageProcessorLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:ConditionCheckItem"],
    resources: [userProfileTable.tableArn],
    conditions: restrictDynamoTransactionAttributes(["id", "ownerId", "username", "accountVisibility"])
  })
);

imageProcessorLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:ConditionCheckItem"],
    resources: [usernameReservationTable.tableArn],
    conditions: restrictDynamoTransactionAttributes(["id", "ownerId"])
  })
);

imageProcessorLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:UpdateItem"],
    resources: [publicPassportSnapshotTable.tableArn],
    conditions: restrictDynamoTransactionAttributes([
      "id",
      "ownerId",
      "equipmentPassportId",
      "publicImageAssetId",
      "publicImageKey",
      "publicImageAltText",
      "updatedAt"
    ])
  })
);

verifierLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:GetItem"],
    resources: [equipmentPassportTable.tableArn],
    conditions: restrictDynamoAttributes(["id", "ownerId", "privateCoverPhotoKey"])
  })
);

verifierLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:GetItem"],
    resources: [rangeSessionTable.tableArn],
    conditions: restrictDynamoAttributes(["id", "ownerId"])
  })
);

verifierLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:UpdateItem"],
    resources: [privateImageAssetTable.tableArn],
    conditions: restrictDynamoAttributes(["id", "ownerId", "bindingStatus", "bindingFailureCode", "verifiedAt", "updatedAt"])
  })
);
