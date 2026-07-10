"use client";

import { generateClient } from "aws-amplify/data";
import { getCurrentUser } from "aws-amplify/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { OpticSightForm, type OpticSightFormValues } from "@/components/OpticSightForm";
import { configureAmplifyClient, getAuthErrorMessage } from "@/lib/amplifyClient";
import { toCreateOpticSightInput } from "@/lib/opticSightProfileData";

export function OpticSightProfileCreate() {
  const router = useRouter();
  const client = useMemo(() => {
    configureAmplifyClient();
    return generateClient<Schema>();
  }, []);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showListLink, setShowListLink] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function handleCreate(values: OpticSightFormValues) {
    setError("");
    setSuccess("");
    setShowListLink(false);
    setIsSaving(true);

    try {
      configureAmplifyClient();
      const currentUser = await getCurrentUser();
      const result = await client.models.OpticSightProfile.create(toCreateOpticSightInput(values, currentUser.username));

      if (result.errors?.length) {
        throw new Error(result.errors.map((item) => item.message).join(" "));
      }

      if (!result.data) {
        throw new Error("The Optic / Sight profile was saved, but no record was returned.");
      }

      if (!result.data.id) {
        setSuccess("Optic / Sight profile saved to your account. Return to the list to open it.");
        setShowListLink(true);
        return;
      }

      setSuccess("Optic / Sight profile saved to your account.");
      router.push(`/optics/${result.data.id}`);
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
          Signed-in users save this Optic / Sight profile to AppSync. These details are recordkeeping only and do not provide sight-change recommendations.
        </p>
      </section>
      <OpticSightForm
        mode="create"
        cancelHref="/optics"
        submitLabel="Create saved profile"
        successMessage={success || undefined}
        errorMessage={error || undefined}
        isSubmitting={isSaving}
        onSubmit={handleCreate}
      />
      {showListLink ? (
        <Link href="/optics" className="inline-flex rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink">
          Return to Optics / Sights
        </Link>
      ) : null}
    </div>
  );
}
