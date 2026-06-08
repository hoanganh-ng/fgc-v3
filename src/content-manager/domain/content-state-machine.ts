import { InvalidContentStatusTransitionError } from "./content-errors";
import type { ContentStatus } from "./content-status";

export const ALLOWED_CONTENT_STATUS_TRANSITIONS: Readonly<
  Record<ContentStatus, readonly ContentStatus[]>
> = {
  COLLECTED: ["SELECTED", "REJECTED"],
  SELECTED: ["REJECTED", "USED"],
  REJECTED: ["SELECTED"],
  USED: [],
};

export function getAllowedContentStatusTransitions(
  from: ContentStatus,
): readonly ContentStatus[] {
  return ALLOWED_CONTENT_STATUS_TRANSITIONS[from];
}

export function canTransitionContentStatus(
  from: ContentStatus,
  to: ContentStatus,
): boolean {
  return ALLOWED_CONTENT_STATUS_TRANSITIONS[from].some(
    (allowedStatus) => allowedStatus === to,
  );
}

export function assertValidContentStatusTransition(
  from: ContentStatus,
  to: ContentStatus,
): void {
  if (!canTransitionContentStatus(from, to)) {
    throw new InvalidContentStatusTransitionError(from, to);
  }
}

export function transitionContentStatus(
  from: ContentStatus,
  to: ContentStatus,
): ContentStatus {
  assertValidContentStatusTransition(from, to);
  return to;
}
