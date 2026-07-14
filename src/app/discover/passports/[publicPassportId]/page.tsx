import { PublicPassportDetail } from "@/components/PublicPassportDetail";

export default async function PublicPassportDetailPage({ params }: { params: Promise<{ publicPassportId?: string }> }) {
  const { publicPassportId } = await params;
  return <PublicPassportDetail publicPassportId={publicPassportId} />;
}
