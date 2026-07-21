"use client";

import type { HTMLAttributes, ReactNode } from "react";

export function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold leading-5 text-ink">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

export function TextField({
  label,
  value,
  error,
  helper,
  required,
  inputMode,
  type = "text",
  onChange
}: {
  label: string;
  value: string;
  error?: string;
  helper?: string;
  required?: boolean;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  type?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold leading-5 text-ink">
        {label}
        {required ? <span className="text-clay"> *</span> : null}
      </span>
      <input
        type={type}
        value={value}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-2 min-h-10 w-full rounded-md border px-3 py-2 text-sm text-ink outline-none focus:border-moss ${error ? "border-clay" : "border-ink/15"}`}
      />
      {helper ? <span className="mt-1 block text-xs leading-5 text-ink/55">{helper}</span> : null}
      {error ? <span className="mt-1 block text-xs font-semibold text-clay">{error}</span> : null}
    </label>
  );
}

export function TextArea({
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
      <span className="block text-sm font-semibold leading-5 text-ink">{label}</span>
      <textarea
        value={value}
        rows={5}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-32 w-full rounded-md border border-ink/15 px-3 py-2 text-sm leading-6 text-ink outline-none focus:border-moss"
      />
      {helper ? <span className="mt-1 block text-xs leading-5 text-ink/55">{helper}</span> : null}
    </label>
  );
}
