"use client";

import { generateClient } from "aws-amplify/data";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { PageHeader } from "@/components/PageHeader";
import { UserProfileForm } from "@/components/UserProfileForm";
import { useAuthUser } from "@/hooks/useAuthUser";
import { configureAmplifyClient, getAuthErrorMessage } from "@/lib/amplifyClient";
import {
  defaultUserProfileFormValues,
  toCreateUserProfileInput,
  toUpdateUserProfileInput,
  toUserProfileFormValues,
  type UserProfileFormValues,
  type UserProfileRecord
} from "@/lib/userProfileData";

type ProfileEditState = "loading" | "signed-out" | "create" | "edit" | "error";

export function UserProfileEdit() {
  const router = useRouter();
  const client = useMemo(() => {
    configureAmplifyClient();
    return generateClient<Schema>();
  }, []);
  const { authState } = useAuthUser();
  const [state, setState] = useState<ProfileEditState>("loading");
  const [profile, setProfile] = useState<UserProfileRecord | null>(null);
  const [error, setError] = useState("");

  const loadProfile = useCallback(async () => {
    setError("");

    if (authState.status === "loading") {
      setState("loading");
      return;
    }

    if (authState.status !== "signed-in") {
      setProfile(null);
      setState("signed-out");
      return;
    }

    try {
      const result = await client.models.UserProfile.list({ filter: { ownerId: { eq: authState.username } } });

      if (result.errors?.length) {
        throw new Error(result.errors.map((item) => item.message).join(" "));
      }

      const currentProfile = result.data[0] ?? null;
      setProfile(currentProfile);
      setState(currentProfile ? "edit" : "create");
    } catch (profileError) {
      setProfile(null);
      setError(getAuthErrorMessage(profileError));
      setState("error");
    }
  }, [authState, client]);

  useEffect(() => {
    const loadInitialState = window.setTimeout(() => {
      void loadProfile();
    }, 0);

    return () => {
      window.clearTimeout(loadInitialState);
    };
  }, [loadProfile]);

  async function handleCreate(values: UserProfileFormValues) {
    if (authState.status !== "signed-in") {
      throw new Error("Sign in before creating a profile.");
    }

    const result = await client.models.UserProfile.create(toCreateUserProfileInput(values, authState.username));

    if (result.errors?.length) {
      throw new Error(result.errors.map((item) => item.message).join(" "));
    }

    router.push("/profile");
  }

  async function handleUpdate(values: UserProfileFormValues) {
    if (!profile?.id) {
      throw new Error("Profile record could not be found.");
    }

    const result = await client.models.UserProfile.update(toUpdateUserProfileInput(profile.id, values));

    if (result.errors?.length) {
      throw new Error(result.errors.map((item) => item.message).join(" "));
    }

    router.push("/profile");
  }

  if (state === "loading") {
    return <p className="rounded-md border border-ink/10 bg-white p-4 text-sm text-ink/65 shadow-soft">Loading profile editor...</p>;
  }

  if (state === "signed-out") {
    return (
      <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <h2 className="text-xl font-bold text-ink">Sign in to edit your profile</h2>
        <p className="mt-2 text-sm leading-6 text-ink/70">Profiles are account-scoped and stay separate from signed-out demo browsing.</p>
        <Link href="/auth/sign-in" className="mt-4 inline-flex rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
          Sign in
        </Link>
      </section>
    );
  }

  if (state === "error") {
    return (
      <section className="rounded-md border border-clay/30 bg-clay/10 p-5">
        <h2 className="text-xl font-bold text-ink">Profile editor unavailable</h2>
        <p className="mt-2 text-sm leading-6 text-clay">{error || "Your profile could not be loaded."}</p>
      </section>
    );
  }

  return (
    <section>
      <PageHeader
        eyebrow={state === "create" ? "Profile setup" : "Profile"}
        title={state === "create" ? "Create your profile" : "Edit profile"}
        description="Set your display name, username, bio, and privacy default. Private range and readiness records remain owner-scoped."
      />
      <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <UserProfileForm
          mode={state === "create" ? "create" : "edit"}
          initialValues={state === "create" ? defaultUserProfileFormValues : toUserProfileFormValues(profile)}
          cancelHref="/profile"
          onSubmit={state === "create" ? handleCreate : handleUpdate}
        />
      </article>
    </section>
  );
}
