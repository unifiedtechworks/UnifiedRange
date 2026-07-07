import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { RangeSessionForm, type RangeSessionFormValues } from "@/components/RangeSessionForm";
import { equipmentPassports, optics, projectiles } from "@/data/mockData";
import { getOpticById, getPassportById, getSessionById, getTargetPhotosForSession } from "@/data/selectors";

export default function EditSessionPage({ params }: { params: { sessionId: string } }) {
  const session = getSessionById(params.sessionId);

  if (!session) {
    notFound();
  }

  const passport = getPassportById(session.equipmentPassportId);
  const optic = getOpticById(passport?.opticOrSightId);
  const targetPhoto = getTargetPhotosForSession(session.id)[0];

  const initialValues: RangeSessionFormValues = {
    date: session.date,
    equipmentPassportId: session.equipmentPassportId,
    projectileProfileId: session.projectileProfileId ?? "",
    opticSightId: optic?.id ?? "",
    distance: String(session.distance),
    distanceUnit: session.distanceUnit,
    discipline: session.discipline,
    position: session.position,
    supportType: session.supportType,
    weatherNotes: session.weatherNotes ?? "",
    windNotesFreeText: session.windNotesFreeText ?? "",
    groupSizeOrScore: session.groupSize ?? session.score ?? "",
    isColdBore: session.isColdBore,
    isCleanBarrel: session.isCleanBarrel,
    isSuppressed: session.isSuppressed,
    confidenceRating: String(session.confidenceRating),
    sessionNotes: session.sessionNotes ?? "",
    targetPhotoNote: targetPhoto?.caption ?? "",
    targetManualEntry: targetPhoto?.manuallyEnteredGroupSize ?? targetPhoto?.manuallyEnteredScore ?? ""
  };

  return (
    <section>
      <PageHeader
        eyebrow="Edit range session"
        title={session.discipline}
        description="Update mock range-session values. Saving is local-only until the AWS backend is implemented."
      />
      <RangeSessionForm
        mode="edit"
        initialValues={initialValues}
        cancelHref={`/sessions/${session.id}`}
        passportOptions={equipmentPassports.map((item) => ({ id: item.id, label: item.nickname }))}
        projectileOptions={projectiles.map((item) => ({ id: item.id, label: `${item.manufacturer} ${item.productLine}` }))}
        opticOptions={optics.map((item) => ({ id: item.id, label: `${item.manufacturer} ${item.model}` }))}
      />
    </section>
  );
}
