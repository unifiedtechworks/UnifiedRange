import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { AuthStatusCard } from "@/components/AuthStatusCard";
import { PageHeader } from "@/components/PageHeader";

export default async function SignInPlaceholderPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;

  return (
    <section>
      <PageHeader
        eyebrow="Account"
        title="Sign in to UnifiedRange"
        description="Sign in with your email and password, or create an account to save private records. Public pages and clearly labeled sample content remain available while signed out."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <AuthForm initialMode={mode === "sign-up" ? "sign-up" : "sign-in"} />
        <article className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
          <h3 className="text-xl font-bold text-ink">Account status</h3>
          <div className="mt-4">
            <AuthStatusCard />
          </div>
          <h3 className="mt-6 text-xl font-bold text-ink">Privacy boundaries</h3>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-ink/70">
            <li>Email and password protect access to your account.</li>
            <li>Saved account records are visible only to their owner.</li>
            <li>Signed-out visitors can browse public pages and clearly labeled sample data.</li>
            <li>Public Passport pages show sanitized public snapshots only.</li>
            <li>Private image uploads are never published to Discover.</li>
          </ul>
          <Link href="/settings" className="mt-5 inline-flex rounded-md border border-ink/15 px-4 py-2 text-sm font-semibold text-ink">
            Back to settings
          </Link>
        </article>
      </div>
    </section>
  );
}
