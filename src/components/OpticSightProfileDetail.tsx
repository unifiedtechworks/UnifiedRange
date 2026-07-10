"use client";

import { generateClient } from "aws-amplify/data";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { DetailRow } from "@/components/DetailRow";
import { PageHeader } from "@/components/PageHeader";
import { Tag } from "@/components/Tag";
import { getOpticById } from "@/data/selectors";
import { useAuthUser } from "@/hooks/useAuthUser";
import { configureAmplifyClient } from "@/lib/amplifyClient";
import { recordToOpticSightProfile, type OpticSightProfileRecord } from "@/lib/opticSightProfileData";
import type { OpticSightProfile } from "@/types";

type DetailState = "loading" | "saved" | "demo" | "missing";

export function OpticSightProfileDetail({ opticId }: { opticId?: string }) {
  const client = useMemo(() => {
    configureAmplifyClient();
    return generateClient<Schema>();
  }, []);
  const { authState } = useAuthUser();
  const [state, setState] = useState<DetailState>("loading");
  const [record, setRecord] = useState<OpticSightProfileRecord | null>(null);
  const [error, setError] = useState("");

  const loadOptic = useCallback(async () => {
    setError("");

    if (!opticId) {
      setRecord(null);
      setError("Missing record ID.");
      setState("missing");
      return;
    }

    const demoOptic = getOpticById(opticId);

    if (demoOptic) {
      setRecord(null);
      setState("demo");
      return;
    }

    if (authState.status === "loading") {
      setState("loading");
      return;
    }

    if (authState.status === "signed-in") {
      try {
        const result = await client.models.OpticSightProfile.get({ id: opticId });

        if (result.errors?.length) {
          throw new Error(result.errors.map((item) => item.message).join(" "));
        }

        if (result.data) {
          setRecord(result.data);
          setState("saved");
          return;
        }
      } catch (detailError) {
        console.error("Unable to load saved Optic / Sight profile", detailError);
        setError("This saved record could not be loaded.");
      }
    }

    setRecord(null);
    setState("missing");
  }, [authState.status, client, opticId]);

  useEffect(() => {
    const loadInitialState = window.setTimeout(() => {
      void loadOptic();
    }, 0);

    window.addEventListener("unifiedrange-auth-change", loadOptic);

    return () => {
      window.clearTimeout(loadInitialState);
      window.removeEventListener("unifiedrange-auth-change", loadOptic);
    };
  }, [loadOptic]);

  if (state === "loading") {
    return <p className="rounded-md border border-ink/10 bg-white p-4 text-sm text-ink/65 shadow-soft">Loading Optic / Sight profile...</p>;
  }

  if (state === "missing") {
    return (
      <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <h2 className="text-xl font-bold text-ink">Optic / Sight profile not found</h2>
        <p className="mt-2 text-sm leading-6 text-ink/70">{error || "This Optic / Sight profile is not available for the current signed-in account or demo data set."}</p>
        <Link href="/optics" className="mt-4 inline-flex rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
          Back to Optics / Sights
        </Link>
      </section>
    );
  }

  const optic = state === "saved" && record ? recordToOpticSightProfile(record) : getOpticById(opticId);

  if (!optic) {
    return null;
  }

  return <OpticSightDetailContent optic={optic} source={state === "saved" ? "saved" : "demo"} />;
}

function OpticSightDetailContent({ optic, source }: { optic: OpticSightProfile; source: "saved" | "demo" }) {
  return (
    <section>
      <PageHeader
        eyebrow={source === "saved" ? "Saved Optic / Sight" : "Demo Optic / Sight"}
        title={`${optic.manufacturer} ${optic.model}`}
        description={optic.publicNotes ?? "Sight profile documentation."}
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/optics" className="inline-flex justify-center rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink">
              Back to Optics / Sights
            </Link>
            <Link href={`/optics/${optic.id}/edit`} className="inline-flex justify-center rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
              Edit sight
            </Link>
          </div>
        }
      />
      <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <div className="flex flex-wrap gap-2">
          <Tag>{source === "saved" ? "Saved account data" : "Demo data"}</Tag>
          <Tag>{optic.sightType.replace("_", " ")}</Tag>
        </div>
        <p className="mt-4 max-w-3xl rounded-md bg-field px-3 py-2 text-sm leading-6 text-ink/70">
          UnifiedRange stores optic and sight details for documentation only. It does not calculate or recommend sight changes.
        </p>
        <dl className="mt-5 grid gap-x-6 md:grid-cols-2">
          <DetailRow label="Manufacturer" value={optic.manufacturer} />
          <DetailRow label="Model" value={optic.model} />
          <DetailRow label="Reticle / pin setup" value={optic.reticleOrPinSetup} />
          <DetailRow label="Magnification" value={optic.magnification} />
          <DetailRow label="Sight unit" value={optic.sightUnit} />
          <DetailRow label="Click value" value={optic.clickValue} />
          <DetailRow label="Private notes" value={optic.privateNotes ? "Private record exists" : "Not recorded"} />
        </dl>
      </article>
    </section>
  );
}
