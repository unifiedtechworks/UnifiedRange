"use client";

import { generateClient } from "aws-amplify/data";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { DetailRow } from "@/components/DetailRow";
import { PageHeader } from "@/components/PageHeader";
import { PublicPhotoPlaceholderList, PublicRangeSessionList, ReactionBar } from "@/components/PublicPassportSections";
import { ReportContentButton } from "@/components/ReportContentButton";
import { Tag } from "@/components/Tag";
import { getSanitizedPublicPassportById } from "@/data/publicDiscovery";
import { configureAmplifyClient } from "@/lib/amplifyClient";
import { recordToSanitizedPublicPassport, type PublicPassportSnapshotRecord } from "@/lib/publicPassportSnapshotData";
import type { SanitizedPublicPassport } from "@/types";

type DetailState = "loading" | "saved" | "demo" | "missing";

export function PublicPassportDetail({ publicPassportId }: { publicPassportId?: string }) {
  const client = useMemo(() => {
    configureAmplifyClient();
    return generateClient<Schema>();
  }, []);
  const [state, setState] = useState<DetailState>("loading");
  const [record, setRecord] = useState<PublicPassportSnapshotRecord | null>(null);
  const [error, setError] = useState("");

  const loadPublicPassport = useCallback(async () => {
    setError("");

    if (!publicPassportId) {
      setRecord(null);
      setError("Missing record ID.");
      setState("missing");
      return;
    }

    const demoPassport = getSanitizedPublicPassportById(publicPassportId);

    if (demoPassport) {
      setRecord(null);
      setState("demo");
      return;
    }

    try {
      const result = await client.models.PublicPassportSnapshot.get({ id: publicPassportId }, { authMode: "apiKey" });

      if (result.errors?.length) {
        throw new Error(result.errors.map((item) => item.message).join(" "));
      }

      if (result.data) {
        setRecord(result.data);
        setState("saved");
        return;
      }
    } catch (loadError) {
      console.error("Unable to load public passport snapshot", loadError);
      setError("This public snapshot could not be loaded.");
    }

    setRecord(null);
    setState("missing");
  }, [client, publicPassportId]);

  useEffect(() => {
    const loadInitialState = window.setTimeout(() => {
      void loadPublicPassport();
    }, 0);

    return () => {
      window.clearTimeout(loadInitialState);
    };
  }, [loadPublicPassport]);

  if (state === "loading") {
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

  const passport = state === "saved" && record ? recordToSanitizedPublicPassport(record) : getSanitizedPublicPassportById(publicPassportId);

  if (!passport) {
    return null;
  }

  return <PublicPassportDetailContent passport={passport} source={state === "saved" ? "Public snapshot" : "Demo data"} />;
}

function PublicPassportDetailContent({ passport, source }: { passport: SanitizedPublicPassport; source: string }) {
  return (
    <section>
      <PageHeader
        eyebrow="Public setup discovery"
        title={passport.title}
        description="Public pages are for Setup Discovery and range-log sharing, with sanitized documentation only. They are not firing solutions or operational guidance."
        action={
          <Link href="/discover" className="inline-flex rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink">
            Back to Discover
          </Link>
        }
      />

      <div className="mb-6 rounded-md border border-moss/20 bg-field p-4">
        <p className="text-sm leading-6 text-ink/70">
          {source}. This page shows only sanitized setup overview fields. Private notes, private images, owner details, purchase records, exact locations, and image metadata are excluded.
        </p>
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
            <h3 className="text-xl font-bold text-ink">Public Notes</h3>
            <p className="mt-3 text-sm leading-6 text-ink/70">{passport.publicNotes ?? "No public notes shared."}</p>
          </article>

          <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
            <h3 className="text-xl font-bold text-ink">Reactions</h3>
            <div className="mt-4">
              <ReactionBar passport={passport} />
            </div>
          </article>

          <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
            <h3 className="text-xl font-bold text-ink">Report Content</h3>
            <p className="mt-2 text-sm leading-6 text-ink/65">Help keep discovery focused on safe, legal, privacy-preserving setup documentation.</p>
            <div className="mt-4">
              <ReportContentButton targetLabel={passport.title} />
            </div>
          </article>
        </div>
      </div>

      <section className="mt-6 rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <h3 className="text-xl font-bold text-ink">Public Range-Session Summaries</h3>
        <div className="mt-4">
          <PublicRangeSessionList passport={passport} />
        </div>
      </section>

      <section className="mt-6 rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <h3 className="text-xl font-bold text-ink">Public Target Photo Placeholders</h3>
        <div className="mt-4">
          <PublicPhotoPlaceholderList passport={passport} />
        </div>
      </section>

      <section className="mt-6 rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <h3 className="text-xl font-bold text-ink">Comments</h3>
        <p className="mt-2 text-sm leading-6 text-ink/65">Comments are a placeholder for future moderated discussion. Reporting and moderation workflows will be connected later.</p>
      </section>
    </section>
  );
}
