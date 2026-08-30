import { defineFunction } from "@aws-amplify/backend";

export const resolvePublicPassportImage = defineFunction({
  name: "resolve-public-passport-image",
  entry: "./handler.ts",
  resourceGroupName: "data",
  timeoutSeconds: 10,
  memoryMB: 256,
  runtime: 20,
  logging: {
    format: "json",
    level: "info",
    retention: "1 month"
  }
});
