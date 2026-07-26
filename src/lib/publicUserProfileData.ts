import type { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { normalizeUsername, type UserProfileRecord } from "@/lib/userProfileData";

type AmplifyDataClient = ReturnType<typeof generateClient<Schema>>;
export type PublicUserProfileRecord = Schema["PublicUserProfileSnapshot"]["type"];

export interface PublicUserIdentity {
  username: string;
  displayName?: string;
}

export function publicIdentityByOwner(records: PublicUserProfileRecord[]) {
  return Object.fromEntries(
    records
      .filter((record) => record.accountVisibility === "public")
      .map((record) => [record.ownerId, { username: record.username, displayName: record.displayName || undefined } satisfies PublicUserIdentity])
  );
}

export async function syncPublicUserProfileSnapshot(
  client: AmplifyDataClient,
  profile: UserProfileRecord,
  ownerId: string,
  usernameOwnershipValidated: true
) {
  if (!usernameOwnershipValidated) return;
  if (!profile.username) {
    return;
  }

  const username = normalizeUsername(profile.username);
  const isPublic = profile.accountVisibility === "public";
  const input = {
    ownerId,
    username,
    accountVisibility: isPublic ? ("public" as const) : ("private" as const),
    // A private snapshot remains discoverable only as a private-account state;
    // it carries no display name or bio for API clients to recover.
    displayName: isPublic ? profile.displayName.trim() : "",
    bio: isPublic ? (profile.bio ?? "").trim() : "",
    updatedAt: new Date().toISOString()
  };
  const existing = await client.models.PublicUserProfileSnapshot.get({ id: username });

  if (existing.errors?.length) {
    throw new Error(existing.errors.map((item) => item.message).join(" "));
  }

  const result = existing.data
    ? await client.models.PublicUserProfileSnapshot.update({ id: existing.data.id, ...input })
    : await client.models.PublicUserProfileSnapshot.create({ id: username, ...input, createdAt: new Date().toISOString() });

  if (result.errors?.length) {
    throw new Error(result.errors.map((item) => item.message).join(" "));
  }
}

export async function removeOwnedStalePublicUserProfileSnapshot(
  client: AmplifyDataClient,
  usernameValue: string,
  allowedOwnerIds: string[]
) {
  const username = normalizeUsername(usernameValue);
  if (!username) return;

  const existing = await client.models.PublicUserProfileSnapshot.get({ id: username });
  if (existing.errors?.length) {
    throw new Error(existing.errors.map((item) => item.message).join(" "));
  }

  if (!existing.data || !allowedOwnerIds.includes(existing.data.ownerId)) {
    return;
  }

  const result = await client.models.PublicUserProfileSnapshot.delete({ id: existing.data.id });
  if (result.errors?.length) {
    throw new Error(result.errors.map((item) => item.message).join(" "));
  }
}
