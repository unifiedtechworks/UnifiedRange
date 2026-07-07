import type {
  EquipmentPassport,
  HuntingChecklist,
  MaintenanceLogEntry,
  OpticSightProfile,
  ProjectileProfile,
  PublicPassportSnapshot,
  RangeSession,
  TargetPhoto,
  UserProfile
} from "@/types";

// TODO: Replace mock records with AWS AppSync queries once Cognito auth, DynamoDB data, and S3 storage are wired.
export const currentUser: UserProfile = {
  id: "user-1",
  displayName: "Seth B.",
  username: "sethb",
  bio: "Keeping range notes, seasonal prep, and setup documentation in one place.",
  privacyDefault: "private",
  createdAt: "2026-07-01T10:00:00Z",
  updatedAt: "2026-07-05T16:00:00Z"
};

export const optics: OpticSightProfile[] = [
  {
    id: "optic-1",
    ownerId: currentUser.id,
    sightType: "scope",
    manufacturer: "Vortex",
    model: "Diamondback Tactical",
    reticleOrPinSetup: "EBR-style reticle",
    magnification: "4-16x",
    adjustmentUnit: "MOA",
    clickValue: "1/4 MOA",
    publicNotes: "Reliable practice optic with clear documentation notes.",
    createdAt: "2026-07-01T10:30:00Z",
    updatedAt: "2026-07-05T14:20:00Z"
  },
  {
    id: "optic-2",
    ownerId: currentUser.id,
    sightType: "red_dot",
    manufacturer: "Holosun",
    model: "HS403",
    reticleOrPinSetup: "Dot",
    publicNotes: "Simple sight profile for close-range practice logging.",
    createdAt: "2026-07-02T11:30:00Z",
    updatedAt: "2026-07-04T09:20:00Z"
  },
  {
    id: "optic-3",
    ownerId: currentUser.id,
    sightType: "bow_sight",
    manufacturer: "Spot Hogg",
    model: "Fast Eddie",
    reticleOrPinSetup: "Multi-pin hunting setup",
    publicNotes: "Future archery sight profile for readiness and practice notes.",
    createdAt: "2026-07-03T11:30:00Z",
    updatedAt: "2026-07-06T09:20:00Z"
  }
];

export const projectiles: ProjectileProfile[] = [
  {
    id: "proj-1",
    ownerId: currentUser.id,
    projectileType: "ammo",
    manufacturer: "Federal",
    productLine: "Gold Medal Match",
    caliber: "6.5 Creedmoor",
    bulletWeight: "140 gr",
    bulletType: "OTM",
    lotNumber: "GM26-A",
    roundsPurchased: 200,
    roundsRemaining: 136,
    publicNotes: "Used for structured range-session comparison notes.",
    createdAt: "2026-07-01T11:00:00Z",
    updatedAt: "2026-07-06T12:00:00Z"
  },
  {
    id: "proj-2",
    ownerId: currentUser.id,
    projectileType: "ammo",
    manufacturer: "Hornady",
    productLine: "American Whitetail",
    caliber: ".308 Winchester",
    bulletWeight: "150 gr",
    bulletType: "InterLock",
    roundsPurchased: 80,
    roundsRemaining: 58,
    publicNotes: "Hunting-season inventory and confirmation notes.",
    createdAt: "2026-07-02T12:00:00Z",
    updatedAt: "2026-07-05T12:00:00Z"
  },
  {
    id: "proj-3",
    ownerId: currentUser.id,
    projectileType: "arrow",
    manufacturer: "Easton",
    productLine: "Axis 5mm",
    caliber: "340 spine arrow",
    arrowShaft: "Axis 5mm",
    arrowSpine: "340",
    pointOrBroadhead: "Field point placeholder",
    fletching: "3 vane",
    totalWeight: "Logged by user",
    privateNotes: "Keep detailed build notes private until reviewed for public sharing.",
    publicNotes: "Future archery projectile profile for practice and readiness documentation.",
    createdAt: "2026-07-03T12:00:00Z",
    updatedAt: "2026-07-06T12:00:00Z"
  }
];

