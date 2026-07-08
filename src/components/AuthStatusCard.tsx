import Link from "next/link";
import { getAmplifyClientStatus } from "@/lib/amplifyClient";

export function AuthStatusCard() {
  const status = getAmplifyClientStatus();

  return (
    <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">AWS foundation</p>
          <h3 className="mt-2 text-xl font-bold text-ink">Cognito auth placeholder</h3>
          <p className="mt-3 text-sm leading-6 text-ink/70">{status.message}</p>
        </div>
        <span className="w-fit rounded-md bg-field px-3 py-1 text-xs font-semibold text-ink">
          {status.configured ? "Configured" : "Mock mode"}
        </span>
      </div>
      <Link href="/auth/sign-in" className="mt-4 inline-flex rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
        View sign-in placeholder
      </Link>
    </article>
  );
}
