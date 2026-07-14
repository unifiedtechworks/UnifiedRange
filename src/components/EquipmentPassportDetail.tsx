"use client";

import { generateClient } from "aws-amplify/data";
import { getCurrentUser } from "aws-amplify/auth";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { DetailRow } from "@/components/DetailRow";
import { EquipmentPassportPrivatePhotoPanel } from "@/components/EquipmentPassportPrivatePhotoPanel";
import { PageHeader } from "@/components/PageHeader";
import { SessionCard } from "@/components/SessionCard";
import { Tag } from "@/components/Tag";
import { getChecklistForPassport, getMaintenanceForPassport, getOpticById, getPassportById, getProjectileById, getSessionsForPassport } from "@/data/selectors";
import { configureAmplifyClient, getAuthErrorMessage } from "@/lib/amplifyClient";
import { recordToEquipmentPassport, type EquipmentPassportRecord } from "@/lib/equipmentPassportData";
import type { EquipmentPassport } from "@/types";

type DetailState = "loading" | "saved" | "demo" | "missing";

export function EquipmentPassportDetail({ passportId }: { passportId?: string }) {
  const client = useMemo(() => {
    configureAmplifyClient();
    return generateClient<Schema>();
  }, []);
  const [state, setState] = useState<DetailState>("loading");
  const [record, setRecord] = useState<EquipmentPassportRecord | null>(null);
  const [error, setError] = useState("");

  const loadPassport = useCallback(async () => {
    setError("");

    if (!passportId) {
      setRecord(null);
      setError("Missing record ID.");
      setState("missing");
      return;
    }

    const demoPassport = getPassportById(passportId);

    if (demoPassport) {
      setRecord(null);
      setState("demo");
      return;
    }

    try {
      configureAmplifyClient();
      await getCurrentUser();
      const result = await client.models.EquipmentPassport.get({ id: passportId });

      if (result.errors?.length) {
        throw new Error(result.errors.map((item) => item.message).join(" "));
      }

      if (result.data) {
        setRecord(result.data);
        setState("saved");
        return;
      }
    } catch (detailError) {
      const message = getAuthErrorMessage(detailError);

      if (!message.toLowerCase().includes("auth") && !message.toLowerCase().includes("user")) {
        console.error("Unable to load saved Equipment Passport", detailError);
        setError("This saved record could not be loaded.");
      }
    }

    setRecord(null);
    setState("missing");
  }, [client, passportId]);

  useEffect(() => {
    const loadInitialState = window.setTimeout(() => {
      void loadPassport();
    }, 0);

    window.addEventListener("unifiedrange-auth-change", loadPassport);

    return () => {
      window.clearTimeout(loadInitialState);
      window.removeEventListener("unifiedrange-auth-change", loadPassport);
    };
  }, [loadPassport]);

  if (state === "loading") {
    return <p className="rounded-md border border-ink/10 bg-white p-4 text-sm text-ink/65 shadow-soft">Loading Equipment Passport...</p>;
  }

  if (state === "missing") {
    return (
      <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <h2 className="text-xl font-bold text-ink">Passport not found</h2>
        <p className="mt-2 text-sm leading-6 text-ink/70">{error || "This passport is not available for the current signed-in account or demo data set."}</p>
        <Link href="/passports" className="mt-4 inline-flex rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
          Back to passports
        </Link>
      </section>
    );
  }

  const passport = state === "saved" && record ? recordToEquipmentPassport(record) : getPassportById(passportId);

  if (!passport) {
    return null;
  }

  return (
    <PassportDetailContent
      passport={passport}
      source={state === "saved" ? "saved" : "demo"}
      onPhotoUpdated={(storageKey) => {
        if (record) {
          setRecord({ ...record, privateCoverPhotoKey: storageKey });
        }
      }}
    />
  );
}

