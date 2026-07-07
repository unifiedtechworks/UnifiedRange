export function DetailRow({ label, value }: { label: string; value?: string | number | boolean }) {
  return (
    <div className="border-b border-ink/10 py-3">
      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-ink">{value === undefined || value === "" ? "Not recorded" : String(value)}</dd>
    </div>
  );
}
