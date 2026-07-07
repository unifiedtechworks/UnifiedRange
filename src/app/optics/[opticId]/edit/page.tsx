import { notFound } from "next/navigation";
import { OpticSightForm, type OpticSightFormValues } from "@/components/OpticSightForm";
import { PageHeader } from "@/components/PageHeader";
import { getOpticById } from "@/data/selectors";

export default function EditOpticPage({ params }: { params: { opticId: string } }) {
  const optic = getOpticById(params.opticId);

  if (!optic) {
    notFound();
  }

  const initialValues: OpticSightFormValues = {
    sightType: optic.sightType,
    manufacturer: optic.manufacturer,
    model: optic.model,
    reticleOrPinSetup: optic.reticleOrPinSetup ?? "",
    magnification: optic.magnification ?? "",
    adjustmentUnit: optic.adjustmentUnit ?? "",
    clickValue: optic.clickValue ?? "",
    privateNotes: optic.privateNotes ?? "",
    publicNotes: optic.publicNotes ?? ""
  };

  return (
    <section>
      <PageHeader
        eyebrow="Edit optic / sight"
        title={`${optic.manufacturer} ${optic.model}`}
        description="Update mock sight profile values. Saving is local-only until the AWS backend is implemented."
      />
      <OpticSightForm mode="edit" initialValues={initialValues} cancelHref={`/optics/${optic.id}`} />
    </section>
  );
}
