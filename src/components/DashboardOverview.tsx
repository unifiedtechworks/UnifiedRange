"use client";

import { generateClient } from "aws-amplify/data";
import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { HuntingChecklistCard } from "@/components/HuntingChecklistCard";
import { MaintenanceCard } from "@/components/MaintenanceCard";
import { PageHeader } from "@/components/PageHeader";
import { PassportCard } from "@/components/PassportCard";
import { SessionCard } from "@/components/SessionCard";
import { StatCard } from "@/components/StatCard";
import { equipmentPassports, huntingChecklists, maintenanceEntries, optics, projectiles, rangeSessions } from "@/data/mockData";
import { useAuthUser } from "@/hooks/useAuthUser";
import { configureAmplifyClient, getAuthErrorMessage, isAuthTokenClearedError } from "@/lib/amplifyClient";
import { recordToEquipmentPassport, type EquipmentPassportRecord } from "@/lib/equipmentPassportData";
import { huntingPassportLabel, recordToHuntingChecklist, type HuntingChecklistRecord } from "@/lib/huntingChecklistData";
import { maintenancePassportLabel, recordToMaintenanceLogEntry, type MaintenanceLogEntryRecord } from "@/lib/maintenanceLogData";
import { recordToOpticSightProfile, type OpticSightProfileRecord } from "@/lib/opticSightProfileData";
import { recordToProjectileProfile, type ProjectileProfileRecord } from "@/lib/projectileProfileData";
import {
  equipmentPassportLabel,
  projectileProfileLabel,
  recordToRangeSession,
  type RangeSessionRecord
} from "@/lib/rangeSessionData";
import type { EquipmentPassport, HuntingChecklist, MaintenanceLogEntry, OpticSightProfile, ProjectileProfile, RangeSession } from "@/types";

type DashboardState = "loading" | "signed-out" | "ready";

interface SavedDashboardData {
  passports: EquipmentPassport[];
  projectiles: ProjectileProfile[];
  optics: OpticSightProfile[];
  sessions: RangeSession[];
  maintenance: MaintenanceLogEntry[];
  checklists: HuntingChecklist[];
}

const emptySavedData: SavedDashboardData = {
  passports: [],
  projectiles: [],
  optics: [],
  sessions: [],
  maintenance: [],
  checklists: []
};

const quickActions = [
  { href: "/passports/new", label: "Add Equipment Passport" },
  { href: "/projectiles/new", label: "Add Projectile / Ammo" },
  { href: "/optics/new", label: "Add Optic / Sight" },
  { href: "/sessions/new", label: "Log Range Session" },
  { href: "/maintenance/new", label: "Add Maintenance" },
  { href: "/readiness/new", label: "Create Hunting Readiness Checklist" }
];

function sortByDateDesc<T extends { date?: string; createdAt?: string; updatedAt?: string }>(items: T[]) {
  return [...items].sort((a, b) => {
    const aTime = new Date(`${a.date ?? a.updatedAt ?? a.createdAt ?? ""}`).getTime();
    const bTime = new Date(`${b.date ?? b.updatedAt ?? b.createdAt ?? ""}`).getTime();
    return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
  });
}

function getOpenChecklistItems(checklists: HuntingChecklist[]) {
  return checklists.flatMap((checklist) => checklist.checklistItems).filter((item) => !item.isComplete).length;
}

function getPassportSummary(passports: EquipmentPassport[], passportId: string, label: "session" | "maintenance" | "readiness") {
  const passport = passports.find((item) => item.id === passportId);

  if (!passport) {
    return undefined;
  }

  if (label === "session") {
    return equipmentPassportLabel(passport);
  }

  if (label === "maintenance") {
    return maintenancePassportLabel(passport);
  }

  return huntingPassportLabel(passport);
}

function getProjectileSummary(projectiles: ProjectileProfile[], projectileId?: string) {
  const projectile = projectiles.find((item) => item.id === projectileId);
  return projectile ? projectileProfileLabel(projectile) : undefined;
}

