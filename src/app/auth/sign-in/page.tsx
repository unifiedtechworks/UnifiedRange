import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { AuthStatusCard } from "@/components/AuthStatusCard";
import { PageHeader } from "@/components/PageHeader";

export default function SignInPlaceholderPage() {
  return (
    <section>
      <PageHeader
        eyebrow="Auth"
        title="Sign in to UnifiedRange"
        description="Use Amazon Cognito email and password auth. Saved account areas use AppSync-backed records, and signed-out browsing remains available with clearly labeled demo data."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <AuthForm />
        <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
          <h3 className="text-xl font-bold text-ink">Auth status</h3>
          <div className="mt-4">
            <AuthStatusCard />
          </div>
          <h3 className="mt-6 text-xl font-bold text-ink">Current boundaries</h3>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-ink/70">
            <li>Email and password authentication is active through Amazon Cognito.</li>
            <li>Saved account records use owner-scoped AppSync and DynamoDB data.</li>
            <li>Signed-out users can still browse clearly labeled demo data.</li>
            <li>Public Passport pages show sanitized public snapshots only.</li>
            <li>Private image uploads remain private S3 objects and are not published to Discover.</li>
          </ul>
          <Link href="/settings" className="mt-5 inline-flex rounded-md border border-ink/15 px-4 py-2 text-sm font-semibold text-ink">
            Back to settings
          </Link>
        </article>
      </div>
    </section>
  );
}
