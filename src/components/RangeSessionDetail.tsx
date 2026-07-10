"use client";

import { generateClient } from "aws-amplify/data";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { DetailRow } from "@/components/DetailRow";
import { PageHeader } from "@/components/PageHeader";
import { getOpticById, getPassportById, getProjectileById, getSessionById, getTargetPhotosForSession } from "@/data/selectors";
import { useAuthUser } from "@/hooks/useAuthUser";
import { configureAmplifyClient } from "@/lib/amplifyClient";
import {
  equipmentPassportLabel,
  opticSightProfileLabel,
  projectileProfileLabel,
  recordToRangeSession,
  type EquipmentPassportRecord,
  type OpticSightProfileRecord,
  type ProjectileProfileRecord,
  type RangeSessionRecord
} from "@/lib/rangeSessionData";
import type { RangeSession } from "@/types";

type DetailState = "loading" | "saved" | "demo" | "missing";

export function RangeSessionDetail({ sessionId }: { sessionId?: string }) {
  const client = useMemo(() => {
    configureAmplifyClient();
    return generateClient<Schema>();
  }, []);
  const { authState } = useAuthUser();
  const [state, setState] = useState<DetailState>("loading");
  const [record, setRecord] = useState<RangeSessionRecord | null>(null);
  const [passport, setPassport] = useState<EquipmentPassportRecord | null>(null);
  const [projectile, setProjectile] = useState<ProjectileProfileRecord | null>(null);
  const [optic, setOptic] = useState<OpticSightProfileRecord | null>(null);
  const [error, setError] = useState("");

  const loadSession = useCallback(async () => {
    setError("");

    if (!sessionId) {
      setRecord(null);
      setError("Missing record ID.");
      setState("missing");
      return;
    }

    const demoSession = getSessionById(sessionId);

    if (demoSession) {
      setRecord(null);
      setPassport(null);
      setProjectile(null);
      setOptic(null);
      setState("demo");
      return;
    }

    if (authState.status === "loading") {
      setState("loading");
      return;
    }

    if (authState.status === "signed-in") {
      try {
        const result = await client.models.RangeSession.get({ id: sessionId });

        if (result.errors?.length) {
          throw new Error(result.errors.map((item) => item.message).join(" "));
        }

        if (result.data) {
          const session = result.data;
          const [passportResult, projectileResult, opticResult] = await Promise.all([
            session.equipmentPassportId ? client.models.EquipmentPassport.get({ id: session.equipmentPassportId }) : Promise.resolve({ data: null, errors: undefined }),
            session.projectileProfileId ? client.models.ProjectileProfile.get({ id: session.projectileProfileId }) : Promise.resolve({ data: null, errors: undefined }),
            session.opticSightProfileId ? client.models.OpticSightProfile.get({ id: session.opticSightProfileId }) : Promise.resolve({ data: null, errors: undefined })
          ]);

          const errors = [...(passportResult.errors ?? []), ...(projectileResult.errors ?? []), ...(opticResult.errors ?? [])];
          if (errors.length) {
            throw new Error(errors.map((item) => item.message).join(" "));
          }

          setRecord(session);
          setPassport(passportResult.data);
          setProjectile(projectileResult.data);
          setOptic(opticResult.data);
          setState("saved");
          return;
        }
      } catch (detailError) {
        console.error("Unable to load saved Range Session", detailError);
        setError("This saved record could not be loaded.");
      }
    }

    setRecord(null);
    setState("missing");
  }, [authState.status, client, sessionId]);

  useEffect(() => {
    const loadInitialState = window.setTimeout(() => {
      void loadSession();
    }, 0);

    window.addEventListener("unifiedrange-auth-change", loadSession);

    return () => {
      window.clearTimeout(loadInitialState);
      window.removeEventListener("unifiedrange-auth-change", loadSession);
    };
  }, [loadSession]);

  if (state === "loading") {
    return <p className="rounded-md border border-ink/10 bg-white p-4 text-sm text-ink/65 shadow-soft">Loading Range Session...</p>;
  }

  if (state === "missing") {
    return (
      <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <h2 className="text-xl font-bold text-ink">Range Session not found</h2>
        <p className="mt-2 text-sm leading-6 text-ink/70">{error || "This Range Session is not available for the current signed-in account or demo data set."}</p>
        <Link href="/sessions" className="mt-4 inline-flex rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
          Back to Range Sessions
        </Link>
      </section>
    );
  }

  const session = state === "saved" && record ? recordToRangeSession(record) : getSessionById(sessionId);

  if (!session) {
    return null;
  }

  return (
    <RangeSessionDetailContent
      session={session}
      source={state === "saved" ? "saved" : "demo"}
      equipmentSummary={passport ? equipmentPassportLabel(passport) : undefined}
      projectileSummary={projectile ? projectileProfileLabel(projectile) : undefined}
      opticSummary={optic ? opticSightProfileLabel(optic) : undefined}
    />
  );
}

