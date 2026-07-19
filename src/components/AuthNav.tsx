"use client";

import { signOut } from "aws-amplify/auth";
import Link from "next/link";
import { useState } from "react";
import { configureAmplifyClient, getAuthErrorMessage, notifyAuthChanged } from "@/lib/amplifyClient";
import { useAuthUser } from "@/hooks/useAuthUser";

export function AuthNav({ compact = false }: { compact?: boolean }) {
  const { authState, refreshAuthState } = useAuthUser();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState("");

  async function handleSignOut() {
    setIsSigningOut(true);
    setError("");

    try {
      configureAmplifyClient();
      await signOut();
      await refreshAuthState();
      notifyAuthChanged();
    } catch (signOutError) {
      setError(getAuthErrorMessage(signOutError));
    } finally {
      setIsSigningOut(false);
    }
  }

  if (compact) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        {authState.status === "signed-in" ? (
          <>
            <span className="max-w-36 truncate text-xs font-semibold text-ink/70">{authState.label}</span>
            <Link href="/profile" className="rounded-md border border-ink/15 bg-white px-3 py-1.5 text-xs font-semibold text-ink">
              Profile
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="rounded-md border border-ink/15 bg-white px-3 py-1.5 text-xs font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSigningOut ? "Signing out..." : "Sign out"}
            </button>
          </>
        ) : (
          <Link href="/auth/sign-in" className="rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-white">
            Sign in
          </Link>
        )}
      </div>
    );
  }

  return (
    <section className="mt-auto rounded-md border border-ink/10 bg-field p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">Account</p>
      {authState.status === "loading" ? <p className="mt-2 text-sm font-semibold text-ink">Checking session...</p> : null}
      {authState.status === "signed-in" ? (
        <>
          <p className="mt-2 truncate text-sm font-semibold text-ink">{authState.label}</p>
          <p className="mt-1 truncate text-xs text-ink/55">{authState.username}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link href="/profile" className="inline-flex justify-center rounded-md border border-ink/15 bg-white px-3 py-2 text-sm font-semibold text-ink">
              Profile
            </Link>
            <Link href="/settings" className="inline-flex justify-center rounded-md border border-ink/15 bg-white px-3 py-2 text-sm font-semibold text-ink">
              Settings
            </Link>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="mt-3 w-full rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSigningOut ? "Signing out..." : "Sign out"}
          </button>
        </>
      ) : null}
      {authState.status === "signed-out" ? (
        <>
          <p className="mt-2 text-sm leading-5 text-ink/70">Sign in to save your own records. Demo screens stay available.</p>
          <Link href="/auth/sign-in" className="mt-3 inline-flex w-full justify-center rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white">
            Sign in
          </Link>
        </>
      ) : null}
      {authState.error || error ? <p className="mt-2 text-xs font-semibold text-clay">{error || authState.error}</p> : null}
    </section>
  );
}
