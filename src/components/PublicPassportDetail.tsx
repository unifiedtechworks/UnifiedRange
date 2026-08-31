"use client";

import { generateClient } from "aws-amplify/data";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { DetailRow } from "@/components/DetailRow";
import { PageHeader } from "@/components/PageHeader";
import { PublicPassportImage } from "@/components/PublicPassportImage";
import { PublicPhotoPlaceholderList, PublicRangeSessionList, ReactionBar } from "@/components/PublicPassportSections";
import { PublicSocialPanel } from "@/components/PublicSocialPanel";
import { ReportContentButton } from "@/components/ReportContentButton";
import { Tag } from "@/components/Tag";
import { getSanitizedPublicPassportById } from "@/data/publicDiscovery";
import { configureAmplifyClient } from "@/lib/amplifyClient";
import { recordToSanitizedPublicPassport, type PublicPassportSnapshotRecord } from "@/lib/publicPassportSnapshotData";
import { publicIdentityByOwner, type PublicUserIdentity } from "@/lib/publicUserProfileData";
import type { SanitizedPublicPassport } from "@/types";

type DetailState = "loading" | "saved" | "demo" | "missing";

export function PublicPassportDetail({ publicPassportId }: { publicPassportId?: string }) {
  const client = useMemo(() => {
    configureAmplifyClient();
    return generateClient<Schema>();
  }, []);
  const [state, setState] = useState<DetailState>("loading");
  const [record, setRecord] = useState<PublicPassportSnapshotRecord | null>(null);
  const [owner, setOwner] = useState<PublicUserIdentity | undefined>();
  const [error, setError] = useState("");
  const loadRequestIdRef = useRef(0);

  const loadPublicPassport = useCallback(async () => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;
    setState("loading");
    setRecord(null);
    setOwner(undefined);
    setError("");

    if (!publicPassportId) {
      setRecord(null);
      setOwner(undefined);
      setError("Missing record ID.");
      setState("missing");
      return;
    }

    const demoPassport = getSanitizedPublicPassportById(publicPassportId);

    if (demoPassport) {
      setRecord(null);
      setOwner(undefined);
      setState("demo");
      return;
    }

    try {
      const result = await client.models.PublicPassportSnapshot.get({ id: publicPassportId }, { authMode: "apiKey" });

      if (loadRequestIdRef.current !== requestId) {
        return;
      }

      if (result.errors?.length) {
        throw new Error("public_snapshot_unavailable");
      }

      if (result.data) {
        if (result.data.id !== publicPassportId) {
          throw new Error("public_snapshot_mismatch");
        }

        const profileResult = await client.models.PublicUserProfileSnapshot.list({
          filter: { ownerId: { eq: result.data.ownerId } },
          authMode: "apiKey"
        });

        if (loadRequestIdRef.current !== requestId) {
          return;
        }

        setRecord(result.data);
        if (!profileResult.errors?.length) {
          setOwner(publicIdentityByOwner(profileResult.data)[result.data.ownerId]);
        }
        setState("saved");
        return;
      }
    } catch {
      if (loadRequestIdRef.current !== requestId) {
        return;
      }

      setError("This public snapshot could not be loaded.");
    }

    setRecord(null);
    setOwner(undefined);
    setState("missing");
  }, [client, publicPassportId]);

  useEffect(() => {
    const loadInitialState = window.setTimeout(() => {
      void loadPublicPassport();
    }, 0);

    return () => {
      window.clearTimeout(loadInitialState);
      loadRequestIdRef.current += 1;
    };
  }, [loadPublicPassport]);

  const hasCurrentSavedRecord = state === "saved" && record?.id === publicPassportId;

  if (state === "loading" || (state === "saved" && !hasCurrentSavedRecord)) {
    return <p className="rounded-md border border-ink/10 bg-white p-4 text-sm text-ink/65 shadow-soft">Loading public setup...</p>;
  }

  if (state === "missing") {
    return (
      <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <h2 className="text-xl font-bold text-ink">Public setup not found</h2>
        <p className="mt-2 text-sm leading-6 text-ink/70">{error || "This public setup snapshot is not available."}</p>
        <Link href="/discover" className="mt-4 inline-flex rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
          Back to Discover
        </Link>
      </section>
    );
  }

  const passport = hasCurrentSavedRecord && record ? recordToSanitizedPublicPassport(record, owner) : getSanitizedPublicPassportById(publicPassportId);

  if (!passport) {
    return null;
  }

  return (
    <PublicPassportDetailContent
      passport={passport}
      source={hasCurrentSavedRecord ? "Public snapshot" : "Sample data"}
      publicPassportSnapshotId={hasCurrentSavedRecord ? record?.id : undefined}
    />
  );
}

