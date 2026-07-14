"use client";

import { generateClient } from "aws-amplify/data";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { DetailRow } from "@/components/DetailRow";
import { PageHeader } from "@/components/PageHeader";
import { ReadinessProgress, getReadinessProgress } from "@/components/ReadinessProgress";
import { Tag } from "@/components/Tag";
import { getChecklistById, getPassportById } from "@/data/selectors";
import { useAuthUser } from "@/hooks/useAuthUser";
import { configureAmplifyClient } from "@/lib/amplifyClient";
import {
  huntingPassportLabel,
  recordToHuntingChecklist,
  type HuntingChecklistRecord,
  type HuntingPassportRecord
} from "@/lib/huntingChecklistData";
import type { HuntingChecklist } from "@/types";

type DetailState = "loading" | "saved" | "demo" | "missing";

export function HuntingReadinessDetail({ checklistId }: { checklistId?: string }) {
  const client = useMemo(() => {
    configureAmplifyClient();
    return generateClient<Schema>();
  }, []);
  const { authState } = useAuthUser();
  const [state, setState] = useState<DetailState>("loading");
  const [record, setRecord] = useState<HuntingChecklistRecord | null>(null);
  const [passport, setPassport] = useState<HuntingPassportRecord | null>(null);
  const [error, setError] = useState("");

  const loadChecklist = useCallback(async () => {
    setError("");

    if (!checklistId) {
      setRecord(null);
      setPassport(null);
      setError("Missing record ID.");
      setState("missing");
      return;
    }

    const demoChecklist = getChecklistById(checklistId);

    if (demoChecklist) {
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
        const result = await client.models.HuntingChecklist.get({ id: checklistId });

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
        console.error("Unable to load saved Hunting Readiness checklist", detailError);
        setError("This saved record could not be loaded.");
      }
    }

    setRecord(null);
    setPassport(null);
    setState("missing");
  }, [authState.status, client, checklistId]);

  useEffect(() => {
    const loadInitialState = window.setTimeout(() => {
      void loadChecklist();
    }, 0);

    window.addEventListener("unifiedrange-auth-change", loadChecklist);

    return () => {
      window.clearTimeout(loadInitialState);
      window.removeEventListener("unifiedrange-auth-change", loadChecklist);
    };
  }, [loadChecklist]);

  if (state === "loading") {
    return <p className="rounded-md border border-ink/10 bg-white p-4 text-sm text-ink/65 shadow-soft">Loading Hunting Readiness checklist...</p>;
  }

  if (state === "missing") {
    return (
      <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <h2 className="text-xl font-bold text-ink">Hunting Readiness checklist not found</h2>
        <p className="mt-2 text-sm leading-6 text-ink/70">{error || "This Hunting Readiness checklist is not available for the current signed-in account or demo data set."}</p>
        <Link href="/readiness" className="mt-4 inline-flex rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
          Back to Hunting Readiness
        </Link>
      </section>
    );
  }

  const checklist = state === "saved" && record ? recordToHuntingChecklist(record) : getChecklistById(checklistId);

  if (!checklist) {
    return null;
  }

  return (
    <HuntingReadinessDetailContent
      checklist={checklist}
      source={state === "saved" ? "saved" : "demo"}
      equipmentSummary={passport ? huntingPassportLabel(passport) : undefined}
    />
  );
}

function HuntingReadinessDetailContent({
  checklist,
  source,
  equipmentSummary
}: {
  checklist: HuntingChecklist;
  source: "saved" | "demo";
  equipmentSummary?: string;
}) {
  const passport = source === "demo" ? getPassportById(checklist.equipmentPassportId) : undefined;
  const progress = getReadinessProgress(checklist);

  return (
    <section>
      <PageHeader
        eyebrow={source === "saved" ? "Saved Hunting Readiness" : "Demo Hunting Readiness"}
        title={checklist.huntName}
        description="Readiness records are private by default and help organize responsible field preparation."
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/readiness" className="inline-flex justify-center rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink">
              Back to Hunting Readiness
            </Link>
            <Link href={`/readiness/${checklist.id}/edit`} className="inline-flex justify-center rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
              Edit checklist
            </Link>
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
          <div className="mb-4 flex flex-wrap gap-2">
            <Tag>{source === "saved" ? "Saved account data" : "Demo data"}</Tag>
            <Tag>Private record</Tag>
          </div>
          <h3 className="text-xl font-bold text-ink">Overview</h3>
          <dl className="mt-4">
            <DetailRow label="Equipment" value={equipmentSummary ?? passport?.nickname} />
            <DetailRow label="Season" value={checklist.season} />
            <DetailRow label="Species / use case" value={checklist.species} />
            <DetailRow label="Completed" value={`${progress.completed}/${progress.total}`} />
            <DetailRow label="Remaining" value={progress.remaining} />
          </dl>
          <div className="mt-4">
            <ReadinessProgress checklist={checklist} />
          </div>
        </article>
        <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
          <h3 className="text-xl font-bold text-ink">Checklist Items</h3>
          <div className="mt-4 grid gap-2">
            {checklist.checklistItems.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-md border border-ink/10 px-3 py-2">
                <span className={`h-3 w-3 rounded-full ${item.isComplete ? "bg-moss" : "bg-clay"}`} />
                <span className="text-sm font-medium text-ink">{item.label}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm leading-6 text-ink/70">{checklist.notes || "No readiness notes recorded."}</p>
        </article>
      </div>
    </section>
  );
}
