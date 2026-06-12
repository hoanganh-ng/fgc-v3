import { InvalidProfileAccountStageTransitionError } from "./profile-errors";
import type { ProfileAccountStage } from "./profile-account-stage";

export const ALLOWED_PROFILE_ACCOUNT_STAGE_TRANSITIONS: Readonly<
  Record<ProfileAccountStage, readonly ProfileAccountStage[]>
> = {
  NEW_ACCOUNT: ["WARMING", "NEEDS_REVIEW"],
  WARMING: ["COLLECTION_READY", "LIMITED", "NEEDS_REVIEW"],
  COLLECTION_READY: ["LIMITED", "NEEDS_REVIEW", "RETIRED"],
  LIMITED: ["WARMING", "COLLECTION_READY", "RETIRED"],
  NEEDS_REVIEW: ["WARMING", "RETIRED"],
  RETIRED: [],
};

export function getAllowedProfileAccountStageTransitions(
  from: ProfileAccountStage,
): readonly ProfileAccountStage[] {
  return ALLOWED_PROFILE_ACCOUNT_STAGE_TRANSITIONS[from];
}

export function canTransitionProfileAccountStage(
  from: ProfileAccountStage,
  to: ProfileAccountStage,
): boolean {
  return ALLOWED_PROFILE_ACCOUNT_STAGE_TRANSITIONS[from].some(
    (allowedStage) => allowedStage === to,
  );
}

export function assertValidProfileAccountStageTransition(
  from: ProfileAccountStage,
  to: ProfileAccountStage,
): void {
  if (!canTransitionProfileAccountStage(from, to)) {
    throw new InvalidProfileAccountStageTransitionError(from, to);
  }
}

export function transitionProfileAccountStage(
  from: ProfileAccountStage,
  to: ProfileAccountStage,
): ProfileAccountStage {
  assertValidProfileAccountStageTransition(from, to);
  return to;
}
