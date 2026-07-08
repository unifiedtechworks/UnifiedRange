"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { FormEvent, HTMLAttributes, ReactNode } from "react";
import type { EquipmentType } from "@/types";

export interface PassportFormValues {
  equipmentType: EquipmentType;
  nickname: string;
  manufacturer: string;
  model: string;
  caliberCategory: string;
  opticSightSummary: string;
  projectileAmmoSummary: string;
  useCaseTags: string;
  roundOrShotCount: string;
  privateNotes: string;
  publicNotes: string;
  isPublic: boolean;
}

interface PassportFormProps {
  mode: "create" | "edit";
  initialValues?: Partial<PassportFormValues>;
  cancelHref: string;
}

const defaultValues: PassportFormValues = {
  equipmentType: "rifle",
  nickname: "",
  manufacturer: "",
  model: "",
  caliberCategory: "",
  opticSightSummary: "",
  projectileAmmoSummary: "",
  useCaseTags: "",
  roundOrShotCount: "0",
  privateNotes: "",
  publicNotes: "",
  isPublic: false
};

const equipmentOptions: { value: EquipmentType; label: string }[] = [
  { value: "rifle", label: "Rifle" },
  { value: "pistol", label: "Pistol" },
  { value: "bow", label: "Bow" },
  { value: "crossbow", label: "Crossbow" },
  { value: "shotgun", label: "Shotgun" },
  { value: "other", label: "Other" }
];

const requiredFields: Array<keyof PassportFormValues> = ["nickname", "manufacturer", "model", "caliberCategory"];

