import Link from "next/link";
import { notFound } from "next/navigation";
import { DetailRow } from "@/components/DetailRow";
import { PageHeader } from "@/components/PageHeader";
import { ReadinessProgress, getReadinessProgress } from "@/components/ReadinessProgress";
import { getChecklistById, getPassportById } from "@/data/selectors";

export default function ReadinessDetailPage({ params }: { params: { checklistId: string } }) {
  const checklist = getChecklistById(params.checklistId);

  if (!checklist) notFound();

  const passport = getPassportById(checklist.equipmentPassportId);
  const progress = getReadinessProgress(checklist);

  return (
    <section>
      <PageHeader
        eyebrow="Private Hunting Readiness"
        title={checklist.huntName}
        description="Readiness records are private by default and help organize responsible field preparation."
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/readiness" className="inline-flex justify-center rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink">
              Back to Hunting Readiness
            </Link>
            <Link href={`/readiness/${checklist.id}/edit`} className="inline-flex justify-center rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
              Edit checklist
            </Link>
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
          <h3 className="text-xl font-bold text-ink">Overview</h3>
          <dl className="mt-4">
            <DetailRow label="Equipment" value={passport?.nickname} />
            <DetailRow label="Season" value={checklist.season} />
            <DetailRow label="Species / use case" value={checklist.species} />
            <DetailRow label="Completed" value={`${progress.completed}/${progress.total}`} />
            <DetailRow label="Remaining" value={progress.remaining} />
          </dl>
          <div className="mt-4">
            <ReadinessProgress checklist={checklist} />
          </div>
        </article>
        <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
          <h3 className="text-xl font-bold text-ink">Checklist Items</h3>
          <div className="mt-4 grid gap-2">
            {checklist.checklistItems.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-md border border-ink/10 px-3 py-2">
                <span className={`h-3 w-3 rounded-full ${item.isComplete ? "bg-moss" : "bg-clay"}`} />
                <span className="text-sm font-medium text-ink">{item.label}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm leading-6 text-ink/70">{checklist.notes}</p>
        </article>
      </div>
    </section>
  );
}
