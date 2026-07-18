import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { PrivacySettingsPanel } from "@/components/PrivacySettingsPanel";

export default function PrivacySettingsPage() {
  return (
    <section>
      <PageHeader
        eyebrow="Privacy settings"
        title="Sharing controls"
        description="Review privacy defaults for Public Passports, image cleanup, private notes, and public profile behavior. These preference controls are local-only in hosted dev."
        action={
          <Link href="/settings" className="inline-flex rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink">
            Back to Settings
          </Link>
        }
      />
      <PrivacySettingsPanel />
    </section>
  );
}
