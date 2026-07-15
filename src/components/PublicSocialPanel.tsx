"use client";

import { generateClient } from "aws-amplify/data";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { useAuthUser } from "@/hooks/useAuthUser";
import { configureAmplifyClient, getAuthErrorMessage } from "@/lib/amplifyClient";
import { formatCommentDate, reactionCounts, reportReasons, type CommentRecord, type ReactionRecord } from "@/lib/publicSocialData";
import type { ReactionType } from "@/types";

type LoadState = "loading" | "ready";

let hasLoggedReactionLoadError = false;

function isAuthorizationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes("not authorized");
}

export function PublicSocialPanel({ publicPassportId, publicPassportTitle }: { publicPassportId: string; publicPassportTitle: string }) {
  return (
    <div className="space-y-6">
      <PublicReactions publicPassportId={publicPassportId} />
      <PublicComments publicPassportId={publicPassportId} publicPassportTitle={publicPassportTitle} />
      <PublicReportPanel targetType="public_passport" targetId={publicPassportId} targetLabel={publicPassportTitle} contextLabel="public passport" />
    </div>
  );
}

function PublicReactions({ publicPassportId }: { publicPassportId: string }) {
  const client = useMemo(() => {
    configureAmplifyClient();
    return generateClient<Schema>();
  }, []);
  const { authState } = useAuthUser();
  const [state, setState] = useState<LoadState>("loading");
  const [reactions, setReactions] = useState<ReactionRecord[]>([]);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const loadReactions = useCallback(async () => {
    setError("");
    setState("loading");

    try {
      // Reaction counts are public-safe aggregate UI. Always load them with API-key
      // auth so signed-out visitors never trigger Cognito header resolution.
      const filter = {
        targetType: { eq: "public_passport" },
        targetId: { eq: publicPassportId }
      } as const;
      let result = await client.models.Reaction.list({
        filter,
        authMode: "apiKey"
      });

      if (result.errors?.length) {
        const apiKeyError = new Error(result.errors.map((item) => item.message).join(" "));

        if (authState.status !== "signed-in" || !isAuthorizationError(apiKeyError)) {
          throw apiKeyError;
        }

        // If a local sandbox has not picked up the public Reaction read auth yet,
        // signed-in visitors can still use the authenticated read rule.
        result = await client.models.Reaction.list({ filter });

        if (result.errors?.length) {
          throw new Error(result.errors.map((item) => item.message).join(" "));
        }
      }

      setReactions(result.data);
    } catch (loadError) {
      if (!hasLoggedReactionLoadError) {
        console.warn("Unable to load public reactions", loadError);
        hasLoggedReactionLoadError = true;
      }

      setError("Reactions unavailable.");
      setReactions([]);
    } finally {
      setState("ready");
    }
  }, [authState.status, client, publicPassportId]);

  useEffect(() => {
    const loadInitialState = window.setTimeout(() => {
      void loadReactions();
    }, 0);

    return () => {
      window.clearTimeout(loadInitialState);
    };
  }, [loadReactions]);

  async function toggleReaction(reactionType: ReactionType) {
    if (authState.status !== "signed-in") {
      setError("Sign in to react to public setups.");
      return;
    }

    setError("");
    setIsSaving(true);

    try {
      const existingReaction = reactions.find((reaction) => reaction.userId === authState.username && reaction.reactionType === reactionType);
      const result = existingReaction
        ? await client.models.Reaction.delete({ id: existingReaction.id })
        : await client.models.Reaction.create({
            userId: authState.username,
            targetType: "public_passport",
            targetId: publicPassportId,
            reactionType,
            createdAt: new Date().toISOString()
          });

      if (result.errors?.length) {
        throw new Error(result.errors.map((item) => item.message).join(" "));
      }

      await loadReactions();
    } catch (reactionError) {
      console.error("Unable to update reaction", reactionError);
      setError(getAuthErrorMessage(reactionError));
    } finally {
      setIsSaving(false);
    }
  }

  const counts = reactionCounts(reactions);

  return (
    <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
      <h3 className="text-xl font-bold text-ink">Reactions</h3>
      <p className="mt-2 text-sm leading-6 text-ink/65">
        {authState.status === "signed-in" ? "React to useful setup documentation." : "Sign in to react. Reaction counts are public."}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {counts.map((reaction) => {
          const isSelected = authState.status === "signed-in" && reactions.some((item) => item.userId === authState.username && item.reactionType === reaction.type);

          return (
            <button
              key={reaction.type}
              type="button"
              disabled={isSaving}
              onClick={() => void toggleReaction(reaction.type)}
              className={`rounded-md px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${isSelected ? "bg-moss text-white" : "bg-field text-moss"}`}
            >
              {reaction.label} {reaction.count}
            </button>
          );
        })}
      </div>
      {state === "loading" ? <p className="mt-3 text-sm text-ink/60">Loading reactions...</p> : null}
      {error ? <p className="mt-3 rounded-md border border-clay/30 bg-clay/10 px-3 py-2 text-sm font-semibold text-clay">{error}</p> : null}
    </section>
  );
}

