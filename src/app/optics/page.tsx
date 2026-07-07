import { DetailRow } from "@/components/DetailRow";
import { PageHeader } from "@/components/PageHeader";
import { optics } from "@/data/mockData";

export default function OpticsPage() {
  return (
    <section>
      <PageHeader
        eyebrow="Optics / sights"
        title="Sight profile documentation"
        description="Record optic and sight details for setup history. This page stores notes only and does not calculate adjustments."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {optics.map((optic) => (
          <article key={optic.id} className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-steel">{optic.sightType.replace("_", " ")}</p>
            <h3 className="mt-2 text-xl font-bold text-ink">{optic.manufacturer} {optic.model}</h3>
            <p className="mt-2 text-sm leading-6 text-ink/65">{optic.publicNotes}</p>
            <dl className="mt-4">
              <DetailRow label="Reticle / pin setup" value={optic.reticleOrPinSetup} />
              <DetailRow label="Magnification" value={optic.magnification} />
              <DetailRow label="Adjustment unit" value={optic.adjustmentUnit} />
              <DetailRow label="Click value" value={optic.clickValue} />
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
