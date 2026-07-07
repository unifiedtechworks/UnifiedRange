import { PageHeader } from "@/components/PageHeader";
import { RangeSessionForm } from "@/components/RangeSessionForm";
import { equipmentPassports, optics, projectiles } from "@/data/mockData";

export default function NewSessionPage() {
  return (
    <section>
      <PageHeader
        eyebrow="New range session"
        title="Log a practice record"
        description="Link equipment, projectiles, and sights to a historical range-session note. This is mock-data-only for now."
      />
      <RangeSessionForm
        mode="create"
        cancelHref="/sessions"
        passportOptions={equipmentPassports.map((passport) => ({ id: passport.id, label: passport.nickname }))}
        projectileOptions={projectiles.map((projectile) => ({ id: projectile.id, label: `${projectile.manufacturer} ${projectile.productLine}` }))}
        opticOptions={optics.map((optic) => ({ id: optic.id, label: `${optic.manufacturer} ${optic.model}` }))}
      />
    </section>
  );
}
