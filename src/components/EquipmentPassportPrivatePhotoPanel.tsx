"use client";

import { generateClient } from "aws-amplify/data";
import { useMemo, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { PrivateImageUploadCard } from "@/components/PrivateImageUploadCard";
import { configureAmplifyClient, getAuthErrorMessage } from "@/lib/amplifyClient";

export function EquipmentPassportPrivatePhotoPanel({
  passportId,
  storageKey,
  onPhotoUpdated
}: {
  passportId: string;
  storageKey?: string | null;
  onPhotoUpdated?: (storageKey: string) => void;
}) {
  const client = useMemo(() => {
    configureAmplifyClient();
    return generateClient<Schema>();
  }, []);
  const [currentStorageKey, setCurrentStorageKey] = useState(storageKey ?? "");
  const [error, setError] = useState("");

  async function handleUploaded(uploadedKey: string) {
    setError("");

    try {
      const result = await client.models.EquipmentPassport.update({
        id: passportId,
        privateCoverPhotoKey: uploadedKey
      });

      if (result.errors?.length) {
        throw new Error(result.errors.map((item) => item.message).join(" "));
      }

      setCurrentStorageKey(uploadedKey);
      onPhotoUpdated?.(uploadedKey);
    } catch (updateError) {
      setError(getAuthErrorMessage(updateError));
      throw updateError;
    }
  }

  return (
    <div className="space-y-3">
      <PrivateImageUploadCard
        title="Private Setup Photo"
        description="Upload one private equipment or setup photo for this saved Equipment Passport."
        folder="equipment"
        recordId={passportId}
        storageKey={currentStorageKey}
        uploadLabel={currentStorageKey ? "Replace private setup photo" : "Upload private setup photo"}
        onUploaded={handleUploaded}
      />
      {error ? <p className="rounded-md border border-clay/30 bg-clay/10 px-3 py-2 text-sm font-semibold text-clay">{error}</p> : null}
    </div>
  );
}
