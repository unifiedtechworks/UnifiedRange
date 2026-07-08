"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { FormField, TextArea, TextField } from "@/components/FormFields";

interface Option {
  id: string;
  label: string;
}

export interface MaintenanceLogFormValues {
  equipmentPassportId: string;
  date: string;
  roundOrShotCount: string;
  maintenanceType: string;
  partsChanged: string;
  cleaningNotes: string;
  torqueCheckNotes: string;
  privateNotes: string;
}

const defaultValues: MaintenanceLogFormValues = {
  equipmentPassportId: "",
  date: "",
  roundOrShotCount: "0",
  maintenanceType: "",
  partsChanged: "",
  cleaningNotes: "",
  torqueCheckNotes: "",
  privateNotes: ""
};

export function MaintenanceLogForm({
  mode,
  initialValues,
  passportOptions,
  cancelHref
}: {
  mode: "create" | "edit";
  initialValues?: Partial<MaintenanceLogFormValues>;
  passportOptions: Option[];
  cancelHref: string;
}) {
  const mergedValues = useMemo(() => ({ ...defaultValues, ...initialValues }), [initialValues]);
  const [values, setValues] = useState<MaintenanceLogFormValues>(mergedValues);
  const [errors, setErrors] = useState<Partial<Record<keyof MaintenanceLogFormValues, string>>>({});
  const [successMessage, setSuccessMessage] = useState("");

  function updateField<K extends keyof MaintenanceLogFormValues>(field: K, value: MaintenanceLogFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSuccessMessage("");
  }

  function validate() {
    const nextErrors: Partial<Record<keyof MaintenanceLogFormValues, string>> = {};

    if (!values.equipmentPassportId) nextErrors.equipmentPassportId = "Required";
    if (!values.date) nextErrors.date = "Required";
    if (!values.maintenanceType.trim()) nextErrors.maintenanceType = "Required";

    const count = Number(values.roundOrShotCount);
    if (values.roundOrShotCount.trim() && (!Number.isFinite(count) || count < 0)) {
      nextErrors.roundOrShotCount = "Use 0 or a positive number";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;

    const payload = {
      ...values,
      partsChanged: values.partsChanged.split(",").map((part) => part.trim()).filter(Boolean),
      roundOrShotCount: Number(values.roundOrShotCount || 0)
    };

    console.log(`Maintenance ${mode} placeholder submit`, payload);
    setSuccessMessage(mode === "create" ? "Draft saved locally for this mock MVP. No backend write occurred." : "Updates saved locally for this mock MVP. No backend write occurred.");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rounded-md border border-moss/20 bg-field p-4">
        <h3 className="text-base font-bold text-ink">Private Maintenance Record</h3>
        <p className="mt-2 text-sm leading-6 text-ink/70">Maintenance logs are private by default and are not included in public passport snapshots.</p>
      </section>

      <section className="rounded-md border border-ink/10 bg-white p-4 shadow-soft sm:p-5">
        <h3 className="text-lg font-bold text-ink">Maintenance Details</h3>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
          <TextField label="Date" type="date" value={values.date} error={errors.date} required onChange={(value) => updateField("date", value)} />
          <TextField label="Maintenance type" value={values.maintenanceType} error={errors.maintenanceType} required onChange={(value) => updateField("maintenanceType", value)} />
          <TextField label="Round / shot count" value={values.roundOrShotCount} error={errors.roundOrShotCount} inputMode="numeric" onChange={(value) => updateField("roundOrShotCount", value)} />
        </div>
        <div className="mt-5">
          <TextField label="Parts changed" value={values.partsChanged} helper="Separate parts with commas." onChange={(value) => updateField("partsChanged", value)} />
        </div>
      </section>

      <section className="rounded-md border border-ink/10 bg-white p-4 shadow-soft sm:p-5">
        <h3 className="text-lg font-bold text-ink">Private Notes</h3>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <TextArea label="Cleaning notes" value={values.cleaningNotes} onChange={(value) => updateField("cleaningNotes", value)} />
          <TextArea label="Torque / check notes" value={values.torqueCheckNotes} onChange={(value) => updateField("torqueCheckNotes", value)} />
          <TextArea label="Private notes" value={values.privateNotes} onChange={(value) => updateField("privateNotes", value)} />
        </div>
      </section>

      {successMessage ? <div className="rounded-md border border-moss/30 bg-field px-4 py-3 text-sm font-semibold text-moss">{successMessage}</div> : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link href={cancelHref} className="inline-flex justify-center rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink">Cancel</Link>
        <button type="submit" className="inline-flex justify-center rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
          {mode === "create" ? "Create maintenance draft" : "Save maintenance draft"}
        </button>
      </div>
    </form>
  );
}
