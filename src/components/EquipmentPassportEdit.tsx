"use client";

import { generateClient } from "aws-amplify/data";
import { getCurrentUser } from "aws-amplify/auth";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { EquipmentPassportPrivatePhotoPanel } from "@/components/EquipmentPassportPrivatePhotoPanel";
import { PassportForm, type PassportFormValues } from "@/components/PassportForm";
import { getOpticById, getPassportById, getProjectileById } from "@/data/selectors";
import { configureAmplifyClient, getAuthErrorMessage } from "@/lib/amplifyClient";
import { toPassportFormValues, toUpdatePassportInput, type EquipmentPassportRecord } from "@/lib/equipmentPassportData";

type EditState = "loading" | "saved" | "demo" | "missing";

export function EquipmentPassportEdit({ passportId }: { passportId?: string }) {
  const router = useRouter();
  const client = useMemo(() => {
    configureAmplifyClient();
    return generateClient<Schema>();
  }, []);
  const [state, setState] = useState<EditState>("loading");
  const [record, setRecord] = useState<EquipmentPassportRecord | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const loadPassport = useCallback(async () => {
    setError("");
    setSuccess("");

    if (!passportId) {
      setRecord(null);
      setError("Missing record ID.");
      setState("missing");
      return;
    }

    const demoPassport = getPassportById(passportId);

    if (demoPassport) {
      setRecord(null);
      setState("demo");
      return;
    }

    try {
      configureAmplifyClient();
      await getCurrentUser();
      const result = await client.models.EquipmentPassport.get({ id: passportId });

      if (result.errors?.length) {
        throw new Error(result.errors.map((item) => item.message).join(" "));
      }

      if (result.data) {
        setRecord(result.data);
        setState("saved");
        return;
      }
    } catch (loadError) {
      const message = getAuthErrorMessage(loadError);

      if (!message.toLowerCase().includes("auth") && !message.toLowerCase().includes("user")) {
        console.error("Unable to load saved Equipment Passport for edit", loadError);
        setError("This saved record could not be loaded.");
      }
    }

    setRecord(null);
    setState("missing");
  }, [client, passportId]);

  useEffect(() => {
    const loadInitialState = window.setTimeout(() => {
      void loadPassport();
    }, 0);

    window.addEventListener("unifiedrange-auth-change", loadPassport);

    return () => {
      window.clearTimeout(loadInitialState);
      window.removeEventListener("unifiedrange-auth-change", loadPassport);
    };
  }, [loadPassport]);

  async function handleUpdate(values: PassportFormValues) {
    if (!record) {
      return;
    }

    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const result = await client.models.EquipmentPassport.update(toUpdatePassportInput(record.id, values));

      if (result.errors?.length) {
        throw new Error(result.errors.map((item) => item.message).join(" "));
      }

      if (!result.data) {
        throw new Error("The passport was updated, but no record was returned.");
      }

      setRecord(result.data);
      setSuccess("Equipment Passport updated.");
      router.refresh();
    } catch (updateError) {
      setError(getAuthErrorMessage(updateError));
    } finally {
      setIsSaving(false);
    }
  }

  if (state === "loading") {
    return <p className="rounded-md border border-ink/10 bg-white p-4 text-sm text-ink/65 shadow-soft">Loading Equipment Passport...</p>;
  }

  if (state === "missing") {
    return (
      <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <h2 className="text-xl font-bold text-ink">Passport not found</h2>
        <p className="mt-2 text-sm leading-6 text-ink/70">{error || "This saved passport is not available for the current signed-in account."}</p>
      </section>
    );
  }

  if (state === "saved" && record) {
    return (
      <div className="space-y-6">
        <PassportForm
          key={record.id}
          mode="edit"
          initialValues={toPassportFormValues(record)}
          cancelHref={`/passports/${record.id}`}
          submitLabel="Save account passport"
          successMessage={success || undefined}
          errorMessage={error || undefined}
          isSubmitting={isSaving}
          onSubmit={handleUpdate}
        />
        <EquipmentPassportPrivatePhotoPanel
          passportId={record.id}
          storageKey={record.privateCoverPhotoKey}
          onPhotoUpdated={(storageKey) => setRecord({ ...record, privateCoverPhotoKey: storageKey })}
        />
      </div>
    );
  }

  const demoPassport = getPassportById(passportId);

  if (!demoPassport) {
    return null;
  }

  const optic = getOpticById(demoPassport.opticOrSightId);
  const projectile = getProjectileById(demoPassport.preferredProjectileId);

  return (
    <div className="space-y-4">
      <p className="rounded-md border border-ink/10 bg-white p-4 text-sm leading-6 text-ink/70 shadow-soft">
        You are editing demo data. Submit will validate and show a local demo success message; sign in and create a saved passport to persist changes.
      </p>
      <PassportForm
        mode="edit"
        initialValues={{
          ...toPassportFormValues(demoPassport),
          opticSightSummary: optic ? `${optic.manufacturer} ${optic.model}` : "",
          projectileAmmoSummary: projectile ? `${projectile.manufacturer} ${projectile.productLine}` : ""
        }}
        cancelHref={`/passports/${demoPassport.id}`}
      />
    </div>
  );
}
