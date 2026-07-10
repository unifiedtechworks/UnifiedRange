"use client";

import { generateClient } from "aws-amplify/data";
import { getCurrentUser } from "aws-amplify/auth";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Schema } from "../../amplify/data/resource";
import { PassportForm, type PassportFormValues } from "@/components/PassportForm";
import { configureAmplifyClient, getAuthErrorMessage } from "@/lib/amplifyClient";
import { toCreatePassportInput } from "@/lib/equipmentPassportData";

export function EquipmentPassportCreate() {
  const router = useRouter();
  const client = useMemo(() => {
    configureAmplifyClient();
    return generateClient<Schema>();
  }, []);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showListLink, setShowListLink] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function handleCreate(values: PassportFormValues) {
    setError("");
    setSuccess("");
    setShowListLink(false);
    setIsSaving(true);

    try {
      configureAmplifyClient();
      const currentUser = await getCurrentUser();
      const result = await client.models.EquipmentPassport.create(toCreatePassportInput(values, currentUser.username));

      if (result.errors?.length) {
        throw new Error(result.errors.map((item) => item.message).join(" "));
      }

      if (!result.data) {
        throw new Error("The passport was saved, but no record was returned.");
      }

      if (!result.data.id) {
        setSuccess("Equipment Passport saved to your account. Return to the list to open it.");
        setShowListLink(true);
        return;
      }

      setSuccess("Equipment Passport saved to your account.");
      router.push(`/passports/${result.data.id}`);
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
          Signed-in users save this Equipment Passport to AppSync. If you are signed out, validation still works but the form cannot create an account record.
        </p>
      </section>
      <PassportForm
        mode="create"
        cancelHref="/passports"
        submitLabel="Create saved passport"
        successMessage={success || undefined}
        errorMessage={error || undefined}
        isSubmitting={isSaving}
        onSubmit={handleCreate}
      />
      {showListLink ? (
        <Link href="/passports" className="inline-flex rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink">
          Return to Equipment Passports
        </Link>
      ) : null}
    </div>
  );
}
