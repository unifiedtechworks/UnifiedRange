"use client";

import { generateClient } from "aws-amplify/data";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { PublicPassportCard } from "@/components/PublicPassportCard";
import { sanitizedPublicPassports } from "@/data/publicDiscovery";
import { configureAmplifyClient, getAuthErrorMessage } from "@/lib/amplifyClient";
import { recordToSanitizedPublicPassport, type PublicPassportSnapshotRecord } from "@/lib/publicPassportSnapshotData";

type DiscoverState = "loading" | "ready";

export function DiscoverPublicPassportList() {
  const client = useMemo(() => {
    configureAmplifyClient();
    return generateClient<Schema>();
  }, []);
  const [state, setState] = useState<DiscoverState>("loading");
  const [records, setRecords] = useState<PublicPassportSnapshotRecord[]>([]);
  const [error, setError] = useState("");

  const loadPublicSnapshots = useCallback(async () => {
    setError("");
    setState("loading");

    try {
      const result = await client.models.PublicPassportSnapshot.list({ authMode: "apiKey" });

      if (result.errors?.length) {
        throw new Error(result.errors.map((item) => item.message).join(" "));
      }

      setRecords(result.data);
    } catch (loadError) {
      console.error("Unable to load public snapshots", loadError);
      setError(getAuthErrorMessage(loadError));
      setRecords([]);
    } finally {
      setState("ready");
    }
  }, [client]);

  useEffect(() => {
    const loadInitialState = window.setTimeout(() => {
      void loadPublicSnapshots();
    }, 0);

    return () => {
      window.clearTimeout(loadInitialState);
    };
  }, [loadPublicSnapshots]);

  const publicSnapshots = records.map(recordToSanitizedPublicPassport);
  const showDemo = state === "ready" && publicSnapshots.length === 0;

  return (
    <div className="space-y-6">
      {state === "loading" ? <p className="rounded-md border border-ink/10 bg-white p-4 text-sm text-ink/65 shadow-soft">Loading public setup snapshots...</p> : null}
      {error ? <p className="rounded-md border border-clay/30 bg-clay/10 p-4 text-sm font-semibold text-clay">{error}</p> : null}

      {showDemo ? (
        <section className="rounded-md border border-ink/10 bg-white p-4 shadow-soft">
          <h2 className="text-lg font-bold text-ink">Demo Discovery Data</h2>
          <p className="mt-2 text-sm leading-6 text-ink/70">No account-backed public snapshots are available yet, so Discover is showing clearly labeled demo setup snapshots.</p>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {(showDemo ? sanitizedPublicPassports : publicSnapshots).map((snapshot) => (
          <PublicPassportCard key={snapshot.id} snapshot={snapshot} sourceLabel={showDemo ? "Demo data" : "Public snapshot"} />
        ))}
      </div>
    </div>
  );
}