export const equipmentPassports: EquipmentPassport[] = [
  {
    id: "passport-1",
    ownerId: currentUser.id,
    equipmentType: "rifle",
    nickname: "Field Notebook Rifle",
    manufacturer: "Tikka",
    model: "T3x Lite",
    category: "Bolt action",
    caliber: "6.5 Creedmoor",
    barrelLength: "24 in",
    twistRate: "1:8",
    opticOrSightId: "optic-1",
    accessories: ["Bipod", "Sling", "Stock pack"],
    preferredProjectileId: "proj-1",
    useCaseTags: ["Target practice", "Hunting prep", "Beginner-friendly"],
    roundOrShotCount: 642,
    maintenanceNotes: "Cleaned after last range session. Action screws checked.",
    privateNotes: "Keep serial, purchase docs, and private range notes out of public snapshots.",
    publicNotes: "A lightweight rifle setup documented for practice history and field readiness.",
    coverPhotoUrl: "https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1200&q=80",
    isPublic: true,
    createdAt: "2026-07-01T12:00:00Z",
    updatedAt: "2026-07-06T13:00:00Z"
  },
  {
    id: "passport-2",
    ownerId: currentUser.id,
    equipmentType: "rifle",
    nickname: "Timber Season Setup",
    manufacturer: "Ruger",
    model: "American",
    category: "Bolt action",
    caliber: ".308 Winchester",
    barrelLength: "22 in",
    opticOrSightId: "optic-1",
    accessories: ["Sling", "Soft case"],
    preferredProjectileId: "proj-2",
    useCaseTags: ["Hunting readiness", "Lightweight", "Budget-conscious"],
    roundOrShotCount: 318,
    maintenanceNotes: "Ready for pre-season inspection.",
    publicNotes: "Plain-spoken hunting setup with a focus on readiness records.",
    coverPhotoUrl: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1200&q=80",
    isPublic: false,
    createdAt: "2026-07-02T12:00:00Z",
    updatedAt: "2026-07-05T13:00:00Z"
  },
  {
    id: "passport-3",
    ownerId: currentUser.id,
    equipmentType: "bow",
    nickname: "Range Bow Prototype",
    manufacturer: "Mathews",
    model: "VXR",
    category: "Compound bow",
    drawWeight: "Logged by user",
    drawLength: "Logged by user",
    bowType: "Compound",
    opticOrSightId: "optic-3",
    accessories: ["Quiver", "Stabilizer"],
    preferredProjectileId: "proj-3",
    useCaseTags: ["Archery practice", "Future support", "Hunting readiness"],
    roundOrShotCount: 124,
    maintenanceNotes: "String and accessory inspection placeholder.",
    privateNotes: "Keep exact storage and purchase notes private.",
    publicNotes: "Archery-style example showing the passport model can support future bow workflows.",
    coverPhotoUrl: "https://images.unsplash.com/photo-1519817914152-22d216bb9170?auto=format&fit=crop&w=1200&q=80",
    isPublic: false,
    createdAt: "2026-07-03T12:00:00Z",
    updatedAt: "2026-07-06T13:00:00Z"
  }
];

export const rangeSessions: RangeSession[] = [
  {
    id: "session-1",
    ownerId: currentUser.id,
    equipmentPassportId: "passport-1",
    projectileProfileId: "proj-1",
    date: "2026-07-03",
    distance: 100,
    distanceUnit: "yards",
    discipline: "Bench practice",
    position: "Seated",
    supportType: "Front rest and rear bag",
    weatherNotes: "Warm, bright, steady conditions.",
    windNotesFreeText: "Light breeze noted in range book.",
    groupSize: "1.2 in",
    score: "N/A",
    isColdBore: true,
    isCleanBarrel: false,
    isSuppressed: false,
    confidenceRating: 4,
    sessionNotes: "Documented group history and equipment feel. No aiming corrections recorded.",
    isPublicSummary: true,
    createdAt: "2026-07-03T18:30:00Z",
    updatedAt: "2026-07-03T19:00:00Z"
  },
  {
    id: "session-2",
    ownerId: currentUser.id,
    equipmentPassportId: "passport-2",
    projectileProfileId: "proj-2",
    date: "2026-07-05",
    distance: 50,
    distanceUnit: "yards",
    discipline: "Field-position practice",
    position: "Kneeling",
    supportType: "Sling support",
    weatherNotes: "Overcast morning.",
    groupSize: "Logged in notebook",
    score: "8/10 steel hits",
    isColdBore: false,
    isCleanBarrel: true,
    isSuppressed: false,
    confidenceRating: 3,
    sessionNotes: "Focused on stable position notes and readiness confidence.",
    isPublicSummary: false,
    createdAt: "2026-07-05T15:30:00Z",
    updatedAt: "2026-07-05T16:00:00Z"
  },
  {
    id: "session-3",
    ownerId: currentUser.id,
    equipmentPassportId: "passport-3",
    projectileProfileId: "proj-3",
    date: "2026-07-06",
    distance: 20,
    distanceUnit: "yards",
    discipline: "Archery practice",
    position: "Standing",
    supportType: "Unsupported",
    weatherNotes: "Indoor lane practice.",
    windNotesFreeText: "Not applicable; indoor notes only.",
    groupSize: "Manual note pending",
    score: "Practice card pending",
    isColdBore: false,
    isCleanBarrel: false,
    isSuppressed: false,
    confidenceRating: 4,
    sessionNotes: "Future archery-style session record using the same logbook structure.",
    isPublicSummary: false,
    createdAt: "2026-07-06T15:30:00Z",
    updatedAt: "2026-07-06T16:00:00Z"
  }
];

