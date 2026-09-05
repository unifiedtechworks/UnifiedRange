"use client";

import { generateClient } from "aws-amplify/data";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { DetailRow } from "@/components/DetailRow";
import { PageHeader } from "@/components/PageHeader";
import { PublicPassportImageConsentPanel } from "@/components/PublicPassportImageConsentPanel";
import { PublicPhotoPlaceholderList, PublicRangeSessionList } from "@/components/PublicPassportSections";
import { PublicPreviewActions } from "@/components/PublicPreviewActions";
import { Tag } from "@/components/Tag";
import { rangeSessions, targetPhotos } from "@/data/mockData";
import { getOpticById, getPassportById, getProjectileById } from "@/data/selectors";
import { useAuthUser } from "@/hooks/useAuthUser";
import { configureAmplifyClient } from "@/lib/amplifyClient";
import { recordToEquipmentPassport, type EquipmentPassportRecord } from "@/lib/equipmentPassportData";
import {
  getPublicImageCleanupFailureMessage,
  removePublicPassportImage
} from "@/lib/publicPassportImageCleanupData";
import {
  buildPublicPassportSnapshotInput,
  recordToSanitizedPublicPassport,
  type PublicPassportSnapshotRecord
} from "@/lib/publicPassportSnapshotData";
import { sanitizePublicPassport } from "@/lib/sanitizePublicPassport";
import type { EquipmentPassport, SanitizedPublicPassport } from "@/types";

type PreviewState = "loading" | "saved" | "demo" | "missing";
type UnpublishState = "idle" | "removing_image" | "unpublishing_text";
const cleanupPendingSessionPrefix = "unifiedrange:public-image-cleanup-pending:";

function hasPendingCleanupMarker(publicPassportSnapshotId: string) {
  try {
    return window.sessionStorage.getItem(`${cleanupPendingSessionPrefix}${publicPassportSnapshotId}`) === "1";
  } catch {
    return false;
  }
}

function setPendingCleanupMarker(publicPassportSnapshotId: string, isPending: boolean) {
  try {
    const storageKey = `${cleanupPendingSessionPrefix}${publicPassportSnapshotId}`;

    if (isPending) {
      window.sessionStorage.setItem(storageKey, "1");
    } else {
      window.sessionStorage.removeItem(storageKey);
    }
  } catch {
    // Cleanup remains safe and retryable through the backend even when browser storage is unavailable.
  }
}

