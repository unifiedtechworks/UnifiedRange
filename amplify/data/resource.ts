import { type ClientSchema, a, defineData } from "@aws-amplify/backend";
import { verifyPrivateImage } from "../functions/verify-private-image/resource.ts";

// TODO: Wire mock-data screens to generated AppSync clients after the sandbox
// produces amplify_outputs.json. Until then, this schema is the backend contract.
const schema = a.schema({
  ReportTargetType: a.enum(["passport", "session", "public_passport", "comment"]),
  ReportStatus: a.enum(["open", "reviewed", "dismissed", "action_needed"]),
  PublicImageAssetSourceType: a.enum(["equipment_cover"]),
  PublicImageAssetStatus: a.enum(["draft", "processing", "ready", "failed", "removed"]),
  PrivateImageAssetSourceType: a.enum(["equipment_cover", "range_session_target"]),
  PrivateImageAssetBindingStatus: a.enum(["unverified", "verifying", "verified", "failed", "rejected", "removed"]),

  VerifyPrivateImageResult: a.customType({
    privateImageAssetId: a.id().required(),
    bindingStatus: a.ref("PrivateImageAssetBindingStatus").required(),
    failureCode: a.string(),
    verifiedAt: a.datetime()
  }),

  verifyPrivateImageAsset: a
    .mutation()
    .arguments({ privateImageAssetId: a.id().required() })
    .returns(a.ref("VerifyPrivateImageResult"))
    .authorization((allow) => [allow.authenticated("identityPool")])
    .handler(a.handler.function(verifyPrivateImage)),

  UsernameReservation: a
    .model({
      username: a.string().required(),
      ownerId: a
        .string()
        .required()
        .authorization((allow) => [allow.ownerDefinedIn("ownerId").to(["create", "read", "delete"]), allow.authenticated().to(["read"])]),
      createdAt: a.datetime()
    })
    .authorization((allow) => [allow.ownerDefinedIn("ownerId").to(["create", "read", "delete"]), allow.authenticated().to(["read"])]),

  UserProfile: a
    .model({
      ownerId: a
        .string()
        .required()
        .authorization((allow) => [allow.ownerDefinedIn("ownerId").to(["create", "read", "delete"])]),
      displayName: a.string().required(),
      username: a.string(),
      avatarUrl: a.string(),
      firstName: a.string(),
      lastName: a.string(),
      city: a.string(),
      state: a.string(),
      bio: a.string(),
      privacyDefault: a.enum(["private", "public_sanitized"]),
      accountVisibility: a.enum(["private", "public"]),
      defaultPassportVisibility: a.enum(["private", "public"]),
      requirePublicPreviewBeforePublishing: a.boolean(),
      hideExactLocationsFromPublicSharing: a.boolean(),
      hideAmmoLotNumbersFromPublicSharing: a.boolean(),
      hidePurchaseDetailsFromPublicSharing: a.boolean(),
      hidePrivateNotesFromPublicSharing: a.boolean(),
      stripImageMetadataBeforePublicSharing: a.boolean(),
      nameLastChangedAt: a.datetime(),
      createdAt: a.datetime(),
      updatedAt: a.datetime()
    })
    .authorization((allow) => [allow.ownerDefinedIn("ownerId")]),

  // Public identity is copied into this deliberately narrow snapshot. Never
  // broaden UserProfile reads or add legal names, location, email, or private
  // account preferences here.
  PublicUserProfileSnapshot: a
    .model({
      ownerId: a
        .string()
        .required()
        .authorization((allow) => [allow.ownerDefinedIn("ownerId").to(["create", "read", "delete"]), allow.publicApiKey().to(["read"])]),
      username: a.string().required(),
      displayName: a.string(),
      bio: a.string(),
      accountVisibility: a.enum(["private", "public"]),
      createdAt: a.datetime(),
      updatedAt: a.datetime()
    })
    .authorization((allow) => [allow.ownerDefinedIn("ownerId"), allow.publicApiKey().to(["read"])]),

  EquipmentPassport: a
    .model({
      ownerId: a
        .string()
        .required()
        .authorization((allow) => [allow.ownerDefinedIn("ownerId").to(["create", "read", "delete"])]),
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
      privateCoverPhotoKey: a.string(),
      isPublic: a.boolean(),
      createdAt: a.datetime(),
      updatedAt: a.datetime()
    })
    .authorization((allow) => [allow.ownerDefinedIn("ownerId")]),

  ProjectileProfile: a
    .model({
      ownerId: a
        .string()
        .required()
        .authorization((allow) => [allow.ownerDefinedIn("ownerId").to(["create", "read", "delete"])]),
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
      ownerId: a
        .string()
        .required()
        .authorization((allow) => [allow.ownerDefinedIn("ownerId").to(["create", "read", "delete"])]),
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
      ownerId: a
        .string()
        .required()
        .authorization((allow) => [allow.ownerDefinedIn("ownerId").to(["create", "read", "delete"])]),
      equipmentPassportId: a.id().required(),
      projectileProfileId: a.id(),
      opticSightProfileId: a.id(),
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
      ownerId: a
        .string()
        .required()
        .authorization((allow) => [allow.ownerDefinedIn("ownerId").to(["create", "read", "delete"])]),
      rangeSessionId: a.id().required(),
      imageUrl: a.string().required(),
      storageKey: a.string(),
      caption: a.string(),
      manuallyEnteredGroupSize: a.string(),
      manuallyEnteredScore: a.string(),
      isPublic: a.boolean(),
      createdAt: a.datetime(),
      updatedAt: a.datetime()
    })
    .authorization((allow) => [allow.ownerDefinedIn("ownerId")]),

  // Private client uploads can register an owner-only candidate here, but a
  // browser-created row is never authoritative proof of storage ownership.
  // Only the trusted verifier may write the guarded binding result fields.
  PrivateImageAsset: a
    .model({
      ownerId: a
        .string()
        .required()
        .authorization((allow) => [
          allow.ownerDefinedIn("ownerId").to(["create", "read"]),
          allow.ownerDefinedIn("ownerSub").identityClaim("sub").to(["read"])
        ]),
      ownerSub: a
        .string()
        .authorization((allow) => [allow.ownerDefinedIn("ownerSub").identityClaim("sub").to(["create", "read"])]),
      sourceType: a
        .ref("PrivateImageAssetSourceType")
        .required()
        .authorization((allow) => [
          allow.ownerDefinedIn("ownerId").to(["read"]),
          allow.ownerDefinedIn("ownerSub").identityClaim("sub").to(["read"])
        ]),
      sourceRecordId: a
        .id()
        .required()
        .authorization((allow) => [
          allow.ownerDefinedIn("ownerId").to(["read"]),
          allow.ownerDefinedIn("ownerSub").identityClaim("sub").to(["read"])
        ]),
      storageKey: a
        .string()
        .required()
        .authorization((allow) => [
          allow.ownerDefinedIn("ownerId").to(["read"]),
          allow.ownerDefinedIn("ownerSub").identityClaim("sub").to(["read"])
        ]),
      storageIdentityId: a.string(),
      sanitizedFileName: a
        .string()
        .required()
        .authorization((allow) => [
          allow.ownerDefinedIn("ownerId").to(["read"]),
          allow.ownerDefinedIn("ownerSub").identityClaim("sub").to(["read"])
        ]),
      contentType: a
        .string()
        .required()
        .authorization((allow) => [
          allow.ownerDefinedIn("ownerId").to(["read"]),
          allow.ownerDefinedIn("ownerSub").identityClaim("sub").to(["read"])
        ]),
      sizeBytes: a
        .integer()
        .required()
        .authorization((allow) => [
          allow.ownerDefinedIn("ownerId").to(["read"]),
          allow.ownerDefinedIn("ownerSub").identityClaim("sub").to(["read"])
        ]),
      bindingStatus: a
        .ref("PrivateImageAssetBindingStatus")
        .authorization((allow) => [allow.ownerDefinedIn("ownerId").to(["read"])]),
      bindingFailureCode: a
        .string()
        .authorization((allow) => [allow.ownerDefinedIn("ownerId").to(["read"])]),
      verifiedAt: a
        .datetime()
        .authorization((allow) => [allow.ownerDefinedIn("ownerId").to(["read"])]),
      createdAt: a.datetime(),
      updatedAt: a.datetime()
    })
    .authorization((allow) => [allow.ownerDefinedIn("ownerId").to(["create", "read"])]),

  MaintenanceLogEntry: a
    .model({
      ownerId: a
        .string()
        .required()
        .authorization((allow) => [allow.ownerDefinedIn("ownerId").to(["create", "read", "delete"])]),
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
      ownerId: a
        .string()
        .required()
        .authorization((allow) => [allow.ownerDefinedIn("ownerId").to(["create", "read", "delete"])]),
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
      ownerId: a
        .string()
        .required()
        .authorization((allow) => [allow.ownerDefinedIn("ownerId").to(["create", "read", "delete"]), allow.publicApiKey().to(["read"])]),
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
      // Reserved public-image projection fields. Owners and API-key clients may
      // read them, and owners may still delete the whole snapshot, but normal
      // client create/update operations cannot populate them. A future backend
      // processing resource must receive explicit field-level write access.
      coverPhotoUrl: a
        .string()
        .authorization((allow) => [allow.ownerDefinedIn("ownerId").to(["read", "delete"]), allow.publicApiKey().to(["read"])]),
      publicImageAssetId: a
        .id()
        .authorization((allow) => [allow.ownerDefinedIn("ownerId").to(["read", "delete"]), allow.publicApiKey().to(["read"])]),
      publicImageKey: a
        .string()
        .authorization((allow) => [allow.ownerDefinedIn("ownerId").to(["read", "delete"]), allow.publicApiKey().to(["read"])]),
      publicImageAltText: a
        .string()
        .authorization((allow) => [allow.ownerDefinedIn("ownerId").to(["read", "delete"]), allow.publicApiKey().to(["read"])]),
      publicStats: a.json(),
      publicRangeSessions: a.json(),
      publicPhotoPlaceholders: a.json(),
      createdAt: a.datetime(),
      updatedAt: a.datetime()
    })
    .authorization((allow) => [allow.ownerDefinedIn("ownerId"), allow.publicApiKey().to(["read"])]),

  // Phase 1 public-image workflow ledger. It is intentionally owner-readable
  // only and has no client create/update/delete authorization. No records can
  // be produced until a future backend-controlled processor is added.
  PublicImageAsset: a
    .model({
      ownerId: a
        .string()
        .required()
        .authorization((allow) => [allow.ownerDefinedIn("ownerId").to(["read"])]),
      publicPassportSnapshotId: a.id().required(),
      privateImageAssetId: a.id(),
      sourceType: a.ref("PublicImageAssetSourceType").required(),
      sourceRecordId: a.id().required(),
      publicImageKey: a.string(),
      publicImageAltText: a.string(),
      status: a.ref("PublicImageAssetStatus").required(),
      processingErrorCode: a.string(),
      consentConfirmedAt: a.datetime(),
      createdAt: a.datetime(),
      updatedAt: a.datetime()
    })
    .authorization((allow) => [allow.ownerDefinedIn("ownerId").to(["read"])]),

  Comment: a
    .model({
      authorId: a
        .string()
        .required()
        .authorization((allow) => [allow.ownerDefinedIn("authorId").to(["create", "read", "delete"]), allow.authenticated().to(["read"])]),
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
      userId: a
        .string()
        .required()
        .authorization((allow) => [
          allow.ownerDefinedIn("userId").to(["create", "read", "delete"]),
          allow.authenticated().to(["read"]),
          allow.publicApiKey().to(["read"])
        ]),
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
    .authorization((allow) => [allow.ownerDefinedIn("userId"), allow.authenticated().to(["read"]), allow.publicApiKey().to(["read"])]),

  Report: a
    .model({
      reporterId: a
        .string()
        .required()
        .authorization((allow) => [allow.ownerDefinedIn("reporterId").to(["create", "read", "delete"]), allow.groups(["admin", "moderator"]).to(["read"])]),
      targetType: a
        .ref("ReportTargetType")
        .authorization((allow) => [allow.ownerDefinedIn("reporterId").to(["create", "read", "delete"]), allow.groups(["admin", "moderator"]).to(["read"])]),
      targetId: a
        .id()
        .required()
        .authorization((allow) => [allow.ownerDefinedIn("reporterId").to(["create", "read", "delete"]), allow.groups(["admin", "moderator"]).to(["read"])]),
      reason: a
        .string()
        .required()
        .authorization((allow) => [allow.ownerDefinedIn("reporterId").to(["create", "read", "delete"]), allow.groups(["admin", "moderator"]).to(["read"])]),
      details: a
        .string()
        .authorization((allow) => [allow.ownerDefinedIn("reporterId").to(["create", "read", "delete"]), allow.groups(["admin", "moderator"]).to(["read"])]),
      status: a
        .ref("ReportStatus")
        .authorization((allow) => [allow.ownerDefinedIn("reporterId").to(["create", "read", "delete"]), allow.groups(["admin", "moderator"]).to(["read", "update"])]),
      createdAt: a
        .datetime()
        .authorization((allow) => [allow.ownerDefinedIn("reporterId").to(["create", "read", "delete"]), allow.groups(["admin", "moderator"]).to(["read"])]),
      updatedAt: a
        .datetime()
        .authorization((allow) => [allow.ownerDefinedIn("reporterId").to(["create", "read", "delete"]), allow.groups(["admin", "moderator"]).to(["read"])]),
    })
    .authorization((allow) => [allow.ownerDefinedIn("reporterId").to(["create", "read", "delete"]), allow.groups(["admin", "moderator"]).to(["read", "update"])])
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