function RangeSessionDetailContent({
  session,
  source,
  equipmentSummary,
  projectileSummary,
  opticSummary
}: {
  session: RangeSession;
  source: "saved" | "demo";
  equipmentSummary?: string;
  projectileSummary?: string;
  opticSummary?: string;
}) {
  const passport = source === "demo" ? getPassportById(session.equipmentPassportId) : undefined;
  const projectile = source === "demo" ? getProjectileById(session.projectileProfileId) : undefined;
  const optic = source === "demo" ? getOpticById(passport?.opticOrSightId) : undefined;
  const photos = source === "demo" ? getTargetPhotosForSession(session.id) : [];

  return (
    <section>
      <PageHeader
        eyebrow={`${source === "saved" ? "Saved Range Session" : "Demo Range Session"} - ${new Date(`${session.date}T00:00:00`).toLocaleDateString()}`}
        title={session.discipline || "Range session"}
        description="A historical practice record with user-entered context, free-text notes, and target-photo placeholders."
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/sessions" className="inline-flex justify-center rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink">
              Back to Range Sessions
            </Link>
            <Link href={`/sessions/${session.id}/edit`} className="inline-flex justify-center rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
              Edit session
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
          <h3 className="text-xl font-bold text-ink">Session Details</h3>
          <dl className="mt-4">
            <DetailRow label="Equipment" value={equipmentSummary ?? passport?.nickname} />
            <DetailRow label="Projectile / ammo" value={projectileSummary ?? (projectile ? `${projectile.manufacturer} ${projectile.productLine}` : undefined)} />
            <DetailRow label="Optic / sight" value={opticSummary ?? (optic ? `${optic.manufacturer} ${optic.model}` : undefined)} />
            <DetailRow label="Distance" value={`${session.distance} ${session.distanceUnit}`} />
            <DetailRow label="Position" value={session.position} />
            <DetailRow label="Support" value={session.supportType} />
            <DetailRow label="Group / score" value={session.groupSize ?? session.score} />
            <DetailRow label="Cold-bore / first-shot marker" value={session.isColdBore ? "Yes" : "No"} />
            <DetailRow label="Clean / fouled marker" value={session.isCleanBarrel ? "Yes" : "No"} />
            <DetailRow label="Suppressed / accessory marker" value={session.isSuppressed ? "Yes" : "No"} />
            <DetailRow label="Confidence rating" value={`${session.confidenceRating}/5`} />
          </dl>
        </article>

        <div className="space-y-6">
          <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
            <h3 className="text-xl font-bold text-ink">Notes</h3>
            <p className="mt-3 text-sm leading-6 text-ink/70">{session.sessionNotes || "No session notes recorded."}</p>
            <p className="mt-3 text-sm leading-6 text-ink/70">{session.weatherNotes || "No weather notes recorded."}</p>
            {session.windNotesFreeText ? <p className="mt-3 text-sm leading-6 text-ink/70">Wind notes: {session.windNotesFreeText}</p> : null}
            <p className="mt-3 rounded-md bg-field px-3 py-2 text-sm leading-6 text-ink/70">Wind notes are stored as free text only and are not transformed into field guidance.</p>
          </article>

          <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
            <h3 className="text-xl font-bold text-ink">Target Photos</h3>
            <p className="mt-2 text-sm leading-6 text-ink/65">Target photos are private unless explicitly shared. Real upload is not implemented yet.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {photos.map((photo) => (
                <div key={photo.id} className="overflow-hidden rounded-md border border-ink/10">
                  <div className="h-44 bg-cover bg-center" style={{ backgroundImage: `url(${photo.imageUrl})` }} aria-hidden="true" />
                  <div className="p-3">
                    <p className="text-sm font-semibold text-ink">{photo.caption}</p>
                    <p className="mt-1 text-xs text-ink/60">Manual entry: {photo.manuallyEnteredGroupSize ?? photo.manuallyEnteredScore ?? "No measurement recorded"}</p>
                  </div>
                </div>
              ))}
              {photos.length === 0 ? <div className="rounded-md border border-dashed border-ink/20 bg-paper p-5 text-sm text-ink/65">No target photos attached yet.</div> : null}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
