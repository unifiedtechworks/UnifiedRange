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
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/optics" className="inline-flex justify-center rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink">
              Back to Optics / Sights
            </Link>
            <Link href={`/optics/${optic.id}/edit`} className="inline-flex justify-center rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
              Edit sight
            </Link>
          </div>
        }
      />
      <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <Tag>{optic.sightType.replace("_", " ")}</Tag>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-ink/70">
          UnifiedRange stores sight profile details for documentation only. It does not generate setup-change instructions or field guidance.
        </p>
        <dl className="mt-5 grid gap-x-6 md:grid-cols-2">
          <DetailRow label="Manufacturer" value={optic.manufacturer} />
          <DetailRow label="Model" value={optic.model} />
          <DetailRow label="Reticle / pin setup" value={optic.reticleOrPinSetup} />
          <DetailRow label="Magnification" value={optic.magnification} />
          <DetailRow label="Sight unit" value={optic.sightUnit} />
          <DetailRow label="Click value" value={optic.clickValue} />
          <DetailRow label="Private notes" value={optic.privateNotes ? "Private record exists" : "Not recorded"} />
        </dl>
      </article>
    </section>
  );
}
