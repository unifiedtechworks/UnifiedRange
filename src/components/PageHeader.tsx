import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  return (
    <div className="mb-5 flex min-w-0 flex-col justify-between gap-4 border-b border-ink/10 pb-5 md:mb-6 md:flex-row md:items-end md:pb-6">
      <div className="min-w-0 max-w-3xl">
        {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.14em] text-clay sm:tracking-[0.2em]">{eyebrow}</p> : null}
        <h2 className="mt-2 text-2xl font-bold leading-tight text-ink sm:text-3xl lg:text-4xl">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-ink/70 sm:text-base sm:leading-7">{description}</p>
      </div>
      {action ? <div className="w-full shrink-0 sm:w-auto [&>*]:w-full sm:[&>*]:w-auto">{action}</div> : null}
    </div>
  );
}
