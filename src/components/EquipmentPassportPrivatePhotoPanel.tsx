"use client";

import { generateClient } from "aws-amplify/data";
import { useMemo, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { PrivateImageUploadCard } from "@/components/PrivateImageUploadCard";
import { PrivateImageVerificationStatus } from "@/components/PrivateImageVerificationStatus";
import { useAuthUser } from "@/hooks/useAuthUser";
import { configureAmplifyClient, getAuthErrorMessage } from "@/lib/amplifyClient";
import { buildPrivateImageAssetRegistration, registerPrivateImageCandidate } from "@/lib/privateImageAssetData";
import type { PrivateImageUploadResult } from "@/lib/privateImageStorage";

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
  const { authState } = useAuthUser();
  const [currentStorageKey, setCurrentStorageKey] = useState(storageKey ?? "");
  const [candidateId, setCandidateId] = useState("");
  const [error, setError] = useState("");
  const [registrationNotice, setRegistrationNotice] = useState("");

  async function handleUploaded(upload: PrivateImageUploadResult) {
    setError("");
    setRegistrationNotice("");

    if (authState.status !== "signed-in") {
      throw new Error("Sign in before uploading private equipment photos.");
    }

    try {
      const source = await client.models.EquipmentPassport.get({ id: passportId });

      if (source.errors?.length) {
        throw new Error(source.errors.map((item) => item.message).join(" "));
      }

      if (!source.data) {
        throw new Error("This saved Equipment Passport could not be verified.");
      }

      const registration = buildPrivateImageAssetRegistration({
        ownerId: authState.ownerKey,
        ownerSub: authState.userSub,
        ownerAliases: authState.ownerAliases,
        sourceOwnerId: source.data.ownerId,
        sourceType: "equipment_cover",
        sourceRecordId: passportId,
        upload
      });
      const result = await client.models.EquipmentPassport.update({
        id: passportId,
        privateCoverPhotoKey: upload.storageKey
      });

      if (result.errors?.length) {
        throw new Error(result.errors.map((item) => item.message).join(" "));
      }

      setCurrentStorageKey(upload.storageKey);
      onPhotoUpdated?.(upload.storageKey);

      try {
        const candidate = await registerPrivateImageCandidate(client, registration);
        setCandidateId(candidate.id);
        setRegistrationNotice("Private image source registered. Verify it below; verification does not publish it.");
      } catch (registrationError) {
        console.error("Unable to register private equipment image source", registrationError);
        setRegistrationNotice("The image is saved and private, but its source registration is pending. Public image publishing remains unavailable.");
      }
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
      <PrivateImageVerificationStatus
        sourceType="equipment_cover"
        sourceRecordId={passportId}
        storageKey={currentStorageKey}
        candidateId={candidateId || undefined}
      />
      {error ? <p className="rounded-md border border-clay/30 bg-clay/10 px-3 py-2 text-sm font-semibold text-clay">{error}</p> : null}
      {registrationNotice ? <p className="rounded-md border border-ink/10 bg-field px-3 py-2 text-sm text-ink/70">{registrationNotice}</p> : null}
    </div>
  );
}
