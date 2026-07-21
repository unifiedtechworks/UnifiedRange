"use client";

import { generateClient } from "aws-amplify/data";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { useAuthUser } from "@/hooks/useAuthUser";
import { configureAmplifyClient, getAuthErrorMessage, isAuthTokenClearedError } from "@/lib/amplifyClient";
import { countPendingReports, hasModerationAccess, sortModerationReports } from "@/lib/moderationAccess";
import { buildReporterIdentityMap, type ReporterIdentity } from "@/lib/moderationReporterIdentity";

export type ModerationReportRecord = Schema["Report"]["type"];
export type ModerationReportState = "loading" | "signed-out" | "access-denied" | "ready" | "error";

export function useModerationReports() {
  const client = useMemo(() => {
    configureAmplifyClient();
    return generateClient<Schema>();
  }, []);
  const { authState } = useAuthUser();
  const [state, setState] = useState<ModerationReportState>("loading");
  const [reports, setReports] = useState<ModerationReportRecord[]>([]);
  const [reporterIdentities, setReporterIdentities] = useState<Record<string, ReporterIdentity>>({});
  const [error, setError] = useState("");
  const [identityWarning, setIdentityWarning] = useState("");
  const canAccessModeration = hasModerationAccess(authState);

  const loadReports = useCallback(async () => {
    setError("");
    setIdentityWarning("");

    if (authState.status === "loading") {
      setState("loading");
      return;
    }

    if (authState.status !== "signed-in") {
      setReports([]);
      setReporterIdentities({});
      setState("signed-out");
      return;
    }

    if (!canAccessModeration) {
      setReports([]);
      setReporterIdentities({});
      setState("access-denied");
      return;
    }

    try {
      const result = await client.models.Report.list();

      if (result.errors?.length) {
        throw new Error(result.errors.map((item) => item.message).join(" "));
      }

      setReports(sortModerationReports(result.data));

      try {
        const reporterIds = [...new Set(result.data.map((report) => report.reporterId))];
        const [reservationResults, profileResult] = await Promise.all([
          Promise.all(
            reporterIds.map((reporterId) =>
              client.models.UsernameReservation.list({
                filter: { ownerId: { eq: reporterId } }
              })
            )
          ),
          // UserProfile remains owner-scoped. This can return only the signed-in
          // moderator's own profile; it does not grant access to reporter profiles.
          client.models.UserProfile.list({ filter: { ownerId: { eq: authState.username } } })
        ]);

        if (reservationResults.some((reservationResult) => reservationResult.errors?.length) || profileResult.errors?.length) {
          throw new Error("Reporter identity lookup returned an error.");
        }

        setReporterIdentities(buildReporterIdentityMap(reservationResults.flatMap((reservationResult) => reservationResult.data), profileResult.data));
      } catch {
        setReporterIdentities({});
        setIdentityWarning("Some reporter names could not be resolved. Internal ID fallbacks are shown.");
      }

      setState("ready");
    } catch (reportError) {
      setReports([]);
      setReporterIdentities({});

      if (isAuthTokenClearedError(reportError)) {
        setState("signed-out");
        return;
      }

      setError(getAuthErrorMessage(reportError));
      setState("error");
    }
  }, [authState.status, authState.username, canAccessModeration, client]);

  useEffect(() => {
    let ignore = false;

    const loadInitialState = window.setTimeout(() => {
      if (!ignore) {
        void loadReports();
      }
    }, 0);

    return () => {
      ignore = true;
      window.clearTimeout(loadInitialState);
    };
  }, [loadReports]);

  return {
    state,
    reports,
    reporterIdentities,
    error,
    identityWarning,
    pendingCount: countPendingReports(reports),
    canAccessModeration,
    reloadReports: loadReports
  };
}