export function DashboardOverview() {
  const client = useMemo(() => {
    configureAmplifyClient();
    return generateClient<Schema>();
  }, []);
  const { authState } = useAuthUser();
  const [state, setState] = useState<DashboardState>("loading");
  const [savedData, setSavedData] = useState<SavedDashboardData>(emptySavedData);
  const [error, setError] = useState("");
  const requestIdRef = useRef(0);

  const loadDashboard = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setError("");

    if (authState.status === "loading") {
      setState("loading");
      return;
    }

    if (authState.status !== "signed-in") {
      setSavedData(emptySavedData);
      setState("signed-out");
      return;
    }

    try {
      const [passportResult, projectileResult, opticResult, sessionResult, maintenanceResult, checklistResult] = await Promise.all([
        client.models.EquipmentPassport.list({ filter: { ownerId: { eq: authState.username } } }),
        client.models.ProjectileProfile.list({ filter: { ownerId: { eq: authState.username } } }),
        client.models.OpticSightProfile.list({ filter: { ownerId: { eq: authState.username } } }),
        client.models.RangeSession.list({ filter: { ownerId: { eq: authState.username } } }),
        client.models.MaintenanceLogEntry.list({ filter: { ownerId: { eq: authState.username } } }),
        client.models.HuntingChecklist.list({ filter: { ownerId: { eq: authState.username } } })
      ]);

      const errors = [
        ...(passportResult.errors ?? []),
        ...(projectileResult.errors ?? []),
        ...(opticResult.errors ?? []),
        ...(sessionResult.errors ?? []),
        ...(maintenanceResult.errors ?? []),
        ...(checklistResult.errors ?? [])
      ];

      if (errors.length) {
        throw new Error(errors.map((item) => item.message).join(" "));
      }

      if (requestId !== requestIdRef.current) {
        return;
      }

      setSavedData({
        passports: passportResult.data.map((record: EquipmentPassportRecord) => recordToEquipmentPassport(record)),
        projectiles: projectileResult.data.map((record: ProjectileProfileRecord) => recordToProjectileProfile(record)),
        optics: opticResult.data.map((record: OpticSightProfileRecord) => recordToOpticSightProfile(record)),
        sessions: sessionResult.data.map((record: RangeSessionRecord) => recordToRangeSession(record)),
        maintenance: maintenanceResult.data.map((record: MaintenanceLogEntryRecord) => recordToMaintenanceLogEntry(record)),
        checklists: checklistResult.data.map((record: HuntingChecklistRecord) => recordToHuntingChecklist(record))
      });
      setState("ready");
    } catch (dashboardError) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      setSavedData(emptySavedData);

      if (isAuthTokenClearedError(dashboardError)) {
        setState("signed-out");
        setError("");
        return;
      }

      setState("ready");
      setError(getAuthErrorMessage(dashboardError));
    }
  }, [authState, client]);

  useEffect(() => {
    const loadInitialState = window.setTimeout(() => {
      void loadDashboard();
    }, 0);

    window.addEventListener("unifiedrange-auth-change", loadDashboard);

    return () => {
      window.clearTimeout(loadInitialState);
      window.removeEventListener("unifiedrange-auth-change", loadDashboard);
    };
  }, [loadDashboard]);

  if (state === "loading") {
    return (
      <DashboardShell eyebrow="Checking account" title="Loading your dashboard" description="UnifiedRange is checking for saved account-backed records.">
        <p className="rounded-md border border-ink/10 bg-white p-4 text-sm text-ink/65 shadow-soft">Loading dashboard summaries...</p>
      </DashboardShell>
    );
  }

  if (state === "signed-out") {
    return <DashboardContent data={getDemoDashboardData()} mode="demo" />;
  }

  return <DashboardContent data={savedData} mode="saved" error={error} />;
}

function getDemoDashboardData(): SavedDashboardData {
  return {
    passports: equipmentPassports,
    projectiles,
    optics,
    sessions: rangeSessions,
    maintenance: maintenanceEntries,
    checklists: huntingChecklists
  };
}

function DashboardShell({
  eyebrow,
  title,
  description,
  children
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        action={
          <Link href="/passports" className="inline-flex rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
            View passports
          </Link>
        }
      />
      {children}
    </section>
  );
}

