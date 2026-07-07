import { PageHeader } from "@/components/PageHeader";
import { PassportForm } from "@/components/PassportForm";

export default function NewPassportPage() {
  return (
    <section>
      <PageHeader
        eyebrow="New equipment passport"
        title="Create a private setup record"
        description="Start with the setup details you want to track. This placeholder form keeps values local until the AWS backend is implemented."
      />
      <PassportForm mode="create" cancelHref="/passports" />
    </section>
  );
}
