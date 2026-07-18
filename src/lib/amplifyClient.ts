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
    window.dispatchEvent(new Event("unifiedrange-auth-change"));
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

  return "Something went wrong. Please try again.";
}
