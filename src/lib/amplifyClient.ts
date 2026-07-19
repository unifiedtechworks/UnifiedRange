import { Amplify } from "aws-amplify";
import outputs from "../../amplify_outputs.json";

let isConfigured = false;

export function configureAmplifyClient() {
  if (!isConfigured) {
    Amplify.configure(outputs);
    isConfigured = true;
  }
}

export function notifyAuthChanged() {
  if (typeof window !== "undefined") {
    window.setTimeout(() => {
      window.dispatchEvent(new Event("unifiedrange-auth-change"));
    }, 75);
  }
}

export function getAmplifyClientMessage() {
  return "Amplify is configured from amplify_outputs.json. Signed-in users can use saved account data, and signed-out users can browse clearly labeled demo data.";
}

export function getAuthErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.name === "UserAlreadyAuthenticatedException") {
      return "You are already signed in.";
    }

    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Something went wrong. Please try again.";
}

export function isAuthTokenClearedError(error: unknown) {
  const message = getAuthErrorMessage(error).toLowerCase();

  return (
    message.includes("novalidauthtokens") ||
    message.includes("no federated jwt") ||
    message.includes("nosigneduser") ||
    message.includes("no current user") ||
    message.includes("not authenticated") ||
    message.includes("invalid login token")
  );
}
