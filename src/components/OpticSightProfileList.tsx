"use client";

import { generateClient } from "aws-amplify/data";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { OpticSightCard } from "@/components/OpticSightCard";
import { optics } from "@/data/mockData";
import { useAuthUser } from "@/hooks/useAuthUser";
import { configureAmplifyClient, getAuthErrorMessage } from "@/lib/amplifyClient";
import { recordToOpticSightProfile, type OpticSightProfileRecord } from "@/lib/opticSightProfileData";

type OpticSightListState = "loading" | "signed-out" | "ready";

export function OpticSightProfileList() {
  const client = useMemo(() => {
    configureAmplifyClient();
    return generateClient<Schema>();
  }, []);
  const { authState } = useAuthUser();
  const [state, setState] = useState<OpticSightListState>("loading");
  const [records, setRecords] = useState<OpticSightProfileRecord[]>([]);
  const [error, setError] = useState("");

  const loadOptics = useCallback(async () => {
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
      const result = await client.models.OpticSightProfile.list({
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
      void loadOptics();
    }, 0);

    window.addEventListener("unifiedrange-auth-change", loadOptics);

    return () => {
      window.clearTimeout(loadInitialState);
      window.removeEventListener("unifiedrange-auth-change", loadOptics);
    };
  }, [loadOptics]);

  const savedOptics = records.map(recordToOpticSightProfile);

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-ink">Saved Account Data</h2>
            <p className="mt-1 text-sm leading-6 text-ink/65">Signed-in users see owner-scoped Optics / Sights records from AppSync here.</p>
          </div>
          <span className="w-fit rounded-md bg-field px-3 py-1 text-xs font-semibold text-ink">
            {state === "loading" ? "Loading" : state === "signed-out" ? "Sign in to save" : `${savedOptics.length} saved`}
          </span>
        </div>

        {state === "loading" ? <p className="rounded-md border border-ink/10 bg-white p-4 text-sm text-ink/65 shadow-soft">Loading saved optics and sights...</p> : null}

        {error ? <p className="rounded-md border border-clay/30 bg-clay/10 p-4 text-sm font-semibold text-clay">{error}</p> : null}

        {state === "signed-out" ? (
          <div className="rounded-md border border-ink/10 bg-white p-4 shadow-soft">
            <p className="text-sm leading-6 text-ink/70">You are browsing demo sights. Sign in to save your own Optics / Sights records.</p>
            <Link href="/auth/sign-in" className="mt-3 inline-flex rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
              Sign in to save records
            </Link>
          </div>
        ) : null}

        {state === "ready" && savedOptics.length === 0 ? (
          <p className="rounded-md border border-ink/10 bg-white p-4 text-sm leading-6 text-ink/70 shadow-soft">No saved Optics / Sights profiles yet. Use Add optic / sight to create your first account-backed record.</p>
        ) : null}

        {savedOptics.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {savedOptics.map((optic) => (
              <OpticSightCard key={optic.id} optic={optic} sourceLabel="Saved account data" />
            ))}
          </div>
        ) : null}
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-xl font-bold text-ink">Demo Data</h2>
          <p className="mt-1 text-sm leading-6 text-ink/65">Mock optic and sight profiles remain available for signed-out browsing and UI demos.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {optics.map((optic) => (
            <OpticSightCard key={optic.id} optic={optic} sourceLabel="Demo data" />
          ))}
        </div>
      </section>
    </div>
  );
}