function DashboardContent({ data, mode, error }: { data: SavedDashboardData; mode: "saved" | "demo"; error?: string }) {
  const isDemo = mode === "demo";
  const openChecklistItems = getOpenChecklistItems(data.checklists);
  const recentSessions = sortByDateDesc(data.sessions).slice(0, 3);
  const recentMaintenance = sortByDateDesc(data.maintenance).slice(0, 3);
  const recentChecklists = sortByDateDesc(data.checklists).slice(0, 3);
  const hasSavedRecords = Object.values(data).some((items) => items.length > 0);

  return (
    <DashboardShell
      eyebrow={isDemo ? "Demo dashboard" : "Saved account dashboard"}
      title={isDemo ? "Demo range logbook and setup passport" : "Your saved range logbook and setup passport"}
      description={
        isDemo
          ? "You are viewing clearly labeled demo data. Sign in to save your own private records."
          : "These summaries are loaded from your owner-scoped AppSync records and remain private by default."
      }
    >
      {isDemo ? (
        <section className="mb-6 rounded-md border border-ink/10 bg-white p-4 shadow-soft">
          <p className="text-sm leading-6 text-ink/70">Demo data is visible while signed out so the app remains browsable.</p>
          <Link href="/auth/sign-in" className="mt-3 inline-flex rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
            Sign in to save your own records
          </Link>
        </section>
      ) : null}

      {error ? <p className="mb-6 rounded-md border border-clay/30 bg-clay/10 p-4 text-sm font-semibold text-clay">{error}</p> : null}

      {!isDemo && !hasSavedRecords ? (
        <section className="mb-6 rounded-md border border-ink/10 bg-white p-4 shadow-soft">
          <h3 className="text-lg font-bold text-ink">No saved account records yet</h3>
          <p className="mt-2 text-sm leading-6 text-ink/70">Use the quick actions below to create your first saved Equipment Passport, Range Session, Maintenance record, or Hunting Readiness checklist.</p>
        </section>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Equipment Passports" value={String(data.passports.length)} helper={isDemo ? "Demo setup records." : "Saved private setup records."} />
        <StatCard label="Projectiles / Ammo" value={String(data.projectiles.length)} helper={isDemo ? "Demo projectile and ammo profiles." : "Saved projectile, ammo, and future archery profiles."} />
        <StatCard label="Optics / Sights" value={String(data.optics.length)} helper={isDemo ? "Demo sight profiles." : "Saved optic and sight documentation."} />
        <StatCard label="Range Sessions" value={String(data.sessions.length)} helper={isDemo ? "Demo range logs." : "Saved historical practice records."} />
        <StatCard label="Maintenance entries" value={String(data.maintenance.length)} helper={isDemo ? "Demo private care records." : "Saved private equipment care records."} />
        <StatCard label="Hunting Readiness" value={String(data.checklists.length)} helper={`${openChecklistItems} checklist items remaining.`} />
      </div>

      <section className="mt-8 rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <h3 className="text-xl font-bold text-ink">Quick Actions</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {quickActions.map((action) => (
            <Link key={action.href} href={action.href} className="inline-flex justify-center rounded-md border border-ink/10 bg-paper px-4 py-3 text-sm font-semibold text-ink transition hover:border-moss/40 hover:text-moss">
              {action.label}
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xl font-bold text-ink">{isDemo ? "Demo Equipment Passports" : "Saved Equipment Passports"}</h3>
            <Link href="/passports" className="text-sm font-semibold text-moss">
              See all
            </Link>
          </div>
          {data.passports.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {data.passports.slice(0, 4).map((passport) => (
                <PassportCard key={passport.id} passport={passport} sourceLabel={isDemo ? "Demo data" : "Saved account data"} />
              ))}
            </div>
          ) : (
            <EmptyDashboardCard href="/passports/new" label="No saved Equipment Passports yet." action="Add Equipment Passport" />
          )}
        </section>

        <div className="space-y-6">
          <RecentSessions sessions={recentSessions} passports={data.passports} projectiles={data.projectiles} isDemo={isDemo} />
          <RecentMaintenance entries={recentMaintenance} passports={data.passports} isDemo={isDemo} />
          <RecentReadiness checklists={recentChecklists} passports={data.passports} isDemo={isDemo} />
        </div>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
          <h3 className="text-xl font-bold text-ink">Public Sharing Reminder</h3>
          <p className="mt-2 text-sm leading-6 text-ink/70">
            Public Passport sharing should happen only after preview. Keep serial numbers, exact locations, private purchase details, and sensitive personal info out of public snapshots.
          </p>
          <Link href="/discover" className="mt-4 inline-flex rounded-md border border-ink/15 bg-white px-3 py-2 text-sm font-semibold text-ink">
            Review Discover
          </Link>
        </section>
        <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
          <h3 className="text-xl font-bold text-ink">Privacy-First Reminder</h3>
          <p className="mt-2 text-sm leading-6 text-ink/70">
            Account-backed records are private by default. Public discovery and publishing remain separate review flows.
          </p>
          <Link href="/settings/privacy" className="mt-4 inline-flex rounded-md border border-ink/15 bg-white px-3 py-2 text-sm font-semibold text-ink">
            Privacy settings
          </Link>
        </section>
      </div>
    </DashboardShell>
  );
}

function EmptyDashboardCard({ href, label, action }: { href: string; label: string; action: string }) {
  return (
    <div className="rounded-md border border-ink/10 bg-white p-4 text-sm leading-6 text-ink/70 shadow-soft">
      <p>{label}</p>
      <Link href={href} className="mt-3 inline-flex rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
        {action}
      </Link>
    </div>
  );
}

function RecentSessions({
  sessions,
  passports,
  projectiles,
  isDemo
}: {
  sessions: RangeSession[];
  passports: EquipmentPassport[];
  projectiles: ProjectileProfile[];
  isDemo: boolean;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xl font-bold text-ink">Recent Range Sessions</h3>
        <Link href="/sessions" className="text-sm font-semibold text-moss">
          Open log
        </Link>
      </div>
      <div className="space-y-4">
        {sessions.length > 0 ? (
          sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              sourceLabel={isDemo ? "Demo data" : "Saved account data"}
              equipmentSummary={getPassportSummary(passports, session.equipmentPassportId, "session")}
              projectileSummary={getProjectileSummary(projectiles, session.projectileProfileId)}
            />
          ))
        ) : (
          <EmptyDashboardCard href="/sessions/new" label="No saved Range Sessions yet." action="Log Range Session" />
        )}
      </div>
    </section>
  );
}

