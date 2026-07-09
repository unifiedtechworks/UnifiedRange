"use client";

import { generateClient } from "aws-amplify/data";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { ProjectileCard } from "@/components/ProjectileCard";
import { projectiles } from "@/data/mockData";
import { configureAmplifyClient, getAuthErrorMessage } from "@/lib/amplifyClient";
import { recordToProjectileProfile, type ProjectileProfileRecord } from "@/lib/projectileProfileData";
import { useAuthUser } from "@/hooks/useAuthUser";

type ProjectileListState = "loading" | "signed-out" | "ready";

export function ProjectileProfileList() {
  const client = useMemo(() => {
    configureAmplifyClient();
    return generateClient<Schema>();
  }, []);
  const { authState } = useAuthUser();
  const [state, setState] = useState<ProjectileListState>("loading");
  const [records, setRecords] = useState<ProjectileProfileRecord[]>([]);
  const [error, setError] = useState("");

  const loadProjectiles = useCallback(async () => {
    setError("");

    if (authState.status === "loading") {
      setState("loading");
      return;
    }

    if (authState.status !== "signed-in") {
      setRecords([]);
      setState("signed-out");
      return;
    }

    try {
      const result = await client.models.ProjectileProfile.list({
        filter: {
          ownerId: {
            eq: authState.username
          }
        }
      });

      if (result.errors?.length) {
        throw new Error(result.errors.map((item) => item.message).join(" "));
      }

      setRecords(result.data);
      setState("ready");
    } catch (listError) {
      setRecords([]);
      setState("ready");
      setError(getAuthErrorMessage(listError));
    }
  }, [authState, client]);

  useEffect(() => {
    const loadInitialState = window.setTimeout(() => {
      void loadProjectiles();
    }, 0);

    window.addEventListener("unifiedrange-auth-change", loadProjectiles);

    return () => {
      window.clearTimeout(loadInitialState);
      window.removeEventListener("unifiedrange-auth-change", loadProjectiles);
    };
  }, [loadProjectiles]);

  const savedProjectiles = records.map(recordToProjectileProfile);

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-ink">Saved Account Data</h2>
            <p className="mt-1 text-sm leading-6 text-ink/65">Signed-in users see owner-scoped Projectile / Ammo records from AppSync here.</p>
          </div>
          <span className="w-fit rounded-md bg-field px-3 py-1 text-xs font-semibold text-ink">
            {state === "loading" ? "Loading" : state === "signed-out" ? "Sign in to save" : `${savedProjectiles.length} saved`}
          </span>
        </div>

        {state === "loading" ? <p className="rounded-md border border-ink/10 bg-white p-4 text-sm text-ink/65 shadow-soft">Loading saved projectiles...</p> : null}

        {error ? <p className="rounded-md border border-clay/30 bg-clay/10 p-4 text-sm font-semibold text-clay">{error}</p> : null}

        {state === "signed-out" ? (
          <div className="rounded-md border border-ink/10 bg-white p-4 shadow-soft">
            <p className="text-sm leading-6 text-ink/70">You are browsing demo projectiles. Sign in to save your own Projectile / Ammo records.</p>
            <Link href="/auth/sign-in" className="mt-3 inline-flex rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
              Sign in to save records
            </Link>
          </div>
        ) : null}

        {state === "ready" && savedProjectiles.length === 0 ? (
          <p className="rounded-md border border-ink/10 bg-white p-4 text-sm leading-6 text-ink/70 shadow-soft">No saved Projectile / Ammo profiles yet. Use Add projectile / ammo to create your first account-backed record.</p>
        ) : null}

        {savedProjectiles.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {savedProjectiles.map((projectile) => (
              <ProjectileCard key={projectile.id} projectile={projectile} sourceLabel="Saved account data" />
            ))}
          </div>
        ) : null}
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-xl font-bold text-ink">Demo Data</h2>
          <p className="mt-1 text-sm leading-6 text-ink/65">Mock projectile profiles remain available for signed-out browsing and UI demos.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projectiles.map((projectile) => (
            <ProjectileCard key={projectile.id} projectile={projectile} sourceLabel="Demo data" />
          ))}
        </div>
      </section>
    </div>
  );
}