function PublicComments({ publicPassportId, publicPassportTitle }: { publicPassportId: string; publicPassportTitle: string }) {
  const client = useMemo(() => {
    configureAmplifyClient();
    return generateClient<Schema>();
  }, []);
  const { authState } = useAuthUser();
  const [comments, setComments] = useState<CommentRecord[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadComments = useCallback(async () => {
    setError("");

    if (authState.status === "loading") {
      setIsLoading(true);
      return;
    }

    if (authState.status !== "signed-in") {
      setComments([]);
      setIsLoading(false);
      return;
    }

    try {
      const result = await client.models.Comment.list({
        filter: {
          targetType: { eq: "public_passport" },
          targetId: { eq: publicPassportId }
        }
      });

      if (result.errors?.length) {
        throw new Error(result.errors.map((item) => item.message).join(" "));
      }

      setComments([...result.data].sort((a, b) => new Date(b.createdAt ?? "").getTime() - new Date(a.createdAt ?? "").getTime()));
    } catch (loadError) {
      console.error("Unable to load comments", loadError);
      setError("Comments could not be loaded.");
      setComments([]);
    } finally {
      setIsLoading(false);
    }
  }, [authState.status, client, publicPassportId]);

  useEffect(() => {
    const loadInitialState = window.setTimeout(() => {
      void loadComments();
    }, 0);

    return () => {
      window.clearTimeout(loadInitialState);
    };
  }, [loadComments]);

  async function submitComment() {
    if (authState.status !== "signed-in") {
      setError("Sign in to comment on public setups.");
      return;
    }

    if (!body.trim()) {
      setError("Write a short comment before submitting.");
      return;
    }

    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const result = await client.models.Comment.create({
        authorId: authState.username,
        targetType: "public_passport",
        targetId: publicPassportId,
        body: body.trim(),
        status: "visible",
        createdAt: new Date().toISOString()
      });

      if (result.errors?.length) {
        throw new Error(result.errors.map((item) => item.message).join(" "));
      }

      setBody("");
      setSuccess("Comment posted.");
      await loadComments();
    } catch (commentError) {
      console.error("Unable to post comment", commentError);
      setError(getAuthErrorMessage(commentError));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
      <h3 className="text-xl font-bold text-ink">Comments</h3>
      <p className="mt-2 text-sm leading-6 text-ink/65">
        Comments are for setup questions, experience, and documentation. No sales, threats, personal information, illegal activity, or unsafe content.
      </p>

      {authState.status === "signed-in" ? (
        <div className="mt-4">
          <label className="block">
            <span className="text-sm font-semibold text-ink">Add a comment about {publicPassportTitle}</span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={3}
              className="mt-2 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-moss"
            />
          </label>
          <button type="button" disabled={isSaving} onClick={() => void submitComment()} className="mt-3 inline-flex rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
            {isSaving ? "Posting..." : "Post comment"}
          </button>
        </div>
      ) : (
        <p className="mt-4 rounded-md border border-ink/10 bg-paper p-4 text-sm leading-6 text-ink/70">
          Comments are available to signed-in users. <Link href="/auth/sign-in" className="font-semibold text-moss">Sign in</Link> to read and add comments.
        </p>
      )}

      {isLoading ? <p className="mt-4 text-sm text-ink/60">Loading comments...</p> : null}
      {error ? <p className="mt-3 rounded-md border border-clay/30 bg-clay/10 px-3 py-2 text-sm font-semibold text-clay">{error}</p> : null}
      {success ? <p className="mt-3 rounded-md border border-moss/30 bg-field px-3 py-2 text-sm font-semibold text-moss">{success}</p> : null}

      {authState.status === "signed-in" ? (
        <div className="mt-5 space-y-3">
          {comments.length === 0 && !isLoading ? <p className="text-sm text-ink/65">No comments yet.</p> : null}
          {comments.map((comment) => (
            <article key={comment.id} className="rounded-md border border-ink/10 bg-paper p-4">
              <div className="flex flex-col justify-between gap-2 sm:flex-row">
                <p className="text-sm font-semibold text-ink">{comment.authorId}</p>
                <p className="text-xs text-ink/55">{formatCommentDate(comment.createdAt)}</p>
              </div>
              <p className="mt-2 text-sm leading-6 text-ink/75">{comment.body}</p>
              <div className="mt-3">
                <PublicReportPanel targetType="comment" targetId={comment.id} targetLabel="comment" contextLabel="comment" compact />
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function PublicReportPanel({
  targetId,
  targetType,
  targetLabel,
  contextLabel,
  compact = false
}: {
  targetId: string;
  targetType: "public_passport" | "comment";
  targetLabel: string;
  contextLabel: string;
  compact?: boolean;
}) {
  const client = useMemo(() => {
    configureAmplifyClient();
    return generateClient<Schema>();
  }, []);
  const { authState } = useAuthUser();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState(reportReasons[0]);
  const [details, setDetails] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function submitReport() {
    if (authState.status !== "signed-in") {
      setError("Sign in to report content.");
      return;
    }

    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const result = await client.models.Report.create({
        reporterId: authState.username,
        targetType,
        targetId,
        reason,
        details: details.trim(),
        status: "open",
        createdAt: new Date().toISOString()
      });

      if (result.errors?.length) {
        throw new Error(result.errors.map((item) => item.message).join(" "));
      }

      setSuccess("Report submitted.");
      setDetails("");
      setIsOpen(false);
    } catch (reportError) {
      console.error("Unable to submit report", reportError);
      setError(getAuthErrorMessage(reportError));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div>
      {authState.status === "signed-in" ? (
        <button
          type="button"
          onClick={() => {
            setIsOpen((current) => !current);
            setError("");
            setSuccess("");
          }}
          className={`inline-flex rounded-md border border-clay/40 bg-white px-3 py-2 text-sm font-semibold text-clay ${compact ? "px-2 py-1 text-xs" : ""}`}
        >
          Report {compact ? "" : contextLabel}
        </button>
      ) : (
        <p className={compact ? "text-xs text-ink/60" : "text-sm leading-6 text-ink/65"}>
          <Link href="/auth/sign-in" className="font-semibold text-moss">Sign in</Link> to report {contextLabel}.
        </p>
      )}

      {success ? <p className="mt-2 text-sm font-semibold text-moss">{success}</p> : null}
      {error ? <p className="mt-2 text-sm font-semibold text-clay">{error}</p> : null}

      {isOpen && authState.status === "signed-in" ? (
        <div className="mt-3 rounded-md border border-ink/10 bg-paper p-4">
          <h4 className="text-sm font-bold text-ink">Report {targetLabel}</h4>
          <label className="mt-3 block">
            <span className="text-sm font-semibold text-ink">Reason</span>
            <select value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-moss">
              {reportReasons.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block">
            <span className="text-sm font-semibold text-ink">Details</span>
            <textarea value={details} onChange={(event) => setDetails(event.target.value)} rows={3} className="mt-2 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-moss" />
          </label>
          <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setIsOpen(false)} className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm font-semibold text-ink">
              Cancel
            </button>
            <button type="button" disabled={isSaving} onClick={() => void submitReport()} className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
              {isSaving ? "Submitting..." : "Submit report"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
