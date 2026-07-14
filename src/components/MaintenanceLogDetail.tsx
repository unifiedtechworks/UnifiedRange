"use client";

import { generateClient } from "aws-amplify/data";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { DetailRow } from "@/components/DetailRow";
import { PageHeader } from "@/components/PageHeader";
import { Tag } from "@/components/Tag";
import { getMaintenanceById, getPassportById } from "@/data/selectors";
import { useAuthUser } from "@/hooks/useAuthUser";
import { configureAmplifyClient } from "@/lib/amplifyClient";
import {
  maintenancePassportLabel,
  recordToMaintenanceLogEntry,
  type MaintenanceLogEntryRecord,
  type MaintenancePassportRecord
} from "@/lib/maintenanceLogData";
import type { MaintenanceLogEntry } from "@/types";

type DetailState = "loading" | "saved" | "demo" | "missing";

export function MaintenanceLogDetail({ maintenanceId }: { maintenanceId?: string }) {
  const client = useMemo(() => {
    configureAmplifyClient();
    return generateClient<Schema>();
  }, []);
  const { authState } = useAuthUser();
  const [state, setState] = useState<DetailState>("loading");
  const [record, setRecord] = useState<MaintenanceLogEntryRecord | null>(null);
  const [passport, setPassport] = useState<MaintenancePassportRecord | null>(null);
  const [error, setError] = useState("");

  const loadMaintenance = useCallback(async () => {
    setError("");

    if (!maintenanceId) {
      setRecord(null);
      setPassport(null);
      setError("Missing record ID.");
      setState("missing");
      return;
    }

    const demoEntry = getMaintenanceById(maintenanceId);

    if (demoEntry) {
      setRecord(null);
      setPassport(null);
      setState("demo");
      return;
    }

    if (authState.status === "loading") {
      setState("loading");
      return;
    }

    if (authState.status === "signed-in") {
      try {
        const result = await client.models.MaintenanceLogEntry.get({ id: maintenanceId });

        if (result.errors?.length) {
          throw new Error(result.errors.map((item) => item.message).join(" "));
        }

        if (result.data) {
          const passportResult = result.data.equipmentPassportId
            ? await client.models.EquipmentPassport.get({ id: result.data.equipmentPassportId })
            : { data: null, errors: undefined };

          if (passportResult.errors?.length) {
            throw new Error(passportResult.errors.map((item) => item.message).join(" "));
          }

          setRecord(result.data);
          setPassport(passportResult.data);
          setState("saved");
          return;
        }
      } catch (detailError) {
        console.error("Unable to load saved Maintenance record", detailError);
        setError("This saved record could not be loaded.");
      }
    }

    setRecord(null);
    setPassport(null);
    setState("missing");
  }, [authState.status, client, maintenanceId]);

  useEffect(() => {
    const loadInitialState = window.setTimeout(() => {
      void loadMaintenance();
    }, 0);

    window.addEventListener("unifiedrange-auth-change", loadMaintenance);

    return () => {
      window.clearTimeout(loadInitialState);
      window.removeEventListener("unifiedrange-auth-change", loadMaintenance);
    };
  }, [loadMaintenance]);

  if (state === "loading") {
    return <p className="rounded-md border border-ink/10 bg-white p-4 text-sm text-ink/65 shadow-soft">Loading Maintenance record...</p>;
  }

  if (state === "missing") {
    return (
      <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <h2 className="text-xl font-bold text-ink">Maintenance record not found</h2>
        <p className="mt-2 text-sm leading-6 text-ink/70">{error || "This Maintenance record is not available for the current signed-in account or demo data set."}</p>
        <Link href="/maintenance" className="mt-4 inline-flex rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
          Back to Maintenance
        </Link>
      </section>
    );
  }

  const entry = state === "saved" && record ? recordToMaintenanceLogEntry(record) : getMaintenanceById(maintenanceId);

  if (!entry) {
    return null;
  }

  return (
    <MaintenanceLogDetailContent
      entry={entry}
      source={state === "saved" ? "saved" : "demo"}
      equipmentSummary={passport ? maintenancePassportLabel(passport) : undefined}
    />
  );
}

function MaintenanceLogDetailContent({
  entry,
  source,
  equipmentSummary
}: {
  entry: MaintenanceLogEntry;
  source: "saved" | "demo";
  equipmentSummary?: string;
}) {
  const passport = source === "demo" ? getPassportById(entry.equipmentPassportId) : undefined;

  return (
    <section>
      <PageHeader
        eyebrow={source === "saved" ? "Saved Maintenance" : "Demo Maintenance"}
        title={entry.maintenanceType}
        description="Maintenance records are private by default and are excluded from public passport snapshots."
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/maintenance" className="inline-flex justify-center rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink">
              Back to Maintenance
            </Link>
            <Link href={`/maintenance/${entry.id}/edit`} className="inline-flex justify-center rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
              Edit record
            </Link>
          </div>
        }
      />
      <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <div className="mb-4 flex flex-wrap gap-2">
          <Tag>{source === "saved" ? "Saved account data" : "Demo data"}</Tag>
          <Tag>Private record</Tag>
        </div>
        <dl className="grid gap-x-6 md:grid-cols-2">
          <DetailRow label="Equipment" value={equipmentSummary ?? passport?.nickname} />
          <DetailRow label="Date" value={new Date(`${entry.date}T00:00:00`).toLocaleDateString()} />
          <DetailRow label="Round / shot count" value={entry.roundOrShotCount} />
          <DetailRow label="Parts changed" value={entry.partsChanged.length ? entry.partsChanged.join(", ") : "None"} />
          <DetailRow label="Cleaning notes" value={entry.cleaningNotes ?? entry.notes} />
          <DetailRow label="Torque / check notes" value={entry.torqueCheckNotes} />
          <DetailRow label="Private notes" value={entry.privateNotes ? "Private notes recorded" : "Not recorded"} />
        </dl>
      </article>
    </section>
  );
}
