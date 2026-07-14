"use client";

import { generateClient } from "aws-amplify/data";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { HuntingReadinessForm, type HuntingReadinessFormValues } from "@/components/HuntingReadinessForm";
import { equipmentPassports } from "@/data/mockData";
import { getChecklistById } from "@/data/selectors";
import { useAuthUser } from "@/hooks/useAuthUser";
import { configureAmplifyClient, getAuthErrorMessage } from "@/lib/amplifyClient";
import {
  huntingPassportOptions,
  toHuntingReadinessFormValues,
  toUpdateHuntingChecklistInput,
  type HuntingChecklistRecord,
  type HuntingPassportRecord
} from "@/lib/huntingChecklistData";

type EditState = "loading" | "saved" | "demo" | "missing";

export function HuntingReadinessEdit({ checklistId }: { checklistId?: string }) {
  const router = useRouter();
  const client = useMemo(() => {
    configureAmplifyClient();
    return generateClient<Schema>();
  }, []);
  const { authState } = useAuthUser();
  const [state, setState] = useState<EditState>("loading");
  const [record, setRecord] = useState<HuntingChecklistRecord | null>(null);
  const [passports, setPassports] = useState<HuntingPassportRecord[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const loadChecklist = useCallback(async () => {
    setError("");
    setSuccess("");

    if (!checklistId) {
      setRecord(null);
      setPassports([]);
      setError("Missing record ID.");
      setState("missing");
      return;
    }

    const demoChecklist = getChecklistById(checklistId);

    if (demoChecklist) {
      setRecord(null);
      setPassports([]);
      setState("demo");
      return;
    }

    if (authState.status === "loading") {
      setState("loading");
      return;
    }

    if (authState.status === "signed-in") {
      try {
        const [checklistResult, passportResult] = await Promise.all([
          client.models.HuntingChecklist.get({ id: checklistId }),
          client.models.EquipmentPassport.list({ filter: { ownerId: { eq: authState.username } } })
        ]);

        const errors = [...(checklistResult.errors ?? []), ...(passportResult.errors ?? [])];
        if (errors.length) {
          throw new Error(errors.map((item) => item.message).join(" "));
        }

        if (checklistResult.data) {
          setRecord(checklistResult.data);
          setPassports(passportResult.data);
          setState("saved");
          return;
        }
      } catch (loadError) {
        console.error("Unable to load saved Hunting Readiness checklist for edit", loadError);
        setError("This saved record could not be loaded.");
      }
    }

    setRecord(null);
    setPassports([]);
    setState("missing");
  }, [authState, client, checklistId]);

  useEffect(() => {
    const loadInitialState = window.setTimeout(() => {
      void loadChecklist();
    }, 0);

    window.addEventListener("unifiedrange-auth-change", loadChecklist);

    return () => {
      window.clearTimeout(loadInitialState);
      window.removeEventListener("unifiedrange-auth-change", loadChecklist);
    };
  }, [loadChecklist]);

  async function handleUpdate(values: HuntingReadinessFormValues) {
    if (!record) {
      return;
    }

    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const result = await client.models.HuntingChecklist.update(toUpdateHuntingChecklistInput(record.id, values));

      if (result.errors?.length) {
        throw new Error(result.errors.map((item) => item.message).join(" "));
      }

      if (!result.data) {
        throw new Error("The Hunting Readiness checklist was updated, but no record was returned.");
      }

      setRecord(result.data);
      setSuccess("Hunting Readiness checklist updated.");
      router.refresh();
    } catch (updateError) {
      setError(getAuthErrorMessage(updateError));
    } finally {
      setIsSaving(false);
    }
  }

  if (state === "loading") {
    return <p className="rounded-md border border-ink/10 bg-white p-4 text-sm text-ink/65 shadow-soft">Loading Hunting Readiness checklist...</p>;
  }

  if (state === "missing") {
    return (
      <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <h2 className="text-xl font-bold text-ink">Hunting Readiness checklist not found</h2>
        <p className="mt-2 text-sm leading-6 text-ink/70">{error || "This saved Hunting Readiness checklist is not available for the current signed-in account."}</p>
      </section>
    );
  }

  if (state === "saved" && record) {
    const noPassportMessage = passports.length === 0 ? "Create a saved Equipment Passport before editing account-backed Hunting Readiness." : undefined;

    return (
      <HuntingReadinessForm
        key={record.id}
        mode="edit"
        initialValues={toHuntingReadinessFormValues(record)}
        cancelHref={`/readiness/${record.id}`}
        passportOptions={huntingPassportOptions(passports)}
        submitLabel="Save checklist"
        successMessage={success || undefined}
        errorMessage={error || undefined}
        isSubmitting={isSaving}
        onSubmit={handleUpdate}
        noPassportMessage={noPassportMessage}
      />
    );
  }

  const demoChecklist = getChecklistById(checklistId);

  if (!demoChecklist) {
    return null;
  }

  return (
    <div className="space-y-4">
      <p className="rounded-md border border-ink/10 bg-white p-4 text-sm leading-6 text-ink/70 shadow-soft">
        You are editing demo data. Submit will validate and show a local demo success message; sign in and create saved records to persist readiness checklists.
      </p>
      <HuntingReadinessForm
        mode="edit"
        initialValues={toHuntingReadinessFormValues(demoChecklist)}
        cancelHref={`/readiness/${demoChecklist.id}`}
        passportOptions={equipmentPassports.map((passport) => ({ id: passport.id, label: passport.nickname }))}
      />
    </div>
  );
}
