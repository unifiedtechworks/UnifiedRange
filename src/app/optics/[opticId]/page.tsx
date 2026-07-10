import { OpticSightProfileDetail } from "@/components/OpticSightProfileDetail";

export default async function OpticDetailPage({ params }: { params: Promise<{ opticId?: string }> }) {
  const { opticId } = await params;
  return <OpticSightProfileDetail opticId={opticId} />;
}
