"use client";

import { generateClient } from "aws-amplify/data";
import { getCurrentUser } from "aws-amplify/auth";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { TextArea, TextField } from "@/components/FormFields";
import { configureAmplifyClient, getAuthErrorMessage } from "@/lib/amplifyClient";

type UserProfile = Schema["UserProfile"]["type"];
type PrivacyDefault = "private" | "public_sanitized";
type ProfileState = "loading" | "signed-out" | "empty" | "ready";

const privacyOptions: Array<{ label: string; value: PrivacyDefault }> = [
  { label: "Private", value: "private" },
  { label: "Public sanitized", value: "public_sanitized" }
];

export function UserProfilePanel() {
  const client = useMemo(() => {
    configureAmplifyClient();
    return generateClient<Schema>();
  }, []);

  const [profileState, setProfileState] = useState<ProfileState>("loading");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [ownerId, setOwnerId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [privacyDefault, setPrivacyDefault] = useState<PrivacyDefault>("private");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    setError("");
    setSuccess("");

    try {
      configureAmplifyClient();
      const currentUser = await getCurrentUser();
      const currentOwnerId = currentUser.username;
      setOwnerId(currentOwnerId);

      const result = await client.models.UserProfile.list({
        filter: {
          ownerId: {
            eq: currentOwnerId
          }
        }
      });

      if (result.errors?.length) {
        throw new Error(result.errors.map((item) => item.message).join(" "));
      }

      const currentProfile = result.data[0] ?? null;
      setProfile(currentProfile);

      if (currentProfile) {
        setDisplayName(currentProfile.displayName ?? "");
        setUsername(currentProfile.username ?? "");
        setBio(currentProfile.bio ?? "");
        setPrivacyDefault((currentProfile.privacyDefault as PrivacyDefault | null | undefined) ?? "private");
        setProfileState("ready");
      } else {
        setDisplayName("");
        setUsername("");
        setBio("");
        setPrivacyDefault("private");
        setProfileState("empty");
      }
    } catch (profileError) {
      const message = getAuthErrorMessage(profileError);
      setProfile(null);
      setOwnerId("");
      setProfileState(message.toLowerCase().includes("auth") || message.toLowerCase().includes("user") ? "signed-out" : "empty");
      if (!message.toLowerCase().includes("auth") && !message.toLowerCase().includes("user")) {
        setError(message);
      }
    }
  }, [client]);

  useEffect(() => {
    const loadInitialState = window.setTimeout(() => {
      void loadProfile();
    }, 0);

    window.addEventListener("unifiedrange-auth-change", loadProfile);

    return () => {
      window.clearTimeout(loadInitialState);
      window.removeEventListener("unifiedrange-auth-change", loadProfile);
    };
  }, [loadProfile]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!displayName.trim()) {
      setError("Display name is required.");
      return;
    }

    if (!ownerId) {
      setError("Sign in before creating a profile.");
      return;
    }

    setIsSaving(true);

    try {
      if (profile) {
        const result = await client.models.UserProfile.update({
          id: profile.id,
          displayName: displayName.trim(),
          username: username.trim(),
          bio: bio.trim(),
          privacyDefault
        });

        if (result.errors?.length) {
          throw new Error(result.errors.map((item) => item.message).join(" "));
        }

        setProfile(result.data);
        setSuccess("Profile updated.");
      } else {
        const result = await client.models.UserProfile.create({
          ownerId,
          displayName: displayName.trim(),
          username: username.trim(),
          bio: bio.trim(),
          privacyDefault
        });

        if (result.errors?.length) {
          throw new Error(result.errors.map((item) => item.message).join(" "));
        }

        setProfile(result.data);
        setProfileState("ready");
        setSuccess("Profile created.");
      }
    } catch (saveError) {
      setError(getAuthErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">AWS profile</p>
          <h3 className="mt-2 text-xl font-bold text-ink">UserProfile</h3>
          <p className="mt-3 text-sm leading-6 text-ink/70">
            This profile is stored as owner-scoped AppSync data. Product areas use saved account records when signed in and clearly labeled demo data when signed out.
          </p>
        </div>
        <span className="w-fit rounded-md bg-field px-3 py-1 text-xs font-semibold text-ink">
          {profileState === "ready" ? "Saved profile" : profileState === "empty" ? "Setup needed" : profileState === "signed-out" ? "Signed out" : "Loading"}
        </span>
      </div>

      {profileState === "loading" ? <p className="mt-5 text-sm text-ink/65">Loading profile...</p> : null}

      {profileState === "signed-out" ? (
        <p className="mt-5 rounded-md bg-field px-3 py-2 text-sm leading-6 text-ink/70">
          Sign in to create or edit your profile. Demo product screens remain available without a profile.
        </p>
      ) : null}

      {profileState === "empty" || profileState === "ready" ? (
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {profileState === "empty" ? (
            <p className="rounded-md bg-moss/10 px-3 py-2 text-sm font-semibold text-moss">No profile found yet. Create one to test the owner-scoped AppSync flow.</p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Display name" value={displayName} required onChange={setDisplayName} />
            <TextField label="Username" value={username} helper="Public handle for later community features." onChange={setUsername} />
          </div>

          <TextArea label="Bio" value={bio} helper="Keep personal details minimal. This profile is private to your signed-in account for now." onChange={setBio} />

          <label className="block">
            <span className="text-sm font-semibold text-ink">Privacy default</span>
            <select
              value={privacyDefault}
              onChange={(event) => setPrivacyDefault(event.target.value as PrivacyDefault)}
              className="mt-2 w-full rounded-md border border-ink/15 px-3 py-2 text-sm text-ink outline-none focus:border-moss"
            >
              {privacyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {error ? <p className="rounded-md bg-clay/10 px-3 py-2 text-sm font-semibold text-clay">{error}</p> : null}
          {success ? <p className="rounded-md bg-moss/10 px-3 py-2 text-sm font-semibold text-moss">{success}</p> : null}

          <button
            type="submit"
            disabled={isSaving}
            className="w-full rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {isSaving ? "Saving..." : profile ? "Save profile" : "Create profile"}
          </button>
        </form>
      ) : null}
    </article>
  );
}
