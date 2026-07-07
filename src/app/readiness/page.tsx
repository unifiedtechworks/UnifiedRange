import { PageHeader } from "@/components/PageHeader";
import { getPassportById } from "@/data/selectors";
import { huntingChecklists } from "@/data/mockData";

export default function ReadinessPage() {
  return (
    <section>
      <PageHeader
        eyebrow="Hunting readiness"
        title="Season prep checklists"
        description="Track license confirmation, equipment checks, field-practice logs, pack prep, maps, weather, and emergency planning."
      />
      <div className="grid gap-5 xl:grid-cols-2">
        {huntingChecklists.map((checklist) => {
          const passport = getPassportById(checklist.equipmentPassportId);
          const completed = checklist.checklistItems.filter((item) => item.isComplete).length;
          return (
            <article key={checklist.id} className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
              <div className="flex flex-col justify-between gap-3 sm:flex-row">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-clay">{checklist.season}</p>
                  <h3 className="mt-2 text-xl font-bold text-ink">{checklist.huntName}</h3>
                  <p className="mt-1 text-sm text-ink/65">{checklist.species} · {passport?.nickname}</p>
                </div>
                <span className="rounded-md bg-field px-3 py-2 text-sm font-semibold text-moss">
                  {completed}/{checklist.checklistItems.length} complete
                </span>
              </div>
              <div className="mt-5 grid gap-2">
                {checklist.checklistItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-md border border-ink/10 px-3 py-2">
                    <span className={`h-3 w-3 rounded-full ${item.isComplete ? "bg-moss" : "bg-clay"}`} />
                    <span className="text-sm font-medium text-ink">{item.label}</span>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
