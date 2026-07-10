"use client";

import { generateClient } from "aws-amplify/data";
import { getCurrentUser } from "aws-amplify/auth";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Schema } from "../../amplify/data/resource";
import { RangeSessionForm, type RangeSessionFormValues } from "@/components/RangeSessionForm";
import { equipmentPassports, optics, projectiles } from "@/data/mockData";
import { useAuthUser } from "@/hooks/useAuthUser";
import { configureAmplifyClient, getAuthErrorMessage } from "@/lib/amplifyClient";
import { relationOptions, toCreateRangeSessionInput, type SavedSessionRelations } from "@/lib/rangeSessionData";

type CreateState = "loading" | "signed-out" | "ready";

const emptyRelations: SavedSessionRelations = {
  passports: [],
  projectiles: [],
  optics: []
};

export function RangeSessionCreate() {
  const router = useRouter();
  const client = useMemo(() => {
    configureAmplifyClient();
    return generateClient<Schema>();
  }, []);
  const { authState } = useAuthUser();
  const [state, setState] = useState<CreateState>("loading");
  const [relations, setRelations] = useState<SavedSessionRelations>(emptyRelations);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showListLink, setShowListLink] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadRelations = useCallback(async () => {
    setError("");

    if (authState.status === "loading") {
      setState("loading");
      return;
    }

    if (authState.status !== "signed-in") {
      setRelations(emptyRelations);
      setState("signed-out");
      return;
    }

    try {
      const [passportResult, projectileResult, opticResult] = await Promise.all([
        client.models.EquipmentPassport.list({ filter: { ownerId: { eq: authState.username } } }),
        client.models.ProjectileProfile.list({ filter: { ownerId: { eq: authState.username } } }),
        client.models.OpticSightProfile.list({ filter: { ownerId: { eq: authState.username } } })
      ]);

      const errors = [...(passportResult.errors ?? []), ...(projectileResult.errors ?? []), ...(opticResult.errors ?? [])];
      if (errors.length) {
        throw new Error(errors.map((item) => item.message).join(" "));
      }

      setRelations({
        passports: passportResult.data,
        projectiles: projectileResult.data,
        optics: opticResult.data
      });
      setState("ready");
    } catch (loadError) {
      setRelations(emptyRelations);
      setState("ready");
      setError(getAuthErrorMessage(loadError));
    }
  }, [authState, client]);

  useEffect(() => {
    const loadInitialState = window.setTimeout(() => {
      void loadRelations();
    }, 0);

    window.addEventListener("unifiedrange-auth-change", loadRelations);

    return () => {
      window.clearTimeout(loadInitialState);
      window.removeEventListener("unifiedrange-auth-change", loadRelations);
    };
  }, [loadRelations]);

  async function handleCreate(values: RangeSessionFormValues) {
    setError("");
    setSuccess("");
    setShowListLink(false);
    setIsSaving(true);

    try {
      configureAmplifyClient();
      const currentUser = await getCurrentUser();
      const result = await client.models.RangeSession.create(toCreateRangeSessionInput(values, currentUser.username));

      if (result.errors?.length) {
        throw new Error(result.errors.map((item) => item.message).join(" "));
      }

      if (!result.data) {
        throw new Error("The Range Session was saved, but no record was returned.");
      }

      if (!result.data.id) {
        setSuccess("Range Session saved to your account. Return to the list to open it.");
        setShowListLink(true);
        return;
      }

      setSuccess("Range Session saved to your account.");
      router.push(`/sessions/${result.data.id}`);
    } catch (createError) {
      setError(getAuthErrorMessage(createError));
    } finally {
      setIsSaving(false);
    }
  }

  if (state === "loading") {
    return <p className="rounded-md border border-ink/10 bg-white p-4 text-sm text-ink/65 shadow-soft">Loading saved records for session links...</p>;
  }

  if (state === "signed-out") {
    return (
      <div className="space-y-4">
        <p className="rounded-md border border-ink/10 bg-white p-4 text-sm leading-6 text-ink/70 shadow-soft">
          You are creating demo data. Submit will validate and show a local demo success message; sign in and use saved records to persist Range Sessions.
        </p>
        <RangeSessionForm
          mode="create"
          cancelHref="/sessions"
          passportOptions={equipmentPassports.map((item) => ({ id: item.id, label: item.nickname }))}
          projectileOptions={projectiles.map((item) => ({ id: item.id, label: `${item.manufacturer} ${item.productLine}` }))}
          opticOptions={optics.map((item) => ({ id: item.id, label: `${item.manufacturer} ${item.model}` }))}
        />
      </div>
    );
  }

  const options = relationOptions(relations);
  const noPassportMessage = relations.passports.length === 0 ? "Create a saved Equipment Passport before logging an account-backed Range Session." : undefined;

  return (
    <div className="space-y-4">
      <RangeSessionForm
        mode="create"
        cancelHref="/sessions"
        passportOptions={options.passportOptions}
        projectileOptions={options.projectileOptions}
        opticOptions={options.opticOptions}
        submitLabel="Create saved session"
        successMessage={success || undefined}
        errorMessage={error || undefined}
        isSubmitting={isSaving}
        onSubmit={handleCreate}
        noPassportMessage={noPassportMessage}
      />
      {showListLink ? (
        <Link href="/sessions" className="inline-flex rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink">
          Return to Range Sessions
        </Link>
      ) : null}
    </div>
  );
}
