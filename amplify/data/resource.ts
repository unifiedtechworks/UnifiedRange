import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

const schema = a.schema({
  UserProfile: a
    .model({
      ownerId: a.string().required(),
      displayName: a.string().required(),
      username: a.string(),
      bio: a.string(),
      privacyDefault: a.enum(["private", "public"]),
      createdAt: a.datetime(),
      updatedAt: a.datetime()
    })
    .authorization((allow) => [allow.owner()]),

  EquipmentPassport: a
    .model({
      ownerId: a.string().required(),
      equipmentType: a.enum(["rifle", "pistol", "bow", "crossbow", "shotgun", "other"]),
      nickname: a.string().required(),
      manufacturer: a.string().required(),
      model: a.string().required(),
      caliberCategory: a.string(),
      opticSightSummary: a.string(),
      projectileAmmoSummary: a.string(),
      useCaseTags: a.string().array(),
      roundShotCount: a.integer(),
      privateNotes: a.string(),
      publicNotes: a.string(),
      visibility: a.enum(["private", "public"]),
      createdAt: a.datetime(),
      updatedAt: a.datetime()
    })
    .authorization((allow) => [allow.owner()]),

  ProjectileProfile: a
    .model({
      ownerId: a.string().required(),
      projectileType: a.enum(["ammo", "arrow", "bolt", "pellet", "other"]),
      manufacturer: a.string().required(),
      productLine: a.string().required(),
      caliberCategory: a.string().required(),
      bulletWeight: a.string(),
      bulletType: a.string(),
      lotNumber: a.string(),
      purchasedCount: a.integer(),
      remainingCount: a.integer(),
      arrowShaft: a.string(),
      arrowSpine: a.string(),
      pointBroadhead: a.string(),
      fletching: a.string(),
      totalWeight: a.string(),
      privateNotes: a.string(),
      publicNotes: a.string(),
      createdAt: a.datetime(),
      updatedAt: a.datetime()
    })
    .authorization((allow) => [allow.owner()]),

  OpticSightProfile: a
    .model({
      ownerId: a.string().required(),
      sightType: a.enum(["scope", "red_dot", "iron_sight", "bow_sight", "other"]),
      manufacturer: a.string().required(),
      model: a.string().required(),
      reticleOrPinSetup: a.string(),
      magnification: a.string(),
      sightUnit: a.string(),
      clickValue: a.string(),
      privateNotes: a.string(),
      publicNotes: a.string(),
      createdAt: a.datetime(),
      updatedAt: a.datetime()
    })
    .authorization((allow) => [allow.owner()]),

  RangeSession: a
    .model({
      ownerId: a.string().required(),
      equipmentPassportId: a.id().required(),
      projectileProfileId: a.id(),
      opticSightProfileId: a.id(),
      date: a.date().required(),
      distance: a.float().required(),
      distanceUnit: a.enum(["yards", "meters"]),
      discipline: a.string(),
      position: a.string(),
      supportRestType: a.string(),
      weatherNotes: a.string(),
      windNotes: a.string(),
      groupSizeOrScore: a.string(),
      coldBoreFirstShot: a.boolean(),
      cleanFouledState: a.string(),
      accessoryNotes: a.string(),
      confidenceRating: a.integer(),
      sessionNotes: a.string(),
      targetPhotoPlaceholder: a.string(),
      shareablePublicSummary: a.boolean(),
      publicSummary: a.string(),
      createdAt: a.datetime(),
      updatedAt: a.datetime()
    })
    .authorization((allow) => [allow.owner()]),

  MaintenanceLogEntry: a
    .model({
      ownerId: a.string().required(),
      equipmentPassportId: a.id().required(),
      serviceDate: a.date().required(),
      category: a.string().required(),
      summary: a.string().required(),
      notes: a.string(),
      nextDueDate: a.date(),
      nextDueCount: a.integer(),
      isPrivate: a.boolean(),
      createdAt: a.datetime(),
      updatedAt: a.datetime()
    })
    .authorization((allow) => [allow.owner()]),

  HuntingChecklist: a
    .model({
      ownerId: a.string().required(),
      title: a.string().required(),
      region: a.string(),
      season: a.string(),
      equipmentPassportId: a.id(),
      itemsJson: a.json(),
      privateNotes: a.string(),
      createdAt: a.datetime(),
      updatedAt: a.datetime()
    })
    .authorization((allow) => [allow.owner()]),

  PublicPassportSnapshot: a
    .model({
      ownerId: a.string().required(),
      equipmentPassportId: a.id().required(),
      title: a.string().required(),
      equipmentType: a.string().required(),
      manufacturer: a.string(),
      model: a.string(),
      caliberCategory: a.string(),
      opticSightSummary: a.string(),
      projectileAmmoSummary: a.string(),
      useCaseTags: a.string().array(),
      publicNotes: a.string(),
      publicRangeSummariesJson: a.json(),
      publicPhotoPlaceholdersJson: a.json(),
      publishedAt: a.datetime(),
      updatedAt: a.datetime()
    })
    .authorization((allow) => [allow.owner(), allow.publicApiKey().to(["read"])]),

  Comment: a
    .model({
      ownerId: a.string().required(),
      publicPassportSnapshotId: a.id().required(),
      body: a.string().required(),
      status: a.enum(["visible", "hidden", "removed"]),
      createdAt: a.datetime(),
      updatedAt: a.datetime()
    })
    .authorization((allow) => [allow.authenticated()]),

  Reaction: a
    .model({
      ownerId: a.string().required(),
      publicPassportSnapshotId: a.id().required(),
      reactionType: a.enum(["useful", "interesting", "thanks"]),
      createdAt: a.datetime()
    })
    .authorization((allow) => [allow.authenticated()]),

  Report: a
    .model({
      ownerId: a.string().required(),
      publicPassportSnapshotId: a.id(),
      commentId: a.id(),
      reason: a.enum([
        "unsafe_weapon_content",
        "illegal_hunting_or_poaching",
        "personal_information",
        "harassment_or_threat",
        "sales_or_marketplace_activity",
        "other"
      ]),
      details: a.string(),
      status: a.enum(["submitted", "reviewing", "resolved"]),
      createdAt: a.datetime(),
      updatedAt: a.datetime()
    })
    .authorization((allow) => [allow.authenticated()])
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "userPool",
    apiKeyAuthorizationMode: {
      expiresInDays: 30
    }
  }
});
