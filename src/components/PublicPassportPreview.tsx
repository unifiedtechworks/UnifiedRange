"use client";

import { generateClient } from "aws-amplify/data";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { DetailRow } from "@/components/DetailRow";
import { PageHeader } from "@/components/PageHeader";
import { PublicPhotoPlaceholderList, PublicRangeSessionList } from "@/components/PublicPassportSections";
import { PublicPreviewActions } from "@/components/PublicPreviewActions";
import { Tag } from "@/components/Tag";
import { rangeSessions, targetPhotos } from "@/data/mockData";
import { getOpticById, getPassportById, getProjectileById } from "@/data/selectors";
import { useAuthUser } from "@/hooks/useAuthUser";
import { configureAmplifyClient, getAuthErrorMessage } from "@/lib/amplifyClient";
import { recordToEquipmentPassport, type EquipmentPassportRecord } from "@/lib/equipmentPassportData";
import {
  recordToSanitizedPublicPassport,
  toPublicSnapshotInput,
  type PublicPassportSnapshotRecord
} from "@/lib/publicPassportSnapshotData";
import { sanitizePublicPassport } from "@/lib/sanitizePublicPassport";
import type { EquipmentPassport, SanitizedPublicPassport } from "@/types";

type PreviewState = "loading" | "saved" | "demo" | "missing";

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

  const loadPreview = useCallback(async () => {
    setError("");
    setMessage("");

    if (!passportId) {
      setRecord(null);
      setSnapshot(null);
      setError("Missing record ID.");
      setState("missing");
      return;
    }

    const demoPassport = getPassportById(passportId);

    if (demoPassport) {
      setRecord(null);
      setSnapshot(null);
      setState("demo");
      return;
    }

    if (authState.status === "loading") {
      setState("loading");
      return;
    }

    if (authState.status !== "signed-in") {
      setRecord(null);
      setSnapshot(null);
      setError("Sign in to preview and publish saved Equipment Passports.");
      setState("missing");
      return;
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

      const errors = [...(passportResult.errors ?? []), ...(snapshotResult.errors ?? [])];
      if (errors.length) {
        throw new Error(errors.map((item) => item.message).join(" "));
      }

      if (passportResult.data) {
        setRecord(passportResult.data);
        setSnapshot(snapshotResult.data[0] ?? null);
        setState("saved");
        return;
      }
    } catch (loadError) {
      console.error("Unable to load public preview", loadError);
      setError("This saved passport could not be loaded for public preview.");
    }

    setRecord(null);
    setSnapshot(null);
    setState("missing");
  }, [authState, client, passportId]);

  useEffect(() => {
    const loadInitialState = window.setTimeout(() => {
      void loadPreview();
    }, 0);

    window.addEventListener("unifiedrange-auth-change", loadPreview);

    return () => {
      window.clearTimeout(loadInitialState);
      window.removeEventListener("unifiedrange-auth-change", loadPreview);
    };
  }, [loadPreview]);

  async function handlePublish(passport: EquipmentPassport) {
    if (authState.status !== "signed-in") {
      setError("Sign in to publish a public snapshot.");
      return;
    }

    setError("");
    setMessage("");
    setIsPublishing(true);

    try {
      const input = toPublicSnapshotInput(passport, authState.username);
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
      setMessage(snapshot ? "Public snapshot updated." : "Public snapshot published.");
    } catch (publishError) {
      setError(getAuthErrorMessage(publishError));
    } finally {
      setIsPublishing(false);
    }
  }

  async function handleUnpublish() {
    if (!snapshot) {
      return;
    }

    const confirmed = window.confirm("Unpublish this public snapshot? It will be removed from Discover.");
    if (!confirmed) {
      return;
    }

    setError("");
    setMessage("");
    setIsPublishing(true);

    try {
      const result = await client.models.PublicPassportSnapshot.delete({ id: snapshot.id });

      if (result.errors?.length) {
        throw new Error(result.errors.map((item) => item.message).join(" "));
      }

      setSnapshot(null);
      setMessage("Public snapshot unpublished.");
    } catch (unpublishError) {
      setError(getAuthErrorMessage(unpublishError));
    } finally {
      setIsPublishing(false);
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
      onPublish={() => void handlePublish(passport)}
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
  onPublish,
  onUnpublish
}: {
  passport: EquipmentPassport;
  sanitized: SanitizedPublicPassport;
  existingSnapshotId?: string;
  source: "saved" | "demo";
  error?: string;
  message?: string;
  isPublishing?: boolean;
  onPublish?: () => void;
  onUnpublish?: () => void;
}) {
  return (
    <section>
      <PageHeader
        eyebrow={source === "saved" ? "Saved public passport preview" : "Demo public passport preview"}
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
          Publishing creates a sanitized copy. Private passport data remains private, and private images are not published in this version. Do not share serial numbers, exact locations, purchase records, private notes, image metadata, or sensitive personal information.
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
            <DetailRow label="Private setup photo" value={passport.privateCoverPhotoKey ? "Private image exists and will not be published" : "Not uploaded"} />
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
        <h3 className="text-xl font-bold text-ink">{source === "saved" ? "Publish Controls" : "Mock Publish Controls"}</h3>
        <p className="mt-2 text-sm leading-6 text-ink/65">
          {source === "saved" ? "Publish or update the sanitized text/setup snapshot in Discover. Private images remain private." : "These buttons only show local confirmation messages. No backend write occurs."}
        </p>
        {source === "saved" ? (
          <div className="mt-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={onPublish} disabled={isPublishing} className="inline-flex justify-center rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
                {isPublishing ? "Saving..." : existingSnapshotId ? "Update public snapshot" : "Publish public snapshot"}
              </button>
              {existingSnapshotId ? (
                <>
                  <Link href={`/discover/passports/${existingSnapshotId}`} className="inline-flex justify-center rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink">
                    View in Discover
                  </Link>
                  <button type="button" onClick={onUnpublish} disabled={isPublishing} className="inline-flex justify-center rounded-md border border-clay/30 bg-white px-4 py-2 text-sm font-semibold text-clay disabled:cursor-not-allowed disabled:opacity-60">
                    Unpublish
                  </button>
                </>
              ) : null}
            </div>
            {error ? <p className="mt-3 rounded-md border border-clay/30 bg-clay/10 px-4 py-3 text-sm font-semibold text-clay">{error}</p> : null}
            {message ? <p className="mt-3 rounded-md border border-moss/25 bg-field px-4 py-3 text-sm font-semibold text-moss">{message}</p> : null}
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
