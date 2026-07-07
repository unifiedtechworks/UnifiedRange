export type PrivacyDefault = "private" | "public_sanitized";

export type EquipmentType = "rifle" | "pistol" | "bow" | "crossbow" | "shotgun" | "other";

export type ProjectileType = "ammo" | "arrow" | "bolt" | "pellet" | "other";

export type SightType = "scope" | "red_dot" | "iron_sight" | "bow_sight" | "other";

export type DistanceUnit = "yards" | "meters";

export type CommentStatus = "visible" | "hidden" | "reported";

export type TargetType = "passport" | "session" | "public_passport";

export type ReactionType =
  | "helpful_setup"
  | "similar_to_mine"
  | "good_hunting_build"
  | "budget_friendly"
  | "lightweight"
  | "well_documented"
  | "beginner_friendly";

export interface Timestamped {
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile extends Timestamped {
  id: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
  bio?: string;
  privacyDefault: PrivacyDefault;
}

export interface EquipmentPassport extends Timestamped {
  id: string;
  ownerId: string;
  equipmentType: EquipmentType;
  nickname: string;
  manufacturer: string;
  model: string;
  category: string;
  caliber?: string;
  barrelLength?: string;
  twistRate?: string;
  drawWeight?: string;
  drawLength?: string;
  bowType?: string;
  opticOrSightId?: string;
  accessories: string[];
  preferredProjectileId?: string;
  useCaseTags: string[];
  roundOrShotCount: number;
  maintenanceNotes?: string;
  privateNotes?: string;
  publicNotes?: string;
  coverPhotoUrl?: string;
  isPublic: boolean;
}

export interface ProjectileProfile extends Timestamped {
  id: string;
  ownerId: string;
  projectileType: ProjectileType;
  manufacturer: string;
  productLine: string;
  caliber?: string;
  bulletWeight?: string;
  bulletType?: string;
  lotNumber?: string;
  roundsPurchased?: number;
  roundsRemaining?: number;
  arrowShaft?: string;
  arrowSpine?: string;
  pointOrBroadhead?: string;
  fletching?: string;
  totalWeight?: string;
  privateNotes?: string;
  publicNotes?: string;
}

export interface OpticSightProfile extends Timestamped {
  id: string;
  ownerId: string;
  sightType: SightType;
  manufacturer: string;
  model: string;
  reticleOrPinSetup?: string;
  magnification?: string;
  adjustmentUnit?: string;
  clickValue?: string;
  privateNotes?: string;
  publicNotes?: string;
}

export interface RangeSession extends Timestamped {
  id: string;
  ownerId: string;
  equipmentPassportId: string;
  projectileProfileId?: string;
  date: string;
  distance: number;
  distanceUnit: DistanceUnit;
  discipline: string;
  position: string;
  supportType: string;
  weatherNotes?: string;
  windNotesFreeText?: string;
  groupSize?: string;
  score?: string;
  isColdBore: boolean;
  isCleanBarrel: boolean;
  isSuppressed: boolean;
  confidenceRating: 1 | 2 | 3 | 4 | 5;
  sessionNotes?: string;
  isPublicSummary: boolean;
}

export interface TargetPhoto extends Timestamped {
  id: string;
  ownerId: string;
  rangeSessionId: string;
  imageUrl: string;
  caption?: string;
  manuallyEnteredGroupSize?: string;
  manuallyEnteredScore?: string;
  isPublic: boolean;
}

export interface MaintenanceLogEntry extends Timestamped {
  id: string;
  ownerId: string;
  equipmentPassportId: string;
  date: string;
  roundOrShotCount: number;
  maintenanceType: string;
  partsChanged: string[];
  cleaningNotes?: string;
  torqueCheckNotes?: string;
  privateNotes?: string;
  notes?: string;
}

export interface HuntingChecklistItem {
  id: string;
  label: string;
  isComplete: boolean;
}

export interface HuntingChecklist extends Timestamped {
  id: string;
  ownerId: string;
  equipmentPassportId: string;
  huntName: string;
  season: string;
  species: string;
  checklistItems: HuntingChecklistItem[];
  notes?: string;
}

export interface PublicPassportSnapshot extends Timestamped {
  id: string;
  equipmentPassportId: string;
  ownerId: string;
  title: string;
  equipmentType: EquipmentType;
  manufacturer: string;
  model: string;
  category: string;
  caliber?: string;
  opticOrSightSummary?: string;
  projectileSummary?: string;
  useCaseTags: string[];
  publicNotes?: string;
  coverPhotoUrl?: string;
  publicStats: {
    loggedSessions: number;
    maintenanceEntries: number;
    lastUpdatedLabel: string;
  };
}

export interface PublicRangeSessionSummary {
  id: string;
  date: string;
  distanceLabel: string;
  discipline: string;
  position: string;
  supportType: string;
  groupOrScore?: string;
  confidenceRating: number;
  notes?: string;
}

export interface PublicTargetPhotoPlaceholder {
  id: string;
  caption?: string;
  manualEntry?: string;
}

export interface SanitizedPublicPassport {
  id: string;
  equipmentPassportId: string;
  title: string;
  equipmentType: EquipmentType;
  manufacturer: string;
  model: string;
  category: string;
  caliber?: string;
  opticOrSightSummary?: string;
  projectileSummary?: string;
  useCaseTags: string[];
  publicNotes?: string;
  coverPhotoUrl?: string;
  publicRangeSessions: PublicRangeSessionSummary[];
  publicPhotoPlaceholders: PublicTargetPhotoPlaceholder[];
  hiddenFields: string[];
  publicFields: string[];
  reactions: {
    helpful: number;
    similar: number;
    wellDocumented: number;
  };
}

export interface Comment extends Timestamped {
  id: string;
  authorId: string;
  targetType: TargetType;
  targetId: string;
  body: string;
  status: CommentStatus;
}

export interface Reaction {
  id: string;
  userId: string;
  targetType: TargetType;
  targetId: string;
  reactionType: ReactionType;
  createdAt: string;
}

export interface Report extends Timestamped {
  id: string;
  reporterId: string;
  targetType: TargetType;
  targetId: string;
  reason: string;
  details?: string;
  status: "open" | "reviewed" | "resolved";
}
