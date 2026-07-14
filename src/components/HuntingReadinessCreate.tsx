"use client";

import { getCurrentUser } from "aws-amplify/auth";
import { generateClient } from "aws-amplify/data";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Schema } from "../../amplify/data/resource";
import { HuntingReadinessForm, type HuntingReadinessFormValues } from "@/components/HuntingReadinessForm";
import { equipmentPassports } from "@/data/mockData";
import { useAuthUser } from "@/hooks/useAuthUser";
import { configureAmplifyClient, getAuthErrorMessage } from "@/lib/amplifyClient";
import { huntingPassportOptions, toCreateHuntingChecklistInput, type HuntingPassportRecord } from "@/lib/huntingChecklistData";

type CreateState = "loading" | "signed-out" | "ready";

export function HuntingReadinessCreate() {
  const router = useRouter();
  const client = useMemo(() => {
    configureAmplifyClient();
    return generateClient<Schema>();
  }, []);
  const { authState } = useAuthUser();
  const [state, setState] = useState<CreateState>("loading");
  const [passports, setPassports] = useState<HuntingPassportRecord[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showListLink, setShowListLink] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadPassports = useCallback(async () => {
    setError("");

    if (authState.status === "loading") {
      setState("loading");
      return;
    }

    if (authState.status !== "signed-in") {
      setPassports([]);
      setState("signed-out");
      return;
    }

    try {
      const result = await client.models.EquipmentPassport.list({ filter: { ownerId: { eq: authState.username } } });

      if (result.errors?.length) {
        throw new Error(result.errors.map((item) => item.message).join(" "));
      }

      setPassports(result.data);
      setState("ready");
    } catch (loadError) {
      setPassports([]);
      setState("ready");
      setError(getAuthErrorMessage(loadError));
    }
  }, [authState, client]);

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

  async function handleCreate(values: HuntingReadinessFormValues) {
    setError("");
    setSuccess("");
    setShowListLink(false);
    setIsSaving(true);

    try {
      configureAmplifyClient();
      const currentUser = await getCurrentUser();
      const result = await client.models.HuntingChecklist.create(toCreateHuntingChecklistInput(values, currentUser.username));

      if (result.errors?.length) {
        throw new Error(result.errors.map((item) => item.message).join(" "));
      }

      if (!result.data) {
        throw new Error("The Hunting Readiness checklist was saved, but no record was returned.");
      }

      if (!result.data.id) {
        setSuccess("Hunting Readiness checklist saved to your account. Return to the list to open it.");
        setShowListLink(true);
        return;
      }

      setSuccess("Hunting Readiness checklist saved to your account.");
      router.push(`/readiness/${result.data.id}`);
    } catch (createError) {
      setError(getAuthErrorMessage(createError));
    } finally {
      setIsSaving(false);
    }
  }

  if (state === "loading") {
    return <p className="rounded-md border border-ink/10 bg-white p-4 text-sm text-ink/65 shadow-soft">Loading saved Equipment Passports...</p>;
  }

  if (state === "signed-out") {
    return (
      <div className="space-y-4">
        <p className="rounded-md border border-ink/10 bg-white p-4 text-sm leading-6 text-ink/70 shadow-soft">
          You are creating demo data. Submit will validate and show a local demo success message; sign in and use saved Equipment Passports to persist Hunting Readiness checklists.
        </p>
        <HuntingReadinessForm
          mode="create"
          cancelHref="/readiness"
          passportOptions={equipmentPassports.map((passport) => ({ id: passport.id, label: passport.nickname }))}
        />
      </div>
    );
  }

  const noPassportMessage = passports.length === 0 ? "Create a saved Equipment Passport before creating account-backed Hunting Readiness." : undefined;

  return (
    <div className="space-y-4">
      <HuntingReadinessForm
        mode="create"
        cancelHref="/readiness"
        passportOptions={huntingPassportOptions(passports)}
        submitLabel="Create saved checklist"
        successMessage={success || undefined}
        errorMessage={error || undefined}
        isSubmitting={isSaving}
        onSubmit={handleCreate}
        noPassportMessage={noPassportMessage}
      />
      {showListLink ? (
        <Link href="/readiness" className="inline-flex rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink">
          Return to Hunting Readiness
        </Link>
      ) : null}
    </div>
  );
}