function RecentMaintenance({ entries, passports, isDemo }: { entries: MaintenanceLogEntry[]; passports: EquipmentPassport[]; isDemo: boolean }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xl font-bold text-ink">Recent Maintenance</h3>
        <Link href="/maintenance" className="text-sm font-semibold text-moss">
          View all
        </Link>
      </div>
      <div className="space-y-3">
        {entries.length > 0 ? (
          entries.map((entry) => (
            <MaintenanceCard
              key={entry.id}
              entry={entry}
              sourceLabel={isDemo ? "Demo data" : "Saved account data"}
              equipmentSummary={getPassportSummary(passports, entry.equipmentPassportId, "maintenance")}
            />
          ))
        ) : (
          <EmptyDashboardCard href="/maintenance/new" label="No saved Maintenance entries yet." action="Add Maintenance" />
        )}
      </div>
    </section>
  );
}

function RecentReadiness({ checklists, passports, isDemo }: { checklists: HuntingChecklist[]; passports: EquipmentPassport[]; isDemo: boolean }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xl font-bold text-ink">Readiness Progress</h3>
        <Link href="/readiness" className="text-sm font-semibold text-moss">
          Open checklists
        </Link>
      </div>
      <div className="space-y-3">
        {checklists.length > 0 ? (
          checklists.map((checklist) => (
            <HuntingChecklistCard
              key={checklist.id}
              checklist={checklist}
              sourceLabel={isDemo ? "Demo data" : "Saved account data"}
              equipmentSummary={getPassportSummary(passports, checklist.equipmentPassportId, "readiness")}
            />
          ))
        ) : (
          <EmptyDashboardCard href="/readiness/new" label="No saved Hunting Readiness checklists yet." action="Create Checklist" />
        )}
      </div>
    </section>
  );
}
