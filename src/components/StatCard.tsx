interface StatCardProps {
  label: string;
  value: string;
  helper: string;
}

export function StatCard({ label, value, helper }: StatCardProps) {
  return (
    <article className="rounded-md border border-ink/10 bg-white p-4 shadow-soft">
      <p className="text-sm font-medium text-ink/60">{label}</p>
      <p className="mt-2 break-words text-2xl font-bold text-ink sm:text-3xl">{value}</p>
      <p className="mt-2 text-sm leading-6 text-ink/65">{helper}</p>
    </article>
  );
}
