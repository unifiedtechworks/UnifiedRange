"use client";

import { generateClient } from "aws-amplify/data";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { PrivateImageUploadCard } from "@/components/PrivateImageUploadCard";
import { PrivateImageVerificationStatus } from "@/components/PrivateImageVerificationStatus";
import { useAuthUser } from "@/hooks/useAuthUser";
import { configureAmplifyClient, getAuthErrorMessage } from "@/lib/amplifyClient";
import { buildPrivateImageAssetRegistration, registerPrivateImageCandidate } from "@/lib/privateImageAssetData";
import type { PrivateImageUploadResult } from "@/lib/privateImageStorage";

type TargetPhotoRecord = Schema["TargetPhoto"]["type"];

export function RangeSessionPrivateTargetPhotoPanel({ sessionId }: { sessionId: string }) {
  const client = useMemo(() => {
    configureAmplifyClient();
    return generateClient<Schema>();
  }, []);
  const { authState } = useAuthUser();
  const [photo, setPhoto] = useState<TargetPhotoRecord | null>(null);
  const [candidateId, setCandidateId] = useState("");
  const [error, setError] = useState("");
  const [registrationNotice, setRegistrationNotice] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadPhoto = useCallback(async () => {
    setError("");

    if (authState.status === "loading") {
      setIsLoading(true);
      return;
    }

    if (authState.status !== "signed-in") {
      setPhoto(null);
      setIsLoading(false);
      return;
    }

    try {
      const result = await client.models.TargetPhoto.list({
        filter: {
          ownerId: { eq: authState.ownerKey },
          rangeSessionId: { eq: sessionId }
        }
      });

      if (result.errors?.length) {
        throw new Error(result.errors.map((item) => item.message).join(" "));
      }

      setPhoto(result.data[0] ?? null);
    } catch (loadError) {
      console.error("Unable to load private target photo", loadError);
      setError("This private target photo could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }, [authState, client, sessionId]);

  useEffect(() => {
    const loadInitialState = window.setTimeout(() => {
      void loadPhoto();
    }, 0);

    return () => {
      window.clearTimeout(loadInitialState);
    };
  }, [loadPhoto]);

  async function handleUploaded(upload: PrivateImageUploadResult) {
    setError("");
    setRegistrationNotice("");
    setCandidateId("");

    if (authState.status !== "signed-in") {
      throw new Error("Sign in before uploading private target photos.");
    }

    try {
      const source = await client.models.RangeSession.get({ id: sessionId });

      if (source.errors?.length) {
        throw new Error(source.errors.map((item) => item.message).join(" "));
      }

      if (!source.data) {
        throw new Error("This saved Range Session could not be verified.");
      }

      const registration = buildPrivateImageAssetRegistration({
        ownerId: authState.ownerKey,
        ownerSub: authState.userSub,
        ownerAliases: authState.ownerAliases,
        sourceOwnerId: source.data.ownerId,
        sourceType: "range_session_target",
        sourceRecordId: sessionId,
        upload
      });
      const result = photo
        ? await client.models.TargetPhoto.update({
            id: photo.id,
            storageKey: upload.storageKey,
            imageUrl: upload.storageKey,
            isPublic: false
          })
        : await client.models.TargetPhoto.create({
            ownerId: authState.ownerKey,
            rangeSessionId: sessionId,
            storageKey: upload.storageKey,
            imageUrl: upload.storageKey,
            caption: "Private target photo",
            isPublic: false
          });

      if (result.errors?.length) {
        throw new Error(result.errors.map((item) => item.message).join(" "));
      }

      if (!result.data || !authState.ownerAliases.includes(result.data.ownerId)) {
        throw new Error("The private target photo record owner could not be verified.");
      }

      setPhoto(result.data);

      try {
        const candidate = await registerPrivateImageCandidate(client, registration);
        setCandidateId(candidate.id);
        setRegistrationNotice("Private image source registered. Verify it below; verification does not publish it.");
      } catch (registrationError) {
        console.error("Unable to register private target image source", registrationError);
        setRegistrationNotice("The image is saved and private, but its source registration is pending. Public image publishing remains unavailable.");
      }
    } catch (uploadRecordError) {
      setError(getAuthErrorMessage(uploadRecordError));
      throw uploadRecordError;
    }
  }

  if (isLoading) {
    return <p className="rounded-md border border-ink/10 bg-white p-4 text-sm text-ink/65 shadow-soft">Loading private target photo...</p>;
  }

  return (
    <div className="space-y-3">
      <PrivateImageUploadCard
        title="Private Target Photo"
        description="Upload one private target photo for this saved Range Session. Manual group-size or score values stay in the session form."
        folder="targets"
        recordId={sessionId}
        storageKey={photo?.storageKey ?? photo?.imageUrl}
        uploadLabel={photo ? "Replace private target photo" : "Upload private target photo"}
        onUploaded={handleUploaded}
      />
      <PrivateImageVerificationStatus
        sourceType="range_session_target"
        sourceRecordId={sessionId}
        storageKey={photo?.storageKey ?? photo?.imageUrl}
        candidateId={candidateId || undefined}
      />
      {error ? <p className="rounded-md border border-clay/30 bg-clay/10 px-3 py-2 text-sm font-semibold text-clay">{error}</p> : null}
      {registrationNotice ? <p className="rounded-md border border-ink/10 bg-field px-3 py-2 text-sm text-ink/70">{registrationNotice}</p> : null}
    </div>
  );
}
