import type { Schema } from "../../amplify/data/resource";
import type { ReactionType } from "@/types";

export type CommentRecord = Schema["Comment"]["type"];
export type ReactionRecord = Schema["Reaction"]["type"];
export type ReportRecord = Schema["Report"]["type"];

export const reactionOptions: { type: ReactionType; label: string }[] = [
  { type: "helpful_setup", label: "Helpful setup" },
  { type: "similar_to_mine", label: "Similar to mine" },
  { type: "good_hunting_build", label: "Good hunting build" },
  { type: "budget_friendly", label: "Budget friendly" },
  { type: "lightweight", label: "Lightweight" },
  { type: "well_documented", label: "Well documented" },
  { type: "beginner_friendly", label: "Beginner friendly" }
];

export const reportReasons = [
  "unsafe content",
  "illegal hunting / poaching",
  "personal information",
  "harassment or threat",
  "sales or marketplace activity",
  "other"
];

export function reactionCounts(reactions: ReactionRecord[]) {
  return reactionOptions.map((option) => ({
    ...option,
    count: reactions.filter((reaction) => reaction.reactionType === option.type).length
  }));
}

export function formatCommentDate(value?: string | null) {
  if (!value) {
    return "Just now";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleDateString();
}
