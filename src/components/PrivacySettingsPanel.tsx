"use client";

import { generateClient } from "aws-amplify/data";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { useAuthUser } from "@/hooks/useAuthUser";
import { configureAmplifyClient, getAuthErrorMessage, isAuthTokenClearedError } from "@/lib/amplifyClient";
import {
  buildPrivacySettingsUpdateInput,
  defaultPrivacySettings,
  toPrivacySettingsValues,
  type PrivacySettingsValues,
  type VisibilityPreference
} from "@/lib/privacySettingsData";
import { isProfileComplete, type UserProfileRecord } from "@/lib/userProfileData";

type PrivacySettingsState = "loading" | "signed-out" | "setup-required" | "ready" | "error";

export function PrivacySettingsPanel() {
  const client = useMemo(() => {
    configureAmplifyClient();
    return generateClient<Schema>();
  }, []);
  const { authState } = useAuthUser();
  const requestIdRef = useRef(0);
  const [state, setState] = useState<PrivacySettingsState>("loading");
  const [profile, setProfile] = useState<UserProfileRecord | null>(null);
  const [settings, setSettings] = useState<PrivacySettingsValues>(defaultPrivacySettings);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setError("");
    setMessage("");

    if (authState.status === "loading") {
      setState("loading");
      return;
    }

    if (authState.status !== "signed-in") {
      setProfile(null);
      setSettings(defaultPrivacySettings);
      setState("signed-out");
      return;
    }

    try {
      const result = await client.models.UserProfile.list({ filter: { ownerId: { eq: authState.username } } });

      if (result.errors?.length) {
        throw new Error(result.errors.map((item) => item.message).join(" "));
      }

      if (requestId !== requestIdRef.current) {
        return;
      }

      const currentProfile = result.data[0] ?? null;
      setProfile(currentProfile);
      setSettings(toPrivacySettingsValues(currentProfile));
      setState(isProfileComplete(currentProfile) ? "ready" : "setup-required");
    } catch (settingsError) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      if (isAuthTokenClearedError(settingsError)) {
        setProfile(null);
        setSettings(defaultPrivacySettings);
        setState("signed-out");
        return;
      }

      setError(getAuthErrorMessage(settingsError));
      setState("error");
    }
  }, [authState, client]);

  useEffect(() => {
    const loadInitialState = window.setTimeout(() => {
      void loadSettings();
    }, 0);

    return () => {
      window.clearTimeout(loadInitialState);
    };
  }, [loadSettings]);

  function updateBoolean(key: keyof PrivacySettingsValues, value: boolean) {
    setSettings((current) => ({ ...current, [key]: value }));
    setMessage("");
    setError("");
  }

  function updateVisibility(key: "accountVisibility" | "defaultPassportVisibility", value: VisibilityPreference) {
    setSettings((current) => ({ ...current, [key]: value }));
    setMessage("");
    setError("");
  }

  async function saveSettings() {
    if (!profile?.id) {
      setError("Complete profile setup before saving account privacy settings.");
      return;
    }

    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      const result = await client.models.UserProfile.update(buildPrivacySettingsUpdateInput(profile.id, settings));

      if (result.errors?.length) {
        throw new Error(result.errors.map((item) => item.message).join(" "));
      }

      setProfile(result.data ?? profile);
      setSettings(toPrivacySettingsValues(result.data ?? profile));
      setMessage("Privacy settings saved to your account.");
    } catch (saveError) {
      setError(isAuthTokenClearedError(saveError) ? "Sign in again before saving privacy settings." : getAuthErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  if (state === "loading") {
    return <p className="rounded-md border border-ink/10 bg-white p-4 text-sm text-ink/65 shadow-soft">Loading privacy settings...</p>;
  }

  if (state === "signed-out") {
    return (
      <div className="space-y-6">
        <PrivacyBoundaryNote />
        <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
          <h3 className="text-xl font-bold text-ink">Sign in to manage account privacy settings</h3>
          <p className="mt-3 text-sm leading-6 text-ink/70">
            Signed-out visitors can browse public and demo content, but private account preferences are only visible to the signed-in owner.
          </p>
          <Link href="/auth/sign-in" className="mt-4 inline-flex rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
            Sign in
          </Link>
        </section>
      </div>
    );
  }

  if (state === "setup-required") {
    return (
      <div className="space-y-6">
        <PrivacyBoundaryNote />
        <section className="rounded-md border border-moss/20 bg-white p-5 shadow-soft">
          <h3 className="text-xl font-bold text-ink">Complete profile setup first</h3>
          <p className="mt-3 text-sm leading-6 text-ink/70">
            Privacy preferences are stored on your owner-scoped profile. Choose your permanent username before saving account settings.
          </p>
          <Link href="/profile/setup" className="mt-4 inline-flex rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
            Continue profile setup
          </Link>
        </section>
      </div>
    );
  }

  if (state === "error") {
    return (
      <section className="rounded-md border border-clay/30 bg-clay/10 p-5">
        <h3 className="text-xl font-bold text-ink">Privacy settings unavailable</h3>
        <p className="mt-2 text-sm leading-6 text-clay">{error || "Try refreshing before editing privacy settings."}</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <PrivacyBoundaryNote />

      <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-ink">Account visibility</span>
            <select
              value={settings.accountVisibility}
              onChange={(event) => updateVisibility("accountVisibility", event.target.value as VisibilityPreference)}
              className="mt-2 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-moss"
            >
              <option value="private">Private</option>
              <option value="public">Public profile allowed later</option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-ink">Default passport visibility</span>
            <select
              value={settings.defaultPassportVisibility}
              onChange={(event) => updateVisibility("defaultPassportVisibility", event.target.value as VisibilityPreference)}
              className="mt-2 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-moss"
            >
              <option value="private">Private</option>
              <option value="public">Public only after preview</option>
            </select>
          </label>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <Toggle label="Require public preview before publishing" checked={settings.requirePublicPreviewBeforePublishing} onChange={(value) => updateBoolean("requirePublicPreviewBeforePublishing", value)} />
          <Toggle label="Hide exact locations from public sharing" checked={settings.hideExactLocationsFromPublicSharing} onChange={(value) => updateBoolean("hideExactLocationsFromPublicSharing", value)} />
          <Toggle label="Hide ammo lot numbers from public sharing" checked={settings.hideAmmoLotNumbersFromPublicSharing} onChange={(value) => updateBoolean("hideAmmoLotNumbersFromPublicSharing", value)} />
          <Toggle label="Hide purchase details from public sharing" checked={settings.hidePurchaseDetailsFromPublicSharing} onChange={(value) => updateBoolean("hidePurchaseDetailsFromPublicSharing", value)} />
          <Toggle label="Hide private notes from public sharing" checked={settings.hidePrivateNotesFromPublicSharing} onChange={(value) => updateBoolean("hidePrivateNotesFromPublicSharing", value)} />
          <Toggle label="Strip image metadata before public sharing" checked={settings.stripImageMetadataBeforePublicSharing} onChange={(value) => updateBoolean("stripImageMetadataBeforePublicSharing", value)} />
        </div>

        <button
          type="button"
          onClick={() => void saveSettings()}
          disabled={isSaving}
          className="mt-5 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Saving..." : "Save privacy settings"}
        </button>
        {message ? <p className="mt-3 rounded-md border border-moss/25 bg-field px-4 py-3 text-sm font-semibold text-moss">{message}</p> : null}
        {error ? <p className="mt-3 rounded-md border border-clay/30 bg-clay/10 px-4 py-3 text-sm font-semibold text-clay">{error}</p> : null}
      </section>
    </div>
  );
}

function PrivacyBoundaryNote() {
  return (
    <section className="rounded-md border border-moss/20 bg-field p-4">
      <h3 className="text-base font-bold text-ink">Private By Default</h3>
      <p className="mt-2 text-sm leading-6 text-ink/70">
        UnifiedRange keeps account records private by default. Public sharing creates a sanitized Public Passport, and public publishing should exclude serial numbers, exact locations, private purchase details, private notes, image metadata, and sensitive personal information.
      </p>
    </section>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 rounded-md border border-ink/10 p-3">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4 rounded border-ink/20 text-moss" />
      <span className="text-sm font-semibold text-ink">{label}</span>
    </label>
  );
}
