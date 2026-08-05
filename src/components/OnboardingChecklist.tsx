"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export interface OnboardingChecklistProgress {
  profileComplete: boolean;
  privacyReviewed: boolean;
  equipmentPassportCount: number;
  projectileCount: number;
  opticCount: number;
  rangeSessionCount: number;
  hasPrivatePhoto: boolean;
  huntingReadinessCount: number;
  publicSnapshotCount: number;
  firstPassportId?: string;
}

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  completed?: boolean;
  optional?: boolean;
  tracked?: boolean;
}

export function OnboardingChecklist({ progress }: { progress: OnboardingChecklistProgress }) {
  const steps = useMemo<OnboardingStep[]>(() => {
    const passportHref = progress.firstPassportId ? `/passports/${progress.firstPassportId}` : "/passports/new";
    const publicPreviewHref = progress.firstPassportId ? `/passports/${progress.firstPassportId}/public-preview` : "/passports/new";

    return [
      {
        id: "profile",
        title: "Complete profile setup",
        description: "Confirm your permanent username and private account profile.",
        href: "/profile/setup",
        actionLabel: "Complete profile",
        completed: progress.profileComplete
      },
      {
        id: "privacy",
        title: "Review privacy settings",
        description: "Review account visibility and sanitized sharing defaults.",
        href: "/settings/privacy",
        actionLabel: "Review privacy",
        completed: progress.privacyReviewed
      },
      {
        id: "passport",
        title: "Create your first Equipment Passport",
        description: "Document a setup privately before linking other records.",
        href: "/passports/new",
        actionLabel: "Create passport",
        completed: progress.equipmentPassportCount > 0
      },
      {
        id: "projectile",
        title: "Add a Projectile / Ammo profile",
        description: "Save the projectile or ammunition details you want to reference.",
        href: "/projectiles/new",
        actionLabel: "Add profile",
        completed: progress.projectileCount > 0
      },
      {
        id: "optic",
        title: "Add an Optic / Sight profile",
        description: "Keep private sight documentation connected to your setup history.",
        href: "/optics/new",
        actionLabel: "Add sight",
        completed: progress.opticCount > 0
      },
      {
        id: "session",
        title: "Log your first Range Session",
        description: "Record practice history using your saved setup records.",
        href: "/sessions/new",
        actionLabel: "Log session",
        completed: progress.rangeSessionCount > 0
      },
      {
        id: "photo",
        title: "Upload a private photo",
        description: "Add an equipment or target photo that remains private to your account.",
        href: passportHref,
        actionLabel: progress.firstPassportId ? "Add private photo" : "Create passport first",
        completed: progress.hasPrivatePhoto
      },
      {
        id: "readiness",
        title: "Create a Hunting Readiness checklist",
        description: "Connect a private preparation checklist to saved equipment.",
        href: "/readiness/new",
        actionLabel: "Create checklist",
        completed: progress.huntingReadinessCount > 0
      },
      {
        id: "publish",
        title: "Publish a sanitized Public Passport Snapshot",
        description: "Optional: preview and publish only the safe setup details you choose.",
        href: publicPreviewHref,
        actionLabel: progress.firstPassportId ? "Open public preview" : "Create passport first",
        completed: progress.publicSnapshotCount > 0,
        optional: true
      },
      {
        id: "discover",
        title: "Browse Discover",
        description: "Explore sanitized public setups. Visits are not tracked.",
        href: "/discover",
        actionLabel: "Browse Discover",
        tracked: false
      }
    ];
  }, [progress]);

  const trackedSteps = steps.filter((step) => step.tracked !== false);
  const completedCount = trackedSteps.filter((step) => step.completed).length;
  const mostlyComplete = completedCount >= 8;
  const [isExpanded, setIsExpanded] = useState(!mostlyComplete);

  return (
    <section className="rounded-md border border-moss/20 bg-white p-5 shadow-soft" aria-labelledby="onboarding-checklist-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-moss">Getting started</p>
          <h3 id="onboarding-checklist-title" className="mt-2 text-xl font-bold text-ink">Build your UnifiedRange workspace</h3>
          <p className="mt-2 text-sm leading-6 text-ink/70">Choose the next step that is useful to you. Publishing is always optional.</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="rounded-md bg-field px-3 py-1 text-sm font-bold text-moss">
            {completedCount}/{trackedSteps.length} complete
          </span>
          <button
            type="button"
            onClick={() => setIsExpanded((current) => !current)}
            aria-expanded={isExpanded}
            aria-controls="onboarding-checklist-steps"
            className="rounded-md border border-ink/15 bg-white px-3 py-1.5 text-sm font-semibold text-ink"
          >
            {isExpanded ? "Collapse" : "Show steps"}
          </button>
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-field" role="progressbar" aria-label="Tracked onboarding progress" aria-valuemin={0} aria-valuemax={trackedSteps.length} aria-valuenow={completedCount}>
        <div className="h-full rounded-full bg-moss transition-all" style={{ width: `${(completedCount / trackedSteps.length) * 100}%` }} />
      </div>
      <p className="mt-2 text-xs leading-5 text-ink/55">Nine milestones are derived from your saved account data. Discover remains a link-only step and is not tracked.</p>

      {isExpanded ? (
        <div id="onboarding-checklist-steps" className="mt-5 grid gap-3 lg:grid-cols-2">
          {steps.map((step) => (
            <article key={step.id} className={`flex min-w-0 flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-start sm:justify-between ${step.completed ? "border-moss/20 bg-field/70" : "border-ink/10 bg-paper"}`}>
              <div className="flex min-w-0 gap-3">
                <span className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${step.completed ? "bg-moss text-white" : step.tracked === false ? "bg-ink/10 text-ink/60" : "border border-ink/20 bg-white text-ink/45"}`} aria-hidden="true">
                  {step.completed ? "✓" : step.tracked === false ? "→" : ""}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-bold text-ink">{step.title}</h4>
                    {step.optional ? <span className="rounded bg-white px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-moss">Optional</span> : null}
                    {step.tracked === false ? <span className="rounded bg-white px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink/55">Not tracked</span> : null}
                  </div>
                  <p className="mt-1 text-sm leading-5 text-ink/65">{step.description}</p>
                </div>
              </div>
              {!step.completed ? (
                <Link href={step.href} className="inline-flex shrink-0 justify-center rounded-md border border-ink/15 bg-white px-3 py-2 text-sm font-semibold text-ink hover:border-moss/40 hover:text-moss">
                  {step.actionLabel}
                </Link>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p id="onboarding-checklist-steps" className="mt-4 rounded-md bg-field px-4 py-3 text-sm leading-6 text-ink/70">
          Your workspace is well underway. Expand the checklist whenever you want to revisit optional or untracked steps.
        </p>
      )}

      <p className="mt-5 rounded-md border border-moss/20 bg-field px-4 py-3 text-sm leading-6 text-ink/70">
        Records are private by default. Public sharing uses sanitized snapshots and is optional. Private equipment and target photos stay private and are not included in public snapshots.
      </p>
    </section>
  );
}
