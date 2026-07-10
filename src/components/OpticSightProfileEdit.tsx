"use client";

import { generateClient } from "aws-amplify/data";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { OpticSightForm, type OpticSightFormValues } from "@/components/OpticSightForm";
import { getOpticById } from "@/data/selectors";
import { useAuthUser } from "@/hooks/useAuthUser";
import { configureAmplifyClient, getAuthErrorMessage } from "@/lib/amplifyClient";
import { toOpticSightFormValues, toUpdateOpticSightInput, type OpticSightProfileRecord } from "@/lib/opticSightProfileData";

type EditState = "loading" | "saved" | "demo" | "missing";

export function OpticSightProfileEdit({ opticId }: { opticId?: string }) {
  const router = useRouter();
  const client = useMemo(() => {
    configureAmplifyClient();
    return generateClient<Schema>();
  }, []);
  const { authState } = useAuthUser();
  const [state, setState] = useState<EditState>("loading");
  const [record, setRecord] = useState<OpticSightProfileRecord | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const loadOptic = useCallback(async () => {
    setError("");
    setSuccess("");

    if (!opticId) {
      setRecord(null);
      setError("Missing record ID.");
      setState("missing");
      return;
    }

    const demoOptic = getOpticById(opticId);

    if (demoOptic) {
      setRecord(null);
      setState("demo");
      return;
    }

    if (authState.status === "loading") {
      setState("loading");
      return;
    }

    if (authState.status === "signed-in") {
      try {
        const result = await client.models.OpticSightProfile.get({ id: opticId });

        if (result.errors?.length) {
          throw new Error(result.errors.map((item) => item.message).join(" "));
        }

        if (result.data) {
          setRecord(result.data);
          setState("saved");
          return;
        }
      } catch (loadError) {
        console.error("Unable to load saved Optic / Sight profile for edit", loadError);
        setError("This saved record could not be loaded.");
      }
    }

    setRecord(null);
    setState("missing");
  }, [authState.status, client, opticId]);

  useEffect(() => {
    const loadInitialState = window.setTimeout(() => {
      void loadOptic();
    }, 0);

    window.addEventListener("unifiedrange-auth-change", loadOptic);

    return () => {
      window.clearTimeout(loadInitialState);
      window.removeEventListener("unifiedrange-auth-change", loadOptic);
    };
  }, [loadOptic]);

  async function handleUpdate(values: OpticSightFormValues) {
    if (!record) {
      return;
    }

    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const result = await client.models.OpticSightProfile.update(toUpdateOpticSightInput(record.id, values));

      if (result.errors?.length) {
        throw new Error(result.errors.map((item) => item.message).join(" "));
      }

      if (!result.data) {
        throw new Error("The Optic / Sight profile was updated, but no record was returned.");
      }

      setRecord(result.data);
      setSuccess("Optic / Sight profile updated.");
      router.refresh();
    } catch (updateError) {
      setError(getAuthErrorMessage(updateError));
    } finally {
      setIsSaving(false);
    }
  }

  if (state === "loading") {
    return <p className="rounded-md border border-ink/10 bg-white p-4 text-sm text-ink/65 shadow-soft">Loading Optic / Sight profile...</p>;
  }

  if (state === "missing") {
    return (
      <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <h2 className="text-xl font-bold text-ink">Optic / Sight profile not found</h2>
        <p className="mt-2 text-sm leading-6 text-ink/70">{error || "This saved Optic / Sight profile is not available for the current signed-in account."}</p>
      </section>
    );
  }

  if (state === "saved" && record) {
    return (
      <OpticSightForm
        key={record.id}
        mode="edit"
        initialValues={toOpticSightFormValues(record)}
        cancelHref={`/optics/${record.id}`}
        submitLabel="Save account profile"
        successMessage={success || undefined}
        errorMessage={error || undefined}
        isSubmitting={isSaving}
        onSubmit={handleUpdate}
      />
    );
  }

  const demoOptic = getOpticById(opticId);

  if (!demoOptic) {
    return null;
  }

  return (
    <div className="space-y-4">
      <p className="rounded-md border border-ink/10 bg-white p-4 text-sm leading-6 text-ink/70 shadow-soft">
        You are editing demo data. Submit will validate and show a local demo success message; sign in and create a saved Optic / Sight profile to persist changes.
      </p>
      <OpticSightForm mode="edit" initialValues={toOpticSightFormValues(demoOptic)} cancelHref={`/optics/${demoOptic.id}`} />
    </div>
  );
}
