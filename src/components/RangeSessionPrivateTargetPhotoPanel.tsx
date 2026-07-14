"use client";

import { generateClient } from "aws-amplify/data";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { PrivateImageUploadCard } from "@/components/PrivateImageUploadCard";
import { useAuthUser } from "@/hooks/useAuthUser";
import { configureAmplifyClient, getAuthErrorMessage } from "@/lib/amplifyClient";

type TargetPhotoRecord = Schema["TargetPhoto"]["type"];

export function RangeSessionPrivateTargetPhotoPanel({ sessionId }: { sessionId: string }) {
  const client = useMemo(() => {
    configureAmplifyClient();
    return generateClient<Schema>();
  }, []);
  const { authState } = useAuthUser();
  const [photo, setPhoto] = useState<TargetPhotoRecord | null>(null);
  const [error, setError] = useState("");
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
          ownerId: { eq: authState.username },
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

  async function handleUploaded(uploadedKey: string) {
    setError("");

    if (authState.status !== "signed-in") {
      throw new Error("Sign in before uploading private target photos.");
    }

    try {
      const result = photo
        ? await client.models.TargetPhoto.update({
            id: photo.id,
            storageKey: uploadedKey,
            imageUrl: uploadedKey,
            isPublic: false
          })
        : await client.models.TargetPhoto.create({
            ownerId: authState.username,
            rangeSessionId: sessionId,
            storageKey: uploadedKey,
            imageUrl: uploadedKey,
            caption: "Private target photo",
            isPublic: false
          });

      if (result.errors?.length) {
        throw new Error(result.errors.map((item) => item.message).join(" "));
      }

      if (result.data) {
        setPhoto(result.data);
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
      {error ? <p className="rounded-md border border-clay/30 bg-clay/10 px-3 py-2 text-sm font-semibold text-clay">{error}</p> : null}
    </div>
  );
}
