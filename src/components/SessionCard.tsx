import Link from "next/link";
import { getPassportById, getProjectileById } from "@/data/selectors";
import type { RangeSession } from "@/types";

export function SessionCard({
  session,
  sourceLabel,
  equipmentSummary,
  projectileSummary
}: {
  session: RangeSession;
  sourceLabel?: string;
  equipmentSummary?: string;
  projectileSummary?: string;
}) {
  const passport = getPassportById(session.equipmentPassportId);
  const projectile = getProjectileById(session.projectileProfileId);
  const displayedEquipment = equipmentSummary ?? passport?.nickname ?? "Unknown setup";
  const displayedProjectile = projectileSummary ?? projectile?.productLine ?? "Not assigned";

  return (
    <Link href={`/sessions/${session.id}`} className="block rounded-md border border-ink/10 bg-white p-4 shadow-soft transition hover:-translate-y-0.5 hover:border-steel/40">
      <div className="flex flex-col justify-between gap-3 sm:flex-row">
        <div>
          <p className="text-sm font-semibold text-clay">{new Date(`${session.date}T00:00:00`).toLocaleDateString()}</p>
          <h3 className="mt-1 text-lg font-bold text-ink">{session.discipline}</h3>
          <p className="mt-1 text-sm text-ink/65">{displayedEquipment}</p>
          {sourceLabel ? <p className="mt-1 text-xs font-semibold text-moss">{sourceLabel}</p> : null}
        </div>
        <div className="rounded-md bg-field px-3 py-2 text-sm font-semibold text-moss">
          Confidence {session.confidenceRating}/5
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        <div>
          <dt className="font-semibold text-ink">Distance</dt>
          <dd className="text-ink/65">
            {session.distance} {session.distanceUnit}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-ink">Position</dt>
          <dd className="text-ink/65">{session.position}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ink">Support</dt>
          <dd className="text-ink/65">{session.supportType}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ink">Projectile</dt>
          <dd className="text-ink/65">{displayedProjectile}</dd>
        </div>
      </dl>
    </Link>
  );
}
