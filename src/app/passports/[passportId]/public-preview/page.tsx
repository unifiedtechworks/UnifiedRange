import { PublicPassportPreview } from "@/components/PublicPassportPreview";

export default async function PublicPassportPreviewPage({ params }: { params: Promise<{ passportId?: string }> }) {
  const { passportId } = await params;
  return <PublicPassportPreview passportId={passportId} />;
}
