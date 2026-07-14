import { HuntingReadinessDetail } from "@/components/HuntingReadinessDetail";

export default async function ReadinessDetailPage({ params }: { params: Promise<{ checklistId?: string }> }) {
  const { checklistId } = await params;
  return <HuntingReadinessDetail checklistId={checklistId} />;
}
