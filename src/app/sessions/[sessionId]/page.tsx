import { RangeSessionDetail } from "@/components/RangeSessionDetail";

export default async function SessionDetailPage({ params }: { params: Promise<{ sessionId?: string }> }) {
  const { sessionId } = await params;
  return <RangeSessionDetail sessionId={sessionId} />;
}
