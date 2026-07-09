"use client";

import { generateClient } from "aws-amplify/data";
import { getCurrentUser } from "aws-amplify/auth";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { PassportCard } from "@/components/PassportCard";
import { equipmentPassports } from "@/data/mockData";
import { configureAmplifyClient, getAuthErrorMessage } from "@/lib/amplifyClient";
import { recordToEquipmentPassport, type EquipmentPassportRecord } from "@/lib/equipmentPassportData";

type PassportListState = "loading" | "signed-out" | "ready";

export function EquipmentPassportList() {
  const client = useMemo(() => {
    configureAmplifyClient();
    return generateClient<Schema>();
  }, []);
  const [state, setState] = useState<PassportListState>("loading");
  const [records, setRecords] = useState<EquipmentPassportRecord[]>([]);
  const [error, setError] = useState("");

  const loadPassports = useCallback(async () => {
    setError("");

    try {
      configureAmplifyClient();
      const currentUser = await getCurrentUser();
      const result = await client.models.EquipmentPassport.list({
        filter: {
          ownerId: {
            eq: currentUser.username
          }
        }
      });

      if (result.errors?.length) {
        throw new Error(result.errors.map((item) => item.message).join(" "));
      }

      setRecords(result.data);
      setState("ready");
    } catch (listError) {
      const message = getAuthErrorMessage(listError);
      setRecords([]);
      setState("signed-out");

      if (!message.toLowerCase().includes("auth") && !message.toLowerCase().includes("user")) {
        setError(message);
      }
    }
  }, [client]);

  useEffect(() => {
    const loadInitialState = window.setTimeout(() => {
      void loadPassports();
    }, 0);

    window.addEventListener("unifiedrange-auth-change", loadPassports);

    return () => {
      window.clearTimeout(loadInitialState);
      window.removeEventListener("unifiedrange-auth-change", loadPassports);
    };
  }, [loadPassports]);

  const savedPassports = records.map(recordToEquipmentPassport);

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-ink">Saved Account Data</h2>
            <p className="mt-1 text-sm leading-6 text-ink/65">Signed-in users see owner-scoped Equipment Passport records from AppSync here.</p>
          </div>
          <span className="w-fit rounded-md bg-field px-3 py-1 text-xs font-semibold text-ink">
            {state === "loading" ? "Loading" : state === "signed-out" ? "Sign in to save" : `${savedPassports.length} saved`}
          </span>
        </div>

        {state === "loading" ? <p className="rounded-md border border-ink/10 bg-white p-4 text-sm text-ink/65 shadow-soft">Loading saved passports...</p> : null}

        {error ? <p className="rounded-md border border-clay/30 bg-clay/10 p-4 text-sm font-semibold text-clay">{error}</p> : null}

        {state === "signed-out" ? (
          <div className="rounded-md border border-ink/10 bg-white p-4 shadow-soft">
            <p className="text-sm leading-6 text-ink/70">You are browsing demo passports. Sign in to save your own Equipment Passport records.</p>
            <Link href="/auth/sign-in" className="mt-3 inline-flex rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
              Sign in to save records
            </Link>
          </div>
        ) : null}

        {state === "ready" && savedPassports.length === 0 ? (
          <p className="rounded-md border border-ink/10 bg-white p-4 text-sm leading-6 text-ink/70 shadow-soft">No saved Equipment Passports yet. Use New passport to create your first account-backed record.</p>
        ) : null}

        {savedPassports.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {savedPassports.map((passport) => (
              <PassportCard key={passport.id} passport={passport} sourceLabel="Saved account data" />
            ))}
          </div>
        ) : null}
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-xl font-bold text-ink">Demo Data</h2>
          <p className="mt-1 text-sm leading-6 text-ink/65">Mock passports remain available for signed-out browsing and UI demos.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {equipmentPassports.map((passport) => (
            <PassportCard key={passport.id} passport={passport} sourceLabel="Demo data" />
          ))}
        </div>
      </section>
    </div>
  );
}
