import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { PrivacySettingsPanel } from "@/components/PrivacySettingsPanel";

export default function PrivacySettingsPage() {
  return (
    <section>
      <PageHeader
        eyebrow="Privacy settings"
        title="Sharing controls"
        description="Manage privacy defaults for Public Passports, private images, protected notes, and public profile visibility."
        action={
          <Link href="/settings" className="inline-flex rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink">
            Back to settings
          </Link>
        }
      />
      <PrivacySettingsPanel />
    </section>
  );
}
