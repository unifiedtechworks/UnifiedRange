import { OpticSightProfileDetail } from "@/components/OpticSightProfileDetail";

export default function OpticDetailPage({ params }: { params: { opticId: string } }) {
  return <OpticSightProfileDetail opticId={params.opticId} />;
}
