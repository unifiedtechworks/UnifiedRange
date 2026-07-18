import { defineStorage } from "@aws-amplify/backend";

export const storage = defineStorage({
  name: "unifiedRangePrivateImages",
  access: (allow) => ({
    "private/equipment/{entity_id}/*": [allow.entity("identity").to(["read", "write", "delete"])],
    "private/targets/{entity_id}/*": [allow.entity("identity").to(["read", "write", "delete"])]
  })
});