export function PublicPassportPreview({ passportId }: { passportId?: string }) {
  const client = useMemo(() => {
    configureAmplifyClient();
    return generateClient<Schema>();
  }, []);
  const { authState } = useAuthUser();
  const [state, setState] = useState<PreviewState>("loading");
  const [record, setRecord] = useState<EquipmentPassportRecord | null>(null);
  const [snapshot, setSnapshot] = useState<PublicPassportSnapshotRecord | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [isProcessingPublicImage, setIsProcessingPublicImage] = useState(false);
  const [isRemovingPublicImage, setIsRemovingPublicImage] = useState(false);
  const [unpublishState, setUnpublishState] = useState<UnpublishState>("idle");
  const [hasPreparedPublicImage, setHasPreparedPublicImage] = useState(false);
  const [isPublicImageCleanupPending, setIsPublicImageCleanupPending] = useState(false);
  const previewRequestIdRef = useRef(0);
  const cleanupRequestIdRef = useRef(0);
  const unpublishRequestIdRef = useRef(0);
  const snapshotMutationInFlightRef = useRef(false);
  const publicImageProcessingInFlightRef = useRef(false);
  const cleanupContextKey = authState.status === "signed-in"
    ? `${passportId ?? ""}:${authState.userSub}:${authState.ownerKey}`
    : `${passportId ?? ""}:${authState.status}`;

  const handleImageProcessingStateChange = useCallback((isProcessing: boolean) => {
    publicImageProcessingInFlightRef.current = isProcessing;
    setIsProcessingPublicImage(isProcessing);
  }, []);

  const loadPreview = useCallback(async () => {
    const requestId = previewRequestIdRef.current + 1;
    previewRequestIdRef.current = requestId;
    setError("");
    setMessage("");
    setIsPublicImageCleanupPending(false);

    if (!passportId) {
      setRecord(null);
      setSnapshot(null);
      setHasPreparedPublicImage(false);
      setError("Missing record ID.");
      setState("missing");
      return null;
    }

    const demoPassport = getPassportById(passportId);

    if (demoPassport) {
      setRecord(null);
      setSnapshot(null);
      setHasPreparedPublicImage(false);
      setState("demo");
      return null;
    }

    if (authState.status === "loading") {
      setState("loading");
      return null;
    }

    if (authState.status !== "signed-in") {
      setRecord(null);
      setSnapshot(null);
      setHasPreparedPublicImage(false);
      setError("Sign in to preview and publish saved Equipment Passports.");
      setState("missing");
      return null;
    }

    try {
      const [passportResult, snapshotResult] = await Promise.all([
        client.models.EquipmentPassport.get({ id: passportId }),
        client.models.PublicPassportSnapshot.list({
          filter: {
            ownerId: { eq: authState.username },
            equipmentPassportId: { eq: passportId }
          }
        })
      ]);

      if (previewRequestIdRef.current !== requestId) {
        return null;
      }

      const errors = [...(passportResult.errors ?? []), ...(snapshotResult.errors ?? [])];
      if (errors.length) {
        throw new Error(errors.map((item) => item.message).join(" "));
      }

      if (passportResult.data) {
        setRecord(passportResult.data);
        const loadedSnapshot = snapshotResult.data[0] ?? null;
        const loadedSnapshotHasImage = Boolean(loadedSnapshot?.publicImageAssetId || loadedSnapshot?.publicImageKey);
        setSnapshot(loadedSnapshot);
        setHasPreparedPublicImage(loadedSnapshotHasImage);
        setIsPublicImageCleanupPending(Boolean(loadedSnapshot && !loadedSnapshotHasImage && hasPendingCleanupMarker(loadedSnapshot.id)));
        setState("saved");
        return loadedSnapshot;
      }
    } catch (loadError) {
      if (previewRequestIdRef.current !== requestId) {
        return null;
      }

      console.error("Unable to load public preview", loadError);
      setError("This saved passport could not be loaded for public preview.");
    }

    if (previewRequestIdRef.current !== requestId) {
      return null;
    }

    setRecord(null);
    setSnapshot(null);
    setHasPreparedPublicImage(false);
    setState("missing");
    return null;
  }, [authState, client, passportId]);

  useEffect(() => {
    const loadInitialState = window.setTimeout(() => {
      void loadPreview();
    }, 0);

    window.addEventListener("unifiedrange-auth-change", loadPreview);

    return () => {
      window.clearTimeout(loadInitialState);
      window.removeEventListener("unifiedrange-auth-change", loadPreview);
      previewRequestIdRef.current += 1;
    };
  }, [loadPreview]);

  useEffect(() => {
    return () => {
      cleanupRequestIdRef.current += 1;
      unpublishRequestIdRef.current += 1;
    };
  }, [cleanupContextKey]);

  async function handlePublish(passport: EquipmentPassport, { forImageProcessing = false }: { forImageProcessing?: boolean } = {}) {
    if (snapshotMutationInFlightRef.current || (publicImageProcessingInFlightRef.current && !forImageProcessing)) {
      return null;
    }

    if (authState.status !== "signed-in") {
      setError("Sign in to publish a public snapshot.");
      return null;
    }

    setError("");
    setMessage("");
    snapshotMutationInFlightRef.current = true;
    setIsPublishing(true);

    try {
      const input = buildPublicPassportSnapshotInput(passport, authState.username);
      const result = snapshot
        ? await client.models.PublicPassportSnapshot.update({
            id: snapshot.id,
            ...input
          })
        : await client.models.PublicPassportSnapshot.create(input);

      if (result.errors?.length) {
        throw new Error(result.errors.map((item) => item.message).join(" "));
      }

      if (!result.data) {
        throw new Error("The public snapshot was saved, but no record was returned.");
      }

      setSnapshot(result.data);
      setMessage(forImageProcessing ? "Sanitized text/setup snapshot saved before image processing." : snapshot ? "Public snapshot updated." : "Public snapshot published.");
      return result.data.id;
    } catch (publishError) {
      console.error("Unable to publish sanitized public passport snapshot", publishError);
      setError("The public snapshot could not be published. Check the saved passport fields and try again.");
      return null;
    } finally {
      snapshotMutationInFlightRef.current = false;
      setIsPublishing(false);
    }
  }

  async function handleUnpublish() {
    if (!snapshot || snapshotMutationInFlightRef.current || publicImageProcessingInFlightRef.current) {
      return;
    }

    if (authState.status !== "signed-in") {
      setError("Sign in to unpublish this public snapshot.");
      return;
    }

    const requiresImageCleanup = hasPreparedPublicImage || isPublicImageCleanupPending;
    const confirmed = window.confirm(
      requiresImageCleanup
        ? "Unpublish this public snapshot? The processed public image will be detached first, then the sanitized setup text will be removed from Discover. Your private original image and private Equipment Passport will not be deleted."
        : "Unpublish this public snapshot? The sanitized setup text will be removed from Discover. Your private Equipment Passport and private images will not be deleted."
    );
    if (!confirmed) {
      return;
    }

    const snapshotId = snapshot.id;
    const unpublishRequestId = unpublishRequestIdRef.current + 1;
    unpublishRequestIdRef.current = unpublishRequestId;
    let publicImageWasDetached = false;
    let derivativeCleanupPending = false;

    setError("");
    setMessage("");
    snapshotMutationInFlightRef.current = true;
    setUnpublishState(requiresImageCleanup ? "removing_image" : "unpublishing_text");

    try {
      if (requiresImageCleanup) {
        const cleanupResult = await removePublicPassportImage(client, snapshotId);

        if (cleanupResult.status === "removed" || cleanupResult.status === "not_attached") {
          setPendingCleanupMarker(snapshotId, false);
          publicImageWasDetached = true;
        } else if (cleanupResult.status === "cleanup_pending") {
          setPendingCleanupMarker(snapshotId, true);
          publicImageWasDetached = true;
          derivativeCleanupPending = true;
        } else {
          if (unpublishRequestIdRef.current === unpublishRequestId) {
            setError(`${getPublicImageCleanupFailureMessage(cleanupResult.failureCode)} The public setup remains published because unpublish did not continue.`);
          }
          return;
        }

        if (unpublishRequestIdRef.current !== unpublishRequestId) {
          return;
        }

        setHasPreparedPublicImage(false);
        setIsPublicImageCleanupPending(derivativeCleanupPending);
        setUnpublishState("unpublishing_text");
      }

      const result = await client.models.PublicPassportSnapshot.delete({ id: snapshotId });

      if (unpublishRequestIdRef.current !== unpublishRequestId) {
        return;
      }

      if (result.errors?.length || !result.data) {
        throw new Error("snapshot_delete_failed");
      }

      setSnapshot(null);
      setHasPreparedPublicImage(false);
      setIsPublicImageCleanupPending(false);
      setPendingCleanupMarker(snapshotId, false);
      setMessage(
        derivativeCleanupPending
          ? "Public snapshot unpublished. Public image delivery was detached first; final derivative cleanup still needs backend retry or reconciliation. Your private original was not changed."
          : publicImageWasDetached
            ? "Public image detached and public snapshot unpublished. Your private original image and private Equipment Passport were not changed."
            : "Public snapshot unpublished. Your private Equipment Passport and private images were not changed."
      );
    } catch {
      if (unpublishRequestIdRef.current !== unpublishRequestId) {
        return;
      }

      if (publicImageWasDetached) {
        const refreshedSnapshot = await loadPreview();

        if (unpublishRequestIdRef.current !== unpublishRequestId) {
          return;
        }

        const refreshedSnapshotHasImage = Boolean(refreshedSnapshot?.publicImageAssetId || refreshedSnapshot?.publicImageKey);
        if (refreshedSnapshotHasImage) {
          setError("The public snapshot changed while unpublish was finishing and may still be published with a newer prepared image. Review the current preview and retry Unpublish. Your private original was not changed.");
        } else {
          setError(
            derivativeCleanupPending
              ? "Public image delivery is detached and final derivative cleanup remains pending, but the sanitized text/setup may still be published. Retry Unpublish; your private original was not changed."
              : "The public image was detached, but the sanitized text/setup may still be published. Retry Unpublish without preparing the image again. Your private original was not changed."
          );
        }
      } else {
        setError("The public snapshot could not be unpublished and may still be public. Refresh and try again. Your private records and images were not changed.");
      }
    } finally {
      snapshotMutationInFlightRef.current = false;
      setUnpublishState("idle");
    }
  }

  async function handleRemovePublicImage() {
    if (
      !snapshot ||
      (!hasPreparedPublicImage && !isPublicImageCleanupPending) ||
      snapshotMutationInFlightRef.current ||
      publicImageProcessingInFlightRef.current
    ) {
      return;
    }

    if (authState.status !== "signed-in") {
      setError("Sign in to remove the prepared public image.");
      return;
    }

    const confirmed = window.confirm(
      isPublicImageCleanupPending
        ? "Retry final public derivative cleanup? Public delivery is already unavailable, the sanitized text/setup remains published, and your private original remains unchanged."
        : "Remove this public image? The sanitized text/setup snapshot will stay published, your private original will remain private and unchanged, and text-only Unpublish will be available after cleanup succeeds."
    );
    if (!confirmed) {
      return;
    }

    setError("");
    setMessage("");
    snapshotMutationInFlightRef.current = true;
    setIsRemovingPublicImage(true);
    const cleanupRequestId = cleanupRequestIdRef.current + 1;
    cleanupRequestIdRef.current = cleanupRequestId;

    try {
      const result = await removePublicPassportImage(client, snapshot.id);

      if (result.status === "removed" || result.status === "not_attached") {
        setPendingCleanupMarker(snapshot.id, false);

        if (cleanupRequestIdRef.current !== cleanupRequestId) {
          return;
        }

        await loadPreview();

        if (cleanupRequestIdRef.current !== cleanupRequestId) {
          return;
        }

        setIsPublicImageCleanupPending(false);
        setMessage(
          result.status === "removed"
            ? "Public image removed. The sanitized text/setup snapshot remains published, and the private original was not changed."
            : "No prepared public image is attached. The sanitized text/setup snapshot remains published."
        );
        return;
      }

      if (result.status === "cleanup_pending") {
        setPendingCleanupMarker(snapshot.id, true);

        if (cleanupRequestIdRef.current !== cleanupRequestId) {
          return;
        }

        await loadPreview();

        if (cleanupRequestIdRef.current !== cleanupRequestId) {
          return;
        }

        setIsPublicImageCleanupPending(true);
        setError(getPublicImageCleanupFailureMessage(result.failureCode));
        return;
      }

      if (cleanupRequestIdRef.current === cleanupRequestId) {
        setError(getPublicImageCleanupFailureMessage(result.failureCode));
      }
    } catch {
      if (cleanupRequestIdRef.current === cleanupRequestId) {
        setError("The public image could not be removed. Your private original was not changed. Try again later.");
      }
    } finally {
      snapshotMutationInFlightRef.current = false;
      setIsRemovingPublicImage(false);
    }
  }

  if (state === "loading") {
    return <p className="rounded-md border border-ink/10 bg-white p-4 text-sm text-ink/65 shadow-soft">Loading public preview...</p>;
  }

  if (state === "missing") {
    return (
      <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <h2 className="text-xl font-bold text-ink">Public preview unavailable</h2>
        <p className="mt-2 text-sm leading-6 text-ink/70">{error || "This Equipment Passport is not available for public preview."}</p>
        <Link href="/passports" className="mt-4 inline-flex rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
          Back to Equipment Passports
        </Link>
      </section>
    );
  }

  if (state === "demo") {
    const passport = getPassportById(passportId);

    if (!passport) {
      return null;
    }

    const optic = getOpticById(passport.opticOrSightId);
    const projectile = getProjectileById(passport.preferredProjectileId);
    const sanitized = sanitizePublicPassport({
      passport,
      optic,
      projectile,
      rangeSessions: rangeSessions.filter((session) => session.equipmentPassportId === passport.id),
      targetPhotos
    });

    return <PublicPreviewContent passport={passport} sanitized={sanitized} source="demo" />;
  }

  if (!record) {
    return null;
  }

  const passport = recordToEquipmentPassport(record);
  const sanitized = snapshot ? recordToSanitizedPublicPassport(snapshot) : sanitizePublicPassport({ passport, rangeSessions: [], targetPhotos: [] });

  return (
    <PublicPreviewContent
      passport={passport}
      sanitized={sanitized}
      existingSnapshotId={snapshot?.id}
      source="saved"
      error={error}
      message={message}
      isPublishing={isPublishing}
      isProcessingPublicImage={isProcessingPublicImage}
      isRemovingPublicImage={isRemovingPublicImage}
      unpublishState={unpublishState}
      hasPreparedPublicImage={hasPreparedPublicImage}
      isPublicImageCleanupPending={isPublicImageCleanupPending}
      onPublish={() => void handlePublish(passport)}
      onPrepareImageSnapshot={() => handlePublish(passport, { forImageProcessing: true })}
      onImageProcessed={() => setHasPreparedPublicImage(true)}
      onImageProcessingStateChange={handleImageProcessingStateChange}
      onRemovePublicImage={snapshot && (hasPreparedPublicImage || isPublicImageCleanupPending) ? () => void handleRemovePublicImage() : undefined}
      onUnpublish={snapshot ? () => void handleUnpublish() : undefined}
    />
  );
}

