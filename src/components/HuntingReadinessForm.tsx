"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { FormField, TextArea, TextField } from "@/components/FormFields";
import type { HuntingChecklistItem } from "@/types";

interface Option {
  id: string;
  label: string;
}

export interface HuntingReadinessFormValues {
  huntName: string;
  equipmentPassportId: string;
  season: string;
  species: string;
  checklistItems: HuntingChecklistItem[];
  notes: string;
}

export const defaultReadinessItems = [
  "License/tag confirmed",
  "Equipment confirmed at range",
  "First-shot/cold-bore practice logged",
  "Field-position practice logged",
  "Ammo/projectile verified",
  "Optic/sight checked",
  "Gear inspected",
  "Pack list complete",
  "Emergency contact plan",
  "Offline maps prepared",
  "Weather checked"
];

function createDefaultItems(): HuntingChecklistItem[] {
  return defaultReadinessItems.map((label, index) => ({
    id: `readiness-item-${index + 1}`,
    label,
    isComplete: false
  }));
}

const defaultValues: HuntingReadinessFormValues = {
  huntName: "",
  equipmentPassportId: "",
  season: "",
  species: "",
  checklistItems: createDefaultItems(),
  notes: ""
};

export function HuntingReadinessForm({
  mode,
  initialValues,
  passportOptions,
  cancelHref
}: {
  mode: "create" | "edit";
  initialValues?: Partial<HuntingReadinessFormValues>;
  passportOptions: Option[];
  cancelHref: string;
}) {
  const mergedValues = useMemo(() => ({ ...defaultValues, ...initialValues, checklistItems: initialValues?.checklistItems ?? createDefaultItems() }), [initialValues]);
  const [values, setValues] = useState<HuntingReadinessFormValues>(mergedValues);
  const [errors, setErrors] = useState<Partial<Record<keyof HuntingReadinessFormValues, string>>>({});
  const [successMessage, setSuccessMessage] = useState("");

  function updateField<K extends keyof HuntingReadinessFormValues>(field: K, value: HuntingReadinessFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSuccessMessage("");
  }

  function toggleItem(itemId: string, isComplete: boolean) {
    updateField(
      "checklistItems",
      values.checklistItems.map((item) => (item.id === itemId ? { ...item, isComplete } : item))
    );
  }

  function validate() {
    const nextErrors: Partial<Record<keyof HuntingReadinessFormValues, string>> = {};
    if (!values.huntName.trim()) nextErrors.huntName = "Required";
    if (!values.equipmentPassportId) nextErrors.equipmentPassportId = "Required";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;

    console.log(`Readiness ${mode} placeholder submit`, values);
    setSuccessMessage(mode === "create" ? "Readiness checklist captured locally." : "Readiness checklist updates captured locally.");
  }

  const completed = values.checklistItems.filter((item) => item.isComplete).length;
  const total = values.checklistItems.length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rounded-md border border-moss/20 bg-field p-4">
        <h3 className="text-base font-bold text-ink">Private Readiness Record</h3>
        <p className="mt-2 text-sm leading-6 text-ink/70">Hunting Readiness records are private by default and help organize preparation, documentation, and field planning.</p>
      </section>

      <section className="rounded-md border border-ink/10 bg-white p-4 shadow-soft sm:p-5">
        <h3 className="text-lg font-bold text-ink">Checklist Details</h3>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <TextField label="Checklist name" value={values.huntName} error={errors.huntName} required onChange={(value) => updateField("huntName", value)} />
          <FormField label="Equipment passport">
            <select
              value={values.equipmentPassportId}
              onChange={(event) => updateField("equipmentPassportId", event.target.value)}
              className={`w-full rounded-md border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-moss ${errors.equipmentPassportId ? "border-clay" : "border-ink/15"}`}
            >
              <option value="">Select equipment</option>
              {passportOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
            {errors.equipmentPassportId ? <span className="mt-1 block text-xs font-semibold text-clay">{errors.equipmentPassportId}</span> : null}
          </FormField>
          <TextField label="Season" value={values.season} onChange={(value) => updateField("season", value)} />
          <TextField label="Species / use case" value={values.species} onChange={(value) => updateField("species", value)} />
        </div>
      </section>

      <section className="rounded-md border border-ink/10 bg-white p-4 shadow-soft sm:p-5">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <h3 className="text-lg font-bold text-ink">Checklist Items</h3>
            <p className="mt-1 text-sm text-ink/65">{completed}/{total} complete · {percent}%</p>
          </div>
          <span className="rounded-md bg-field px-3 py-2 text-sm font-semibold text-moss">{total - completed} remaining</span>
        </div>
        <div className="mt-5 grid gap-2">
          {values.checklistItems.map((item) => (
            <label key={item.id} className="flex items-start gap-3 rounded-md border border-ink/10 px-3 py-2">
              <input type="checkbox" checked={item.isComplete} onChange={(event) => toggleItem(item.id, event.target.checked)} className="mt-1 h-4 w-4 rounded border-ink/20 text-moss" />
              <span className="text-sm font-medium text-ink">{item.label}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-ink/10 bg-white p-4 shadow-soft sm:p-5">
        <TextArea label="Notes" value={values.notes} onChange={(value) => updateField("notes", value)} />
      </section>

      {successMessage ? <div className="rounded-md border border-moss/30 bg-field px-4 py-3 text-sm font-semibold text-moss">{successMessage}</div> : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link href={cancelHref} className="inline-flex justify-center rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink">Cancel</Link>
        <button type="submit" className="inline-flex justify-center rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
          {mode === "create" ? "Create readiness draft" : "Save readiness draft"}
        </button>
      </div>
    </form>
  );
}
