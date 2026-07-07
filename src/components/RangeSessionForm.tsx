"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { FormField, TextArea, TextField } from "@/components/FormFields";
import type { DistanceUnit } from "@/types";

interface SelectOption {
  id: string;
  label: string;
}

export interface RangeSessionFormValues {
  date: string;
  equipmentPassportId: string;
  projectileProfileId: string;
  opticSightId: string;
  distance: string;
  distanceUnit: DistanceUnit;
  discipline: string;
  position: string;
  supportType: string;
  weatherNotes: string;
  windNotesFreeText: string;
  groupSizeOrScore: string;
  isColdBore: boolean;
  isCleanBarrel: boolean;
  isSuppressed: boolean;
  confidenceRating: string;
  sessionNotes: string;
  targetPhotoNote: string;
  targetManualEntry: string;
}

interface RangeSessionFormProps {
  mode: "create" | "edit";
  initialValues?: Partial<RangeSessionFormValues>;
  cancelHref: string;
  passportOptions: SelectOption[];
  projectileOptions: SelectOption[];
  opticOptions: SelectOption[];
}

const defaultValues: RangeSessionFormValues = {
  date: "",
  equipmentPassportId: "",
  projectileProfileId: "",
  opticSightId: "",
  distance: "",
  distanceUnit: "yards",
  discipline: "",
  position: "",
  supportType: "",
  weatherNotes: "",
  windNotesFreeText: "",
  groupSizeOrScore: "",
  isColdBore: false,
  isCleanBarrel: false,
  isSuppressed: false,
  confidenceRating: "3",
  sessionNotes: "",
  targetPhotoNote: "",
  targetManualEntry: ""
};

