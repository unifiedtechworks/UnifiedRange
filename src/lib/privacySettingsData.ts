import type { UserProfileRecord } from "@/lib/userProfileData";

export type VisibilityPreference = "private" | "public";

export interface PrivacySettingsValues {
  accountVisibility: VisibilityPreference;
  defaultPassportVisibility: VisibilityPreference;
  requirePublicPreviewBeforePublishing: boolean;
  hideExactLocationsFromPublicSharing: boolean;
  hideAmmoLotNumbersFromPublicSharing: boolean;
  hidePurchaseDetailsFromPublicSharing: boolean;
  hidePrivateNotesFromPublicSharing: boolean;
  stripImageMetadataBeforePublicSharing: boolean;
}

export const defaultPrivacySettings: PrivacySettingsValues = {
  accountVisibility: "private",
  defaultPassportVisibility: "private",
  requirePublicPreviewBeforePublishing: true,
  hideExactLocationsFromPublicSharing: true,
  hideAmmoLotNumbersFromPublicSharing: true,
  hidePurchaseDetailsFromPublicSharing: true,
  hidePrivateNotesFromPublicSharing: true,
  stripImageMetadataBeforePublicSharing: true
};

function normalizeVisibility(value?: string | null): VisibilityPreference {
  return value === "public" ? "public" : "private";
}

function normalizeBoolean(value: boolean | null | undefined, fallback = true) {
  return typeof value === "boolean" ? value : fallback;
}

export function toPrivacySettingsValues(profile?: UserProfileRecord | null): PrivacySettingsValues {
  return {
    accountVisibility: normalizeVisibility(profile?.accountVisibility),
    defaultPassportVisibility: normalizeVisibility(profile?.defaultPassportVisibility),
    requirePublicPreviewBeforePublishing: normalizeBoolean(profile?.requirePublicPreviewBeforePublishing),
    hideExactLocationsFromPublicSharing: normalizeBoolean(profile?.hideExactLocationsFromPublicSharing),
    hideAmmoLotNumbersFromPublicSharing: normalizeBoolean(profile?.hideAmmoLotNumbersFromPublicSharing),
    hidePurchaseDetailsFromPublicSharing: normalizeBoolean(profile?.hidePurchaseDetailsFromPublicSharing),
    hidePrivateNotesFromPublicSharing: normalizeBoolean(profile?.hidePrivateNotesFromPublicSharing),
    stripImageMetadataBeforePublicSharing: normalizeBoolean(profile?.stripImageMetadataBeforePublicSharing)
  };
}

export function buildPrivacySettingsUpdateInput(profileId: string, values: PrivacySettingsValues) {
  return {
    id: profileId,
    accountVisibility: values.accountVisibility,
    defaultPassportVisibility: values.defaultPassportVisibility,
    requirePublicPreviewBeforePublishing: values.requirePublicPreviewBeforePublishing,
    hideExactLocationsFromPublicSharing: values.hideExactLocationsFromPublicSharing,
    hideAmmoLotNumbersFromPublicSharing: values.hideAmmoLotNumbersFromPublicSharing,
    hidePurchaseDetailsFromPublicSharing: values.hidePurchaseDetailsFromPublicSharing,
    hidePrivateNotesFromPublicSharing: values.hidePrivateNotesFromPublicSharing,
    stripImageMetadataBeforePublicSharing: values.stripImageMetadataBeforePublicSharing
  };
}
