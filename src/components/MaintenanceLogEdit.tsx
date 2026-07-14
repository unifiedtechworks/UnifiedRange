"use client";

import { generateClient } from "aws-amplify/data";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { MaintenanceLogForm, type MaintenanceLogFormValues } from "@/components/MaintenanceLogForm";
import { equipmentPassports } from "@/data/mockData";
import { getMaintenanceById } from "@/data/selectors";
import { useAuthUser } from "@/hooks/useAuthUser";
import { configureAmplifyClient, getAuthErrorMessage } from "@/lib/amplifyClient";
import {
  maintenancePassportOptions,
  toMaintenanceLogFormValues,
  toUpdateMaintenanceInput,
  type MaintenanceLogEntryRecord,
  type MaintenancePassportRecord
} from "@/lib/maintenanceLogData";

type EditState = "loading" | "saved" | "demo" | "missing";

export function MaintenanceLogEdit({ maintenanceId }: { maintenanceId?: string }) {
  const router = useRouter();
  const client = useMemo(() => {
    configureAmplifyClient();
    return generateClient<Schema>();
  }, []);
  const { authState } = useAuthUser();
  const [state, setState] = useState<EditState>("loading");
  const [record, setRecord] = useState<MaintenanceLogEntryRecord | null>(null);
  const [passports, setPassports] = useState<MaintenancePassportRecord[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const loadMaintenance = useCallback(async () => {
    setError("");
    setSuccess("");

    if (!maintenanceId) {
      setRecord(null);
      setPassports([]);
      setError("Missing record ID.");
      setState("missing");
      return;
    }

    const demoEntry = getMaintenanceById(maintenanceId);

    if (demoEntry) {
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
        const [maintenanceResult, passportResult] = await Promise.all([
          client.models.MaintenanceLogEntry.get({ id: maintenanceId }),
          client.models.EquipmentPassport.list({ filter: { ownerId: { eq: authState.username } } })
        ]);

        const errors = [...(maintenanceResult.errors ?? []), ...(passportResult.errors ?? [])];
        if (errors.length) {
          throw new Error(errors.map((item) => item.message).join(" "));
        }

        if (maintenanceResult.data) {
          setRecord(maintenanceResult.data);
          setPassports(passportResult.data);
          setState("saved");
          return;
        }
      } catch (loadError) {
        console.error("Unable to load saved Maintenance record for edit", loadError);
        setError("This saved record could not be loaded.");
      }
    }

    setRecord(null);
    setPassports([]);
    setState("missing");
  }, [authState, client, maintenanceId]);

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

  async function handleUpdate(values: MaintenanceLogFormValues) {
    if (!record) {
      return;
    }

    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const result = await client.models.MaintenanceLogEntry.update(toUpdateMaintenanceInput(record.id, values));

      if (result.errors?.length) {
        throw new Error(result.errors.map((item) => item.message).join(" "));
      }

      if (!result.data) {
        throw new Error("The Maintenance record was updated, but no record was returned.");
      }

      setRecord(result.data);
      setSuccess("Maintenance record updated.");
      router.refresh();
    } catch (updateError) {
      setError(getAuthErrorMessage(updateError));
    } finally {
      setIsSaving(false);
    }
  }

  if (state === "loading") {
    return <p className="rounded-md border border-ink/10 bg-white p-4 text-sm text-ink/65 shadow-soft">Loading Maintenance record...</p>;
  }

  if (state === "missing") {
    return (
      <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <h2 className="text-xl font-bold text-ink">Maintenance record not found</h2>
        <p className="mt-2 text-sm leading-6 text-ink/70">{error || "This saved Maintenance record is not available for the current signed-in account."}</p>
      </section>
    );
  }

  if (state === "saved" && record) {
    const noPassportMessage = passports.length === 0 ? "Create a saved Equipment Passport before editing account-backed Maintenance." : undefined;

    return (
      <MaintenanceLogForm
        key={record.id}
        mode="edit"
        initialValues={toMaintenanceLogFormValues(record)}
        cancelHref={`/maintenance/${record.id}`}
        passportOptions={maintenancePassportOptions(passports)}
        submitLabel="Save maintenance"
        successMessage={success || undefined}
        errorMessage={error || undefined}
        isSubmitting={isSaving}
        onSubmit={handleUpdate}
        noPassportMessage={noPassportMessage}
      />
    );
  }

  const demoEntry = getMaintenanceById(maintenanceId);

  if (!demoEntry) {
    return null;
  }

  return (
    <div className="space-y-4">
      <p className="rounded-md border border-ink/10 bg-white p-4 text-sm leading-6 text-ink/70 shadow-soft">
        You are editing demo data. Submit will validate and show a local demo success message; sign in and create saved records to persist maintenance logs.
      </p>
      <MaintenanceLogForm
        mode="edit"
        initialValues={toMaintenanceLogFormValues(demoEntry)}
        cancelHref={`/maintenance/${demoEntry.id}`}
        passportOptions={equipmentPassports.map((passport) => ({ id: passport.id, label: passport.nickname }))}
      />
    </div>
  );
}
