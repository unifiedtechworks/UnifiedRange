"use client";

import { generateClient } from "aws-amplify/data";
import { getCurrentUser } from "aws-amplify/auth";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { ProjectileForm, type ProjectileFormValues } from "@/components/ProjectileForm";
import { configureAmplifyClient, getAuthErrorMessage } from "@/lib/amplifyClient";
import { toCreateProjectileInput } from "@/lib/projectileProfileData";

export function ProjectileProfileCreate() {
  const router = useRouter();
  const client = useMemo(() => {
    configureAmplifyClient();
    return generateClient<Schema>();
  }, []);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleCreate(values: ProjectileFormValues) {
    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      configureAmplifyClient();
      const currentUser = await getCurrentUser();
      const result = await client.models.ProjectileProfile.create(toCreateProjectileInput(values, currentUser.username));

      if (result.errors?.length) {
        throw new Error(result.errors.map((item) => item.message).join(" "));
      }

      if (!result.data) {
        throw new Error("The projectile profile was saved, but no record was returned.");
      }

      setSuccess("Projectile / Ammo profile saved to your account.");
      router.push(`/projectiles/${result.data.id}`);
    } catch (createError) {
      setError(getAuthErrorMessage(createError));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-moss/20 bg-field p-4">
        <h2 className="text-base font-bold text-ink">Account-backed save</h2>
        <p className="mt-2 text-sm leading-6 text-ink/70">
          Signed-in users save this Projectile / Ammo profile to AppSync. Lot numbers, purchase counts, and remaining inventory are private account data.
        </p>
      </section>
      <ProjectileForm
        mode="create"
        cancelHref="/projectiles"
        submitLabel="Create saved profile"
        successMessage={success || undefined}
        errorMessage={error || undefined}
        isSubmitting={isSaving}
        onSubmit={handleCreate}
      />
    </div>
  );
}
