import { notFound } from "next/navigation";
import { HuntingReadinessForm, type HuntingReadinessFormValues } from "@/components/HuntingReadinessForm";
import { PageHeader } from "@/components/PageHeader";
import { equipmentPassports } from "@/data/mockData";
import { getChecklistById } from "@/data/selectors";

export default function EditReadinessPage({ params }: { params: { checklistId: string } }) {
  const checklist = getChecklistById(params.checklistId);

  if (!checklist) notFound();

  const initialValues: HuntingReadinessFormValues = {
    huntName: checklist.huntName,
    equipmentPassportId: checklist.equipmentPassportId,
    season: checklist.season,
    species: checklist.species,
    checklistItems: checklist.checklistItems,
    notes: checklist.notes ?? ""
  };

  return (
    <section>
      <PageHeader
        eyebrow="Edit Hunting Readiness"
        title={checklist.huntName}
        description="Update mock readiness values. Saving is local-only until the AWS backend is implemented."
      />
      <HuntingReadinessForm
        mode="edit"
        initialValues={initialValues}
        cancelHref={`/readiness/${checklist.id}`}
        passportOptions={equipmentPassports.map((passport) => ({ id: passport.id, label: passport.nickname }))}
      />
    </section>
  );
}
