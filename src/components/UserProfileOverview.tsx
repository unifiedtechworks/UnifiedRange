"use client";

import { generateClient } from "aws-amplify/data";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { DetailRow } from "@/components/DetailRow";
import { PageHeader } from "@/components/PageHeader";
import { useAuthUser } from "@/hooks/useAuthUser";
import { configureAmplifyClient, getAuthErrorMessage, isAuthTokenClearedError } from "@/lib/amplifyClient";
import { recordToEquipmentPassport, type EquipmentPassportRecord } from "@/lib/equipmentPassportData";
import { recordToHuntingChecklist, type HuntingChecklistRecord } from "@/lib/huntingChecklistData";
import { recordToMaintenanceLogEntry, type MaintenanceLogEntryRecord } from "@/lib/maintenanceLogData";
import { recordToRangeSession, type RangeSessionRecord } from "@/lib/rangeSessionData";
import {
  privacyDefaultLabel,
  type UserProfileRecord
} from "@/lib/userProfileData";
import { ensureUsernameReservation } from "@/lib/usernameReservationData";
import type { EquipmentPassport, HuntingChecklist, MaintenanceLogEntry, RangeSession } from "@/types";

type ProfileState = "loading" | "signed-out" | "setup" | "ready" | "error";

interface ProfileActivity {
  passports: EquipmentPassport[];
  sessions: RangeSession[];
  maintenance: MaintenanceLogEntry[];
  checklists: HuntingChecklist[];
  publicSnapshots: Schema["PublicPassportSnapshot"]["type"][];
}

const emptyActivity: ProfileActivity = {
  passports: [],
  sessions: [],
  maintenance: [],
  checklists: [],
  publicSnapshots: []
};

function sortByRecent<T extends { date?: string | null; createdAt?: string | null; updatedAt?: string | null }>(items: T[]) {
  return [...items].sort((a, b) => {
    const aTime = new Date(a.updatedAt ?? a.date ?? a.createdAt ?? "").getTime();
    const bTime = new Date(b.updatedAt ?? b.date ?? b.createdAt ?? "").getTime();
    return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
  });
}

