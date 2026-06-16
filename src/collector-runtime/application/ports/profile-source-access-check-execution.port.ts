import { z } from "zod";
import type {
  ProfileSourceAccessCheckRunFailureReason,
  ProfileSourceAccessCheckRunOutcome,
  ProfileSourceAccessCheckRunTarget,
} from "../../domain";

export const PROFILE_SOURCE_ACCESS_BROWSER_PAGE_KINDS = [
  "FACEBOOK_GROUP",
  "FACEBOOK_LOGIN",
  "FACEBOOK_CHECKPOINT",
  "FACEBOOK_UNAVAILABLE",
  "OTHER",
] as const;

export type ProfileSourceAccessBrowserPageKind =
  (typeof PROFILE_SOURCE_ACCESS_BROWSER_PAGE_KINDS)[number];

export const ProfileSourceAccessBrowserObservationSchema = z
  .object({
    pageKind: z.enum(PROFILE_SOURCE_ACCESS_BROWSER_PAGE_KINDS),
    groupContentVisible: z.boolean(),
    joinActionVisible: z.boolean(),
    joinedIndicatorVisible: z.boolean(),
    accessDeniedIndicatorVisible: z.boolean(),
  })
  .strict();

export type ProfileSourceAccessBrowserObservation = z.infer<
  typeof ProfileSourceAccessBrowserObservationSchema
>;

export interface ProfileSourceAccessBrowserCheckInput {
  readonly checkRunId: string;
  readonly profileId: string;
  readonly sourceGroupId: string;
  readonly target: ProfileSourceAccessCheckRunTarget;
  readonly abortSignal?: AbortSignal;
}

export type ProfileSourceAccessBrowserCheckResult =
  | {
      readonly ok: true;
      readonly observation: ProfileSourceAccessBrowserObservation;
    }
  | {
      readonly ok: false;
      readonly failureReason: ProfileSourceAccessCheckRunFailureReason;
    };

export interface ProfileSourceAccessBrowserCheckPort {
  check(
    input: ProfileSourceAccessBrowserCheckInput,
  ): Promise<ProfileSourceAccessBrowserCheckResult>;
}

export interface ProfileSourceAccessOutcomeClassifierPort {
  classify(
    observation: ProfileSourceAccessBrowserObservation,
  ): Promise<ProfileSourceAccessCheckRunOutcome>;
}

export interface ProfileSourceAccessMutationInput {
  readonly profileId: string;
  readonly sourceGroupId: string;
  readonly outcome: ProfileSourceAccessCheckRunOutcome;
}

export type ProfileSourceAccessMutationResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly failureReason: ProfileSourceAccessCheckRunFailureReason;
    };

export interface ProfileSourceAccessMutationPort {
  applyOutcome(
    input: ProfileSourceAccessMutationInput,
  ): Promise<ProfileSourceAccessMutationResult>;
}