export const targetPhotos: TargetPhoto[] = [
  {
    id: "photo-1",
    ownerId: currentUser.id,
    rangeSessionId: "session-1",
    imageUrl: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
    caption: "Target photo attached for historical reference.",
    manuallyEnteredGroupSize: "1.2 in",
    isPublic: false,
    createdAt: "2026-07-03T18:40:00Z",
    updatedAt: "2026-07-03T18:40:00Z"
  }
];

export const maintenanceEntries: MaintenanceLogEntry[] = [
  {
    id: "maint-1",
    ownerId: currentUser.id,
    equipmentPassportId: "passport-1",
    date: "2026-07-04",
    roundOrShotCount: 642,
    maintenanceType: "Cleaning",
    partsChanged: [],
    notes: "Bore cleaned, exterior wiped down, fasteners inspected.",
    createdAt: "2026-07-04T20:00:00Z",
    updatedAt: "2026-07-04T20:00:00Z"
  },
  {
    id: "maint-2",
    ownerId: currentUser.id,
    equipmentPassportId: "passport-2",
    date: "2026-07-05",
    roundOrShotCount: 318,
    maintenanceType: "Inspection",
    partsChanged: ["Sling swivel replaced"],
    notes: "Pre-season gear inspection logged.",
    createdAt: "2026-07-05T20:00:00Z",
    updatedAt: "2026-07-05T20:00:00Z"
  }
];

export const huntingChecklists: HuntingChecklist[] = [
  {
    id: "hunt-1",
    ownerId: currentUser.id,
    equipmentPassportId: "passport-2",
    huntName: "September deer opener",
    season: "2026 Early Season",
    species: "Deer",
    checklistItems: [
      { id: "item-1", label: "License/tag confirmed", isComplete: true },
      { id: "item-2", label: "Equipment confirmed at range", isComplete: true },
      { id: "item-3", label: "First-shot practice logged", isComplete: false },
      { id: "item-4", label: "Field-position practice logged", isComplete: true },
      { id: "item-5", label: "Ammo/projectile verified", isComplete: true },
      { id: "item-6", label: "Optic/sight checked", isComplete: false },
      { id: "item-7", label: "Gear inspected", isComplete: true },
      { id: "item-8", label: "Pack list complete", isComplete: false },
      { id: "item-9", label: "Emergency contact plan", isComplete: true },
      { id: "item-10", label: "Offline maps prepared", isComplete: false },
      { id: "item-11", label: "Weather checked", isComplete: false }
    ],
    notes: "Private readiness checklist for the season.",
    createdAt: "2026-07-05T08:00:00Z",
    updatedAt: "2026-07-06T10:00:00Z"
  }
];

export const publicPassports: PublicPassportSnapshot[] = [
  {
    id: "public-1",
    equipmentPassportId: "passport-1",
    ownerId: currentUser.id,
    title: "Lightweight 6.5 Creedmoor Practice Setup",
    equipmentType: "rifle",
    manufacturer: "Tikka",
    model: "T3x Lite",
    category: "Bolt action",
    caliber: "6.5 Creedmoor",
    opticOrSightSummary: "Vortex 4-16x scope",
    projectileSummary: "140 gr match ammo",
    useCaseTags: ["Target practice", "Hunting prep", "Beginner-friendly"],
    publicNotes: "Shared as a sanitized setup profile for discovery and documentation.",
    coverPhotoUrl: "https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1200&q=80",
    publicStats: {
      loggedSessions: 8,
      maintenanceEntries: 4,
      lastUpdatedLabel: "Updated this week"
    },
    createdAt: "2026-07-04T12:00:00Z",
    updatedAt: "2026-07-06T13:00:00Z"
  }
];
