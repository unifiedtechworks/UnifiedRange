"use client";

import { generateClient } from "aws-amplify/data";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { RangeSessionPrivateTargetPhotoPanel } from "@/components/RangeSessionPrivateTargetPhotoPanel";
import { RangeSessionForm, type RangeSessionFormValues } from "@/components/RangeSessionForm";
import { equipmentPassports, optics, projectiles } from "@/data/mockData";
import { getOpticById, getPassportById, getSessionById, getTargetPhotosForSession } from "@/data/selectors";
import { useAuthUser } from "@/hooks/useAuthUser";
import { configureAmplifyClient, getAuthErrorMessage } from "@/lib/amplifyClient";
import {
  relationOptions,
  toRangeSessionFormValues,
  toUpdateRangeSessionInput,
  type RangeSessionRecord,
  type SavedSessionRelations
} from "@/lib/rangeSessionData";

type EditState = "loading" | "saved" | "demo" | "missing";

const emptyRelations: SavedSessionRelations = {
  passports: [],
  projectiles: [],
  optics: []
};

export function RangeSessionEdit({ sessionId }: { sessionId?: string }) {
  const router = useRouter();
  const client = useMemo(() => {
    configureAmplifyClient();
    return generateClient<Schema>();
  }, []);
  const { authState } = useAuthUser();
  const [state, setState] = useState<EditState>("loading");
  const [record, setRecord] = useState<RangeSessionRecord | null>(null);
  const [relations, setRelations] = useState<SavedSessionRelations>(emptyRelations);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const loadSession = useCallback(async () => {
    setError("");
    setSuccess("");

    if (!sessionId) {
      setRecord(null);
      setError("Missing record ID.");
      setState("missing");
      return;
    }

    const demoSession = getSessionById(sessionId);

    if (demoSession) {
      setRecord(null);
      setRelations(emptyRelations);
      setState("demo");
      return;
    }

    if (authState.status === "loading") {
      setState("loading");
      return;
    }

    if (authState.status === "signed-in") {
      try {
        const [sessionResult, passportResult, projectileResult, opticResult] = await Promise.all([
          client.models.RangeSession.get({ id: sessionId }),
          client.models.EquipmentPassport.list({ filter: { ownerId: { eq: authState.username } } }),
          client.models.ProjectileProfile.list({ filter: { ownerId: { eq: authState.username } } }),
          client.models.OpticSightProfile.list({ filter: { ownerId: { eq: authState.username } } })
        ]);

        const errors = [...(sessionResult.errors ?? []), ...(passportResult.errors ?? []), ...(projectileResult.errors ?? []), ...(opticResult.errors ?? [])];
        if (errors.length) {
          throw new Error(errors.map((item) => item.message).join(" "));
        }

        if (sessionResult.data) {
          setRecord(sessionResult.data);
          setRelations({
            passports: passportResult.data,
            projectiles: projectileResult.data,
            optics: opticResult.data
          });
          setState("saved");
          return;
        }
      } catch (loadError) {
        console.error("Unable to load saved Range Session for edit", loadError);
        setError("This saved record could not be loaded.");
      }
    }

    setRecord(null);
    setState("missing");
  }, [authState, client, sessionId]);

  useEffect(() => {
    const loadInitialState = window.setTimeout(() => {
      void loadSession();
    }, 0);

    window.addEventListener("unifiedrange-auth-change", loadSession);

    return () => {
      window.clearTimeout(loadInitialState);
      window.removeEventListener("unifiedrange-auth-change", loadSession);
    };
  }, [loadSession]);

  async function handleUpdate(values: RangeSessionFormValues) {
    if (!record) {
      return;
    }

    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const result = await client.models.RangeSession.update(toUpdateRangeSessionInput(record.id, values));

      if (result.errors?.length) {
        throw new Error(result.errors.map((item) => item.message).join(" "));
      }

      if (!result.data) {
        throw new Error("The Range Session was updated, but no record was returned.");
      }

      setRecord(result.data);
      setSuccess("Range Session updated.");
      router.refresh();
    } catch (updateError) {
      setError(getAuthErrorMessage(updateError));
    } finally {
      setIsSaving(false);
    }
  }

  if (state === "loading") {
    return <p className="rounded-md border border-ink/10 bg-white p-4 text-sm text-ink/65 shadow-soft">Loading Range Session...</p>;
  }

  if (state === "missing") {
    return (
      <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <h2 className="text-xl font-bold text-ink">Range Session not found</h2>
        <p className="mt-2 text-sm leading-6 text-ink/70">{error || "This saved Range Session is not available for the current signed-in account."}</p>
      </section>
    );
  }

  if (state === "saved" && record) {
    const options = relationOptions(relations);
    const noPassportMessage = relations.passports.length === 0 ? "Create a saved Equipment Passport before editing account-backed Range Sessions." : undefined;

    return (
      <div className="space-y-6">
        <RangeSessionForm
          key={record.id}
          mode="edit"
          initialValues={toRangeSessionFormValues(record)}
          cancelHref={`/sessions/${record.id}`}
          passportOptions={options.passportOptions}
          projectileOptions={options.projectileOptions}
          opticOptions={options.opticOptions}
          submitLabel="Save account session"
          successMessage={success || undefined}
          errorMessage={error || undefined}
          isSubmitting={isSaving}
          onSubmit={handleUpdate}
          noPassportMessage={noPassportMessage}
        />
        <RangeSessionPrivateTargetPhotoPanel sessionId={record.id} />
      </div>
    );
  }

  const demoSession = getSessionById(sessionId);

  if (!demoSession) {
    return null;
  }

  const passport = getPassportById(demoSession.equipmentPassportId);
  const optic = getOpticById(passport?.opticOrSightId);
  const targetPhoto = getTargetPhotosForSession(demoSession.id)[0];

  return (
    <div className="space-y-4">
      <p className="rounded-md border border-ink/10 bg-white p-4 text-sm leading-6 text-ink/70 shadow-soft">
        You are editing demo data. Submit will validate and show a local demo success message; sign in and create saved records to persist sessions.
      </p>
      <RangeSessionForm
        mode="edit"
        initialValues={{
          ...toRangeSessionFormValues(demoSession),
          opticSightId: optic?.id ?? "",
          targetPhotoNote: targetPhoto?.caption ?? "",
          targetManualEntry: targetPhoto?.manuallyEnteredGroupSize ?? targetPhoto?.manuallyEnteredScore ?? ""
        }}
        cancelHref={`/sessions/${demoSession.id}`}
        passportOptions={equipmentPassports.map((item) => ({ id: item.id, label: item.nickname }))}
        projectileOptions={projectiles.map((item) => ({ id: item.id, label: `${item.manufacturer} ${item.productLine}` }))}
        opticOptions={optics.map((item) => ({ id: item.id, label: `${item.manufacturer} ${item.model}` }))}
      />
    </div>
  );
}
