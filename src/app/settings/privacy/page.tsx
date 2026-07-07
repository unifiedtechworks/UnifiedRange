import { PageHeader } from "@/components/PageHeader";
import { PrivacySettingsPanel } from "@/components/PrivacySettingsPanel";

export default function PrivacySettingsPage() {
  return (
    <section>
      <PageHeader
        eyebrow="Privacy settings"
        title="Mock sharing controls"
        description="Review future privacy defaults for Public Passports, image cleanup, private notes, and public profile behavior."
      />
      <PrivacySettingsPanel />
    </section>
  );
}
