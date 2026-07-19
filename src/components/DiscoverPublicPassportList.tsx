"use client";

import { generateClient } from "aws-amplify/data";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { PublicPassportCard } from "@/components/PublicPassportCard";
import { sanitizedPublicPassports } from "@/data/publicDiscovery";
import { configureAmplifyClient } from "@/lib/amplifyClient";
import { recordToSanitizedPublicPassport, type PublicPassportSnapshotRecord } from "@/lib/publicPassportSnapshotData";
import type { EquipmentType, SanitizedPublicPassport } from "@/types";

type DiscoverState = "loading" | "ready";

const equipmentTypeOptions: Array<{ value: "" | EquipmentType; label: string }> = [
  { value: "", label: "All equipment" },
  { value: "rifle", label: "Rifle" },
  { value: "pistol", label: "Pistol" },
  { value: "bow", label: "Bow" },
  { value: "crossbow", label: "Crossbow" },
  { value: "shotgun", label: "Shotgun" },
  { value: "other", label: "Other" }
];

interface DiscoverFilters {
  keyword: string;
  equipmentType: "" | EquipmentType;
  manufacturer: string;
  model: string;
  caliberOrCategory: string;
  useCaseTag: string;
}

const emptyFilters: DiscoverFilters = {
  keyword: "",
  equipmentType: "",
  manufacturer: "",
  model: "",
  caliberOrCategory: "",
  useCaseTag: ""
};

function normalize(value?: string) {
  return (value ?? "").trim().toLowerCase();
}

function includesFilter(value: string | undefined, filter: string) {
  const normalizedFilter = normalize(filter);
  return !normalizedFilter || normalize(value).includes(normalizedFilter);
}

function getSearchHaystack(snapshot: SanitizedPublicPassport) {
  return [
    snapshot.title,
    snapshot.equipmentType,
    snapshot.manufacturer,
    snapshot.model,
    snapshot.category,
    snapshot.caliber,
    snapshot.opticOrSightSummary,
    snapshot.projectileSummary,
    snapshot.publicNotes,
    ...snapshot.useCaseTags
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function filterSnapshots(snapshots: SanitizedPublicPassport[], filters: DiscoverFilters) {
  const keyword = normalize(filters.keyword);

  return snapshots.filter((snapshot) => {
    const caliberOrCategory = `${snapshot.caliber ?? ""} ${snapshot.category ?? ""}`;
    const matchesTag = !filters.useCaseTag || snapshot.useCaseTags.some((tag) => normalize(tag) === normalize(filters.useCaseTag));

    return (
      (!keyword || getSearchHaystack(snapshot).includes(keyword)) &&
      (!filters.equipmentType || snapshot.equipmentType === filters.equipmentType) &&
      includesFilter(snapshot.manufacturer, filters.manufacturer) &&
      includesFilter(snapshot.model, filters.model) &&
      includesFilter(caliberOrCategory, filters.caliberOrCategory) &&
      matchesTag
    );
  });
}

function getAvailableTags(snapshots: SanitizedPublicPassport[]) {
  return [...new Set(snapshots.flatMap((snapshot) => snapshot.useCaseTags).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function hasActiveFilters(filters: DiscoverFilters) {
  return Object.values(filters).some((value) => Boolean(value));
}

export function DiscoverPublicPassportList() {
  const client = useMemo(() => {
    configureAmplifyClient();
    return generateClient<Schema>();
  }, []);
  const [state, setState] = useState<DiscoverState>("loading");
  const [records, setRecords] = useState<PublicPassportSnapshotRecord[]>([]);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<DiscoverFilters>(emptyFilters);

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
      console.warn("Unable to load public snapshots", loadError);
      setError("Public setup snapshots are unavailable right now. Demo discovery data remains available.");
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
  const visibleSnapshots = showDemo ? sanitizedPublicPassports : publicSnapshots;
  const filteredSnapshots = filterSnapshots(visibleSnapshots, filters);
  const availableTags = getAvailableTags(visibleSnapshots);
  const activeFilters = hasActiveFilters(filters);

  function updateFilter<Key extends keyof DiscoverFilters>(key: Key, value: DiscoverFilters[Key]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

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

      <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-ink">Search Public Setups</h2>
            <p className="mt-1 text-sm leading-6 text-ink/65">
              Filters search sanitized public snapshot fields only. Private notes, image keys, target photos, maintenance, readiness, purchase details, lot numbers, and exact locations are not included.
            </p>
          </div>
          {activeFilters ? (
            <button type="button" onClick={() => setFilters(emptyFilters)} className="w-fit rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink">
              Reset filters
            </button>
          ) : null}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FilterInput label="Keyword search" value={filters.keyword} placeholder="Search setup notes, tags, summaries" onChange={(value) => updateFilter("keyword", value)} />
          <label className="block">
            <span className="text-sm font-semibold text-ink">Equipment type</span>
            <select
              value={filters.equipmentType}
              onChange={(event) => updateFilter("equipmentType", event.target.value as DiscoverFilters["equipmentType"])}
              className="mt-2 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-moss"
            >
              {equipmentTypeOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <FilterInput label="Manufacturer" value={filters.manufacturer} placeholder="e.g. Tikka" onChange={(value) => updateFilter("manufacturer", value)} />
          <FilterInput label="Model" value={filters.model} placeholder="e.g. T3x" onChange={(value) => updateFilter("model", value)} />
          <FilterInput label="Caliber / category" value={filters.caliberOrCategory} placeholder="e.g. 6.5 or elk" onChange={(value) => updateFilter("caliberOrCategory", value)} />
          <label className="block">
            <span className="text-sm font-semibold text-ink">Use case tag</span>
            <select
              value={filters.useCaseTag}
              onChange={(event) => updateFilter("useCaseTag", event.target.value)}
              className="mt-2 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-moss"
            >
              <option value="">All use cases</option>
              {availableTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {state === "ready" && filteredSnapshots.length === 0 ? (
        <section className="rounded-md border border-ink/10 bg-white p-5 text-center shadow-soft">
          <h2 className="text-xl font-bold text-ink">No public setups match your filters.</h2>
          <p className="mt-2 text-sm leading-6 text-ink/70">Try a broader keyword, remove a specific field filter, or reset filters to view all public setup snapshots.</p>
          <button type="button" onClick={() => setFilters(emptyFilters)} className="mt-4 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
            Reset filters
          </button>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {filteredSnapshots.map((snapshot) => (
          <PublicPassportCard key={snapshot.id} snapshot={snapshot} sourceLabel={showDemo ? "Demo data" : "Public snapshot"} />
        ))}
      </div>
    </div>
  );
}

function FilterInput({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-moss"
      />
    </label>
  );
}
