import { defineStorage } from "@aws-amplify/backend";

export const storage = defineStorage({
  name: "unifiedRangePrivateImages",
  access: (allow) => ({
    "private/{entity_id}/equipment/*": [allow.entity("identity").to(["read", "write", "delete"])],
    "private/{entity_id}/targets/*": [allow.entity("identity").to(["read", "write", "delete"])]
  })
});
