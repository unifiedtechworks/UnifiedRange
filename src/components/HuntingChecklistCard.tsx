import Link from "next/link";
import { ReadinessProgress, getReadinessProgress } from "@/components/ReadinessProgress";
import { getPassportById } from "@/data/selectors";
import type { HuntingChecklist } from "@/types";

export function HuntingChecklistCard({
  checklist,
  sourceLabel,
  equipmentSummary
}: {
  checklist: HuntingChecklist;
  sourceLabel?: string;
  equipmentSummary?: string;
}) {
  const passport = getPassportById(checklist.equipmentPassportId);
  const progress = getReadinessProgress(checklist);
  const displayedEquipment = equipmentSummary ?? passport?.nickname ?? "Unknown equipment";

  return (
    <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
      <div className="flex flex-col justify-between gap-3 sm:flex-row">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-clay">{checklist.season || "Season pending"}</p>
          <h3 className="mt-2 text-xl font-bold text-ink">{checklist.huntName}</h3>
          <p className="mt-1 text-sm text-ink/65">
            {checklist.species || "Use case pending"} - {displayedEquipment}
          </p>
          {sourceLabel ? <p className="mt-1 text-xs font-semibold text-moss">{sourceLabel}</p> : null}
        </div>
        <span className="h-fit rounded-md bg-field px-3 py-2 text-sm font-semibold text-moss">
          {progress.completed}/{progress.total} complete
        </span>
      </div>
      <div className="mt-5">
        <ReadinessProgress checklist={checklist} />
      </div>
      <div className="mt-5 grid gap-2">
        {checklist.checklistItems.map((item) => (
          <div key={item.id} className="flex items-center gap-3 rounded-md border border-ink/10 px-3 py-2">
            <span className={`h-3 w-3 rounded-full ${item.isComplete ? "bg-moss" : "bg-clay"}`} />
            <span className="text-sm font-medium text-ink">{item.label}</span>
          </div>
        ))}
      </div>
      <Link href={`/readiness/${checklist.id}`} className="mt-4 inline-flex rounded-md border border-ink/15 bg-white px-3 py-2 text-sm font-semibold text-ink">
        View checklist
      </Link>
    </article>
  );
}
