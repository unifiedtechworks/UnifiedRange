"use client";

import { generateClient } from "aws-amplify/data";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { DetailRow } from "@/components/DetailRow";
import { PageHeader } from "@/components/PageHeader";
import { Tag } from "@/components/Tag";
import { getProjectileById } from "@/data/selectors";
import { configureAmplifyClient } from "@/lib/amplifyClient";
import { recordToProjectileProfile, type ProjectileProfileRecord } from "@/lib/projectileProfileData";
import type { ProjectileProfile } from "@/types";
import { useAuthUser } from "@/hooks/useAuthUser";

type DetailState = "loading" | "saved" | "demo" | "missing";

export function ProjectileProfileDetail({ projectileId }: { projectileId?: string }) {
  const client = useMemo(() => {
    configureAmplifyClient();
    return generateClient<Schema>();
  }, []);
  const { authState } = useAuthUser();
  const [state, setState] = useState<DetailState>("loading");
  const [record, setRecord] = useState<ProjectileProfileRecord | null>(null);
  const [error, setError] = useState("");

  const loadProjectile = useCallback(async () => {
    setError("");

    if (!projectileId) {
      setRecord(null);
      setError("Missing record ID.");
      setState("missing");
      return;
    }

    const demoProjectile = getProjectileById(projectileId);

    if (demoProjectile) {
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
        const result = await client.models.ProjectileProfile.get({ id: projectileId });

        if (result.errors?.length) {
          throw new Error(result.errors.map((item) => item.message).join(" "));
        }

        if (result.data) {
          setRecord(result.data);
          setState("saved");
          return;
        }
      } catch (detailError) {
        console.error("Unable to load saved Projectile / Ammo profile", detailError);
        setError("This saved record could not be loaded.");
      }
    }

    setRecord(null);
    setState("missing");
  }, [authState.status, client, projectileId]);

  useEffect(() => {
    const loadInitialState = window.setTimeout(() => {
      void loadProjectile();
    }, 0);

    window.addEventListener("unifiedrange-auth-change", loadProjectile);

    return () => {
      window.clearTimeout(loadInitialState);
      window.removeEventListener("unifiedrange-auth-change", loadProjectile);
    };
  }, [loadProjectile]);

  if (state === "loading") {
    return <p className="rounded-md border border-ink/10 bg-white p-4 text-sm text-ink/65 shadow-soft">Loading Projectile / Ammo profile...</p>;
  }

  if (state === "missing") {
    return (
      <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <h2 className="text-xl font-bold text-ink">Projectile profile not found</h2>
        <p className="mt-2 text-sm leading-6 text-ink/70">{error || "This Projectile / Ammo profile is not available for the current signed-in account or demo data set."}</p>
        <Link href="/projectiles" className="mt-4 inline-flex rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
          Back to Projectiles / Ammo
        </Link>
      </section>
    );
  }

  const projectile = state === "saved" && record ? recordToProjectileProfile(record) : getProjectileById(projectileId);

  if (!projectile) {
    return null;
  }

  return <ProjectileDetailContent projectile={projectile} source={state === "saved" ? "saved" : "demo"} />;
}

function ProjectileDetailContent({ projectile, source }: { projectile: ProjectileProfile; source: "saved" | "demo" }) {
  return (
    <section>
      <PageHeader
        eyebrow={source === "saved" ? "Saved Projectile / Ammo" : "Demo Projectile / Ammo"}
        title={projectile.productLine}
        description={projectile.publicNotes ?? "Private projectile profile notes."}
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/projectiles" className="inline-flex justify-center rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink">
              Back to Projectiles / Ammo
            </Link>
            <Link href={`/projectiles/${projectile.id}/edit`} className="inline-flex justify-center rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
              Edit profile
            </Link>
          </div>
        }
      />
      <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <div className="flex flex-wrap gap-2">
          <Tag>{source === "saved" ? "Saved account data" : "Demo data"}</Tag>
          <Tag>{projectile.projectileType}</Tag>
          <Tag>{projectile.caliber ?? "category pending"}</Tag>
        </div>
        <p className="mt-4 rounded-md bg-field px-3 py-2 text-sm leading-6 text-ink/70">
          Lot number, purchase count, remaining inventory, and private notes are treated as private account data by default.
        </p>
        <dl className="mt-5 grid gap-x-6 md:grid-cols-2">
          <DetailRow label="Manufacturer" value={projectile.manufacturer} />
          <DetailRow label="Product line" value={projectile.productLine} />
          <DetailRow label="Caliber / category" value={projectile.caliber} />
          <DetailRow label="Bullet weight" value={projectile.bulletWeight} />
          <DetailRow label="Bullet type" value={projectile.bulletType} />
          <DetailRow label="Lot number" value={projectile.lotNumber ? "Private record exists" : "Not recorded"} />
          <DetailRow label="Purchased" value={projectile.roundsPurchased} />
          <DetailRow label="Remaining" value={projectile.roundsRemaining} />
          <DetailRow label="Arrow shaft" value={projectile.arrowShaft} />
          <DetailRow label="Arrow spine" value={projectile.arrowSpine} />
          <DetailRow label="Point / broadhead" value={projectile.pointOrBroadhead} />
          <DetailRow label="Fletching" value={projectile.fletching} />
          <DetailRow label="Total weight" value={projectile.totalWeight} />
        </dl>
      </article>
    </section>
  );
}
