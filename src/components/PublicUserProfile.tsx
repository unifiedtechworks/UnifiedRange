"use client";

import { generateClient } from "aws-amplify/data";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { PageHeader } from "@/components/PageHeader";
import { PublicPassportCard } from "@/components/PublicPassportCard";
import { configureAmplifyClient } from "@/lib/amplifyClient";
import { recordToSanitizedPublicPassport, type PublicPassportSnapshotRecord } from "@/lib/publicPassportSnapshotData";
import { normalizeUsername } from "@/lib/userProfileData";
import type { PublicUserProfileRecord } from "@/lib/publicUserProfileData";

type PublicProfileState = "loading" | "ready" | "private" | "missing" | "error";

export function PublicUserProfile({ username }: { username?: string }) {
  const client = useMemo(() => {
    configureAmplifyClient();
    return generateClient<Schema>();
  }, []);
  const [state, setState] = useState<PublicProfileState>("loading");
  const [profile, setProfile] = useState<PublicUserProfileRecord | null>(null);
  const [setups, setSetups] = useState<PublicPassportSnapshotRecord[]>([]);

  const loadProfile = useCallback(async () => {
    const normalizedUsername = normalizeUsername(username ?? "");
    if (!normalizedUsername) {
      setState("missing");
      return;
    }

    setState("loading");
    try {
      const profileResult = await client.models.PublicUserProfileSnapshot.get({ id: normalizedUsername }, { authMode: "apiKey" });
      if (profileResult.errors?.length) {
        throw new Error(profileResult.errors.map((item) => item.message).join(" "));
      }
      if (!profileResult.data) {
        setProfile(null);
        setSetups([]);
        setState("missing");
        return;
      }

      setProfile(profileResult.data);
      if (profileResult.data.accountVisibility !== "public") {
        setSetups([]);
        setState("private");
        return;
      }

      const setupResult = await client.models.PublicPassportSnapshot.list({
        filter: { ownerId: { eq: profileResult.data.ownerId } },
        authMode: "apiKey"
      });
      if (setupResult.errors?.length) {
        throw new Error(setupResult.errors.map((item) => item.message).join(" "));
      }
      setSetups(setupResult.data);
      setState("ready");
    } catch (error) {
      console.warn("Unable to load public user profile", error);
      setProfile(null);
      setSetups([]);
      setState("error");
    }
  }, [client, username]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadProfile(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadProfile]);

  if (state === "loading") {
    return <p className="rounded-md border border-ink/10 bg-white p-4 text-sm text-ink/65 shadow-soft">Loading public profile...</p>;
  }

  if (state === "missing" || state === "error") {
    return (
      <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <h2 className="text-xl font-bold text-ink">Public profile not found</h2>
        <p className="mt-2 text-sm leading-6 text-ink/70">{state === "error" ? "This public profile could not be loaded." : "This username does not have a public profile."}</p>
        <Link href="/discover" className="mt-4 inline-flex rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">Browse Discover</Link>
      </section>
    );
  }

  if (state === "private") {
    return (
      <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-moss">Public profile</p>
        <h2 className="mt-2 text-2xl font-bold text-ink">@{profile?.username}</h2>
        <p className="mt-3 text-sm leading-6 text-ink/70">This account is private. Profile details and public activity are not shown.</p>
      </section>
    );
  }

  if (!profile) return null;
  const owner = { username: profile.username, displayName: profile.displayName || undefined };
  const publicSetups = setups.map((setup) => recordToSanitizedPublicPassport(setup, owner));

  return (
    <section>
      <PageHeader
        eyebrow="Public profile"
        title={profile.displayName || `@${profile.username}`}
        description={`@${profile.username} · Public account · ${publicSetups.length} public ${publicSetups.length === 1 ? "setup" : "setups"}`}
        action={<Link href="/discover" className="inline-flex rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink">Browse Discover</Link>}
      />
      <article className="rounded-md border border-moss/20 bg-field p-5">
        <h2 className="text-lg font-bold text-ink">About</h2>
        <p className="mt-2 text-sm leading-6 text-ink/70">{profile.bio || "No public bio shared."}</p>
        <p className="mt-3 text-xs leading-5 text-ink/55">Only sanitized public identity and explicitly published setup snapshots appear here.</p>
      </article>

      <div className="mt-6">
        <h2 className="text-xl font-bold text-ink">Published setups</h2>
        {publicSetups.length === 0 ? (
          <div className="mt-4 rounded-md border border-ink/10 bg-white p-5 text-center shadow-soft">
            <h3 className="text-lg font-bold text-ink">No public setups yet</h3>
            <p className="mt-2 text-sm text-ink/65">This public account has not published a setup snapshot.</p>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {publicSetups.map((setup) => <PublicPassportCard key={setup.id} snapshot={setup} sourceLabel="Public snapshot" />)}
          </div>
        )}
      </div>
    </section>
  );
}
