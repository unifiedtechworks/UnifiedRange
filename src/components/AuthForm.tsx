"use client";

import { confirmSignUp, signIn, signUp } from "aws-amplify/auth";
import type { FormEvent } from "react";
import { useState } from "react";
import { TextField } from "@/components/FormFields";
import { configureAmplifyClient, getAuthErrorMessage, notifyAuthChanged } from "@/lib/amplifyClient";

type AuthMode = "sign-in" | "sign-up" | "confirm";

const passwordHelp = "At least 8 characters with uppercase, lowercase, number, and symbol.";

export function AuthForm() {
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const title = mode === "sign-in" ? "Sign in" : mode === "sign-up" ? "Create account" : "Confirm email";

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
      setSuccess("Signed in successfully.");
    } catch (authError) {
      setError(getAuthErrorMessage(authError));
    } finally {
      setIsSubmitting(false);
    }
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
            className={`rounded px-3 py-2 ${mode === "sign-in" ? "bg-white text-ink shadow-soft" : "text-ink/65"}`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => switchMode("sign-up")}
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
          <TextField
            label="Confirmation code"
            value={confirmationCode}
            required
            inputMode="numeric"
            helper="Use the code sent by Cognito to your email address."
            onChange={setConfirmationCode}
          />
        ) : null}

        {error ? <p className="rounded-md bg-clay/10 px-3 py-2 text-sm font-semibold text-clay">{error}</p> : null}
        {success ? <p className="rounded-md bg-moss/10 px-3 py-2 text-sm font-semibold text-moss">{success}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {isSubmitting ? "Working..." : mode === "sign-up" ? "Create account" : mode === "confirm" ? "Confirm email" : "Sign in"}
        </button>
      </form>

      {mode !== "confirm" ? (
        <p className="mt-4 text-sm leading-6 text-ink/65">
          Product screens remain available with mock data while account-backed records are added later.
        </p>
      ) : (
        <button type="button" onClick={() => switchMode("sign-in")} className="mt-4 text-sm font-semibold text-moss">
          Back to sign in
        </button>
      )}
    </article>
  );
}
