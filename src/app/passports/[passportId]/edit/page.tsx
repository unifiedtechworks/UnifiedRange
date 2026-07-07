import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { PassportForm, type PassportFormValues } from "@/components/PassportForm";
import { getOpticById, getPassportById, getProjectileById } from "@/data/selectors";

export default function EditPassportPage({ params }: { params: { passportId: string } }) {
  const passport = getPassportById(params.passportId);

  if (!passport) {
    notFound();
  }

  const optic = getOpticById(passport.opticOrSightId);
  const projectile = getProjectileById(passport.preferredProjectileId);

  const initialValues: PassportFormValues = {
    equipmentType: passport.equipmentType,
    nickname: passport.nickname,
    manufacturer: passport.manufacturer,
    model: passport.model,
    caliberCategory: passport.caliber ?? passport.category,
    opticSightSummary: optic ? `${optic.manufacturer} ${optic.model}` : "",
    projectileAmmoSummary: projectile ? `${projectile.manufacturer} ${projectile.productLine}` : "",
    useCaseTags: passport.useCaseTags.join(", "),
    roundOrShotCount: String(passport.roundOrShotCount),
    privateNotes: passport.privateNotes ?? "",
    publicNotes: passport.publicNotes ?? "",
    isPublic: passport.isPublic
  };

  return (
    <section>
      <PageHeader
        eyebrow="Edit equipment passport"
        title={passport.nickname}
        description="Update the mock passport form values. Saving is local-only until the AWS backend is implemented."
      />
      <PassportForm mode="edit" initialValues={initialValues} cancelHref={`/passports/${passport.id}`} />
    </section>
  );
}
