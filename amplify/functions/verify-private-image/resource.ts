import { defineFunction } from "@aws-amplify/backend";

export const verifyPrivateImage = defineFunction({
  name: "verify-private-image",
  entry: "./handler.ts",
  resourceGroupName: "data",
  timeoutSeconds: 15,
  memoryMB: 256,
  runtime: 20,
  logging: {
    format: "json",
    level: "info",
    retention: "1 month"
  }
});
