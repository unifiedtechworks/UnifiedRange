"use client";

import { generateClient } from "aws-amplify/data";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { useAuthUser } from "@/hooks/useAuthUser";
import { configureAmplifyClient } from "@/lib/amplifyClient";
import type { PrivateImageAssetSourceType } from "@/lib/privateImageAssetData";

type PrivateImageAssetRecord = Schema["PrivateImageAsset"]["type"];
type VerificationResult = NonNullable<Schema["verifyPrivateImageAsset"]["type"]>;

const failureMessages: Record<string, string> = {
  source_not_found: "The saved source record could not be found.",
  source_owner_mismatch: "The saved source owner could not be confirmed.",
  invalid_storage_key: "The private storage path does not match this source.",
  object_not_found: "The private image object could not be found.",
  unsupported_content_type: "The stored object is not a supported private image type.",
  file_too_large: "The stored object is larger than the private image limit.",
  metadata_mismatch: "The registered file details do not match the stored object.",
  unauthorized: "This registration cannot be bound to the active storage identity. Re-upload the private image and try again.",
  unknown_error: "Verification could not be completed. Try again later."
};

function statusCopy(status: string, failureCode?: string | null) {
  if (status === "verified") {
    return "Private source verified. Verification does not publish or copy the image.";
  }

  if (status === "verifying") {
    return "Server verification is in progress. The image remains private.";
  }

  if (status === "failed") {
    return failureMessages[failureCode ?? "unknown_error"] ?? failureMessages.unknown_error;
  }

  if (status === "rejected" || status === "removed") {
    return "This private source is not eligible for verification. The image remains private.";
  }

  return "Private source registered but not yet server-verified. The image remains private.";
}

export function PrivateImageVerificationStatus({
  sourceType,
  sourceRecordId,
  storageKey,
  candidateId
}: {
  sourceType: PrivateImageAssetSourceType;
  sourceRecordId: string;
  storageKey?: string | null;
  candidateId?: string;
}) {
  const client = useMemo(() => {
    configureAmplifyClient();
    return generateClient<Schema>();
  }, []);
  const { authState } = useAuthUser();
  const [candidate, setCandidate] = useState<PrivateImageAssetRecord | null>(null);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState("");

  const loadCandidate = useCallback(async () => {
    setError("");
    setVerificationResult(null);

    if (!storageKey || authState.status !== "signed-in") {
      setCandidate(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      if (candidateId) {
        const result = await client.models.PrivateImageAsset.get({ id: candidateId });

        if (result.errors?.length) {
          throw new Error(result.errors.map((item) => item.message).join(" "));
        }

        setCandidate(result.data ?? null);
        return;
      }

      const result = await client.models.PrivateImageAsset.list({
        filter: {
          ownerId: { eq: authState.ownerKey },
          sourceType: { eq: sourceType },
          sourceRecordId: { eq: sourceRecordId },
          storageKey: { eq: storageKey }
        }
      });

      if (result.errors?.length) {
        throw new Error(result.errors.map((item) => item.message).join(" "));
      }

      const newestCandidate = [...result.data].sort((left, right) => (right.createdAt ?? "").localeCompare(left.createdAt ?? ""))[0] ?? null;
      setCandidate(newestCandidate);
    } catch (loadError) {
      console.error("Unable to load private image verification state", loadError);
      setCandidate(null);
      setError("Private image verification status could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }, [authState, candidateId, client, sourceRecordId, sourceType, storageKey]);

  useEffect(() => {
    const loadInitialState = window.setTimeout(() => {
      void loadCandidate();
    }, 0);

    return () => {
      window.clearTimeout(loadInitialState);
    };
  }, [loadCandidate]);

  async function handleVerify() {
    if (!candidate || authState.status !== "signed-in") {
      return;
    }

    setError("");
    setIsVerifying(true);
    setVerificationResult({
      privateImageAssetId: candidate.id,
      bindingStatus: "verifying"
    });

    try {
      const result = await client.mutations.verifyPrivateImageAsset(
        { privateImageAssetId: candidate.id },
        { authMode: "iam" }
      );

      if (result.errors?.length || !result.data) {
        throw new Error(result.errors?.map((item) => item.message).join(" ") || "Verification returned no result.");
      }

      setVerificationResult(result.data);
    } catch (verificationError) {
      console.error("Unable to verify private image source", verificationError);
      setVerificationResult(null);
      setError("Private image verification could not be completed. The image remains private.");
    } finally {
      setIsVerifying(false);
    }
  }

  if (!storageKey || authState.status !== "signed-in") {
    return null;
  }

  const status = verificationResult?.bindingStatus ?? candidate?.bindingStatus ?? "unverified";
  const failureCode = verificationResult?.failureCode ?? candidate?.bindingFailureCode;
  const canVerify = Boolean(candidate) && (status === "unverified" || status === "failed");

  return (
    <section className="rounded-md border border-ink/10 bg-field px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/50">Private source verification</p>
          <p className="mt-1 text-sm leading-6 text-ink/70">
            {isLoading ? "Loading private verification status..." : candidate ? statusCopy(status, failureCode) : "No Phase 2A registration was found for this private image. Re-upload it to register a verifiable source."}
          </p>
        </div>

        {canVerify ? (
          <button
            type="button"
            disabled={isVerifying}
            onClick={() => void handleVerify()}
            className="inline-flex w-full shrink-0 justify-center rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {isVerifying ? "Verifying..." : "Verify private image"}
          </button>
        ) : null}
      </div>

      {error ? <p className="mt-3 text-sm font-semibold text-clay">{error}</p> : null}
    </section>
  );
}
