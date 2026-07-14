"use client";

import { generateClient } from "aws-amplify/data";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { HuntingChecklistCard } from "@/components/HuntingChecklistCard";
import { huntingChecklists } from "@/data/mockData";
import { useAuthUser } from "@/hooks/useAuthUser";
import { configureAmplifyClient, getAuthErrorMessage } from "@/lib/amplifyClient";
import {
  huntingPassportLabel,
  recordToHuntingChecklist,
  type HuntingChecklistRecord,
  type HuntingPassportRecord
} from "@/lib/huntingChecklistData";

type ReadinessListState = "loading" | "signed-out" | "ready";

export function HuntingReadinessList() {
  const client = useMemo(() => {
    configureAmplifyClient();
    return generateClient<Schema>();
  }, []);
  const { authState } = useAuthUser();
  const [state, setState] = useState<ReadinessListState>("loading");
  const [records, setRecords] = useState<HuntingChecklistRecord[]>([]);
  const [passports, setPassports] = useState<HuntingPassportRecord[]>([]);
  const [error, setError] = useState("");

  const loadReadiness = useCallback(async () => {
    setError("");

    if (authState.status === "loading") {
      setState("loading");
      return;
    }

    if (authState.status !== "signed-in") {
      setRecords([]);
      setPassports([]);
      setState("signed-out");
      return;
    }

    try {
      const [checklistResult, passportResult] = await Promise.all([
        client.models.HuntingChecklist.list({ filter: { ownerId: { eq: authState.username } } }),
        client.models.EquipmentPassport.list({ filter: { ownerId: { eq: authState.username } } })
      ]);

      const errors = [...(checklistResult.errors ?? []), ...(passportResult.errors ?? [])];
      if (errors.length) {
        throw new Error(errors.map((item) => item.message).join(" "));
      }

      setRecords(checklistResult.data);
      setPassports(passportResult.data);
      setState("ready");
    } catch (listError) {
      setRecords([]);
      setPassports([]);
      setState("ready");
      setError(getAuthErrorMessage(listError));
    }
  }, [authState, client]);

  useEffect(() => {
    const loadInitialState = window.setTimeout(() => {
      void loadReadiness();
    }, 0);

    window.addEventListener("unifiedrange-auth-change", loadReadiness);

    return () => {
      window.clearTimeout(loadInitialState);
      window.removeEventListener("unifiedrange-auth-change", loadReadiness);
    };
  }, [loadReadiness]);

  const savedChecklists = records.map(recordToHuntingChecklist);

  function getEquipmentSummary(passportId: string) {
    const passport = passports.find((item) => item.id === passportId);
    return passport ? huntingPassportLabel(passport) : undefined;
  }

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-ink">Saved Account Data</h2>
            <p className="mt-1 text-sm leading-6 text-ink/65">Signed-in users see owner-scoped Hunting Readiness records from AppSync here.</p>
          </div>
          <span className="w-fit rounded-md bg-field px-3 py-1 text-xs font-semibold text-ink">
            {state === "loading" ? "Loading" : state === "signed-out" ? "Sign in to save" : `${savedChecklists.length} saved`}
          </span>
        </div>

        {state === "loading" ? <p className="rounded-md border border-ink/10 bg-white p-4 text-sm text-ink/65 shadow-soft">Loading saved readiness checklists...</p> : null}
        {error ? <p className="rounded-md border border-clay/30 bg-clay/10 p-4 text-sm font-semibold text-clay">{error}</p> : null}

        {state === "signed-out" ? (
          <div className="rounded-md border border-ink/10 bg-white p-4 shadow-soft">
            <p className="text-sm leading-6 text-ink/70">You are browsing demo readiness checklists. Sign in to save private Hunting Readiness records linked to your saved Equipment Passports.</p>
            <Link href="/auth/sign-in" className="mt-3 inline-flex rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
              Sign in to save records
            </Link>
          </div>
        ) : null}

        {state === "ready" && savedChecklists.length === 0 ? (
          <p className="rounded-md border border-ink/10 bg-white p-4 text-sm leading-6 text-ink/70 shadow-soft">No saved Hunting Readiness checklists yet. Use Create checklist to create your first private account-backed record.</p>
        ) : null}

        {savedChecklists.length > 0 ? (
          <div className="grid gap-5 xl:grid-cols-2">
            {savedChecklists.map((checklist) => (
              <HuntingChecklistCard key={checklist.id} checklist={checklist} sourceLabel="Saved account data" equipmentSummary={getEquipmentSummary(checklist.equipmentPassportId)} />
            ))}
          </div>
        ) : null}
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-xl font-bold text-ink">Demo Data</h2>
          <p className="mt-1 text-sm leading-6 text-ink/65">Mock readiness checklists remain available for signed-out browsing and UI demos.</p>
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          {huntingChecklists.map((checklist) => (
            <HuntingChecklistCard key={checklist.id} checklist={checklist} sourceLabel="Demo data" />
          ))}
        </div>
      </section>
    </div>
  );
}
