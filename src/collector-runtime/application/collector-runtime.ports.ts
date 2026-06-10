import type {
  SubmitCapturedFacebookPayloadInput,
  SubmitCapturedFacebookPayloadResult,
} from "./collector-runtime.types";

export interface ProfileCheckoutInput {
  readonly sourceGroupId?: string;
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

export interface ProfileLeaseReleaseInput {
  readonly profileId: string;
  readonly leaseId: string;
  readonly macroActionsPerformed?: number;
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
