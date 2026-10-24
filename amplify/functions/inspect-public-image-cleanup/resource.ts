import { defineFunction } from "@aws-amplify/backend";

export const inspectPublicImageCleanup = defineFunction({
  name: "inspect-public-image-cleanup",
  entry: "./handler.ts",
  resourceGroupName: "data",
  timeoutSeconds: 10,
  memoryMB: 256,
  runtime: 24,
  logging: {
    format: "json",
    level: "info",
    retention: "1 month"
  }
});
