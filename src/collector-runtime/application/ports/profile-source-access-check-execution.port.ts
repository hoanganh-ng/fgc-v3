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

export interface ProfileSourceAccessBrowserObservation {
  readonly pageKind: ProfileSourceAccessBrowserPageKind;
  readonly groupContentVisible: boolean;
  readonly joinActionVisible: boolean;
  readonly joinedIndicatorVisible: boolean;
  readonly accessDeniedIndicatorVisible: boolean;
}

export interface ProfileSourceAccessBrowserCheckInput {
  readonly checkRunId: string;
  readonly profileId: string;
  readonly sourceGroupId: string;
  readonly target: ProfileSourceAccessCheckRunTarget;
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
