"use client";

import { generateClient } from "aws-amplify/data";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { ProjectileForm, type ProjectileFormValues } from "@/components/ProjectileForm";
import { getProjectileById } from "@/data/selectors";
import { configureAmplifyClient, getAuthErrorMessage } from "@/lib/amplifyClient";
import { toProjectileFormValues, toUpdateProjectileInput, type ProjectileProfileRecord } from "@/lib/projectileProfileData";
import { useAuthUser } from "@/hooks/useAuthUser";

type EditState = "loading" | "saved" | "demo" | "missing";

export function ProjectileProfileEdit({ projectileId }: { projectileId: string }) {
  const router = useRouter();
  const client = useMemo(() => {
    configureAmplifyClient();
    return generateClient<Schema>();
  }, []);
  const { authState } = useAuthUser();
  const [state, setState] = useState<EditState>("loading");
  const [record, setRecord] = useState<ProjectileProfileRecord | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const loadProjectile = useCallback(async () => {
    setError("");
    setSuccess("");
    const demoProjectile = getProjectileById(projectileId);

    if (authState.status === "loading") {
      setState("loading");
      return;
    }

    if (authState.status === "signed-in") {
      try {
        const result = await client.models.ProjectileProfile.get({ id: projectileId });

        if (result.errors?.length) {
          throw new Error(result.errors.map((item) => item.message).join(" "));
        }

        if (result.data) {
          setRecord(result.data);
          setState("saved");
          return;
        }
      } catch (loadError) {
        if (!demoProjectile) {
          setError(getAuthErrorMessage(loadError));
        }
      }
    }

    if (demoProjectile) {
      setRecord(null);
      setState("demo");
    } else {
      setRecord(null);
      setState("missing");
    }
  }, [authState.status, client, projectileId]);

  useEffect(() => {
    const loadInitialState = window.setTimeout(() => {
      void loadProjectile();
    }, 0);

    window.addEventListener("unifiedrange-auth-change", loadProjectile);

    return () => {
      window.clearTimeout(loadInitialState);
      window.removeEventListener("unifiedrange-auth-change", loadProjectile);
    };
  }, [loadProjectile]);

  async function handleUpdate(values: ProjectileFormValues) {
    if (!record) {
      return;
    }

    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const result = await client.models.ProjectileProfile.update(toUpdateProjectileInput(record.id, values));

      if (result.errors?.length) {
        throw new Error(result.errors.map((item) => item.message).join(" "));
      }

      if (!result.data) {
        throw new Error("The projectile profile was updated, but no record was returned.");
      }

      setRecord(result.data);
      setSuccess("Projectile / Ammo profile updated.");
      router.refresh();
    } catch (updateError) {
      setError(getAuthErrorMessage(updateError));
    } finally {
      setIsSaving(false);
    }
  }

  if (state === "loading") {
    return <p className="rounded-md border border-ink/10 bg-white p-4 text-sm text-ink/65 shadow-soft">Loading Projectile / Ammo profile...</p>;
  }

  if (state === "missing") {
    return (
      <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <h2 className="text-xl font-bold text-ink">Projectile profile not found</h2>
        <p className="mt-2 text-sm leading-6 text-ink/70">{error || "This saved projectile profile is not available for the current signed-in account."}</p>
      </section>
    );
  }

  if (state === "saved" && record) {
    return (
      <ProjectileForm
        key={record.id}
        mode="edit"
        initialValues={toProjectileFormValues(record)}
        cancelHref={`/projectiles/${record.id}`}
        submitLabel="Save account profile"
        successMessage={success || undefined}
        errorMessage={error || undefined}
        isSubmitting={isSaving}
        onSubmit={handleUpdate}
      />
    );
  }

  const demoProjectile = getProjectileById(projectileId);

  if (!demoProjectile) {
    return null;
  }

  return (
    <div className="space-y-4">
      <p className="rounded-md border border-ink/10 bg-white p-4 text-sm leading-6 text-ink/70 shadow-soft">
        You are editing demo data. Submit will validate and show a local demo success message; sign in and create a saved Projectile / Ammo profile to persist changes.
      </p>
      <ProjectileForm mode="edit" initialValues={toProjectileFormValues(demoProjectile)} cancelHref={`/projectiles/${demoProjectile.id}`} />
    </div>
  );
}