function PassportDetailContent({
  passport,
  source,
  onPhotoUpdated
}: {
  passport: EquipmentPassport;
  source: "saved" | "demo";
  onPhotoUpdated?: (storageKey: string) => void;
}) {
  const optic = getOpticById(passport.opticOrSightId);
  const projectile = getProjectileById(passport.preferredProjectileId);
  const sessions = source === "demo" ? getSessionsForPassport(passport.id) : [];
  const maintenance = source === "demo" ? getMaintenanceForPassport(passport.id) : [];
  const checklist = source === "demo" ? getChecklistForPassport(passport.id) : undefined;
  const opticSummary = optic ? `${optic.manufacturer} ${optic.model}` : passport.opticSightSummary;
  const projectileSummary = projectile ? `${projectile.manufacturer} ${projectile.productLine}` : passport.projectileAmmoSummary;

  return (
    <section>
      <PageHeader
        eyebrow={source === "saved" ? "Saved account passport" : "Demo equipment passport"}
        title={passport.nickname}
        description={passport.publicNotes ?? "Private setup documentation and readiness notes."}
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href={`/passports/${passport.id}/public-preview`} className="inline-flex justify-center rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink">
              Public preview
            </Link>
            <Link href={`/passports/${passport.id}/edit`} className="inline-flex justify-center rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
              Edit passport
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <article className="overflow-hidden rounded-md border border-ink/10 bg-white shadow-soft">
          <div className="h-64 bg-cover bg-center" style={{ backgroundImage: `url(${passport.coverPhotoUrl})` }} aria-hidden="true" />
          <div className="p-5">
            <div className="flex flex-wrap gap-2">
              <Tag>{source === "saved" ? "Saved account data" : "Demo data"}</Tag>
              {passport.useCaseTags.map((tag) => (
                <Tag key={tag}>{tag}</Tag>
              ))}
            </div>
            <dl className="mt-5">
              <DetailRow label="Manufacturer" value={passport.manufacturer} />
              <DetailRow label="Model" value={passport.model} />
              <DetailRow label="Category" value={passport.category} />
              <DetailRow label="Caliber / category" value={passport.caliber} />
              <DetailRow label="Round or shot count" value={passport.roundOrShotCount} />
              <DetailRow label="Optic / sight" value={opticSummary} />
              <DetailRow label="Projectile / ammo" value={projectileSummary} />
              <DetailRow label="Public sharing" value={passport.isPublic ? "Sanitized public snapshot prepared" : "Private"} />
            </dl>
          </div>
        </article>

        <div className="space-y-6">
          <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
            <h3 className="text-xl font-bold text-ink">Setup Notes</h3>
            <p className="mt-3 text-sm leading-6 text-ink/70">{passport.privateNotes ?? passport.maintenanceNotes ?? "No private setup notes recorded."}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {passport.accessories.map((accessory) => (
                <Tag key={accessory}>{accessory}</Tag>
              ))}
            </div>
          </article>

          {source === "saved" ? (
            <EquipmentPassportPrivatePhotoPanel passportId={passport.id} storageKey={passport.privateCoverPhotoKey} onPhotoUpdated={onPhotoUpdated} />
          ) : null}

          <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
            <h3 className="text-xl font-bold text-ink">Related Sessions</h3>
            {source === "saved" ? <p className="mt-3 text-sm leading-6 text-ink/70">Range Sessions remain on mock data and are not linked to saved account passports yet.</p> : null}
            {sessions.length > 0 ? (
              <div className="mt-4 space-y-4">
                {sessions.map((session) => (
                  <SessionCard key={session.id} session={session} />
                ))}
              </div>
            ) : null}
          </article>

          <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
            <h3 className="text-xl font-bold text-ink">Maintenance and Readiness</h3>
            {source === "saved" ? (
              <p className="mt-2 text-sm text-ink/65">Maintenance and Hunting Readiness stay on mock data until those slices are wired.</p>
            ) : (
              <>
                <p className="mt-2 text-sm text-ink/65">{maintenance.length} maintenance records linked to this demo passport.</p>
                <p className="mt-1 text-sm text-ink/65">
                  {checklist ? `${checklist.checklistItems.filter((item) => item.isComplete).length}/${checklist.checklistItems.length} readiness items complete.` : "No hunting checklist linked yet."}
                </p>
              </>
            )}
          </article>
        </div>
      </div>
    </section>
  );
}
