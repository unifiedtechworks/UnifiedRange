import type { Schema } from "../../amplify/data/resource";
import { defaultPrivacySettings } from "@/lib/privacySettingsData";

export type UserProfileRecord = Schema["UserProfile"]["type"];
export type PrivacyDefault = "private" | "public_sanitized";

export interface UserProfileFormValues {
  displayName: string;
  username: string;
  firstName: string;
  lastName: string;
  city: string;
  state: string;
  bio: string;
  privacyDefault: PrivacyDefault;
}

export const defaultUserProfileFormValues: UserProfileFormValues = {
  displayName: "",
  username: "",
  firstName: "",
  lastName: "",
  city: "",
  state: "",
  bio: "",
  privacyDefault: "private"
};

export const usernameHelper = "Use 3-24 lowercase letters, numbers, underscores, or hyphens.";
export const nameChangeWindowDays = 30;

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function validateUsername(value: string) {
  const username = normalizeUsername(value);

  if (!username) {
    return "Username is required.";
  }

  if (username.length < 3 || username.length > 24) {
    return "Username must be 3-24 characters.";
  }

  if (!/^[a-z0-9_-]+$/.test(username)) {
    return "Use lowercase letters, numbers, underscores, or hyphens only.";
  }

  return "";
}

export type UserProfileFormMode = "create" | "complete" | "edit";

export function validateUserProfile(values: UserProfileFormValues, mode: UserProfileFormMode) {
  const errors: Partial<Record<keyof UserProfileFormValues, string>> = {};

  if (!values.displayName.trim()) {
    errors.displayName = "Display name is required.";
  }

  if (mode !== "edit") {
    const usernameError = validateUsername(values.username);
    if (usernameError) {
      errors.username = usernameError;
    }
  }

  return errors;
}

export function toUserProfileFormValues(profile?: UserProfileRecord | null): UserProfileFormValues {
  return {
    displayName: profile?.displayName ?? "",
    username: profile?.username ?? "",
    firstName: profile?.firstName ?? "",
    lastName: profile?.lastName ?? "",
    city: profile?.city ?? "",
    state: profile?.state ?? "",
    bio: profile?.bio ?? "",
    privacyDefault: (profile?.privacyDefault as PrivacyDefault | null | undefined) ?? "private"
  };
}

export function toCreateUserProfileInput(values: UserProfileFormValues, ownerId: string) {
  const now = new Date().toISOString();

  return {
    ownerId,
    displayName: values.displayName.trim(),
    username: normalizeUsername(values.username),
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    city: values.city.trim(),
    state: values.state.trim(),
    bio: values.bio.trim(),
    privacyDefault: values.privacyDefault,
    accountVisibility: defaultPrivacySettings.accountVisibility,
    defaultPassportVisibility: defaultPrivacySettings.defaultPassportVisibility,
    requirePublicPreviewBeforePublishing: defaultPrivacySettings.requirePublicPreviewBeforePublishing,
    hideExactLocationsFromPublicSharing: defaultPrivacySettings.hideExactLocationsFromPublicSharing,
    hideAmmoLotNumbersFromPublicSharing: defaultPrivacySettings.hideAmmoLotNumbersFromPublicSharing,
    hidePurchaseDetailsFromPublicSharing: defaultPrivacySettings.hidePurchaseDetailsFromPublicSharing,
    hidePrivateNotesFromPublicSharing: defaultPrivacySettings.hidePrivateNotesFromPublicSharing,
    stripImageMetadataBeforePublicSharing: defaultPrivacySettings.stripImageMetadataBeforePublicSharing,
    nameLastChangedAt: values.firstName.trim() || values.lastName.trim() ? now : undefined
  };
}

export function toUpdateUserProfileInput(id: string, values: UserProfileFormValues, currentProfile?: UserProfileRecord | null) {
  const nameChanged = didLegalNameChange(values, currentProfile);

  return {
    id,
    displayName: values.displayName.trim(),
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    city: values.city.trim(),
    state: values.state.trim(),
    bio: values.bio.trim(),
    privacyDefault: values.privacyDefault,
    ...(nameChanged ? { nameLastChangedAt: new Date().toISOString() } : {})
  };
}

export function toCompleteUserProfileInput(id: string, values: UserProfileFormValues, currentProfile?: UserProfileRecord | null) {
  const nameChanged = didLegalNameChange(values, currentProfile);

  return {
    id,
    username: normalizeUsername(values.username),
    displayName: values.displayName.trim(),
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    city: values.city.trim(),
    state: values.state.trim(),
    bio: values.bio.trim(),
    privacyDefault: values.privacyDefault,
    ...(nameChanged ? { nameLastChangedAt: new Date().toISOString() } : {})
  };
}

export function privacyDefaultLabel(value?: string | null) {
  return value === "public_sanitized" ? "Public sanitized by explicit publish flow" : "Private by default";
}

export function isProfileComplete(profile?: UserProfileRecord | null) {
  return Boolean(profile?.username && !validateUsername(profile.username));
}

export function didLegalNameChange(values: UserProfileFormValues, profile?: UserProfileRecord | null) {
  return values.firstName.trim() !== (profile?.firstName ?? "") || values.lastName.trim() !== (profile?.lastName ?? "");
}

export function getNextNameChangeDate(profile?: UserProfileRecord | null) {
  if (!profile?.nameLastChangedAt) {
    return null;
  }

  const lastChanged = new Date(profile.nameLastChangedAt);
  if (!Number.isFinite(lastChanged.getTime())) {
    return null;
  }

  return new Date(lastChanged.getTime() + nameChangeWindowDays * 24 * 60 * 60 * 1000);
}

export function getNameChangeLimitMessage(values: UserProfileFormValues, profile?: UserProfileRecord | null) {
  if (!didLegalNameChange(values, profile)) {
    return "";
  }

  const nextChangeDate = getNextNameChangeDate(profile);
  if (!nextChangeDate || Date.now() >= nextChangeDate.getTime()) {
    return "";
  }

  return `First and last name changes are available about once every ${nameChangeWindowDays} days. You can change them again on ${nextChangeDate.toLocaleDateString()}.`;
}
