"use client";

import { generateClient } from "aws-amplify/data";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { SessionCard } from "@/components/SessionCard";
import { rangeSessions } from "@/data/mockData";
import { useAuthUser } from "@/hooks/useAuthUser";
import { configureAmplifyClient, getAuthErrorMessage } from "@/lib/amplifyClient";
import {
  equipmentPassportLabel,
  projectileProfileLabel,
  recordToRangeSession,
  type EquipmentPassportRecord,
  type ProjectileProfileRecord,
  type RangeSessionRecord
} from "@/lib/rangeSessionData";

type SessionListState = "loading" | "signed-out" | "ready";

export function RangeSessionList() {
  const client = useMemo(() => {
    configureAmplifyClient();
    return generateClient<Schema>();
  }, []);
  const { authState } = useAuthUser();
  const [state, setState] = useState<SessionListState>("loading");
  const [records, setRecords] = useState<RangeSessionRecord[]>([]);
  const [passports, setPassports] = useState<EquipmentPassportRecord[]>([]);
  const [projectiles, setProjectiles] = useState<ProjectileProfileRecord[]>([]);
  const [error, setError] = useState("");

  const loadSessions = useCallback(async () => {
    setError("");

    if (authState.status === "loading") {
      setState("loading");
      return;
    }

    if (authState.status !== "signed-in") {
      setRecords([]);
      setPassports([]);
      setProjectiles([]);
      setState("signed-out");
      return;
    }

    try {
      const [sessionResult, passportResult, projectileResult] = await Promise.all([
        client.models.RangeSession.list({ filter: { ownerId: { eq: authState.username } } }),
        client.models.EquipmentPassport.list({ filter: { ownerId: { eq: authState.username } } }),
        client.models.ProjectileProfile.list({ filter: { ownerId: { eq: authState.username } } })
      ]);

      const errors = [...(sessionResult.errors ?? []), ...(passportResult.errors ?? []), ...(projectileResult.errors ?? [])];
      if (errors.length) {
        throw new Error(errors.map((item) => item.message).join(" "));
      }

      setRecords(sessionResult.data);
      setPassports(passportResult.data);
      setProjectiles(projectileResult.data);
      setState("ready");
    } catch (listError) {
      setRecords([]);
      setState("ready");
      setError(getAuthErrorMessage(listError));
    }
  }, [authState, client]);

  useEffect(() => {
    const loadInitialState = window.setTimeout(() => {
      void loadSessions();
    }, 0);

    window.addEventListener("unifiedrange-auth-change", loadSessions);

    return () => {
      window.clearTimeout(loadInitialState);
      window.removeEventListener("unifiedrange-auth-change", loadSessions);
    };
  }, [loadSessions]);

  const savedSessions = records.map(recordToRangeSession);

  function getEquipmentSummary(passportId: string) {
    const passport = passports.find((item) => item.id === passportId);
    return passport ? equipmentPassportLabel(passport) : undefined;
  }

  function getProjectileSummary(projectileId?: string) {
    const projectile = projectiles.find((item) => item.id === projectileId);
    return projectile ? projectileProfileLabel(projectile) : undefined;
  }

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-ink">Saved Account Data</h2>
            <p className="mt-1 text-sm leading-6 text-ink/65">Signed-in users see owner-scoped Range Sessions from AppSync here.</p>
          </div>
          <span className="w-fit rounded-md bg-field px-3 py-1 text-xs font-semibold text-ink">
            {state === "loading" ? "Loading" : state === "signed-out" ? "Sign in to save" : `${savedSessions.length} saved`}
          </span>
        </div>

        {state === "loading" ? <p className="rounded-md border border-ink/10 bg-white p-4 text-sm text-ink/65 shadow-soft">Loading saved range sessions...</p> : null}
        {error ? <p className="rounded-md border border-clay/30 bg-clay/10 p-4 text-sm font-semibold text-clay">{error}</p> : null}

        {state === "signed-out" ? (
          <div className="rounded-md border border-ink/10 bg-white p-4 shadow-soft">
            <p className="text-sm leading-6 text-ink/70">You are browsing demo sessions. Sign in to save your own Range Sessions linked to saved records.</p>
            <Link href="/auth/sign-in" className="mt-3 inline-flex rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
              Sign in to save records
            </Link>
          </div>
        ) : null}

        {state === "ready" && savedSessions.length === 0 ? (
          <p className="rounded-md border border-ink/10 bg-white p-4 text-sm leading-6 text-ink/70 shadow-soft">No saved Range Sessions yet. Use Log range session to create your first account-backed session.</p>
        ) : null}

        {savedSessions.length > 0 ? (
          <div className="space-y-4">
            {savedSessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                sourceLabel="Saved account data"
                equipmentSummary={getEquipmentSummary(session.equipmentPassportId)}
                projectileSummary={getProjectileSummary(session.projectileProfileId)}
              />
            ))}
          </div>
        ) : null}
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-xl font-bold text-ink">Demo Data</h2>
          <p className="mt-1 text-sm leading-6 text-ink/65">Mock range sessions remain available for signed-out browsing and UI demos.</p>
        </div>
        <div className="space-y-4">
          {rangeSessions.map((session) => (
            <SessionCard key={session.id} session={session} sourceLabel="Demo data" />
          ))}
        </div>
      </section>
    </div>
  );
}
