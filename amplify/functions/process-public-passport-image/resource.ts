import { defineFunction } from "@aws-amplify/backend";

export const processPublicPassportImage = defineFunction({
  name: "process-public-passport-image",
  entry: "./handler.ts",
  resourceGroupName: "data",
  timeoutSeconds: 45,
  memoryMB: 1024,
  ephemeralStorageSizeMB: 512,
  runtime: 20,
  logging: {
    format: "json",
    level: "info",
    retention: "1 month"
  }
});
