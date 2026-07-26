"use client";

import { generateClient } from "aws-amplify/data";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { PageHeader } from "@/components/PageHeader";
import { useAuthUser } from "@/hooks/useAuthUser";
import { configureAmplifyClient, getAuthErrorMessage, isAuthTokenClearedError } from "@/lib/amplifyClient";
import {
  removeOwnedStalePublicUserProfileSnapshot,
  syncPublicUserProfileSnapshot
} from "@/lib/publicUserProfileData";
import { normalizeUsername, validateUsername, type UserProfileRecord } from "@/lib/userProfileData";
import {
  checkUsernameAvailability,
  ensureUsernameReservation,
  ownerIdentityFromAuth,
  shortOwnerIdentifier,
  type UsernameReservationDiagnostics
} from "@/lib/usernameReservationData";

type RepairState = "loading" | "signed-out" | "no-profile" | "not-eligible" | "eligible" | "error";

export function UsernameConflictRepair() {
  const router = useRouter();
  const client = useMemo(() => {
    configureAmplifyClient();
    return generateClient<Schema>();
  }, []);
  const { authState } = useAuthUser();
  const [state, setState] = useState<RepairState>("loading");
  const [profile, setProfile] = useState<UserProfileRecord | null>(null);
  const [diagnostics, setDiagnostics] = useState<UsernameReservationDiagnostics | null>(null);
  const [username, setUsername] = useState("");
  const [availabilityMessage, setAvailabilityMessage] = useState("");
  const [error, setError] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadEligibility = useCallback(async () => {
    setError("");
    setDiagnostics(null);

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
      const profileResult = await client.models.UserProfile.list({ filter: { ownerId: { eq: authState.ownerKey } } });
      if (profileResult.errors?.length) throw new Error(profileResult.errors.map((item) => item.message).join(" "));

      const currentProfile = profileResult.data[0] ?? null;
      setProfile(currentProfile);
      if (!currentProfile?.username) {
        setState("no-profile");
        return;
      }

      const ownership = await checkUsernameAvailability(client, currentProfile.username, ownerIdentityFromAuth(authState), true);
      setDiagnostics(ownership.diagnostics);
      setState(ownership.status === "taken" ? "eligible" : "not-eligible");
    } catch (loadError) {
      if (isAuthTokenClearedError(loadError)) {
        setState("signed-out");
      } else {
        setError(getAuthErrorMessage(loadError));
        setState("error");
      }
    }
  }, [authState, client]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadEligibility(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadEligibility]);

  async function checkNewUsername() {
    if (authState.status !== "signed-in") return;
    const usernameError = validateUsername(username);
    if (usernameError) {
      setError(usernameError);
      setAvailabilityMessage("");
      return;
    }

    setIsChecking(true);
    setError("");
    try {
      const result = await checkUsernameAvailability(client, username, ownerIdentityFromAuth(authState), true);
      setAvailabilityMessage(result.status === "taken" ? "That username is already taken." : result.message);
      if (result.status === "taken") setError("Choose another username.");
    } catch (checkError) {
      setError(getAuthErrorMessage(checkError));
      setAvailabilityMessage("");
    } finally {
      setIsChecking(false);
    }
  }

  async function repairUsername() {
    if (authState.status !== "signed-in" || !profile?.id || !profile.username) {
      setError("This repair session is no longer available. Return to Profile and try again.");
      return;
    }

    const nextUsername = normalizeUsername(username);
    const usernameError = validateUsername(nextUsername);
    if (usernameError) {
      setError(usernameError);
      return;
    }
    if (nextUsername === normalizeUsername(profile.username)) {
      setError("Choose a username different from the conflicted username.");
      return;
    }

    setIsSaving(true);
    setError("");
    setAvailabilityMessage("");

    try {
      const ownerIdentity = ownerIdentityFromAuth(authState);

      // Revalidate eligibility immediately before mutation. If the old
      // reservation was repaired elsewhere, normal username immutability wins.
      const currentOwnership = await checkUsernameAvailability(client, profile.username, ownerIdentity, true);
      if (currentOwnership.status !== "taken") {
        setDiagnostics(currentOwnership.diagnostics);
        setState("not-eligible");
        throw new Error("The conflict no longer exists, so username repair is not available.");
      }

      const nextAvailability = await checkUsernameAvailability(client, nextUsername, ownerIdentity, true);
      if (nextAvailability.status === "taken") {
        throw new Error("That username is already taken.");
      }

      const publicSnapshot = await client.models.PublicUserProfileSnapshot.get({ id: nextUsername });
      if (publicSnapshot.errors?.length) throw new Error(publicSnapshot.errors.map((item) => item.message).join(" "));
      const allowedOwnerIds = [...new Set([profile.ownerId, ...ownerIdentity.aliases])];
      if (publicSnapshot.data && !allowedOwnerIds.includes(publicSnapshot.data.ownerId)) {
        throw new Error("That username cannot be used because a public identity record already exists. Choose another username.");
      }

      await ensureUsernameReservation(client, nextUsername, ownerIdentity, true);

      const updateResult = await client.models.UserProfile.update({ id: profile.id, username: nextUsername });
      if (updateResult.errors?.length) throw new Error(updateResult.errors.map((item) => item.message).join(" "));
      if (!updateResult.data) throw new Error("Profile username could not be updated.");

      // The other user's reservation is untouched. Only a stale public snapshot
      // owned by this signed-in account may be removed.
      try {
        await removeOwnedStalePublicUserProfileSnapshot(client, profile.username, allowedOwnerIds);
        await syncPublicUserProfileSnapshot(client, updateResult.data, updateResult.data.ownerId, true);
      } catch (syncError) {
        console.warn("Username repaired; public profile synchronization will retry from Profile", syncError);
      }

      router.push("/profile");
    } catch (repairError) {
      setError(getAuthErrorMessage(repairError));
    } finally {
      setIsSaving(false);
    }
  }

  if (state === "loading") return <StatusCard title="Checking username ownership" body="Confirming that this account is eligible for conflict repair..." />;
  if (state === "signed-out") return <StatusCard title="Sign in required" body="Sign in to the affected account before repairing its username." actionHref="/auth/sign-in" actionLabel="Sign in" />;
  if (state === "no-profile") return <StatusCard title="Profile required" body="Complete profile setup before using username conflict repair." actionHref="/profile/setup" actionLabel="Profile setup" />;
  if (state === "not-eligible") return <StatusCard title="Username repair is not available" body="This profile does not currently have a reservation conflict. Normal usernames remain immutable." actionHref="/profile" actionLabel="Back to Profile" />;
  if (state === "error") return <StatusCard title="Repair unavailable" body={error || "Username ownership could not be checked."} actionHref="/profile" actionLabel="Back to Profile" />;

  return (
    <section>
      <PageHeader
        eyebrow="Username conflict repair"
        title="Choose a different username"
        description="This one-time repair is available because your legacy profile username is reserved by another account. The existing owner keeps that username."
        action={<Link href="/profile" className="inline-flex rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink">Cancel</Link>}
      />

      {diagnostics ? (
        <div className="mb-6 rounded-md border border-clay/30 bg-clay/10 p-4 text-sm text-ink/70">
          <p className="font-semibold text-ink">Confirmed conflict for @{diagnostics.normalizedUsername}</p>
          <p className="mt-2 font-mono text-xs">Current auth ID: {shortOwnerIdentifier(diagnostics.currentOwnerKey)} · Reservation owner: {shortOwnerIdentifier(diagnostics.reservationOwnerId)}</p>
        </div>
      ) : null}

      <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <label className="block">
          <span className="text-sm font-semibold text-ink">New username</span>
          <input
            value={username}
            onChange={(event) => {
              setUsername(event.target.value);
              setAvailabilityMessage("");
              setError("");
            }}
            autoComplete="off"
            spellCheck={false}
            placeholder="new_username"
            className="mt-2 min-h-10 w-full rounded-md border border-ink/15 px-3 py-2 text-sm text-ink outline-none focus:border-moss"
          />
          <span className="mt-1 block text-xs leading-5 text-ink/55">Use 3-24 lowercase letters, numbers, underscores, or hyphens. This becomes your immutable username.</span>
        </label>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button type="button" disabled={isChecking || isSaving} onClick={() => void checkNewUsername()} className="rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60">
            {isChecking ? "Checking..." : "Check availability"}
          </button>
          <button type="button" disabled={isChecking || isSaving} onClick={() => void repairUsername()} className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {isSaving ? "Repairing username..." : "Save new username"}
          </button>
        </div>

        {availabilityMessage ? <p className="mt-3 text-sm font-semibold text-moss">{availabilityMessage}</p> : null}
        {error ? <p className="mt-3 rounded-md border border-clay/30 bg-clay/10 px-4 py-3 text-sm font-semibold text-clay">{error}</p> : null}
        <p className="mt-4 text-xs leading-5 text-ink/55">This action never deletes, transfers, or overwrites the reservation owned by the other account.</p>
      </article>
    </section>
  );
}

function StatusCard({ title, body, actionHref, actionLabel }: { title: string; body: string; actionHref?: string; actionLabel?: string }) {
  return (
    <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
      <h2 className="text-xl font-bold text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-ink/70">{body}</p>
      {actionHref && actionLabel ? <Link href={actionHref} className="mt-4 inline-flex rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">{actionLabel}</Link> : null}
    </section>
  );
}
