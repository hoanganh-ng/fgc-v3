import { InvalidProfileHomeFeedCollectionRunStatusTransitionError } from "./collection-run-errors";
import type { ProfileHomeFeedCollectionRunStatus } from "./profile-home-feed-collection-run-status";

export const ALLOWED_PROFILE_HOME_FEED_COLLECTION_RUN_STATUS_TRANSITIONS: Readonly<
  Record<
    ProfileHomeFeedCollectionRunStatus,
    readonly ProfileHomeFeedCollectionRunStatus[]
  >
> = {
  QUEUED: ["RUNNING", "CANCELED"],
  RUNNING: ["SUCCEEDED", "FAILED"],
  SUCCEEDED: [],
  FAILED: [],
  CANCELED: [],
};

export function canTransitionProfileHomeFeedCollectionRunStatus(
  from: ProfileHomeFeedCollectionRunStatus,
  to: ProfileHomeFeedCollectionRunStatus,
): boolean {
  return ALLOWED_PROFILE_HOME_FEED_COLLECTION_RUN_STATUS_TRANSITIONS[from].some(
    (allowedStatus) => allowedStatus === to,
  );
}

export function assertValidProfileHomeFeedCollectionRunStatusTransition(
  from: ProfileHomeFeedCollectionRunStatus,
  to: ProfileHomeFeedCollectionRunStatus,
): void {
  if (!canTransitionProfileHomeFeedCollectionRunStatus(from, to)) {
    throw new InvalidProfileHomeFeedCollectionRunStatusTransitionError(
      from,
      to,
    );
  }
}
