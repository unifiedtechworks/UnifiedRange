import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 border-b border-ink/10 pb-6 md:flex-row md:items-end">
      <div className="max-w-3xl">
        {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">{eyebrow}</p> : null}
        <h2 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">{title}</h2>
        <p className="mt-3 text-base leading-7 text-ink/70">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