function PublicPreviewContent({
  passport,
  sanitized,
  existingSnapshotId,
  source,
  error,
  message,
  isPublishing,
  isProcessingPublicImage,
  isRemovingPublicImage,
  unpublishState,
  hasPreparedPublicImage,
  isPublicImageCleanupPending,
  onPublish,
  onPrepareImageSnapshot,
  onImageProcessed,
  onImageProcessingStateChange,
  onRemovePublicImage,
  onUnpublish
}: {
  passport: EquipmentPassport;
  sanitized: SanitizedPublicPassport;
  existingSnapshotId?: string;
  source: "saved" | "demo";
  error?: string;
  message?: string;
  isPublishing?: boolean;
  isProcessingPublicImage?: boolean;
  isRemovingPublicImage?: boolean;
  unpublishState?: UnpublishState;
  hasPreparedPublicImage?: boolean;
  isPublicImageCleanupPending?: boolean;
  onPublish?: () => void;
  onPrepareImageSnapshot?: () => Promise<string | null>;
  onImageProcessed?: () => void;
  onImageProcessingStateChange?: (isProcessing: boolean) => void;
  onRemovePublicImage?: () => void;
  onUnpublish?: () => void;
}) {
  const isUnpublishing = Boolean(unpublishState && unpublishState !== "idle");
  const isSnapshotBusy = Boolean(isPublishing || isProcessingPublicImage || isRemovingPublicImage || isUnpublishing);
  const areSnapshotChangesDisabled = Boolean(isSnapshotBusy || isPublicImageCleanupPending);

  return (
    <section>
      <PageHeader
        eyebrow={source === "saved" ? "Saved public passport preview" : "Sample public passport preview"}
        title={passport.nickname}
        description="Review the private record beside the sanitized public version before publishing anything to discovery."
        action={
          <Link href={`/passports/${passport.id}`} className="inline-flex rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink">
            Back to passport
          </Link>
        }
      />

      <div className="mb-6 rounded-md border border-clay/25 bg-clay/10 p-4">
        <h3 className="text-base font-bold text-ink">Public Sharing Warning</h3>
        <p className="mt-2 text-sm leading-6 text-ink/70">
          Publishing creates a sanitized copy. Private passport data and original images remain private. An owner may explicitly prepare one verified equipment-cover derivative for the saved Public Passport detail page. Do not share serial numbers, exact locations, purchase records, private notes, image metadata, or sensitive personal information.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
          <h3 className="text-xl font-bold text-ink">Private Passport Summary</h3>
          <p className="mt-2 text-sm leading-6 text-ink/65">This side may reference private-only records and is not the public output.</p>
          <dl className="mt-4">
            <DetailRow label="Nickname" value={passport.nickname} />
            <DetailRow label="Manufacturer" value={passport.manufacturer} />
            <DetailRow label="Model" value={passport.model} />
            <DetailRow label="Caliber / category" value={passport.caliber ?? passport.category} />
            <DetailRow label="Optic / sight" value={passport.opticSightSummary} />
            <DetailRow label="Projectile / ammo" value={passport.projectileAmmoSummary} />
            <DetailRow label="Private notes" value={passport.privateNotes ? "Private notes exist and will be hidden" : "Not recorded"} />
            <DetailRow label="Private setup photo" value={passport.privateCoverPhotoKey ? "Private original exists; an optional processed derivative requires separate consent" : "Not uploaded"} />
            <DetailRow label="Maintenance notes" value={passport.maintenanceNotes ? "Private maintenance notes exist and will be hidden" : "Not recorded"} />
          </dl>
        </article>

        <article className="rounded-md border border-moss/20 bg-white p-5 shadow-soft">
          <h3 className="text-xl font-bold text-ink">Sanitized Public Preview</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            <Tag>{sanitized.equipmentType}</Tag>
            {sanitized.useCaseTags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </div>
          <dl className="mt-4">
            <DetailRow label="Title" value={sanitized.title} />
            <DetailRow label="Manufacturer / model" value={`${sanitized.manufacturer} ${sanitized.model}`} />
            <DetailRow label="Caliber / category" value={sanitized.caliber ?? sanitized.category} />
            <DetailRow label="Optic / sight summary" value={sanitized.opticOrSightSummary} />
            <DetailRow label="Projectile / ammo summary" value={sanitized.projectileSummary} />
            <DetailRow label="Public notes" value={sanitized.publicNotes} />
          </dl>
        </article>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
          <h3 className="text-xl font-bold text-ink">Hidden From Public</h3>
          <ul className="mt-4 space-y-2 text-sm text-ink/70">
            {sanitized.hiddenFields.map((field) => (
              <li key={field}>- {field}</li>
            ))}
          </ul>
        </section>
        <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
          <h3 className="text-xl font-bold text-ink">May Be Public</h3>
          <ul className="mt-4 space-y-2 text-sm text-ink/70">
            {sanitized.publicFields.map((field) => (
              <li key={field}>- {field}</li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-6 rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <h3 className="text-xl font-bold text-ink">Public Range-Session Summaries</h3>
        <div className="mt-4">
          <PublicRangeSessionList passport={sanitized} />
        </div>
      </section>

      <section className="mt-6 rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <h3 className="text-xl font-bold text-ink">Public Target Photo Placeholders</h3>
        <div className="mt-4">
          <PublicPhotoPlaceholderList passport={sanitized} />
        </div>
      </section>

      <section className="mt-6 rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <h3 className="text-xl font-bold text-ink">{source === "saved" ? "Publish controls" : "Sample publish controls"}</h3>
        <p className="mt-2 text-sm leading-6 text-ink/65">
          {source === "saved" ? "Publish or update the sanitized text/setup snapshot in Discover. Private originals remain private. Only an eligible processed derivative may appear on saved Public Passport detail; Discover and public profile cards remain image-free." : "These buttons only show local confirmation messages. No backend write occurs."}
        </p>
        {source === "saved" ? (
          <div className="mt-4">
            {onPrepareImageSnapshot ? (
              <PublicPassportImageConsentPanel
                passportId={passport.id}
                passportOwnerId={passport.ownerId}
                privateCoverPhotoKey={passport.privateCoverPhotoKey}
                hasPreparedPublicImage={hasPreparedPublicImage}
                isSnapshotSaving={areSnapshotChangesDisabled}
                onPrepareSnapshot={onPrepareImageSnapshot}
                onProcessed={onImageProcessed}
                onProcessingStateChange={onImageProcessingStateChange}
              />
            ) : null}
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={onPublish} disabled={areSnapshotChangesDisabled} className="inline-flex justify-center rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
                {isProcessingPublicImage ? "Preparing public-safe image..." : isPublishing ? "Saving..." : existingSnapshotId ? "Update public snapshot" : "Publish public snapshot"}
              </button>
              {existingSnapshotId ? (
                <>
                  <Link href={`/discover/passports/${existingSnapshotId}`} className="inline-flex justify-center rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink">
                    View in Discover
                  </Link>
                  <button
                    type="button"
                    onClick={onUnpublish}
                    disabled={isSnapshotBusy}
                    className="inline-flex justify-center rounded-md border border-clay/30 bg-white px-4 py-2 text-sm font-semibold text-clay disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {unpublishState === "removing_image" ? "Detaching public image..." : unpublishState === "unpublishing_text" ? "Unpublishing text/setup..." : "Unpublish"}
                  </button>
                  {(hasPreparedPublicImage || isPublicImageCleanupPending) && onRemovePublicImage ? (
                    <button
                      type="button"
                      onClick={onRemovePublicImage}
                      disabled={isSnapshotBusy}
                      className="inline-flex justify-center rounded-md border border-clay/30 bg-clay/10 px-4 py-2 text-sm font-semibold text-clay disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isRemovingPublicImage ? "Removing public image..." : isPublicImageCleanupPending ? "Retry image cleanup" : "Remove public image"}
                    </button>
                  ) : null}
                </>
              ) : null}
            </div>
            {hasPreparedPublicImage ? <p className="mt-3 text-xs leading-5 text-ink/55">This prepared derivative may appear on the saved Public Passport detail page. Remove it to return this snapshot to text-only sharing, or use Unpublish to detach it before removing the sanitized text/setup. Direct image replacement remains unavailable.</p> : null}
            {isPublicImageCleanupPending ? <p className="mt-3 text-xs leading-5 text-ink/55">Public delivery is already unavailable, but final derivative deletion needs a safe retry. Publishing and image processing stay disabled. Retry image cleanup while keeping the text/setup public, or use Unpublish to retry cleanup and then remove the text/setup.</p> : null}
            {unpublishState === "removing_image" ? <p className="mt-3 rounded-md border border-moss/25 bg-field px-4 py-3 text-sm font-semibold text-moss" role="status" aria-live="polite">Detaching the processed public image before unpublishing. The private original is not being changed.</p> : null}
            {unpublishState === "unpublishing_text" ? <p className="mt-3 rounded-md border border-moss/25 bg-field px-4 py-3 text-sm font-semibold text-moss" role="status" aria-live="polite">Public image delivery is unavailable. Unpublishing the sanitized text/setup now.</p> : null}
            {error ? <p className="mt-3 rounded-md border border-clay/30 bg-clay/10 px-4 py-3 text-sm font-semibold text-clay" role="alert">{error}</p> : null}
            {message ? <p className="mt-3 rounded-md border border-moss/25 bg-field px-4 py-3 text-sm font-semibold text-moss" role="status" aria-live="polite">{message}</p> : null}
          </div>
        ) : (
          <div className="mt-4">
            <PublicPreviewActions />
          </div>
        )}
      </section>
    </section>
  );
}
