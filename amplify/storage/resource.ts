import { defineStorage } from "@aws-amplify/backend";
import { processPublicPassportImage } from "../functions/process-public-passport-image/resource.ts";
import { removePublicPassportImage } from "../functions/remove-public-passport-image/resource.ts";
import { resolvePublicPassportImage } from "../functions/resolve-public-passport-image/resource.ts";
import { verifyPrivateImage } from "../functions/verify-private-image/resource.ts";

export const storage = defineStorage({
  name: "unifiedRangePrivateImages",
  access: (allow) => ({
    "private/equipment/{entity_id}/*": [
      allow.entity("identity").to(["read", "write", "delete"]),
      allow.resource(verifyPrivateImage).to(["get"]),
      allow.resource(processPublicPassportImage).to(["get"])
    ],
    "private/targets/{entity_id}/*": [
      allow.entity("identity").to(["read", "write", "delete"]),
      allow.resource(verifyPrivateImage).to(["get"])
    ],
    "public/passports/{snapshot_id}/cover/*": [
      allow.resource(processPublicPassportImage).to(["get", "write", "delete"]),
      allow.resource(removePublicPassportImage).to(["delete"]),
      allow.resource(resolvePublicPassportImage).to(["get"])
    ]
  })
});
