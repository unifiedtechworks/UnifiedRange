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
  return "Amplify Auth is configured from amplify_outputs.json. Product screens still use mock data until data wiring is added.";
}

export function getAuthErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}
