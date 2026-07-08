"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { FormField, TextArea, TextField } from "@/components/FormFields";
import type { ProjectileType } from "@/types";

export interface ProjectileFormValues {
  projectileType: ProjectileType;
  manufacturer: string;
  productLine: string;
  caliberCategory: string;
  bulletWeight: string;
  bulletType: string;
  lotNumber: string;
  roundsPurchased: string;
  roundsRemaining: string;
  arrowShaft: string;
  arrowSpine: string;
  pointOrBroadhead: string;
  fletching: string;
  totalWeight: string;
  privateNotes: string;
  publicNotes: string;
}

interface ProjectileFormProps {
  mode: "create" | "edit";
  initialValues?: Partial<ProjectileFormValues>;
  cancelHref: string;
}

const defaultValues: ProjectileFormValues = {
  projectileType: "ammo",
  manufacturer: "",
  productLine: "",
  caliberCategory: "",
  bulletWeight: "",
  bulletType: "",
  lotNumber: "",
  roundsPurchased: "0",
  roundsRemaining: "0",
  arrowShaft: "",
  arrowSpine: "",
  pointOrBroadhead: "",
  fletching: "",
  totalWeight: "",
  privateNotes: "",
  publicNotes: ""
};

const projectileOptions: { value: ProjectileType; label: string }[] = [
  { value: "ammo", label: "Ammo" },
  { value: "arrow", label: "Arrow" },
  { value: "bolt", label: "Bolt" },
  { value: "pellet", label: "Pellet" },
  { value: "other", label: "Other" }
];

export function ProjectileForm({ mode, initialValues, cancelHref }: ProjectileFormProps) {
  const mergedValues = useMemo(() => ({ ...defaultValues, ...initialValues }), [initialValues]);
  const [values, setValues] = useState<ProjectileFormValues>(mergedValues);
  const [errors, setErrors] = useState<Partial<Record<keyof ProjectileFormValues, string>>>({});
  const [successMessage, setSuccessMessage] = useState("");

  function updateField<K extends keyof ProjectileFormValues>(field: K, value: ProjectileFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSuccessMessage("");
  }

  function validate() {
    const nextErrors: Partial<Record<keyof ProjectileFormValues, string>> = {};

    (["manufacturer", "productLine", "caliberCategory"] as Array<keyof ProjectileFormValues>).forEach((field) => {
      if (!String(values[field]).trim()) {
        nextErrors[field] = "Required";
      }
    });

    (["roundsPurchased", "roundsRemaining"] as Array<keyof ProjectileFormValues>).forEach((field) => {
      const rawValue = String(values[field]).trim();
      const numberValue = Number(rawValue);
      if (rawValue && (!Number.isFinite(numberValue) || numberValue < 0)) {
        nextErrors[field] = "Use 0 or a positive number";
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

    const payload = {
      ...values,
      roundsPurchased: Number(values.roundsPurchased || 0),
      roundsRemaining: Number(values.roundsRemaining || 0)
    };

    console.log(`Projectile ${mode} placeholder submit`, payload);
    setSuccessMessage(mode === "create" ? "Draft saved locally for this mock MVP. No backend write occurred." : "Updates saved locally for this mock MVP. No backend write occurred.");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rounded-md border border-moss/20 bg-field p-4">
        <h3 className="text-base font-bold text-ink">Inventory Privacy</h3>
        <p className="mt-2 text-sm leading-6 text-ink/70">
          Lot numbers and purchase details should stay private by default. Public notes should describe only broad setup context suitable for discovery.
        </p>
      </section>

      <section className="rounded-md border border-ink/10 bg-white p-4 shadow-soft sm:p-5">
        <h3 className="text-lg font-bold text-ink">Projectile Profile</h3>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <FormField label="Projectile type">
            <select
              value={values.projectileType}
              onChange={(event) => updateField("projectileType", event.target.value as ProjectileType)}
              className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-moss"
            >
              {projectileOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>
          <TextField label="Manufacturer" value={values.manufacturer} error={errors.manufacturer} required onChange={(value) => updateField("manufacturer", value)} />
          <TextField label="Product line" value={values.productLine} error={errors.productLine} required onChange={(value) => updateField("productLine", value)} />
          <TextField label="Caliber / category" value={values.caliberCategory} error={errors.caliberCategory} required onChange={(value) => updateField("caliberCategory", value)} />
          <TextField label="Bullet weight" value={values.bulletWeight} onChange={(value) => updateField("bulletWeight", value)} />
          <TextField label="Bullet type" value={values.bulletType} onChange={(value) => updateField("bulletType", value)} />
          <TextField label="Lot number" value={values.lotNumber} helper="Private by default." onChange={(value) => updateField("lotNumber", value)} />
          <TextField label="Purchased" value={values.roundsPurchased} error={errors.roundsPurchased} inputMode="numeric" onChange={(value) => updateField("roundsPurchased", value)} />
          <TextField label="Remaining" value={values.roundsRemaining} error={errors.roundsRemaining} inputMode="numeric" onChange={(value) => updateField("roundsRemaining", value)} />
        </div>
      </section>

      <section className="rounded-md border border-ink/10 bg-white p-4 shadow-soft sm:p-5">
        <h3 className="text-lg font-bold text-ink">Future Archery Fields</h3>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <TextField label="Arrow shaft" value={values.arrowShaft} onChange={(value) => updateField("arrowShaft", value)} />
          <TextField label="Arrow spine" value={values.arrowSpine} onChange={(value) => updateField("arrowSpine", value)} />
          <TextField label="Point / broadhead" value={values.pointOrBroadhead} onChange={(value) => updateField("pointOrBroadhead", value)} />
          <TextField label="Fletching" value={values.fletching} onChange={(value) => updateField("fletching", value)} />
          <TextField label="Total weight" value={values.totalWeight} onChange={(value) => updateField("totalWeight", value)} />
        </div>
      </section>

      <section className="rounded-md border border-ink/10 bg-white p-4 shadow-soft sm:p-5">
        <h3 className="text-lg font-bold text-ink">Notes</h3>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <TextArea label="Private notes" value={values.privateNotes} onChange={(value) => updateField("privateNotes", value)} />
          <TextArea label="Public notes" value={values.publicNotes} helper="Keep public notes broad and free of private inventory details." onChange={(value) => updateField("publicNotes", value)} />
        </div>
      </section>

      {successMessage ? <div className="rounded-md border border-moss/30 bg-field px-4 py-3 text-sm font-semibold text-moss">{successMessage}</div> : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link href={cancelHref} className="inline-flex justify-center rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink">
          Cancel
        </Link>
        <button type="submit" className="inline-flex justify-center rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
          {mode === "create" ? "Create projectile draft" : "Save projectile draft"}
        </button>
      </div>
    </form>
  );
}
