import Link from "next/link";
import { AuthStatusCard } from "@/components/AuthStatusCard";
import { PageHeader } from "@/components/PageHeader";

export default function SignInPlaceholderPage() {
  return (
    <section>
      <PageHeader
        eyebrow="Auth"
        title="Sign-in placeholder"
        description="UnifiedRange will use Amazon Cognito for email and password sign-up and sign-in. Mock data remains available while the AWS backend foundation is prepared."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <AuthStatusCard />
        <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
          <h3 className="text-xl font-bold text-ink">Planned auth behavior</h3>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-ink/70">
            <li>Email and password authentication through Amazon Cognito.</li>
            <li>Private records scoped to the signed-in owner.</li>
            <li>Public Passport snapshots remain sanitized before discovery sharing.</li>
            <li>Comments, reactions, and reports require a signed-in account.</li>
          </ul>
          <Link href="/settings" className="mt-5 inline-flex rounded-md border border-ink/15 px-4 py-2 text-sm font-semibold text-ink">
            Back to settings
          </Link>
        </article>
      </div>
    </section>
  );
}
