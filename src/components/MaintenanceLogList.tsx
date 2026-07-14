"use client";

import { generateClient } from "aws-amplify/data";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { MaintenanceCard } from "@/components/MaintenanceCard";
import { maintenanceEntries } from "@/data/mockData";
import { useAuthUser } from "@/hooks/useAuthUser";
import { configureAmplifyClient, getAuthErrorMessage } from "@/lib/amplifyClient";
import {
  maintenancePassportLabel,
  recordToMaintenanceLogEntry,
  type MaintenanceLogEntryRecord,
  type MaintenancePassportRecord
} from "@/lib/maintenanceLogData";

type MaintenanceListState = "loading" | "signed-out" | "ready";

export function MaintenanceLogList() {
  const client = useMemo(() => {
    configureAmplifyClient();
    return generateClient<Schema>();
  }, []);
  const { authState } = useAuthUser();
  const [state, setState] = useState<MaintenanceListState>("loading");
  const [records, setRecords] = useState<MaintenanceLogEntryRecord[]>([]);
  const [passports, setPassports] = useState<MaintenancePassportRecord[]>([]);
  const [error, setError] = useState("");

  const loadMaintenance = useCallback(async () => {
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
      const [maintenanceResult, passportResult] = await Promise.all([
        client.models.MaintenanceLogEntry.list({ filter: { ownerId: { eq: authState.username } } }),
        client.models.EquipmentPassport.list({ filter: { ownerId: { eq: authState.username } } })
      ]);

      const errors = [...(maintenanceResult.errors ?? []), ...(passportResult.errors ?? [])];
      if (errors.length) {
        throw new Error(errors.map((item) => item.message).join(" "));
      }

      setRecords(maintenanceResult.data);
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
      void loadMaintenance();
    }, 0);

    window.addEventListener("unifiedrange-auth-change", loadMaintenance);

    return () => {
      window.clearTimeout(loadInitialState);
      window.removeEventListener("unifiedrange-auth-change", loadMaintenance);
    };
  }, [loadMaintenance]);

  const savedEntries = records.map(recordToMaintenanceLogEntry);

  function getEquipmentSummary(passportId: string) {
    const passport = passports.find((item) => item.id === passportId);
    return passport ? maintenancePassportLabel(passport) : undefined;
  }

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-ink">Saved Account Data</h2>
            <p className="mt-1 text-sm leading-6 text-ink/65">Signed-in users see owner-scoped Maintenance records from AppSync here.</p>
          </div>
          <span className="w-fit rounded-md bg-field px-3 py-1 text-xs font-semibold text-ink">
            {state === "loading" ? "Loading" : state === "signed-out" ? "Sign in to save" : `${savedEntries.length} saved`}
          </span>
        </div>

        {state === "loading" ? <p className="rounded-md border border-ink/10 bg-white p-4 text-sm text-ink/65 shadow-soft">Loading saved maintenance records...</p> : null}
        {error ? <p className="rounded-md border border-clay/30 bg-clay/10 p-4 text-sm font-semibold text-clay">{error}</p> : null}

        {state === "signed-out" ? (
          <div className="rounded-md border border-ink/10 bg-white p-4 shadow-soft">
            <p className="text-sm leading-6 text-ink/70">You are browsing demo maintenance records. Sign in to save private Maintenance records linked to your saved Equipment Passports.</p>
            <Link href="/auth/sign-in" className="mt-3 inline-flex rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
              Sign in to save records
            </Link>
          </div>
        ) : null}

        {state === "ready" && savedEntries.length === 0 ? (
          <p className="rounded-md border border-ink/10 bg-white p-4 text-sm leading-6 text-ink/70 shadow-soft">No saved Maintenance records yet. Use Add maintenance to create your first private account-backed record.</p>
        ) : null}

        {savedEntries.length > 0 ? (
          <div className="space-y-4">
            {savedEntries.map((entry) => (
              <MaintenanceCard key={entry.id} entry={entry} sourceLabel="Saved account data" equipmentSummary={getEquipmentSummary(entry.equipmentPassportId)} />
            ))}
          </div>
        ) : null}
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-xl font-bold text-ink">Demo Data</h2>
          <p className="mt-1 text-sm leading-6 text-ink/65">Mock maintenance records remain available for signed-out browsing and UI demos.</p>
        </div>
        <div className="space-y-4">
          {maintenanceEntries.map((entry) => (
            <MaintenanceCard key={entry.id} entry={entry} sourceLabel="Demo data" />
          ))}
        </div>
      </section>
    </div>
  );
}
