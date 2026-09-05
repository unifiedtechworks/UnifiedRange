"use client";

import { generateClient } from "aws-amplify/data";
import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { useAuthUser } from "@/hooks/useAuthUser";
import { configureAmplifyClient } from "@/lib/amplifyClient";
import {
  loadEligibleEquipmentCoverCandidate,
  type EligibleEquipmentCoverCandidate,
  type EquipmentCoverCandidateLookup
} from "@/lib/privateImageAssetData";
import { getPrivateImageUrl } from "@/lib/privateImageStorage";
import {
  getPublicImageProcessingFailureMessage,
  normalizePublicImageAltText,
  processPublicPassportImageSelection,
  publicImageAltTextMaxLength
} from "@/lib/publicPassportImageProcessingData";

const safetyChecks = [
  { id: "serial_numbers", label: "I checked that the image does not show serial numbers." },
  { id: "exact_locations", label: "I checked that the image does not show exact locations." },
  { id: "license_plates", label: "I checked that the image does not show license plates." },
  { id: "bystander_faces", label: "I checked that the image does not show faces of bystanders." },
  { id: "private_documents", label: "I checked that the image does not show private documents." },
  { id: "personal_information", label: "I checked that the image does not show sensitive personal information." },
  {
    id: "public_detail_rendering",
    label: "I understand this processed derivative may appear publicly on the saved Public Passport detail page."
  }
] as const;

type SafetyCheckId = (typeof safetyChecks)[number]["id"];
type CandidateState = "loading" | EquipmentCoverCandidateLookup["status"] | "error";
type PreviewState = "idle" | "loading" | "ready" | "error";
type ProcessingState = "idle" | "processing" | "ready" | "failed";

function emptySafetyConfirmations() {
  return Object.fromEntries(safetyChecks.map((item) => [item.id, false])) as Record<SafetyCheckId, boolean>;
}

