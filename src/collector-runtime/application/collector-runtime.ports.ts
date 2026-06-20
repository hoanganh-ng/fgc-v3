import type {
  SubmitCapturedFacebookPayloadInput,
  SubmitCapturedFacebookPayloadResult,
} from "./collector-runtime.types";
import type { CollectorRuntimeAccountStage } from "../domain/account-stage";

export interface ProfileCheckoutInput {
  readonly sourceGroupId: string;
  readonly purpose?: string;
}

export type ProfileCheckoutResult =
  | {
      readonly ok: true;
      readonly profileId: string;
      readonly leaseId: string;
      readonly leaseExpiresAt?: string;
    }
  | {
      readonly ok: false;
      readonly statusCode?: number;
      readonly errorCode: string;
      readonly errorMessage: string;
    };

export type ProfileAuthenticationObservation =
  | "LOGIN_REQUIRED"
  | "CHECKPOINT_REQUIRED";

export interface ProfileLeaseReleaseInput {
  readonly profileId: string;
  readonly leaseId: string;
  readonly macroActionsPerformed?: number;
  readonly authenticationObservation?: ProfileAuthenticationObservation;
}

export type ProfileLeaseReleaseResult =
  | {
      readonly ok: true;
      readonly releasedAt?: string;
    }
  | {
      readonly ok: false;
      readonly statusCode?: number;
      readonly errorCode: string;
      readonly errorMessage: string;
    };

export interface RuntimeProfileConfiguration {
  readonly profileId: string;
  readonly leaseId: string;
  readonly leaseExpiresAt?: string;
  readonly hardwareFingerprint: unknown;
  readonly networkContext: unknown;
  readonly authenticationState: unknown;
  readonly temporalRoutine?: unknown;
  readonly safetyThresholds?: unknown;
  readonly contentAffinities?: unknown;
}

export type RuntimeProfileConfigurationResult =
  | {
      readonly ok: true;
      readonly configuration: RuntimeProfileConfiguration;
    }
  | {
      readonly ok: false;
      readonly statusCode?: number;
      readonly errorCode: string;
      readonly errorMessage: string;
    };

export interface ProfileLeasePort {
  checkoutProfile(input: ProfileCheckoutInput): Promise<ProfileCheckoutResult>;
  releaseProfileLease(
    input: ProfileLeaseReleaseInput,
  ): Promise<ProfileLeaseReleaseResult>;
}

export type ProfileHomeFeedCheckoutResult =
  | {
      readonly ok: true;
      readonly profileId: string;
      readonly accountStage: CollectorRuntimeAccountStage;
      readonly leaseId: string;
      readonly leaseExpiresAt?: string;
    }
  | {
      readonly ok: false;
      readonly statusCode?: number;
      readonly errorCode: string;
      readonly errorMessage: string;
    };

export interface ProfileHomeFeedCheckoutPort {
  checkoutProfileForHomeFeedCollection(
    profileId: string,
  ): Promise<ProfileHomeFeedCheckoutResult>;
}

export interface RuntimeProfileConfigurationPort {
  getRuntimeProfileConfiguration(
    leaseId: string,
  ): Promise<RuntimeProfileConfigurationResult>;
}

export interface CollectorRuntimeWarning {
  readonly code: string;
  readonly message: string;
  readonly path?: string;
}

export interface CapturedFacebookPayload {
  readonly payload: unknown;
  readonly capturedAt: Date;
  readonly sourceUrlHint?: string;
}

export interface FacebookPayloadCaptureDiagnostics {
  readonly pageContextFetchCaptureCount: number;
  readonly pageContextXhrCaptureCount: number;
  readonly networkListenerCaptureCount: number;
  readonly parseFailureCount: number;
  readonly totalPayloadsPassedToExtractor: number;
  readonly finalPageUrl?: string;
  readonly loginRedirectSuspected: boolean;
}

export interface FacebookGroupPayloadCaptureInput {
  readonly sourceGroupId: string;
  readonly sourceGroupUrl: string;
  readonly profileId: string;
  readonly leaseId: string;
}

export type FacebookPayloadCaptureResult =
  | {
      readonly ok: true;
      readonly capturedPayloads: readonly CapturedFacebookPayload[];
      readonly warnings: readonly CollectorRuntimeWarning[];
      readonly diagnostics?: FacebookPayloadCaptureDiagnostics;
    }
  | {
      readonly ok: false;
      readonly errorCode: string;
      readonly errorMessage: string;
      readonly warnings: readonly CollectorRuntimeWarning[];
      readonly diagnostics?: FacebookPayloadCaptureDiagnostics;
    };

export interface FacebookGroupPayloadCapturePort {
  captureGroupPayloads(
    input: FacebookGroupPayloadCaptureInput,
  ): Promise<FacebookPayloadCaptureResult>;
}

export interface CapturedFacebookPayloadSubmissionUseCase {
  execute(
    input: SubmitCapturedFacebookPayloadInput,
  ): Promise<SubmitCapturedFacebookPayloadResult>;
}

export interface FacebookHomeFeedPayloadCaptureInput {
  readonly profileId: string;
  readonly leaseId: string;
  readonly maxScrolls: number;
  readonly maxDurationMs: number;
  readonly abortSignal?: AbortSignal;
}

export interface FacebookHomeFeedPayloadCapturePort {
  captureHomeFeedPayloads(
    input: FacebookHomeFeedPayloadCaptureInput,
  ): Promise<FacebookPayloadCaptureResult>;
}

export type SourcePublisherObservationKind = "GROUP" | "PAGE";

export interface SourcePublisherObservationInput {
  readonly platform: "FACEBOOK";
  readonly kind: SourcePublisherObservationKind;
  readonly externalPublisherId: string;
  readonly observedAt: string;
  readonly displayName?: string;
  readonly canonicalUrl?: string;
}

export type SourcePublisherObservationResult =
  | {
      readonly ok: true;
      readonly sourcePublisherId: string;
    }
  | {
      readonly ok: false;
      readonly statusCode?: number;
      readonly errorCode: string;
      readonly errorMessage: string;
    };

export interface SourcePublisherObservationPort {
  observeSourcePublisher(
    input: SourcePublisherObservationInput,
  ): Promise<SourcePublisherObservationResult>;
}

export interface HomeFeedContentSubmissionTopComment {
  readonly externalCommentId: string;
  readonly bodyText: string;
  readonly authorDisplayName?: string;
  readonly authorExternalId?: string;
  readonly reactionCount: number;
  readonly replyCount?: number;
  readonly postedAt?: string;
  readonly collectedAt: string;
}

export interface HomeFeedContentSubmissionInput {
  readonly sourcePublisherId: string;
  readonly platform: "FACEBOOK";
  readonly externalPostId: string;
  readonly sourceUrl: string;
  readonly title?: string;
  readonly bodyText: string;
  readonly authorDisplayName?: string;
  readonly authorExternalId?: string;
  readonly postedAt?: string;
  readonly collectedAt: string;
  readonly reactionCount: number;
  readonly commentCount: number;
  readonly shareCount?: number;
  readonly topComments: readonly HomeFeedContentSubmissionTopComment[];
}

export type HomeFeedContentSubmissionResult =
  | {
      readonly ok: true;
      readonly contentItemId: string;
    }
  | {
      readonly ok: false;
      readonly statusCode?: number;
      readonly errorCode: string;
      readonly errorMessage: string;
    };

export interface HomeFeedContentSubmissionPort {
  submitHomeFeedCollectedContent(
    input: HomeFeedContentSubmissionInput,
  ): Promise<HomeFeedContentSubmissionResult>;
}
