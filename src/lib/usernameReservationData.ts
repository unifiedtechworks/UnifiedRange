import type { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { normalizeUsername } from "@/lib/userProfileData";

type AmplifyDataClient = ReturnType<typeof generateClient<Schema>>;

export type UsernameAvailability =
  | { status: "available"; message: string }
  | { status: "taken"; message: string }
  | { status: "own-reservation"; message: string };

function getGraphQLErrorMessage(errors?: Array<{ message: string }> | null) {
  return errors?.map((item) => item.message).join(" ") ?? "";
}

function isDuplicateReservationError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes("conditionalcheckfailed") || message.includes("already exists") || message.includes("duplicate") || message.includes("conflict");
}

export async function checkUsernameAvailability(client: AmplifyDataClient, usernameValue: string, ownerId: string): Promise<UsernameAvailability> {
  const username = normalizeUsername(usernameValue);
  const result = await client.models.UsernameReservation.get({ id: username });

  if (result.errors?.length) {
    throw new Error(getGraphQLErrorMessage(result.errors) || "Username availability could not be checked.");
  }

  if (!result.data) {
    return { status: "available", message: "Username available." };
  }

  if (result.data.ownerId === ownerId) {
    return { status: "own-reservation", message: "Username is already reserved for your account." };
  }

  return { status: "taken", message: "That username is already taken." };
}

export async function ensureUsernameReservation(client: AmplifyDataClient, usernameValue: string, ownerId: string) {
  const username = normalizeUsername(usernameValue);
  const availability = await checkUsernameAvailability(client, username, ownerId);

  if (availability.status === "taken") {
    throw new Error(availability.message);
  }

  if (availability.status === "own-reservation") {
    return;
  }

  const result = await client.models.UsernameReservation.create({
    id: username,
    username,
    ownerId
  });

  if (result.errors?.length) {
    const message = getGraphQLErrorMessage(result.errors);
    throw new Error(isDuplicateReservationError(new Error(message)) ? "That username is already taken." : message || "Username could not be reserved.");
  }
}