export function UserProfileOverview() {
  const client = useMemo(() => {
    configureAmplifyClient();
    return generateClient<Schema>();
  }, []);
  const { authState } = useAuthUser();
  const [state, setState] = useState<ProfileState>("loading");
  const [profile, setProfile] = useState<UserProfileRecord | null>(null);
  const [activity, setActivity] = useState<ProfileActivity>(emptyActivity);
  const [error, setError] = useState("");
  const requestIdRef = useRef(0);

  const loadProfile = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setError("");

    if (authState.status === "loading") {
      setState("loading");
      return;
    }

    if (authState.status !== "signed-in") {
      setProfile(null);
      setActivity(emptyActivity);
      setState("signed-out");
      return;
    }

    try {
      const profileResult = await client.models.UserProfile.list({ filter: { ownerId: { eq: authState.username } } });

      if (profileResult.errors?.length) {
        throw new Error(profileResult.errors.map((item) => item.message).join(" "));
      }

      if (requestId !== requestIdRef.current) {
        return;
      }

      const currentProfile = profileResult.data[0] ?? null;
      setProfile(currentProfile);

      if (!currentProfile) {
        setActivity(emptyActivity);
        setState("setup");
        return;
      }

      if (currentProfile.username) {
        try {
          await ensureUsernameReservation(client, currentProfile.username, authState.username);
        } catch {
          throw new Error("This profile username conflicts with an existing reservation. Please contact support for manual resolution.");
        }
      }

      const [passportResult, sessionResult, maintenanceResult, checklistResult, publicSnapshotResult] = await Promise.all([
        client.models.EquipmentPassport.list({ filter: { ownerId: { eq: authState.username } } }),
        client.models.RangeSession.list({ filter: { ownerId: { eq: authState.username } } }),
        client.models.MaintenanceLogEntry.list({ filter: { ownerId: { eq: authState.username } } }),
        client.models.HuntingChecklist.list({ filter: { ownerId: { eq: authState.username } } }),
        client.models.PublicPassportSnapshot.list({ filter: { ownerId: { eq: authState.username } } })
      ]);

      const errors = [
        ...(passportResult.errors ?? []),
        ...(sessionResult.errors ?? []),
        ...(maintenanceResult.errors ?? []),
        ...(checklistResult.errors ?? []),
        ...(publicSnapshotResult.errors ?? [])
      ];

      if (errors.length) {
        throw new Error(errors.map((item) => item.message).join(" "));
      }

      if (requestId !== requestIdRef.current) {
        return;
      }

      setActivity({
        passports: passportResult.data.map((record: EquipmentPassportRecord) => recordToEquipmentPassport(record)),
        sessions: sessionResult.data.map((record: RangeSessionRecord) => recordToRangeSession(record)),
        maintenance: maintenanceResult.data.map((record: MaintenanceLogEntryRecord) => recordToMaintenanceLogEntry(record)),
        checklists: checklistResult.data.map((record: HuntingChecklistRecord) => recordToHuntingChecklist(record)),
        publicSnapshots: publicSnapshotResult.data
      });
      setState("ready");
    } catch (profileError) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      if (isAuthTokenClearedError(profileError)) {
        setProfile(null);
        setActivity(emptyActivity);
        setError("");
        setState("signed-out");
        return;
      }

      setProfile(null);
      setActivity(emptyActivity);
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

  if (state === "loading") {
    return <p className="rounded-md border border-ink/10 bg-white p-4 text-sm text-ink/65 shadow-soft">Loading profile...</p>;
  }

  if (state === "signed-out") {
    return (
      <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <h2 className="text-xl font-bold text-ink">Sign in to view your profile</h2>
        <p className="mt-2 text-sm leading-6 text-ink/70">Your private activity summary is visible only to your signed-in account.</p>
        <Link href="/auth/sign-in" className="mt-4 inline-flex rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
          Sign in
        </Link>
      </section>
    );
  }

  if (state === "error") {
    return (
      <section className="rounded-md border border-clay/30 bg-clay/10 p-5">
        <h2 className="text-xl font-bold text-ink">Profile unavailable</h2>
        <p className="mt-2 text-sm leading-6 text-clay">{error || "Your profile could not be loaded."}</p>
      </section>
    );
  }

  if (state === "setup") {
    return (
      <section>
        <PageHeader
          eyebrow="Profile setup"
          title="Complete your profile"
          description="Choose your permanent username and basic profile details before using saved account workflows. This does not make private records public."
          action={
            <Link href="/profile/setup" className="inline-flex rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
              Start setup
            </Link>
          }
        />
        <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
          <h3 className="text-xl font-bold text-ink">Profile required</h3>
          <p className="mt-3 text-sm leading-6 text-ink/70">
            Signed-in users need a profile before creating or editing saved account records. Signed-out visitors can still browse public pages and clearly labeled demo content.
          </p>
        </article>
      </section>
    );
  }

  if (!profile) {
    return null;
  }

  const recentPassports = sortByRecent(activity.passports).slice(0, 3);
  const recentSessions = sortByRecent(activity.sessions).slice(0, 3);
  const recentMaintenance = sortByRecent(activity.maintenance).slice(0, 3);
  const recentChecklists = sortByRecent(activity.checklists).slice(0, 3);

  return (
    <section>
      <PageHeader
        eyebrow="Profile"
        title={profile.displayName}
        description="Your private activity summary is visible only while signed in. Public activity is based on sanitized public snapshots."
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/profile/edit" className="inline-flex justify-center rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
              Edit profile
            </Link>
            <Link href="/settings/privacy" className="inline-flex justify-center rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink">
              Privacy settings
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
          <h3 className="text-xl font-bold text-ink">Account Summary</h3>
          <dl className="mt-4">
            <DetailRow label="Username" value={profile.username ? `@${profile.username}` : "Not set"} />
            <DetailRow label="First name" value={profile.firstName || "Not set"} />
            <DetailRow label="Last name" value={profile.lastName || "Not set"} />
            <DetailRow label="City" value={profile.city || "Not set"} />
            <DetailRow label="State" value={profile.state || "Not set"} />
            <DetailRow label="Bio" value={profile.bio || "No bio yet."} />
            <DetailRow label="Privacy default" value={privacyDefaultLabel(profile.privacyDefault)} />
          </dl>
          <p className="mt-4 rounded-md border border-moss/20 bg-field px-4 py-3 text-sm leading-6 text-ink/70">
            Private records stay owner-scoped. Public sharing creates a separate sanitized snapshot.
          </p>
        </article>

        <div className="space-y-6">
          <ActivitySection title="Private Activity" description="Visible only to your signed-in account.">
            <ActivityLinks title="Recent Equipment Passports" basePath="/passports" items={recentPassports.map((item) => ({ id: item.id, label: item.nickname }))} />
            <ActivityLinks title="Recent Range Sessions" basePath="/sessions" items={recentSessions.map((item) => ({ id: item.id, label: `${item.date} - ${item.discipline}` }))} />
            <ActivityLinks title="Recent Maintenance" basePath="/maintenance" items={recentMaintenance.map((item) => ({ id: item.id, label: `${item.date} - ${item.maintenanceType}` }))} />
            <ActivityLinks title="Recent Hunting Readiness" basePath="/readiness" items={recentChecklists.map((item) => ({ id: item.id, label: item.huntName }))} />
          </ActivitySection>

          <ActivitySection title="Public Activity" description="Sanitized public snapshots only. Private records and images are not shown here.">
            <ActivityLinks title="Published Public Passports" basePath="/discover/passports" items={activity.publicSnapshots.map((item) => ({ id: item.id, label: item.title }))} />
          </ActivitySection>
        </div>
      </div>
    </section>
  );
}

function ActivitySection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
      <h3 className="text-xl font-bold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-ink/65">{description}</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

function ActivityLinks({ title, basePath, items }: { title: string; basePath: string; items: Array<{ id: string; label: string }> }) {
  return (
    <div className="rounded-md border border-ink/10 bg-paper p-4">
      <h4 className="text-sm font-bold text-ink">{title}</h4>
      {items.length ? (
        <div className="mt-3 space-y-2">
          {items.map((item) => (
            <Link key={item.id} href={`${basePath}/${item.id}`} className="block text-sm font-semibold text-moss">
              {item.label}
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-ink/60">No records yet.</p>
      )}
    </div>
  );
}
