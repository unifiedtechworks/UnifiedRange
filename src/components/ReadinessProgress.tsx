import type { HuntingChecklist } from "@/types";

export function getReadinessProgress(checklist: HuntingChecklist) {
  const total = checklist.checklistItems.length;
  const completed = checklist.checklistItems.filter((item) => item.isComplete).length;
  const remaining = total - completed;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return { total, completed, remaining, percent };
}

export function ReadinessProgress({ checklist }: { checklist: HuntingChecklist }) {
  const progress = getReadinessProgress(checklist);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold text-ink">{progress.percent}% complete</span>
        <span className="text-ink/60">
          {progress.completed} done · {progress.remaining} remaining
        </span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-ink/10">
        <div className="h-2 rounded-full bg-moss" style={{ width: `${progress.percent}%` }} />
      </div>
    </div>
  );
}
