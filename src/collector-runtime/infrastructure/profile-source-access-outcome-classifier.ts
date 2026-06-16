import type {
  ProfileSourceAccessBrowserObservation,
  ProfileSourceAccessOutcomeClassifierPort,
} from "../application";
import { ProfileSourceAccessBrowserObservationSchema } from "../application";
import type { ProfileSourceAccessCheckRunOutcome } from "../domain";

export class DeterministicProfileSourceAccessOutcomeClassifier
  implements ProfileSourceAccessOutcomeClassifierPort
{
  public async classify(
    observation: ProfileSourceAccessBrowserObservation,
  ): Promise<ProfileSourceAccessCheckRunOutcome> {
    const parsed = ProfileSourceAccessBrowserObservationSchema.parse(observation);

    if (parsed.pageKind === "FACEBOOK_CHECKPOINT") {
      return "CHECKPOINT_REQUIRED";
    }

    if (parsed.pageKind === "FACEBOOK_LOGIN") {
      return "LOGIN_REQUIRED";
    }

    if (hasContradictoryEvidence(parsed)) {
      return "NEEDS_MANUAL_REVIEW";
    }

    if (
      parsed.pageKind === "FACEBOOK_UNAVAILABLE" ||
      parsed.accessDeniedIndicatorVisible
    ) {
      return "ACCESS_DENIED";
    }

    if (parsed.groupContentVisible && parsed.joinedIndicatorVisible) {
      return "JOINED_ACCESSIBLE";
    }

    if (parsed.joinActionVisible) {
      return "JOIN_REQUIRED";
    }

    if (
      parsed.pageKind === "FACEBOOK_GROUP" &&
      parsed.groupContentVisible &&
      !parsed.joinActionVisible &&
      !parsed.joinedIndicatorVisible &&
      !parsed.accessDeniedIndicatorVisible
    ) {
      return "PUBLIC_ACCESSIBLE";
    }

    return "NEEDS_MANUAL_REVIEW";
  }
}

function hasContradictoryEvidence(
  observation: ProfileSourceAccessBrowserObservation,
): boolean {
  if (
    observation.joinActionVisible &&
    observation.joinedIndicatorVisible
  ) {
    return true;
  }

  if (
    observation.joinedIndicatorVisible &&
    observation.accessDeniedIndicatorVisible
  ) {
    return true;
  }

  if (
    observation.groupContentVisible &&
    (observation.pageKind === "FACEBOOK_UNAVAILABLE" ||
      observation.accessDeniedIndicatorVisible)
  ) {
    return true;
  }

  return false;
}
