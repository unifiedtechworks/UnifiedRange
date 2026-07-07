import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { SessionCard } from "@/components/SessionCard";
import { rangeSessions } from "@/data/mockData";

export default function SessionsPage() {
  return (
    <section>
      <PageHeader
        eyebrow="Range sessions"
        title="Practice history"
        description="Review session context, equipment used, manually entered scores or groups, target photos, and confidence notes."
        action={
          <Link href="/sessions/new" className="inline-flex rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
            Log range session
          </Link>
        }
      />
      <div className="space-y-4">
        {rangeSessions.map((session) => (
          <SessionCard key={session.id} session={session} />
        ))}
      </div>
    </section>
  );
}
