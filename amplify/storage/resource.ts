import { defineStorage } from "@aws-amplify/backend";
import { verifyPrivateImage } from "../functions/verify-private-image/resource";

export const storage = defineStorage({
  name: "unifiedRangePrivateImages",
  access: (allow) => ({
    "private/equipment/{entity_id}/*": [
      allow.entity("identity").to(["read", "write", "delete"]),
      allow.resource(verifyPrivateImage).to(["get"])
    ],
    "private/targets/{entity_id}/*": [
      allow.entity("identity").to(["read", "write", "delete"]),
      allow.resource(verifyPrivateImage).to(["get"])
    ]
  })
});
