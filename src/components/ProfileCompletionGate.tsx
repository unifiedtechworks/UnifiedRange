"use client";

import { generateClient } from "aws-amplify/data";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Schema } from "../../amplify/data/resource";
import { useAuthUser } from "@/hooks/useAuthUser";
import { configureAmplifyClient, getAuthErrorMessage } from "@/lib/amplifyClient";
import { isProfileComplete } from "@/lib/userProfileData";

const gatedPrefixes = ["/dashboard", "/passports", "/projectiles", "/optics", "/sessions", "/maintenance", "/readiness"];

type GateState = "checking" | "open" | "setup-required" | "error";

function shouldGatePath(pathname: string) {
  return gatedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function ProfileCompletionGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { authState } = useAuthUser();
  const client = useMemo(() => {
    configureAmplifyClient();
    return generateClient<Schema>();
  }, []);
  const [state, setState] = useState<GateState>("checking");
  const [error, setError] = useState("");

  const checkProfile = useCallback(async () => {
    setError("");

    if (!shouldGatePath(pathname)) {
      setState("open");
      return;
    }

    if (authState.status === "loading") {
      setState("checking");
      return;
    }

    if (authState.status !== "signed-in") {
      setState("open");
      return;
    }

    try {
      const result = await client.models.UserProfile.list({ filter: { ownerId: { eq: authState.username } } });

      if (result.errors?.length) {
        throw new Error(result.errors.map((item) => item.message).join(" "));
      }

      setState(isProfileComplete(result.data[0] ?? null) ? "open" : "setup-required");
    } catch (profileError) {
      setError(getAuthErrorMessage(profileError));
      setState("error");
    }
  }, [authState, client, pathname]);

  useEffect(() => {
    const loadInitialState = window.setTimeout(() => {
      void checkProfile();
    }, 0);

    return () => {
      window.clearTimeout(loadInitialState);
    };
  }, [checkProfile]);

  if (state === "open") {
    return <>{children}</>;
  }

  if (state === "checking") {
    return <p className="rounded-md border border-ink/10 bg-white p-4 text-sm text-ink/65 shadow-soft">Checking profile setup...</p>;
  }

  if (state === "error") {
    return (
      <section className="rounded-md border border-clay/30 bg-clay/10 p-5">
        <h2 className="text-xl font-bold text-ink">Profile setup could not be checked</h2>
        <p className="mt-2 text-sm leading-6 text-clay">{error || "Try refreshing before using saved account workflows."}</p>
      </section>
    );
  }

  return (
    <section className="rounded-md border border-moss/20 bg-white p-5 shadow-soft">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">Profile setup</p>
      <h2 className="mt-2 text-2xl font-bold text-ink">Complete your profile</h2>
      <p className="mt-3 text-sm leading-6 text-ink/70">
        Choose your permanent username before creating or editing saved account records. Public Discover and signed-out demo browsing remain available without this step.
      </p>
      <Link href="/profile/setup" className="mt-4 inline-flex rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
        Continue setup
      </Link>
    </section>
  );
}