function PublicPassportDetailContent({
  passport,
  source,
  publicPassportSnapshotId
}: {
  passport: SanitizedPublicPassport;
  source: string;
  publicPassportSnapshotId?: string;
}) {
  const isDemo = source === "Sample data";

  return (
    <section>
      <PageHeader
        eyebrow="Public setup discovery"
        title={passport.title}
        description="Browse sanitized setup documentation and shared range-log context. Public pages do not provide aiming adjustments or operational guidance."
        action={
          <Link href="/discover" className="inline-flex rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink">
            Back to Discover
          </Link>
        }
      />

      <div className="mb-6 rounded-md border border-moss/20 bg-field p-4">
        <p className="text-sm leading-6 text-ink/70">
          {source}. This page shows sanitized setup overview fields and, when explicitly approved, one processed public equipment-cover image. Private notes, private originals, owner details, purchase records, exact locations, and image metadata are excluded.
        </p>
      </div>

      {publicPassportSnapshotId ? <PublicPassportImage publicPassportSnapshotId={publicPassportSnapshotId} /> : null}

      <div className="mb-6 rounded-md border border-ink/10 bg-white p-4 shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">Published by</p>
        {passport.publicOwnerUsername ? (
          <Link href={`/u/${encodeURIComponent(passport.publicOwnerUsername)}`} className="mt-2 inline-flex font-semibold text-moss">
            {passport.publicOwnerDisplayName ? `${passport.publicOwnerDisplayName} (@${passport.publicOwnerUsername})` : `@${passport.publicOwnerUsername}`}
          </Link>
        ) : (
          <p className="mt-2 text-sm font-semibold text-ink/65">UnifiedRange user</p>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
          <div className="flex flex-wrap gap-2">
            <Tag>{passport.equipmentType}</Tag>
            {passport.useCaseTags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </div>
          <dl className="mt-5">
            <DetailRow label="Manufacturer" value={passport.manufacturer} />
            <DetailRow label="Model" value={passport.model} />
            <DetailRow label="Caliber / category" value={passport.caliber ?? passport.category} />
            <DetailRow label="Optic / sight summary" value={passport.opticOrSightSummary} />
            <DetailRow label="Projectile / ammo summary" value={passport.projectileSummary} />
          </dl>
        </article>

        <div className="space-y-6">
          <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
            <h3 className="text-xl font-bold text-ink">Public notes</h3>
            <p className="mt-3 text-sm leading-6 text-ink/70">{passport.publicNotes ?? "No public notes shared."}</p>
          </article>

          {isDemo ? (
            <>
              <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
                <h3 className="text-xl font-bold text-ink">Reactions</h3>
                <div className="mt-4">
                  <ReactionBar passport={passport} />
                </div>
              </article>

              <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
                <h3 className="text-xl font-bold text-ink">Report content</h3>
                <p className="mt-2 text-sm leading-6 text-ink/65">Help keep discovery focused on safe, legal, privacy-preserving setup documentation.</p>
                <div className="mt-4">
                  <ReportContentButton targetLabel={passport.title} />
                </div>
              </article>
            </>
          ) : null}
        </div>
      </div>

      <section className="mt-6 rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <h3 className="text-xl font-bold text-ink">Public range-session summaries</h3>
        <div className="mt-4">
          <PublicRangeSessionList passport={passport} />
        </div>
      </section>

      <section className="mt-6 rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <h3 className="text-xl font-bold text-ink">Public target photo placeholders</h3>
        <div className="mt-4">
          <PublicPhotoPlaceholderList passport={passport} />
        </div>
      </section>

      {isDemo ? (
        <section className="mt-6 rounded-md border border-ink/10 bg-white p-5 shadow-soft">
          <h3 className="text-xl font-bold text-ink">Comments</h3>
          <p className="mt-2 text-sm leading-6 text-ink/65">Comments are unavailable on sample snapshots. Published public snapshots support signed-in comments and reporting.</p>
        </section>
      ) : (
        <section className="mt-6">
          <PublicSocialPanel publicPassportId={passport.id} publicPassportTitle={passport.title} />
        </section>
      )}
    </section>
  );
}
