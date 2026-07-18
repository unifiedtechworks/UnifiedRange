"use client";

import { confirmSignUp, signIn, signOut, signUp } from "aws-amplify/auth";
import Link from "next/link";
import type { FormEvent } from "react";
import { useState } from "react";
import { TextField } from "@/components/FormFields";
import { configureAmplifyClient, getAuthErrorMessage, notifyAuthChanged } from "@/lib/amplifyClient";
import { refreshSharedAuthState, useAuthUser } from "@/hooks/useAuthUser";

type AuthMode = "sign-in" | "sign-up" | "confirm";

const passwordHelp = "At least 8 characters with uppercase, lowercase, number, and symbol.";

export function AuthForm() {
  const { authState, refreshAuthState } = useAuthUser();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const title = mode === "sign-in" ? "Sign in" : mode === "sign-up" ? "Create account" : "Confirm email";
  const submitLabel = mode === "sign-up" ? "Create account" : mode === "confirm" ? "Confirm email" : "Sign in";
  const submittingLabel = mode === "sign-up" ? "Creating account..." : mode === "confirm" ? "Confirming email..." : "Signing in...";

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError("");
    setSuccess("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      configureAmplifyClient();

      if (mode === "sign-up") {
        const result = await signUp({
          username: email.trim(),
          password,
          options: {
            userAttributes: {
              email: email.trim()
            }
          }
        });

        if (result.nextStep.signUpStep === "CONFIRM_SIGN_UP") {
          setMode("confirm");
          setSuccess("Account created. Check your email for a confirmation code.");
        } else {
          setSuccess("Account created. You can sign in now.");
          setMode("sign-in");
        }

        return;
      }

      if (mode === "confirm") {
        await confirmSignUp({
          username: email.trim(),
          confirmationCode: confirmationCode.trim()
        });
        setSuccess("Email confirmed. You can sign in now.");
        setMode("sign-in");
        return;
      }

      const result = await signIn({
        username: email.trim(),
        password
      });

      if (result.nextStep.signInStep === "CONFIRM_SIGN_UP") {
        setMode("confirm");
        setSuccess("Confirm your email before signing in.");
        return;
      }

      notifyAuthChanged();
      setPassword("");
      setSuccess("Signed in successfully. Your saved account data is available across the wired MVP sections.");
      await refreshSharedAuthState({ showLoading: false });
    } catch (authError) {
      setError(getAuthErrorMessage(authError));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignOut() {
    setIsSigningOut(true);
    setError("");
    setSuccess("");
    setPassword("");

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

  if (authState.status === "signed-in") {
    return (
      <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">Amazon Cognito</p>
          <h3 className="mt-2 text-xl font-bold text-ink">Signed in</h3>
          <p className="mt-3 text-sm leading-6 text-ink/70">You are signed in and can use saved account data across the wired MVP sections.</p>
          <p className="mt-3 text-sm font-semibold text-ink">{authState.label}</p>
          <p className="mt-1 text-xs text-ink/55">Cognito username: {authState.username}</p>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Link href="/dashboard" className="inline-flex justify-center rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink">
            Go to Dashboard
          </Link>
          <Link href="/profile" className="inline-flex justify-center rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink">
            View Profile
          </Link>
          <Link href="/settings" className="inline-flex justify-center rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink">
            View Settings
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="inline-flex justify-center rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSigningOut ? "Signing out..." : "Sign out"}
          </button>
        </div>

        {error ? <p className="mt-4 rounded-md bg-clay/10 px-3 py-2 text-sm font-semibold text-clay">{error}</p> : null}
      </article>
    );
  }

  return (
    <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
      <div className="flex flex-col gap-4 border-b border-ink/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">Amazon Cognito</p>
          <h3 className="mt-2 text-xl font-bold text-ink">{title}</h3>
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-md bg-field p-1 text-sm font-semibold">
          <button
            type="button"
            onClick={() => switchMode("sign-in")}
            disabled={isSubmitting}
            className={`rounded px-3 py-2 ${mode === "sign-in" ? "bg-white text-ink shadow-soft" : "text-ink/65"}`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => switchMode("sign-up")}
            disabled={isSubmitting}
            className={`rounded px-3 py-2 ${mode === "sign-up" ? "bg-white text-ink shadow-soft" : "text-ink/65"}`}
          >
            Sign up
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <TextField label="Email" type="email" value={email} required onChange={setEmail} />

        {mode !== "confirm" ? (
          <TextField
            label="Password"
            type="password"
            value={password}
            helper={mode === "sign-up" ? passwordHelp : undefined}
            required
            onChange={setPassword}
          />
        ) : null}

        {mode === "confirm" ? (
          <>
            <p className="rounded-md bg-field px-3 py-2 text-sm leading-6 text-ink/70">
              Enter the confirmation code sent to your email address, then return to sign in with the confirmed account.
            </p>
            <TextField
              label="Confirmation code"
              value={confirmationCode}
              required
              inputMode="numeric"
              helper="Use the code sent by Cognito to your email address."
              onChange={setConfirmationCode}
            />
          </>
        ) : null}

        {error ? <p className="rounded-md bg-clay/10 px-3 py-2 text-sm font-semibold text-clay">{error}</p> : null}
        {success ? <p className="rounded-md bg-moss/10 px-3 py-2 text-sm font-semibold text-moss">{success}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {isSubmitting ? submittingLabel : submitLabel}
        </button>

      </form>

      {mode !== "confirm" ? (
        <p className="mt-4 text-sm leading-6 text-ink/65">
          Product screens remain available to signed-out visitors with clearly labeled demo data. Sign in to create and manage saved account records.
        </p>
      ) : (
        <button type="button" onClick={() => switchMode("sign-in")} className="mt-4 text-sm font-semibold text-moss">
          Back to sign in
        </button>
      )}
    </article>
  );
}
