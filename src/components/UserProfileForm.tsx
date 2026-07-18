"use client";

import Link from "next/link";
import { useState } from "react";
import { TextArea, TextField } from "@/components/FormFields";
import {
  defaultUserProfileFormValues,
  privacyDefaultLabel,
  usernameHelper,
  validateUserProfile,
  type UserProfileFormValues
} from "@/lib/userProfileData";

interface UserProfileFormProps {
  mode: "create" | "edit";
  initialValues?: UserProfileFormValues;
  cancelHref: string;
  onSubmit: (values: UserProfileFormValues) => Promise<void>;
}

export function UserProfileForm({ mode, initialValues = defaultUserProfileFormValues, cancelHref, onSubmit }: UserProfileFormProps) {
  const [values, setValues] = useState<UserProfileFormValues>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof UserProfileFormValues, string>>>({});
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function updateField<Key extends keyof UserProfileFormValues>(key: Key, value: UserProfileFormValues[Key]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
    setFormError("");
    setSuccess("");
  }

  async function handleSubmit() {
    const nextErrors = validateUserProfile(values);
    setErrors(nextErrors);
    setFormError("");
    setSuccess("");

    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }

    setIsSaving(true);

    try {
      await onSubmit(values);
      setSuccess(mode === "create" ? "Profile created." : "Profile updated.");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Profile could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      <div className="rounded-md border border-moss/20 bg-field p-4">
        <h3 className="text-base font-bold text-ink">Profile Basics</h3>
        <p className="mt-2 text-sm leading-6 text-ink/70">
          Choose a display name and username for your account. Your private records stay private, and public sharing still requires a separate sanitized publish step.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Display name" value={values.displayName} error={errors.displayName} required onChange={(value) => updateField("displayName", value)} />
        <TextField
          label="Username / handle"
          value={values.username}
          error={errors.username}
          helper={usernameHelper}
          required
          onChange={(value) => updateField("username", value.trim().toLowerCase())}
        />
      </div>

      <TextArea label="Bio" value={values.bio} helper="Optional. Keep personal details minimal." onChange={(value) => updateField("bio", value)} />

      <label className="block">
        <span className="text-sm font-semibold text-ink">Privacy default</span>
        <select
          value={values.privacyDefault}
          onChange={(event) => updateField("privacyDefault", event.target.value as UserProfileFormValues["privacyDefault"])}
          className="mt-2 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-moss"
        >
          <option value="private">{privacyDefaultLabel("private")}</option>
          <option value="public_sanitized">{privacyDefaultLabel("public_sanitized")}</option>
        </select>
      </label>

      <p className="rounded-md border border-ink/10 bg-white px-4 py-3 text-sm leading-6 text-ink/70">
        Username uniqueness is checked only when the current backend allows the app to see matching profiles. A dedicated reservation workflow can be added later if public usernames become a stronger product guarantee.
      </p>

      {formError ? <p className="rounded-md border border-clay/30 bg-clay/10 px-4 py-3 text-sm font-semibold text-clay">{formError}</p> : null}
      {success ? <p className="rounded-md border border-moss/25 bg-field px-4 py-3 text-sm font-semibold text-moss">{success}</p> : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link href={cancelHref} className="inline-flex justify-center rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink">
          Cancel
        </Link>
        <button type="submit" disabled={isSaving} className="inline-flex justify-center rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
          {isSaving ? "Saving..." : mode === "create" ? "Create profile" : "Save profile"}
        </button>
      </div>
    </form>
  );
}
