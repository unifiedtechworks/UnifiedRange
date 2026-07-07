"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { FormField, TextArea, TextField } from "@/components/FormFields";
import type { SightType } from "@/types";

export interface OpticSightFormValues {
  sightType: SightType;
  manufacturer: string;
  model: string;
  reticleOrPinSetup: string;
  magnification: string;
  adjustmentUnit: string;
  clickValue: string;
  privateNotes: string;
  publicNotes: string;
}

interface OpticSightFormProps {
  mode: "create" | "edit";
  initialValues?: Partial<OpticSightFormValues>;
  cancelHref: string;
}

const defaultValues: OpticSightFormValues = {
  sightType: "scope",
  manufacturer: "",
  model: "",
  reticleOrPinSetup: "",
  magnification: "",
  adjustmentUnit: "",
  clickValue: "",
  privateNotes: "",
  publicNotes: ""
};

const sightOptions: { value: SightType; label: string }[] = [
  { value: "scope", label: "Scope" },
  { value: "red_dot", label: "Red dot" },
  { value: "iron_sight", label: "Iron sight" },
  { value: "bow_sight", label: "Bow sight" },
  { value: "other", label: "Other" }
];

export function OpticSightForm({ mode, initialValues, cancelHref }: OpticSightFormProps) {
  const mergedValues = useMemo(() => ({ ...defaultValues, ...initialValues }), [initialValues]);
  const [values, setValues] = useState<OpticSightFormValues>(mergedValues);
  const [errors, setErrors] = useState<Partial<Record<keyof OpticSightFormValues, string>>>({});
  const [successMessage, setSuccessMessage] = useState("");

  function updateField<K extends keyof OpticSightFormValues>(field: K, value: OpticSightFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSuccessMessage("");
  }

  function validate() {
    const nextErrors: Partial<Record<keyof OpticSightFormValues, string>> = {};

    (["manufacturer", "model"] as Array<keyof OpticSightFormValues>).forEach((field) => {
      if (!String(values[field]).trim()) {
        nextErrors[field] = "Required";
      }
    });

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!validate()) {
      setSuccessMessage("");
      return;
    }

    console.log(`Optic / sight ${mode} placeholder submit`, values);
    setSuccessMessage(mode === "create" ? "Optic / sight profile draft captured locally." : "Optic / sight updates captured locally.");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rounded-md border border-steel/20 bg-white p-4 shadow-soft sm:p-5">
        <h3 className="text-lg font-bold text-ink">Sight Profile</h3>
        <p className="mt-2 text-sm leading-6 text-ink/70">
          Store optic and sight details for setup documentation only. UnifiedRange does not calculate corrections or provide adjustment instructions.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <FormField label="Sight type">
            <select
              value={values.sightType}
              onChange={(event) => updateField("sightType", event.target.value as SightType)}
              className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-moss"
            >
              {sightOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>
          <TextField label="Manufacturer" value={values.manufacturer} error={errors.manufacturer} required onChange={(value) => updateField("manufacturer", value)} />
          <TextField label="Model" value={values.model} error={errors.model} required onChange={(value) => updateField("model", value)} />
          <TextField label="Reticle / pin setup" value={values.reticleOrPinSetup} onChange={(value) => updateField("reticleOrPinSetup", value)} />
          <TextField label="Magnification" value={values.magnification} onChange={(value) => updateField("magnification", value)} />
          <TextField label="Adjustment unit" value={values.adjustmentUnit} onChange={(value) => updateField("adjustmentUnit", value)} />
          <TextField label="Click value" value={values.clickValue} onChange={(value) => updateField("clickValue", value)} />
        </div>
      </section>

      <section className="rounded-md border border-ink/10 bg-white p-4 shadow-soft sm:p-5">
        <h3 className="text-lg font-bold text-ink">Notes</h3>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <TextArea label="Private notes" value={values.privateNotes} onChange={(value) => updateField("privateNotes", value)} />
          <TextArea label="Public notes" value={values.publicNotes} helper="Use general setup context only." onChange={(value) => updateField("publicNotes", value)} />
        </div>
      </section>

      {successMessage ? <div className="rounded-md border border-moss/30 bg-field px-4 py-3 text-sm font-semibold text-moss">{successMessage}</div> : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link href={cancelHref} className="inline-flex justify-center rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink">
          Cancel
        </Link>
        <button type="submit" className="inline-flex justify-center rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
          {mode === "create" ? "Create sight draft" : "Save sight draft"}
        </button>
      </div>
    </form>
  );
}
