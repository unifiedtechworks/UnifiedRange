import { defineFunction } from "@aws-amplify/backend";

export const retryRemovedPublicImageCleanup = defineFunction({
  name: "retry-removed-public-image-cleanup",
  entry: "./handler.ts",
  resourceGroupName: "data",
  timeoutSeconds: 15,
  memoryMB: 256,
  runtime: 24,
  logging: {
    format: "json",
    level: "info",
    retention: "1 month"
  }
});
