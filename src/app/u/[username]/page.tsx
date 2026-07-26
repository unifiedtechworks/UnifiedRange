import { PublicUserProfile } from "@/components/PublicUserProfile";

export default async function PublicUserProfilePage({ params }: { params: Promise<{ username?: string }> }) {
  const { username } = await params;
  return <PublicUserProfile username={username} />;
}
