import { defineBackend } from "@aws-amplify/backend";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { auth } from "./auth/resource.ts";
import { data } from "./data/resource.ts";
import { verifyPrivateImage } from "./functions/verify-private-image/resource.ts";
import { storage } from "./storage/resource.ts";

const backend = defineBackend({
  auth,
  data,
  verifyPrivateImage,
  storage
});

const verifierLambda = backend.verifyPrivateImage.resources.lambda;
const privateImageAssetTable = backend.data.resources.tables.PrivateImageAsset;
const equipmentPassportTable = backend.data.resources.tables.EquipmentPassport;
const rangeSessionTable = backend.data.resources.tables.RangeSession;

backend.verifyPrivateImage.addEnvironment("PRIVATE_IMAGE_ASSET_TABLE_NAME", privateImageAssetTable.tableName);
backend.verifyPrivateImage.addEnvironment("EQUIPMENT_PASSPORT_TABLE_NAME", equipmentPassportTable.tableName);
backend.verifyPrivateImage.addEnvironment("RANGE_SESSION_TABLE_NAME", rangeSessionTable.tableName);

verifierLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:GetItem"],
    resources: [privateImageAssetTable.tableArn, equipmentPassportTable.tableArn, rangeSessionTable.tableArn]
  })
);

verifierLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:UpdateItem"],
    resources: [privateImageAssetTable.tableArn]
  })
);
