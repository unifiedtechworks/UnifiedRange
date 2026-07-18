import type { Schema } from "../../amplify/data/resource";

export type UserProfileRecord = Schema["UserProfile"]["type"];
export type PrivacyDefault = "private" | "public_sanitized";

export interface UserProfileFormValues {
  displayName: string;
  username: string;
  bio: string;
  privacyDefault: PrivacyDefault;
}

export const defaultUserProfileFormValues: UserProfileFormValues = {
  displayName: "",
  username: "",
  bio: "",
  privacyDefault: "private"
};

export const usernameHelper = "Use 3-24 lowercase letters, numbers, underscores, or hyphens.";

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

export function validateUserProfile(values: UserProfileFormValues) {
  const errors: Partial<Record<keyof UserProfileFormValues, string>> = {};

  if (!values.displayName.trim()) {
    errors.displayName = "Display name is required.";
  }

  const usernameError = validateUsername(values.username);
  if (usernameError) {
    errors.username = usernameError;
  }

  return errors;
}

export function toUserProfileFormValues(profile?: UserProfileRecord | null): UserProfileFormValues {
  return {
    displayName: profile?.displayName ?? "",
    username: profile?.username ?? "",
    bio: profile?.bio ?? "",
    privacyDefault: (profile?.privacyDefault as PrivacyDefault | null | undefined) ?? "private"
  };
}

export function toCreateUserProfileInput(values: UserProfileFormValues, ownerId: string) {
  return {
    ownerId,
    displayName: values.displayName.trim(),
    username: normalizeUsername(values.username),
    bio: values.bio.trim(),
    privacyDefault: values.privacyDefault
  };
}

export function toUpdateUserProfileInput(id: string, values: UserProfileFormValues) {
  return {
    id,
    displayName: values.displayName.trim(),
    username: normalizeUsername(values.username),
    bio: values.bio.trim(),
    privacyDefault: values.privacyDefault
  };
}

export function privacyDefaultLabel(value?: string | null) {
  return value === "public_sanitized" ? "Public sanitized by explicit publish flow" : "Private by default";
}
