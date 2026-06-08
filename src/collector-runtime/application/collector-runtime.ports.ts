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
      readonly errorCode: string;
      readonly errorMessage: string;
    };

export interface ProfileLeasePort {
  checkoutProfile(input: ProfileCheckoutInput): Promise<ProfileCheckoutResult>;
  releaseProfileLease(
    input: ProfileLeaseReleaseInput,
  ): Promise<ProfileLeaseReleaseResult>;
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
    }
  | {
      readonly ok: false;
      readonly errorCode: string;
      readonly errorMessage: string;
      readonly warnings: readonly CollectorRuntimeWarning[];
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
