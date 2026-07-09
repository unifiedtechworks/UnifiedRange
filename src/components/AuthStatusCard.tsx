"use client";

import Link from "next/link";
import { signOut } from "aws-amplify/auth";
import { useState } from "react";
import { configureAmplifyClient, getAmplifyClientMessage, getAuthErrorMessage, notifyAuthChanged } from "@/lib/amplifyClient";
import { useAuthUser } from "@/hooks/useAuthUser";

export function AuthStatusCard() {
  const { authState, refreshAuthState } = useAuthUser();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState("");

  async function handleSignOut() {
    setIsSigningOut(true);
    setError("");

    try {
      configureAmplifyClient();
      await signOut();
      notifyAuthChanged();
      await refreshAuthState();
    } catch (signOutError) {
      setError(getAuthErrorMessage(signOutError));
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">Cognito auth</p>
          <h3 className="mt-2 text-xl font-bold text-ink">
            {authState.status === "signed-in" ? "Signed in" : authState.status === "loading" ? "Checking session" : "Signed out"}
          </h3>
          <p className="mt-3 text-sm leading-6 text-ink/70">{getAmplifyClientMessage()}</p>
          <p className="mt-3 text-sm font-semibold text-ink">{authState.label}</p>
          {authState.status === "signed-in" ? <p className="mt-1 text-xs text-ink/55">Cognito username: {authState.username}</p> : null}
          {authState.error ? <p className="mt-3 rounded-md bg-clay/10 px-3 py-2 text-sm font-semibold text-clay">{authState.error}</p> : null}
          {error ? <p className="mt-3 rounded-md bg-clay/10 px-3 py-2 text-sm font-semibold text-clay">{error}</p> : null}
        </div>
        <span className="w-fit rounded-md bg-field px-3 py-1 text-xs font-semibold text-ink">
          {authState.status === "signed-in" ? "Active session" : "Mock screens available"}
        </span>
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        {authState.status === "signed-in" ? (
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="inline-flex justify-center rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSigningOut ? "Signing out..." : "Sign out"}
          </button>
        ) : (
          <Link href="/auth/sign-in" className="inline-flex justify-center rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
            Sign in
          </Link>
        )}
      </div>
    </article>
  );
}
