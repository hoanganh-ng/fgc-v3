import { z } from "zod";
import type {
  ProfileSourceAccessBrowserObservation,
  ProfileSourceAccessOutcomeClassifierPort,
} from "../application";
import type { ProfileSourceAccessCheckRunOutcome } from "../domain";

const BrowserObservationSchema = z
  .object({
    pageKind: z.enum([
      "FACEBOOK_GROUP",
      "FACEBOOK_LOGIN",
      "FACEBOOK_CHECKPOINT",
      "FACEBOOK_UNAVAILABLE",
      "OTHER",
    ]),
    groupContentVisible: z.boolean(),
    joinActionVisible: z.boolean(),
    joinedIndicatorVisible: z.boolean(),
    accessDeniedIndicatorVisible: z.boolean(),
  })
  .strict();

export class DeterministicProfileSourceAccessOutcomeClassifier
  implements ProfileSourceAccessOutcomeClassifierPort
{
  public async classify(
    observation: ProfileSourceAccessBrowserObservation,
  ): Promise<ProfileSourceAccessCheckRunOutcome> {
    const parsed = BrowserObservationSchema.parse(observation);

    if (parsed.pageKind === "FACEBOOK_CHECKPOINT") {
      return "CHECKPOINT_REQUIRED";
    }

    if (parsed.pageKind === "FACEBOOK_LOGIN") {
      return "LOGIN_REQUIRED";
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
