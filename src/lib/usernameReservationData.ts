import type { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { normalizeUsername } from "@/lib/userProfileData";

type AmplifyDataClient = ReturnType<typeof generateClient<Schema>>;

export interface OwnerIdentity {
  canonicalOwnerKey: string;
  aliases: string[];
}

export interface UsernameReservationDiagnostics {
  normalizedUsername: string;
  currentOwnerKey: string;
  reservationOwnerId?: string;
  reservationExists: boolean;
  profileExists: boolean;
}

export type UsernameAvailability =
  | { status: "available"; message: string; diagnostics: UsernameReservationDiagnostics }
  | { status: "taken"; message: string; diagnostics: UsernameReservationDiagnostics }
  | { status: "own-reservation"; message: string; diagnostics: UsernameReservationDiagnostics };

export class UsernameReservationConflictError extends Error {
  diagnostics: UsernameReservationDiagnostics;

  constructor(diagnostics: UsernameReservationDiagnostics) {
    super("This username is reserved by another account. Public profile synchronization is paused pending manual review.");
    this.name = "UsernameReservationConflictError";
    this.diagnostics = diagnostics;
  }
}

function getGraphQLErrorMessage(errors?: Array<{ message: string }> | null) {
  return errors?.map((item) => item.message).join(" ") ?? "";
}

function isDuplicateReservationError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes("conditionalcheckfailed") || message.includes("already exists") || message.includes("duplicate") || message.includes("conflict");
}

export function ownerIdentityFromAuth(auth: { ownerKey: string; ownerAliases: string[] }): OwnerIdentity {
  return {
    canonicalOwnerKey: auth.ownerKey,
    aliases: [...new Set([auth.ownerKey, ...auth.ownerAliases])].filter(Boolean)
  };
}

export function shortOwnerIdentifier(value?: string) {
  if (!value) return "none";
  return value.length > 12 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
}

export async function checkUsernameAvailability(
  client: AmplifyDataClient,
  usernameValue: string,
  ownerIdentity: OwnerIdentity,
  profileExists = false
): Promise<UsernameAvailability> {
  const username = normalizeUsername(usernameValue);
  const result = await client.models.UsernameReservation.get({ id: username });

  if (result.errors?.length) {
    throw new Error(getGraphQLErrorMessage(result.errors) || "Username availability could not be checked.");
  }

  const diagnostics: UsernameReservationDiagnostics = {
    normalizedUsername: username,
    currentOwnerKey: ownerIdentity.canonicalOwnerKey,
    reservationOwnerId: result.data?.ownerId,
    reservationExists: Boolean(result.data),
    profileExists
  };

  if (!result.data) {
    return { status: "available", message: "Username available.", diagnostics };
  }

  if (ownerIdentity.aliases.includes(result.data.ownerId)) {
    return { status: "own-reservation", message: "Username is already reserved for your account.", diagnostics };
  }

  return { status: "taken", message: "That username is already taken.", diagnostics };
}

export async function ensureUsernameReservation(
  client: AmplifyDataClient,
  usernameValue: string,
  ownerIdentity: OwnerIdentity,
  profileExists = false
) {
  const username = normalizeUsername(usernameValue);
  const availability = await checkUsernameAvailability(client, username, ownerIdentity, profileExists);

  if (availability.status === "taken") {
    throw new UsernameReservationConflictError(availability.diagnostics);
  }

  if (availability.status === "own-reservation") {
    return availability;
  }

  const result = await client.models.UsernameReservation.create({
    id: username,
    username,
    ownerId: ownerIdentity.canonicalOwnerKey
  });

  if (result.errors?.length) {
    const message = getGraphQLErrorMessage(result.errors);
    if (isDuplicateReservationError(new Error(message))) {
      return ensureUsernameReservation(client, username, ownerIdentity, profileExists);
    }
    throw new Error(message || "Username could not be reserved.");
  }

  return {
    status: "own-reservation" as const,
    message: "Username reserved for your account.",
    diagnostics: { ...availability.diagnostics, reservationExists: true, reservationOwnerId: ownerIdentity.canonicalOwnerKey }
  };
}