export function PublicPassportImageConsentPanel({
  passportId,
  passportOwnerId,
  privateCoverPhotoKey,
  hasPreparedPublicImage = false,
  isSnapshotSaving = false,
  onPrepareSnapshot,
  onProcessed,
  onProcessingStateChange
}: {
  passportId: string;
  passportOwnerId: string;
  privateCoverPhotoKey?: string | null;
  hasPreparedPublicImage?: boolean;
  isSnapshotSaving?: boolean;
  onPrepareSnapshot: () => Promise<string | null>;
  onProcessed?: () => void;
  onProcessingStateChange?: (isProcessing: boolean) => void;
}) {
  const client = useMemo(() => {
    configureAmplifyClient();
    return generateClient<Schema>();
  }, []);
  const { authState } = useAuthUser();
  const choiceDescriptionId = useId();
  const altTextDescriptionId = useId();
  const [candidateState, setCandidateState] = useState<CandidateState>("loading");
  const [candidate, setCandidate] = useState<EligibleEquipmentCoverCandidate | null>(null);
  const [choice, setChoice] = useState<"without_image" | "verified_image">("without_image");
  const [privatePreviewUrl, setPrivatePreviewUrl] = useState("");
  const [previewState, setPreviewState] = useState<PreviewState>("idle");
  const [safetyConfirmations, setSafetyConfirmations] = useState(emptySafetyConfirmations);
  const [altText, setAltText] = useState("");
  const [altTextError, setAltTextError] = useState("");
  const [formError, setFormError] = useState("");
  const [processingState, setProcessingState] = useState<ProcessingState>("idle");
  const [processingMessage, setProcessingMessage] = useState("");
  const candidateRequestIdRef = useRef(0);
  const processingRequestIdRef = useRef(0);
  const processingRequestInFlightRef = useRef(false);
  const processingContextKey = authState.status === "signed-in"
    ? `${authState.userSub}:${authState.ownerKey}`
    : authState.status;

  const resetConsent = useCallback(() => {
    setSafetyConfirmations(emptySafetyConfirmations());
    setAltText("");
    setAltTextError("");
    setFormError("");
    setProcessingState("idle");
    setProcessingMessage("");
  }, []);

  const loadCandidate = useCallback(async () => {
    const requestId = candidateRequestIdRef.current + 1;
    candidateRequestIdRef.current = requestId;
    setCandidate(null);
    setCandidateState("loading");
    setChoice("without_image");
    resetConsent();

    if (authState.status === "loading") {
      return;
    }

    if (authState.status !== "signed-in") {
      setCandidateState("unavailable");
      return;
    }

    try {
      const lookup = await loadEligibleEquipmentCoverCandidate(client, {
        ownerId: authState.ownerKey,
        ownerSub: authState.userSub,
        ownerAliases: authState.ownerAliases,
        sourceOwnerId: passportOwnerId,
        sourceRecordId: passportId,
        currentStorageKey: privateCoverPhotoKey
      });

      if (candidateRequestIdRef.current !== requestId) {
        return;
      }

      setCandidateState(lookup.status);
      setCandidate(lookup.status === "available" ? lookup.candidate : null);
    } catch {
      if (candidateRequestIdRef.current !== requestId) {
        return;
      }

      setCandidateState("error");
      setCandidate(null);
    }
  }, [authState, client, passportId, passportOwnerId, privateCoverPhotoKey, resetConsent]);

  useEffect(() => {
    const loadInitialCandidate = window.setTimeout(() => {
      void loadCandidate();
    }, 0);

    return () => {
      window.clearTimeout(loadInitialCandidate);
      candidateRequestIdRef.current += 1;
    };
  }, [loadCandidate]);

  useEffect(() => {
    return () => {
      processingRequestIdRef.current += 1;
      processingRequestInFlightRef.current = false;
      onProcessingStateChange?.(false);
    };
  }, [onProcessingStateChange, passportId, passportOwnerId, privateCoverPhotoKey, processingContextKey]);

  useEffect(() => {
    let isCurrent = true;

    async function loadPrivatePreview() {
      setPrivatePreviewUrl("");

      if (choice !== "verified_image" || !candidate || !privateCoverPhotoKey) {
        setPreviewState("idle");
        return;
      }

      setPreviewState("loading");

      try {
        const url = await getPrivateImageUrl(privateCoverPhotoKey);

        if (isCurrent) {
          setPrivatePreviewUrl(url);
          setPreviewState(url ? "ready" : "error");
        }
      } catch {
        if (isCurrent) {
          setPreviewState("error");
        }
      }
    }

    void loadPrivatePreview();

    return () => {
      isCurrent = false;
    };
  }, [candidate, choice, privateCoverPhotoKey]);

  function updateChoice(nextChoice: "without_image" | "verified_image") {
    setChoice(nextChoice);
    resetConsent();
  }

  function updateSafetyConfirmation(id: SafetyCheckId, checked: boolean) {
    setSafetyConfirmations((current) => ({ ...current, [id]: checked }));
    setFormError("");
    setProcessingState("idle");
    setProcessingMessage("");
  }

  async function handleProcessImage() {
    if (processingRequestInFlightRef.current) {
      return;
    }

    setFormError("");
    setProcessingMessage("");

    if (hasPreparedPublicImage) {
      setFormError("A public-safe derivative is already prepared. Safe replacement is not available yet.");
      return;
    }

    if (authState.status !== "signed-in" || candidateState !== "available" || !candidate) {
      setFormError("No verified equipment image is available for public publishing yet.");
      return;
    }

    if (previewState !== "ready") {
      setFormError("The private source preview must load before you can confirm this image.");
      return;
    }

    if (!safetyChecks.every((item) => safetyConfirmations[item.id])) {
      setFormError("Confirm every image-safety item before preparing the public-safe derivative.");
      return;
    }

    const normalizedAltText = normalizePublicImageAltText(altText);
    setAltTextError(normalizedAltText.error);

    if (normalizedAltText.error) {
      return;
    }

    setAltText(normalizedAltText.value);
    processingRequestInFlightRef.current = true;
    const processingRequestId = processingRequestIdRef.current + 1;
    processingRequestIdRef.current = processingRequestId;
    setProcessingState("processing");
    onProcessingStateChange?.(true);

    try {
      const publicPassportSnapshotId = await onPrepareSnapshot();

      if (processingRequestIdRef.current !== processingRequestId) {
        return;
      }

      if (!publicPassportSnapshotId) {
        setProcessingState("failed");
        setProcessingMessage("The sanitized text/setup snapshot could not be saved, so the image was not processed.");
        return;
      }

      const result = await processPublicPassportImageSelection(client, {
        publicPassportSnapshotId,
        privateImageAssetId: candidate.id,
        altText: normalizedAltText.value
      });

      if (processingRequestIdRef.current !== processingRequestId) {
        return;
      }

      if (result.status === "ready") {
        setProcessingState("ready");
        setProcessingMessage("The public-safe derivative is prepared and can appear on the saved Public Passport detail while it remains eligible.");
        onProcessed?.();
        return;
      }

      const sourceChanged = ["candidate_not_verified", "source_not_found", "source_mismatch", "invalid_storage_key", "metadata_mismatch", "object_not_found"].includes(
        result.failureCode
      );
      setProcessingState("failed");
      setProcessingMessage(
        `Your text/setup snapshot is saved without a public image. ${getPublicImageProcessingFailureMessage(result.failureCode)}`
      );

      if (sourceChanged) {
        setCandidate(null);
        setCandidateState("source_changed");
        setChoice("without_image");
      }
    } catch {
      if (processingRequestIdRef.current === processingRequestId) {
        setProcessingState("failed");
        setProcessingMessage("The public-safe image could not be completed. Your private original was not changed. Try again later.");
      }
    } finally {
      if (processingRequestIdRef.current === processingRequestId) {
        processingRequestInFlightRef.current = false;
        onProcessingStateChange?.(false);
      }
    }
  }

  const allSafetyChecksConfirmed = safetyChecks.every((item) => safetyConfirmations[item.id]);
  const imageChoiceDisabled = hasPreparedPublicImage || candidateState !== "available" || !candidate;
  const isProcessing = processingState === "processing";

  return (
    <section className="mt-5 rounded-md border border-moss/20 bg-field/60 p-4 sm:p-5">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/50">Owner-only image consent</p>
        <h4 className="mt-1 text-lg font-bold text-ink">Optional public image</h4>
        <p id={choiceDescriptionId} className="mt-2 text-sm leading-6 text-ink/70">
          Images are optional. Your private original stays private. Selecting an image creates a separate processed derivative that may appear only on the saved Public Passport detail page.
        </p>
        {hasPreparedPublicImage ? (
          <p className="mt-3 rounded-md border border-moss/25 bg-white px-3 py-2 text-sm leading-6 text-ink/70">
            A public-safe derivative is already prepared and may appear on the saved Public Passport detail page while it remains eligible. Discover and public profile cards remain image-free. Use the owner-only Remove public image action to return this snapshot to text-only sharing, or use Unpublish to detach the image before removing the sanitized text/setup. Direct image replacement remains unavailable.
          </p>
        ) : null}
      </div>

      <fieldset aria-describedby={choiceDescriptionId} disabled={isProcessing || isSnapshotSaving} className="mt-4 space-y-3">
        <legend className="sr-only">Choose whether to prepare an equipment image</legend>
        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-ink/10 bg-white px-4 py-3">
          <input
            type="radio"
            name="public-image-choice"
            value="without_image"
            checked={choice === "without_image"}
            onChange={() => updateChoice("without_image")}
            className="mt-1 h-4 w-4 border-ink/20 text-moss"
          />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-ink">Publish without images</span>
            <span className="mt-1 block text-xs leading-5 text-ink/60">Default and safest. Normal sanitized text/setup publishing continues without processing a photo.</span>
          </span>
        </label>

        <label className={`flex items-start gap-3 rounded-md border border-ink/10 bg-white px-4 py-3 ${imageChoiceDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
          <input
            type="radio"
            name="public-image-choice"
            value="verified_image"
            checked={choice === "verified_image"}
            disabled={imageChoiceDisabled}
            onChange={() => updateChoice("verified_image")}
            className="mt-1 h-4 w-4 border-ink/20 text-moss"
          />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-ink">Select verified equipment image</span>
            <span className="mt-1 block text-xs leading-5 text-ink/60">Only the currently verified private Equipment Passport cover is eligible. Target photos are excluded.</span>
          </span>
        </label>
      </fieldset>

      <div className="mt-3 text-sm leading-6 text-ink/65" aria-live="polite">
        {candidateState === "loading" ? <p>Checking for a verified equipment image...</p> : null}
        {candidateState === "available" ? <p>{hasPreparedPublicImage ? "A verified equipment cover exists, but direct replacement is unavailable. Remove the current public image only if you want to return to text-only sharing." : "A verified equipment cover is available for optional processing."}</p> : null}
        {candidateState === "unavailable" ? <p>No verified equipment image is available for public publishing yet.</p> : null}
        {candidateState === "source_changed" ? <p>The private equipment cover changed or is no longer available. Re-upload or verify the current cover before processing.</p> : null}
        {candidateState === "error" ? <p>The verified equipment image status could not be checked. You can still publish without images.</p> : null}
      </div>

      {candidateState !== "available" ? (
        <Link href={`/passports/${passportId}`} className="mt-3 inline-flex text-sm font-semibold text-moss underline underline-offset-4">
          Review private equipment image
        </Link>
      ) : null}

      {choice === "verified_image" && candidate ? (
        <div className="mt-5 space-y-5 border-t border-ink/10 pt-5">
          <div>
            <h5 className="text-sm font-bold text-ink">Private source preview</h5>
            <p className="mt-1 text-xs leading-5 text-ink/60">Owner-only preview for your safety review. This signed private source is not the public derivative.</p>
            <div className="mt-3 flex aspect-[4/3] min-h-48 items-center justify-center overflow-hidden rounded-md border border-dashed border-ink/20 bg-paper sm:max-w-lg">
              {previewState === "loading" ? <span className="px-4 text-center text-sm text-ink/60">Loading private source preview...</span> : null}
              {previewState === "ready" && privatePreviewUrl ? (
                <div
                  role="img"
                  aria-label="Private equipment cover selected for image-safety review"
                  className="h-full w-full bg-contain bg-center bg-no-repeat"
                  style={{ backgroundImage: `url(${privatePreviewUrl})` }}
                />
              ) : null}
              {previewState === "error" ? <span className="px-4 text-center text-sm font-semibold text-clay">This private source preview could not be loaded. Processing is disabled.</span> : null}
            </div>
          </div>

          <fieldset className="rounded-md border border-clay/20 bg-white p-4">
            <legend className="px-1 text-sm font-bold text-ink">Image-safety checklist</legend>
            <p className="mb-3 text-xs leading-5 text-ink/60">Metadata stripping cannot remove sensitive details visible in the pixels. Public images may be copied or shared by visitors.</p>
            <div className="space-y-3">
              {safetyChecks.map((item) => (
                <label key={item.id} className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-ink/75">
                  <input
                    type="checkbox"
                    checked={safetyConfirmations[item.id]}
                    disabled={hasPreparedPublicImage || isProcessing || isSnapshotSaving}
                    onChange={(event) => updateSafetyConfirmation(item.id, event.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0 rounded border-ink/20 text-moss"
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="block">
            <span className="block text-sm font-semibold text-ink">Public image alt text</span>
            <textarea
              value={altText}
              rows={3}
              disabled={hasPreparedPublicImage || isProcessing || isSnapshotSaving}
              aria-describedby={altTextDescriptionId}
              aria-invalid={Boolean(altTextError)}
              onChange={(event) => {
                const nextAltText = event.target.value;
                setAltText(nextAltText);
                setAltTextError(nextAltText.length > publicImageAltTextMaxLength ? `Keep alt text to ${publicImageAltTextMaxLength} characters or fewer.` : "");
                setFormError("");
                setProcessingState("idle");
                setProcessingMessage("");
              }}
              className={`mt-2 min-h-24 w-full rounded-md border px-3 py-2 text-sm leading-6 text-ink outline-none focus:border-moss ${altTextError ? "border-clay" : "border-ink/15"}`}
            />
            <span id={altTextDescriptionId} className="mt-1 flex flex-col gap-1 text-xs leading-5 text-ink/55 sm:flex-row sm:justify-between">
              <span>Required. Describe the visible setup without links, storage paths, or sensitive details.</span>
              <span>{altText.length}/{publicImageAltTextMaxLength}</span>
            </span>
            {altTextError ? <span className="mt-1 block text-xs font-semibold text-clay">{altTextError}</span> : null}
          </label>

          <div>
            <button
              type="button"
              disabled={hasPreparedPublicImage || isProcessing || isSnapshotSaving || previewState !== "ready" || !allSafetyChecksConfirmed}
              onClick={() => void handleProcessImage()}
              className="inline-flex w-full justify-center rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {isProcessing || isSnapshotSaving ? "Preparing public-safe image..." : "Save snapshot and prepare image"}
            </button>
            <p className="mt-2 text-xs leading-5 text-ink/55">This explicit action saves the sanitized text/setup snapshot first, then calls the processor. Ordinary text publishing never processes an image.</p>
          </div>
        </div>
      ) : null}

      {formError ? <p className="mt-4 rounded-md border border-clay/30 bg-clay/10 px-4 py-3 text-sm font-semibold text-clay" role="alert">{formError}</p> : null}
      {processingMessage ? (
        <p
          className={`mt-4 rounded-md border px-4 py-3 text-sm font-semibold ${processingState === "ready" ? "border-moss/30 bg-white text-moss" : "border-clay/30 bg-clay/10 text-clay"}`}
          role={processingState === "failed" ? "alert" : "status"}
          aria-live="polite"
        >
          {processingMessage}
        </p>
      ) : null}

      <div className="mt-4 rounded-md border border-ink/10 bg-white px-4 py-3 text-xs leading-5 text-ink/60">
        <p className="font-semibold text-ink/70">Public image rendering is limited to saved Public Passport detail pages.</p>
        <p className="mt-1">Discover and public profile cards remain image-free. The private original remains private, and no target photo is eligible.</p>
      </div>
    </section>
  );
}
