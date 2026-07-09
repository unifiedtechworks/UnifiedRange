import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

// TODO: Wire mock-data screens to generated AppSync clients after the sandbox
// produces amplify_outputs.json. Until then, this schema is the backend contract.
const schema = a.schema({
  UserProfile: a
    .model({
      ownerId: a.string().required(),
      displayName: a.string().required(),
      username: a.string(),
      avatarUrl: a.string(),
      bio: a.string(),
      privacyDefault: a.enum(["private", "public_sanitized"]),
      createdAt: a.datetime(),
      updatedAt: a.datetime()
    })
    .authorization((allow) => [allow.ownerDefinedIn("ownerId")]),

  EquipmentPassport: a
    .model({
      ownerId: a.string().required(),
      equipmentType: a.enum(["rifle", "pistol", "bow", "crossbow", "shotgun", "other"]),
      nickname: a.string().required(),
      manufacturer: a.string().required(),
      model: a.string().required(),
      category: a.string().required(),
      caliber: a.string(),
      barrelLength: a.string(),
      twistRate: a.string(),
      drawWeight: a.string(),
      drawLength: a.string(),
      bowType: a.string(),
      opticOrSightId: a.id(),
      opticSightSummary: a.string(),
      accessories: a.string().array(),
      preferredProjectileId: a.id(),
      projectileAmmoSummary: a.string(),
      useCaseTags: a.string().array(),
      roundOrShotCount: a.integer(),
      maintenanceNotes: a.string(),
      privateNotes: a.string(),
      publicNotes: a.string(),
      coverPhotoUrl: a.string(),
      isPublic: a.boolean(),
      createdAt: a.datetime(),
      updatedAt: a.datetime()
    })
    .authorization((allow) => [allow.ownerDefinedIn("ownerId")]),

  ProjectileProfile: a
    .model({
      ownerId: a.string().required(),
      projectileType: a.enum(["ammo", "arrow", "bolt", "pellet", "other"]),
      manufacturer: a.string().required(),
      productLine: a.string().required(),
      caliber: a.string(),
      bulletWeight: a.string(),
      bulletType: a.string(),
      lotNumber: a.string(),
      roundsPurchased: a.integer(),
      roundsRemaining: a.integer(),
      arrowShaft: a.string(),
      arrowSpine: a.string(),
      pointOrBroadhead: a.string(),
      fletching: a.string(),
      totalWeight: a.string(),
      privateNotes: a.string(),
      publicNotes: a.string(),
      createdAt: a.datetime(),
      updatedAt: a.datetime()
    })
    .authorization((allow) => [allow.ownerDefinedIn("ownerId")]),

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
    .authorization((allow) => [allow.ownerDefinedIn("ownerId")]),

  RangeSession: a
    .model({
      ownerId: a.string().required(),
      equipmentPassportId: a.id().required(),
      projectileProfileId: a.id(),
      date: a.date().required(),
      distance: a.float().required(),
      distanceUnit: a.enum(["yards", "meters"]),
      discipline: a.string(),
      position: a.string(),
      supportType: a.string(),
      weatherNotes: a.string(),
      windNotesFreeText: a.string(),
      groupSize: a.string(),
      score: a.string(),
      isColdBore: a.boolean(),
      isCleanBarrel: a.boolean(),
      isSuppressed: a.boolean(),
      confidenceRating: a.integer(),
      sessionNotes: a.string(),
      isPublicSummary: a.boolean(),
      createdAt: a.datetime(),
      updatedAt: a.datetime()
    })
    .authorization((allow) => [allow.ownerDefinedIn("ownerId")]),

  TargetPhoto: a
    .model({
      ownerId: a.string().required(),
      rangeSessionId: a.id().required(),
      imageUrl: a.string().required(),
      caption: a.string(),
      manuallyEnteredGroupSize: a.string(),
      manuallyEnteredScore: a.string(),
      isPublic: a.boolean(),
      createdAt: a.datetime(),
      updatedAt: a.datetime()
    })
    .authorization((allow) => [allow.ownerDefinedIn("ownerId")]),

  MaintenanceLogEntry: a
    .model({
      ownerId: a.string().required(),
      equipmentPassportId: a.id().required(),
      date: a.date().required(),
      roundOrShotCount: a.integer(),
      maintenanceType: a.string().required(),
      partsChanged: a.string().array(),
      cleaningNotes: a.string(),
      torqueCheckNotes: a.string(),
      privateNotes: a.string(),
      notes: a.string(),
      createdAt: a.datetime(),
      updatedAt: a.datetime()
    })
    .authorization((allow) => [allow.ownerDefinedIn("ownerId")]),

  HuntingChecklist: a
    .model({
      ownerId: a.string().required(),
      equipmentPassportId: a.id().required(),
      huntName: a.string().required(),
      season: a.string(),
      species: a.string(),
      checklistItems: a.json(),
      notes: a.string(),
      createdAt: a.datetime(),
      updatedAt: a.datetime()
    })
    .authorization((allow) => [allow.ownerDefinedIn("ownerId")]),

  // Public snapshots must be generated from sanitized private records, not
  // written directly from unreviewed private fields.
  PublicPassportSnapshot: a
    .model({
      ownerId: a.string().required(),
      equipmentPassportId: a.id().required(),
      title: a.string().required(),
      equipmentType: a.enum(["rifle", "pistol", "bow", "crossbow", "shotgun", "other"]),
      manufacturer: a.string(),
      model: a.string(),
      category: a.string(),
      caliber: a.string(),
      opticOrSightSummary: a.string(),
      projectileSummary: a.string(),
      useCaseTags: a.string().array(),
      publicNotes: a.string(),
      coverPhotoUrl: a.string(),
      publicStats: a.json(),
      publicRangeSessions: a.json(),
      publicPhotoPlaceholders: a.json(),
      createdAt: a.datetime(),
      updatedAt: a.datetime()
    })
    .authorization((allow) => [allow.ownerDefinedIn("ownerId"), allow.publicApiKey().to(["read"])]),

  Comment: a
    .model({
      authorId: a.string().required(),
      targetType: a.enum(["passport", "session", "public_passport"]),
      targetId: a.id().required(),
      body: a.string().required(),
      status: a.enum(["visible", "hidden", "reported"]),
      createdAt: a.datetime(),
      updatedAt: a.datetime()
    })
    .authorization((allow) => [allow.ownerDefinedIn("authorId"), allow.authenticated().to(["read"])]),

  Reaction: a
    .model({
      userId: a.string().required(),
      targetType: a.enum(["passport", "session", "public_passport"]),
      targetId: a.id().required(),
      reactionType: a.enum([
        "helpful_setup",
        "similar_to_mine",
        "good_hunting_build",
        "budget_friendly",
        "lightweight",
        "well_documented",
        "beginner_friendly"
      ]),
      createdAt: a.datetime()
    })
    .authorization((allow) => [allow.ownerDefinedIn("userId"), allow.authenticated().to(["read"])]),

  Report: a
    .model({
      reporterId: a.string().required(),
      targetType: a.enum(["passport", "session", "public_passport"]),
      targetId: a.id().required(),
      reason: a.string().required(),
      details: a.string(),
      status: a.enum(["open", "reviewed", "resolved"]),
      createdAt: a.datetime(),
      updatedAt: a.datetime()
    })
    .authorization((allow) => [allow.ownerDefinedIn("reporterId")])
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