export function PassportForm({ mode, initialValues, cancelHref }: PassportFormProps) {
  const mergedValues = useMemo(() => ({ ...defaultValues, ...initialValues }), [initialValues]);
  const [values, setValues] = useState<PassportFormValues>(mergedValues);
  const [errors, setErrors] = useState<Partial<Record<keyof PassportFormValues, string>>>({});
  const [successMessage, setSuccessMessage] = useState("");

  function updateField<K extends keyof PassportFormValues>(field: K, value: PassportFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSuccessMessage("");
  }

  function validate() {
    const nextErrors: Partial<Record<keyof PassportFormValues, string>> = {};

    requiredFields.forEach((field) => {
      if (!String(values[field]).trim()) {
        nextErrors[field] = "Required";
      }
    });

    const count = Number(values.roundOrShotCount);
    if (values.roundOrShotCount.trim() && (!Number.isFinite(count) || count < 0)) {
      nextErrors.roundOrShotCount = "Use 0 or a positive number";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!validate()) {
      setSuccessMessage("");
      return;
    }

    const payload = {
      ...values,
      useCaseTags: values.useCaseTags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      roundOrShotCount: Number(values.roundOrShotCount || 0)
    };

    console.log(`Passport ${mode} placeholder submit`, payload);
    setSuccessMessage(mode === "create" ? "Draft saved locally for this mock MVP. No backend write occurred." : "Updates saved locally for this mock MVP. No backend write occurred.");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rounded-md border border-moss/20 bg-field p-4">
        <h3 className="text-base font-bold text-ink">Privacy First</h3>
        <p className="mt-2 text-sm leading-6 text-ink/70">
          Equipment passports are private by default. You can prepare public notes for discovery, but sharing should stay sanitized and intentional.
        </p>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
        <section className="rounded-md border border-ink/10 bg-white p-4 shadow-soft sm:p-5">
          <h3 className="text-lg font-bold text-ink">Setup Identity</h3>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Equipment type">
              <select
                value={values.equipmentType}
                onChange={(event) => updateField("equipmentType", event.target.value as EquipmentType)}
                className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-moss"
              >
                {equipmentOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <TextField label="Nickname" value={values.nickname} error={errors.nickname} required onChange={(value) => updateField("nickname", value)} />
            <TextField label="Manufacturer" value={values.manufacturer} error={errors.manufacturer} required onChange={(value) => updateField("manufacturer", value)} />
            <TextField label="Model" value={values.model} error={errors.model} required onChange={(value) => updateField("model", value)} />
            <TextField label="Caliber / category" value={values.caliberCategory} error={errors.caliberCategory} required onChange={(value) => updateField("caliberCategory", value)} />
            <TextField label="Round / shot count" value={values.roundOrShotCount} error={errors.roundOrShotCount} inputMode="numeric" onChange={(value) => updateField("roundOrShotCount", value)} />
          </div>
        </section>

        <section className="rounded-md border border-ink/10 bg-white p-4 shadow-soft sm:p-5">
          <h3 className="text-lg font-bold text-ink">Setup Summary</h3>
          <div className="mt-5 space-y-4">
            <TextField label="Optic / sight summary" value={values.opticSightSummary} onChange={(value) => updateField("opticSightSummary", value)} />
            <TextField label="Projectile / ammo summary" value={values.projectileAmmoSummary} onChange={(value) => updateField("projectileAmmoSummary", value)} />
            <TextField label="Use case tags" value={values.useCaseTags} helper="Separate tags with commas, such as hunting prep, range practice, lightweight." onChange={(value) => updateField("useCaseTags", value)} />
          </div>
        </section>
      </div>

      <section className="rounded-md border border-ink/10 bg-white p-4 shadow-soft sm:p-5">
        <h3 className="text-lg font-bold text-ink">Notes and Sharing</h3>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <TextArea label="Private notes" value={values.privateNotes} helper="Private notes are for your own setup documentation and should not appear in public discovery." onChange={(value) => updateField("privateNotes", value)} />
          <TextArea label="Public notes" value={values.publicNotes} helper="Use general setup context suitable for a sanitized public passport." onChange={(value) => updateField("publicNotes", value)} />
        </div>

        <div className="mt-5 rounded-md border border-clay/25 bg-clay/10 p-4">
          <h4 className="text-sm font-bold text-ink">Public Sharing Warning</h4>
          <p className="mt-2 text-sm leading-6 text-ink/70">
            Public passports should not include serial numbers, exact range or hunting locations, private purchase details, personal documents, or sensitive personal information.
          </p>
        </div>

        <label className="mt-5 flex items-start gap-3 rounded-md border border-ink/10 p-4">
          <input
            type="checkbox"
            checked={values.isPublic}
            onChange={(event) => updateField("isPublic", event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-ink/20 text-moss"
          />
          <span>
            <span className="block text-sm font-bold text-ink">Prepare a sanitized public snapshot</span>
            <span className="mt-1 block text-sm leading-6 text-ink/65">
              Leave unchecked to keep this passport private. Public discovery publishing will be handled later by an AWS Lambda sanitization workflow.
            </span>
          </span>
        </label>
      </section>

      {successMessage ? (
        <div className="rounded-md border border-moss/30 bg-field px-4 py-3 text-sm font-semibold text-moss" role="status">
          {successMessage}
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link href={cancelHref} className="inline-flex justify-center rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink">
          Cancel
        </Link>
        <button type="submit" className="inline-flex justify-center rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
          {mode === "create" ? "Create passport draft" : "Save passport draft"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function TextField({
  label,
  value,
  error,
  helper,
  required,
  inputMode,
  onChange
}: {
  label: string;
  value: string;
  error?: string;
  helper?: string;
  required?: boolean;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-ink">
        {label}
        {required ? <span className="text-clay"> *</span> : null}
      </span>
      <input
        value={value}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-2 w-full rounded-md border px-3 py-2 text-sm text-ink outline-none focus:border-moss ${error ? "border-clay" : "border-ink/15"}`}
      />
      {helper ? <span className="mt-1 block text-xs leading-5 text-ink/55">{helper}</span> : null}
      {error ? <span className="mt-1 block text-xs font-semibold text-clay">{error}</span> : null}
    </label>
  );
}

function TextArea({
  label,
  value,
  helper,
  onChange
}: {
  label: string;
  value: string;
  helper?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <textarea
        value={value}
        rows={6}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-md border border-ink/15 px-3 py-2 text-sm leading-6 text-ink outline-none focus:border-moss"
      />
      {helper ? <span className="mt-1 block text-xs leading-5 text-ink/55">{helper}</span> : null}
    </label>
  );
}
