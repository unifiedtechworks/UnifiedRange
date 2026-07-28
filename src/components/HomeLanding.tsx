"use client";

import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { useAuthUser } from "@/hooks/useAuthUser";

const productAreas = [
  {
    title: "Private range logbook",
    description: "Keep range sessions, notes, and private target photos organized in your account."
  },
  {
    title: "Equipment Passports",
    description: "Document equipment, projectiles, sights, maintenance history, and setup context."
  },
  {
    title: "Hunting Readiness",
    description: "Keep private preparation checklists connected to the equipment you plan to use."
  },
  {
    title: "Privacy-first discovery",
    description: "Publish sanitized setup snapshots and browse shared setups without exposing private records or images."
  }
];

export function HomeLanding() {
  const { authState } = useAuthUser();

  if (authState.status === "loading") {
    return (
      <section>
        <PageHeader
          eyebrow="UnifiedRange"
          title="Your setups, sessions, and readiness in one place"
          description="Checking your account before opening UnifiedRange."
        />
        <p className="rounded-md border border-ink/10 bg-white p-4 text-sm text-ink/65 shadow-soft">Loading your workspace...</p>
      </section>
    );
  }

  const isSignedIn = authState.status === "signed-in";

  return (
    <section>
      <PageHeader
        eyebrow="UnifiedRange"
        title={isSignedIn ? "Welcome back" : "A privacy-first range logbook and setup passport"}
        description={
          isSignedIn
            ? "Open your private dashboard, continue documenting a setup, or review sanitized public snapshots."
            : "Document equipment, range sessions, maintenance, and hunting readiness privately. Share only the sanitized setup details you choose."
        }
        action={
          <Link
            href={isSignedIn ? "/dashboard" : "/auth/sign-in"}
            className="inline-flex justify-center rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white"
          >
            {isSignedIn ? "Open Dashboard" : "Sign in"}
          </Link>
        }
      />

      {!isSignedIn ? (
        <div className="mb-6 flex flex-col gap-3 rounded-md border border-moss/20 bg-field p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-ink">New to UnifiedRange?</h2>
            <p className="mt-1 text-sm leading-6 text-ink/70">Create an account from the sign-in page, or browse public and clearly labeled sample content first.</p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <Link href="/auth/sign-in?mode=sign-up" className="inline-flex justify-center rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
              Create account
            </Link>
            <Link href="/discover" className="inline-flex justify-center rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink">
              Browse Discover
            </Link>
          </div>
        </div>
      ) : (
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <HomeAction href="/dashboard" label="Dashboard" />
          <HomeAction href="/profile" label="My Profile" />
          <HomeAction href="/discover" label="Discover" />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {productAreas.map((area) => (
          <article key={area.title} className="min-w-0 rounded-md border border-ink/10 bg-white p-5 shadow-soft">
            <h2 className="text-xl font-bold text-ink">{area.title}</h2>
            <p className="mt-2 break-words text-sm leading-6 text-ink/70">{area.description}</p>
          </article>
        ))}
      </div>

      <article className="mt-6 rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <h2 className="text-xl font-bold text-ink">Private by default</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/70">
          Private records and private image uploads stay in your account. Public profiles and published Equipment Passports use sanitized snapshots that exclude private notes, private images, purchase details, lot numbers, and exact locations.
        </p>
      </article>
    </section>
  );
}

function HomeAction({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex justify-center rounded-md border border-ink/10 bg-white px-4 py-3 text-sm font-semibold text-ink shadow-soft transition hover:border-moss/40 hover:text-moss">
      {label}
    </Link>
  );
}
