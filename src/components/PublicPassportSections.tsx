import type { SanitizedPublicPassport } from "@/types";

export function ReactionBar({ passport }: { passport: SanitizedPublicPassport }) {
  return (
    <div className="flex flex-wrap gap-2">
      <span className="rounded-md bg-field px-3 py-2 text-sm font-semibold text-moss">Helpful {passport.reactions.helpful}</span>
      <span className="rounded-md bg-field px-3 py-2 text-sm font-semibold text-moss">Similar to mine {passport.reactions.similar}</span>
      <span className="rounded-md bg-field px-3 py-2 text-sm font-semibold text-moss">Well documented {passport.reactions.wellDocumented}</span>
    </div>
  );
}

export function PublicRangeSessionList({ passport }: { passport: SanitizedPublicPassport }) {
  if (passport.publicRangeSessions.length === 0) {
    return <p className="text-sm text-ink/65">No public range-session summaries are shared for this setup.</p>;
  }

  return (
    <div className="space-y-3">
      {passport.publicRangeSessions.map((session) => (
        <article key={session.id} className="rounded-md border border-ink/10 bg-paper p-4">
          <div className="flex flex-col justify-between gap-2 sm:flex-row">
            <div>
              <p className="text-sm font-semibold text-clay">{new Date(`${session.date}T00:00:00`).toLocaleDateString()}</p>
              <h4 className="mt-1 text-base font-bold text-ink">{session.discipline}</h4>
            </div>
            <span className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-ink">{session.confidenceRating}/5 confidence</span>
          </div>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="font-semibold text-ink">Distance</dt>
              <dd className="text-ink/65">{session.distanceLabel}</dd>
            </div>
            <div>
              <dt className="font-semibold text-ink">Position</dt>
              <dd className="text-ink/65">{session.position}</dd>
            </div>
            <div>
              <dt className="font-semibold text-ink">Group / score</dt>
              <dd className="text-ink/65">{session.groupOrScore ?? "Not shared"}</dd>
            </div>
          </dl>
          {session.notes ? <p className="mt-3 text-sm leading-6 text-ink/70">{session.notes}</p> : null}
        </article>
      ))}
    </div>
  );
}

export function PublicPhotoPlaceholderList({ passport }: { passport: SanitizedPublicPassport }) {
  if (passport.publicPhotoPlaceholders.length === 0) {
    return <p className="text-sm text-ink/65">No public target photo placeholders are shared for this setup.</p>;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {passport.publicPhotoPlaceholders.map((photo) => (
        <article key={photo.id} className="rounded-md border border-dashed border-ink/20 bg-paper p-4">
          <p className="text-sm font-bold text-ink">{photo.caption ?? "Shared target photo placeholder"}</p>
          <p className="mt-1 text-xs text-ink/60">Manual entry: {photo.manualEntry ?? "Not shared"}</p>
          <p className="mt-3 text-xs leading-5 text-ink/55">Image metadata is excluded from public preview data.</p>
        </article>
      ))}
    </div>
  );
}