export function RangeSessionForm({
  mode,
  initialValues,
  cancelHref,
  passportOptions,
  projectileOptions,
  opticOptions
}: RangeSessionFormProps) {
  const mergedValues = useMemo(() => ({ ...defaultValues, ...initialValues }), [initialValues]);
  const [values, setValues] = useState<RangeSessionFormValues>(mergedValues);
  const [errors, setErrors] = useState<Partial<Record<keyof RangeSessionFormValues, string>>>({});
  const [successMessage, setSuccessMessage] = useState("");

  function updateField<K extends keyof RangeSessionFormValues>(field: K, value: RangeSessionFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSuccessMessage("");
  }

  function validate() {
    const nextErrors: Partial<Record<keyof RangeSessionFormValues, string>> = {};

    if (!values.date) {
      nextErrors.date = "Required";
    }

    if (!values.equipmentPassportId) {
      nextErrors.equipmentPassportId = "Required";
    }

    const distanceValue = Number(values.distance);
    if (!values.distance.trim()) {
      nextErrors.distance = "Required";
    } else if (!Number.isFinite(distanceValue) || distanceValue <= 0) {
      nextErrors.distance = "Use a positive number";
    }

    const confidence = Number(values.confidenceRating);
    if (!Number.isInteger(confidence) || confidence < 1 || confidence > 5) {
      nextErrors.confidenceRating = "Choose a rating from 1 to 5";
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
      distance: Number(values.distance),
      confidenceRating: Number(values.confidenceRating)
    };

    console.log(`Range session ${mode} placeholder submit`, payload);
    setSuccessMessage(mode === "create" ? "Range session draft captured locally." : "Range session updates captured locally.");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rounded-md border border-moss/20 bg-field p-4">
        <h3 className="text-base font-bold text-ink">Logbook Boundary</h3>
        <p className="mt-2 text-sm leading-6 text-ink/70">
          Range sessions store historical notes and user-entered results. Wind notes are free text only, and this form does not calculate holds, corrections, or aiming guidance.
        </p>
      </section>

      <section className="rounded-md border border-ink/10 bg-white p-4 shadow-soft sm:p-5">
        <h3 className="text-lg font-bold text-ink">Session Links</h3>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <TextField label="Date" type="date" value={values.date} error={errors.date} required onChange={(value) => updateField("date", value)} />
          <SelectField label="Equipment passport" value={values.equipmentPassportId} error={errors.equipmentPassportId} options={passportOptions} required onChange={(value) => updateField("equipmentPassportId", value)} />
          <SelectField label="Projectile / ammo profile" value={values.projectileProfileId} options={projectileOptions} onChange={(value) => updateField("projectileProfileId", value)} />
          <SelectField label="Optic / sight profile" value={values.opticSightId} options={opticOptions} onChange={(value) => updateField("opticSightId", value)} />
        </div>
      </section>

      <section className="rounded-md border border-ink/10 bg-white p-4 shadow-soft sm:p-5">
        <h3 className="text-lg font-bold text-ink">Practice Context</h3>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <TextField label="Distance" value={values.distance} error={errors.distance} required inputMode="decimal" onChange={(value) => updateField("distance", value)} />
          <FormField label="Distance unit">
            <select
              value={values.distanceUnit}
              onChange={(event) => updateField("distanceUnit", event.target.value as DistanceUnit)}
              className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-moss"
            >
              <option value="yards">Yards</option>
              <option value="meters">Meters</option>
            </select>
          </FormField>
          <TextField label="Discipline" value={values.discipline} onChange={(value) => updateField("discipline", value)} />
          <TextField label="Position" value={values.position} onChange={(value) => updateField("position", value)} />
          <TextField label="Support / rest type" value={values.supportType} onChange={(value) => updateField("supportType", value)} />
          <TextField label="Group size or score" value={values.groupSizeOrScore} onChange={(value) => updateField("groupSizeOrScore", value)} />
          <TextField label="Confidence rating" value={values.confidenceRating} error={errors.confidenceRating} inputMode="numeric" helper="Use 1 to 5." onChange={(value) => updateField("confidenceRating", value)} />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Checkbox label="Cold-bore / first-shot marker" checked={values.isColdBore} onChange={(checked) => updateField("isColdBore", checked)} />
          <Checkbox label="Clean / fouled marker" checked={values.isCleanBarrel} onChange={(checked) => updateField("isCleanBarrel", checked)} />
          <Checkbox label="Suppressed / accessory marker" checked={values.isSuppressed} onChange={(checked) => updateField("isSuppressed", checked)} />
        </div>
      </section>

      <section className="rounded-md border border-ink/10 bg-white p-4 shadow-soft sm:p-5">
        <h3 className="text-lg font-bold text-ink">Notes</h3>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <TextArea label="Weather notes" value={values.weatherNotes} onChange={(value) => updateField("weatherNotes", value)} />
          <TextArea label="Wind notes" value={values.windNotesFreeText} helper="Free text only. No wind hold or correction calculation." onChange={(value) => updateField("windNotesFreeText", value)} />
          <TextArea label="Session notes" value={values.sessionNotes} onChange={(value) => updateField("sessionNotes", value)} />
        </div>
      </section>

      <section className="rounded-md border border-dashed border-steel/40 bg-white p-4 shadow-soft sm:p-5">
        <h3 className="text-lg font-bold text-ink">Target Photo Placeholder</h3>
        <p className="mt-2 text-sm leading-6 text-ink/70">
          Real image upload will come later with S3 storage and Lambda metadata cleanup. Target photos are private unless explicitly shared.
        </p>
        <div className="mt-5 rounded-md border border-dashed border-ink/25 bg-paper p-6 text-center">
          <p className="text-sm font-semibold text-ink">Mock upload drop zone</p>
          <p className="mt-1 text-xs text-ink/55">No file is uploaded yet. Add a note or manual score below for now.</p>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <TextField label="Manual group-size / score entry" value={values.targetManualEntry} onChange={(value) => updateField("targetManualEntry", value)} />
          <TextField label="Target photo note" value={values.targetPhotoNote} onChange={(value) => updateField("targetPhotoNote", value)} />
        </div>
      </section>

      {successMessage ? <div className="rounded-md border border-moss/30 bg-field px-4 py-3 text-sm font-semibold text-moss">{successMessage}</div> : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link href={cancelHref} className="inline-flex justify-center rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink">
          Cancel
        </Link>
        <button type="submit" className="inline-flex justify-center rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
          {mode === "create" ? "Create session draft" : "Save session draft"}
        </button>
      </div>
    </form>
  );
}

function SelectField({
  label,
  value,
  options,
  error,
  required,
  onChange
}: {
  label: string;
  value: string;
  options: SelectOption[];
  error?: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-ink">
        {label}
        {required ? <span className="text-clay"> *</span> : null}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-2 w-full rounded-md border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-moss ${error ? "border-clay" : "border-ink/15"}`}
      >
        <option value="">Not selected</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <span className="mt-1 block text-xs font-semibold text-clay">{error}</span> : null}
    </label>
  );
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 rounded-md border border-ink/10 p-3">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4 rounded border-ink/20 text-moss" />
      <span className="text-sm font-semibold text-ink">{label}</span>
    </label>
  );
}
