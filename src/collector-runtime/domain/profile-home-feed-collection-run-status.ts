import type { infer as zInfer } from "zod";
import type { ProfileHomeFeedCollectionRunStatusSchema } from "./profile-home-feed-collection-run.schemas";

export const PROFILE_HOME_FEED_COLLECTION_RUN_STATUSES = [
  "QUEUED",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "CANCELED",
] as const;

export const TERMINAL_PROFILE_HOME_FEED_COLLECTION_RUN_STATUSES = [
  "SUCCEEDED",
  "FAILED",
  "CANCELED",
] as const;

export type ProfileHomeFeedCollectionRunStatus = zInfer<
  typeof ProfileHomeFeedCollectionRunStatusSchema
>;

export function isProfileHomeFeedCollectionRunStatus(
  value: unknown,
): value is ProfileHomeFeedCollectionRunStatus {
  return (
    typeof value === "string" &&
    PROFILE_HOME_FEED_COLLECTION_RUN_STATUSES.some(
      (status) => status === value,
    )
  );
}

export function isTerminalProfileHomeFeedCollectionRunStatus(
  status: ProfileHomeFeedCollectionRunStatus,
): boolean {
  return TERMINAL_PROFILE_HOME_FEED_COLLECTION_RUN_STATUSES.some(
    (terminalStatus) => terminalStatus === status,
  );
}
