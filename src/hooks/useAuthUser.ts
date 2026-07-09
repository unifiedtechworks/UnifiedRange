"use client";

import { fetchUserAttributes, getCurrentUser } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { configureAmplifyClient, getAuthErrorMessage } from "@/lib/amplifyClient";

export type AuthUserState =
  | { status: "loading"; label: "Checking session..."; username?: string; error?: string }
  | { status: "signed-out"; label: string; username?: string; error?: string }
  | { status: "signed-in"; label: string; username: string; error?: string };

const authCheckTimeoutMs = 8000;
const authListeners = new Set<() => void>();

let currentAuthState: AuthUserState = { status: "loading", label: "Checking session..." };
let authRequestId = 0;
let hasBoundAuthEvents = false;

function withTimeout<T>(promise: Promise<T>, timeoutMessage: string) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(timeoutMessage)), authCheckTimeoutMs);
    })
  ]);
}

function isSignedOutMessage(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("auth") || normalized.includes("user") || normalized.includes("not authenticated") || normalized.includes("no current user");
}

function emitAuthState(nextState: AuthUserState) {
  currentAuthState = nextState;
  authListeners.forEach((listener) => listener());
}

function subscribeAuthState(listener: () => void) {
  authListeners.add(listener);
  return () => {
    authListeners.delete(listener);
  };
}

function getAuthSnapshot() {
  return currentAuthState;
}

export async function getCurrentAuthUserSafe(): Promise<AuthUserState> {
  try {
    configureAmplifyClient();
    const currentUser = await withTimeout(getCurrentUser(), "Auth check timed out. Please try refreshing the page.");
    let label = currentUser.signInDetails?.loginId ?? currentUser.username;

    try {
      const attributes = await withTimeout(fetchUserAttributes(), "User attributes timed out. Please try refreshing the page.");
      label = attributes.email ?? label;
    } catch {
      // getCurrentUser succeeded, so the session is valid enough for app state.
      // Attribute lookup can briefly fail right after sign-in; keep signed-in.
    }

    return {
      status: "signed-in",
      username: currentUser.username,
      label
    };
  } catch (authError) {
    const message = getAuthErrorMessage(authError);

    if (isSignedOutMessage(message)) {
      return { status: "signed-out", label: "No active Cognito session" };
    }

    return { status: "signed-out", label: "Unable to confirm session", error: message };
  }
}

export async function refreshSharedAuthState({ showLoading = true }: { showLoading?: boolean } = {}) {
  const requestId = authRequestId + 1;
  authRequestId = requestId;

  if (showLoading) {
    emitAuthState({ status: "loading", label: "Checking session..." });
  }

  const nextState = await getCurrentAuthUserSafe();

  if (requestId === authRequestId) {
    emitAuthState(nextState);
  }

  return nextState;
}

function bindAuthEvents() {
  if (hasBoundAuthEvents || typeof window === "undefined") {
    return;
  }

  hasBoundAuthEvents = true;

  window.addEventListener("unifiedrange-auth-change", () => {
    void refreshSharedAuthState({ showLoading: false });
  });

  Hub.listen("auth", ({ payload }) => {
    const eventName = payload.event.toLowerCase();

    if (eventName.includes("signin") || eventName.includes("signout") || eventName.includes("signup") || eventName.includes("confirm")) {
      void refreshSharedAuthState({ showLoading: false });
    }
  });
}

export function useAuthUser() {
  const authState = useSyncExternalStore(subscribeAuthState, getAuthSnapshot, getAuthSnapshot);

  const refreshAuthState = useCallback(async () => {
    return refreshSharedAuthState();
  }, []);

  useEffect(() => {
    bindAuthEvents();
    const loadInitialState = window.setTimeout(() => {
      void refreshSharedAuthState({ showLoading: currentAuthState.status === "loading" });
    }, 0);

    return () => {
      window.clearTimeout(loadInitialState);
    };
  }, []);

  return { authState, refreshAuthState };
}
