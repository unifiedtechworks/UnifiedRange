import Link from "next/link";
import { notFound } from "next/navigation";
import { DetailRow } from "@/components/DetailRow";
import { PageHeader } from "@/components/PageHeader";
import { Tag } from "@/components/Tag";
import { getOpticById } from "@/data/selectors";

export default function OpticDetailPage({ params }: { params: { opticId: string } }) {
  const optic = getOpticById(params.opticId);

  if (!optic) {
    notFound();
  }

  return (
    <section>
      <PageHeader
        eyebrow="Optics / sights"
        title={`${optic.manufacturer} ${optic.model}`}
        description={optic.publicNotes ?? "Sight profile documentation."}
        action={
          <Link href={`/optics/${optic.id}/edit`} className="inline-flex rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
            Edit sight
          </Link>
        }
      />
      <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <Tag>{optic.sightType.replace("_", " ")}</Tag>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-ink/70">
          UnifiedRange stores sight profile details for documentation only. It does not calculate corrections or provide adjustment instructions.
        </p>
        <dl className="mt-5 grid gap-x-6 md:grid-cols-2">
          <DetailRow label="Manufacturer" value={optic.manufacturer} />
          <DetailRow label="Model" value={optic.model} />
          <DetailRow label="Reticle / pin setup" value={optic.reticleOrPinSetup} />
          <DetailRow label="Magnification" value={optic.magnification} />
          <DetailRow label="Adjustment unit" value={optic.adjustmentUnit} />
          <DetailRow label="Click value" value={optic.clickValue} />
          <DetailRow label="Private notes" value={optic.privateNotes ? "Private record exists" : "Not recorded"} />
        </dl>
      </article>
    </section>
  );
}
