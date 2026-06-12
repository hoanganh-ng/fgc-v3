import { InvalidCollectionRunStatusTransitionError } from "./collection-run-errors";
import type { CollectionRunStatus } from "./collection-run-status";

export const ALLOWED_COLLECTION_RUN_STATUS_TRANSITIONS: Readonly<
  Record<CollectionRunStatus, readonly CollectionRunStatus[]>
> = {
  QUEUED: ["RUNNING", "CANCELED"],
  RUNNING: ["SUCCEEDED", "FAILED"],
  SUCCEEDED: [],
  FAILED: [],
  CANCELED: [],
};

export function getAllowedCollectionRunStatusTransitions(
  from: CollectionRunStatus,
): readonly CollectionRunStatus[] {
  return ALLOWED_COLLECTION_RUN_STATUS_TRANSITIONS[from];
}

export function canTransitionCollectionRunStatus(
  from: CollectionRunStatus,
  to: CollectionRunStatus,
): boolean {
  return ALLOWED_COLLECTION_RUN_STATUS_TRANSITIONS[from].some(
    (allowedStatus) => allowedStatus === to,
  );
}

export function assertValidCollectionRunStatusTransition(
  from: CollectionRunStatus,
  to: CollectionRunStatus,
): void {
  if (!canTransitionCollectionRunStatus(from, to)) {
    throw new InvalidCollectionRunStatusTransitionError(from, to);
  }
}

export function transitionCollectionRunStatus(
  from: CollectionRunStatus,
  to: CollectionRunStatus,
): CollectionRunStatus {
  assertValidCollectionRunStatusTransition(from, to);
  return to;
}
