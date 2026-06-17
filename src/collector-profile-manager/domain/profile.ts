import type { infer as zInfer } from "zod";
import {
  ImmutableFingerprintViolationError,
  InvalidProvisioningRecoveryTransitionError,
  InvalidProvisioningTokenStateError,
  MissingRequiredProfileConfigurationError,
} from "./profile-errors";
import { ProvisioningTokenStateSchema } from "./profile.schemas";
import type { CollectorProfileSchema } from "./profile.schemas";
import type { ProfileStatus } from "./profile-status";
import type { ProfileAccountStage } from "./profile-account-stage";
import { transitionProfileAccountStage } from "./profile-account-stage-state-machine";
import { transitionProfileStatus } from "./profile-state-machine";
import type {
  AuthenticationState,
  BehavioralPersona,
  ContentAffinities,
  DailySafetyUsage,
  HardwareFingerprint,
  IdentityMetadata,
  IsoDateTime,
  NetworkContext,
  ProfileId,
  ProvisioningTokenState,
  SafetyThresholds,
  TemporalRoutine,
} from "./profile-properties";
import type { ProfileAuthenticationHealth } from "./profile-authentication-health";

export type CollectorProfile = zInfer<typeof CollectorProfileSchema>;

export interface CreatePendingCollectorProfileInput {
  readonly id: ProfileId;
  readonly displayName: string;
  readonly createdAt: IsoDateTime;
  readonly networkContext?: NetworkContext;
  readonly hardwareFingerprint?: HardwareFingerprint | null;
  readonly behavioralPersona?: BehavioralPersona;
  readonly temporalRoutine?: TemporalRoutine;
  readonly safetyThresholds?: SafetyThresholds;
  readonly contentAffinities?: ContentAffinities;
}

export function createPendingCollectorProfile(
  input: CreatePendingCollectorProfileInput,
): CollectorProfile {
  const identity: IdentityMetadata = {
    id: input.id,
    displayName: input.displayName,
    status: "PENDING_CONFIG",
    accountStage: "NEW_ACCOUNT",
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    lastCheckoutAt: null,
    lastReleasedAt: null,
    nextAvailableAt: null,
    dailyUsage: createEmptyDailySafetyUsage(),
  };

  return {
    identity,
    networkContext: input.networkContext ?? createUnconfiguredNetworkContext(),
    hardwareFingerprint: input.hardwareFingerprint ?? null,
    authenticationState: createEmptyAuthenticationState(),
    behavioralPersona:
      input.behavioralPersona ?? createUnconfiguredBehavioralPersona(),
    temporalRoutine: input.temporalRoutine ?? createUnconfiguredTemporalRoutine(),
    safetyThresholds: input.safetyThresholds ?? createUnconfiguredSafetyThresholds(),
    contentAffinities:
      input.contentAffinities ?? createUnconfiguredContentAffinities(),
    provisioningToken: createNotIssuedProvisioningTokenState(),
    authenticationHealth: "NOT_PROVISIONED" as ProfileAuthenticationHealth,
    authenticationHealthUpdatedAt: input.createdAt,
  };
}

export function markCollectorProfileSessionIngested(
  profile: CollectorProfile,
  sessionCapturedAt: IsoDateTime,
  sessionState: {
    readonly cookies: readonly AuthenticationState["cookies"][number][];
    readonly localStorage: readonly AuthenticationState["localStorage"][number][];
    readonly sessionExpiresAt: IsoDateTime | null;
  },
  provisioningToken: ProvisioningTokenState,
): CollectorProfile {
  return {
    ...profile,
    authenticationState: {
      cookies: [...sessionState.cookies],
      localStorage: [...sessionState.localStorage],
      sessionCapturedAt,
      sessionExpiresAt: sessionState.sessionExpiresAt,
    },
    provisioningToken,
    authenticationHealth: "HEALTHY",
    authenticationHealthUpdatedAt: sessionCapturedAt,
  };
}

export function transitionCollectorProfileAccountStage(
  profile: CollectorProfile,
  to: ProfileAccountStage,
  updatedAt: IsoDateTime,
): CollectorProfile {
  const nextStage = transitionProfileAccountStage(
    profile.identity.accountStage,
    to,
  );

  return {
    ...profile,
    identity: {
      ...profile.identity,
      accountStage: nextStage,
      updatedAt,
    },
  };
}

export function transitionCollectorProfileStatus(
  profile: CollectorProfile,
  to: ProfileStatus,
  updatedAt: IsoDateTime,
): CollectorProfile {
  if (profile.identity.status === "PENDING_CONFIG" && to === "PENDING_LOGIN") {
    assertRequiredProfileConfiguration(profile);
  }

  const nextStatus = transitionProfileStatus(profile.identity.status, to);

  return {
    ...profile,
    identity: {
      ...profile.identity,
      status: nextStatus,
      updatedAt,
    },
  };
}

/**
 * Domain-owned full-profile mutation boundary for the provisioning
 * status transition. This is the single backstop for the
 * `READY -> PENDING_LOGIN` recovery transition (Sprint 055).
 *
 * Invariants:
 * - The existing `ALLOWED_PROFILE_STATUS_TRANSITIONS` state machine
 *   still gates the raw status move.
 * - For `READY -> PENDING_LOGIN`, the current `authenticationHealth`
 *   MUST be `REAUTH_REQUIRED` or `CHECKPOINT_REVIEW_REQUIRED`. Any
 *   other value (including `HEALTHY` and `NOT_PROVISIONED`) throws
 *   `InvalidProvisioningRecoveryTransitionError`. This is the
 *   domain-level guard that closes the bypass opportunity described
 *   in the Sprint 055 review findings.
 * - For `PENDING_CONFIG -> PENDING_LOGIN`, the existing required
 *   configuration check is performed.
 * - For `PENDING_LOGIN -> PENDING_LOGIN` (token restart), the status
 *   is preserved and only `updatedAt` is refreshed.
 * - `BUSY -> PENDING_LOGIN` is rejected by the state machine and
 *   surfaces as `InvalidProfileStateTransitionError`.
 *
 * The function intentionally depends only on domain primitives and
 * domain errors. It does not import or throw application errors so the
 * invariant cannot be bypassed by a caller that skips the application
 * precheck.
 */
export function transitionCollectorProfileStatusForProvisioning(
  profile: CollectorProfile,
  to: ProfileStatus,
  updatedAt: IsoDateTime,
): CollectorProfile {
  if (profile.identity.status === "PENDING_CONFIG" && to === "PENDING_LOGIN") {
    assertRequiredProfileConfiguration(profile);
  }

  if (
    profile.identity.status === "READY" &&
    to === "PENDING_LOGIN" &&
    profile.authenticationHealth !== "REAUTH_REQUIRED" &&
    profile.authenticationHealth !== "CHECKPOINT_REVIEW_REQUIRED"
  ) {
    throw new InvalidProvisioningRecoveryTransitionError(
      profile.authenticationHealth,
      profile.identity.id,
    );
  }

  if (profile.identity.status === "PENDING_LOGIN" && to === "PENDING_LOGIN") {
    return {
      ...profile,
      identity: {
        ...profile.identity,
        updatedAt,
      },
    };
  }

  const nextStatus = transitionProfileStatus(profile.identity.status, to);

  return {
    ...profile,
    identity: {
      ...profile.identity,
      status: nextStatus,
      updatedAt,
    },
  };
}

export function assignHardwareFingerprint(
  profile: CollectorProfile,
  hardwareFingerprint: HardwareFingerprint,
  updatedAt: IsoDateTime,
): CollectorProfile {
  if (profile.hardwareFingerprint !== null) {
    throw new ImmutableFingerprintViolationError(profile.identity.id);
  }

  return {
    ...profile,
    hardwareFingerprint,
    identity: {
      ...profile.identity,
      updatedAt,
    },
  };
}

export function getMissingRequiredProfileConfiguration(
  profile: CollectorProfile,
): readonly string[] {
  const missingFields: string[] = [];

  if (profile.identity.id.trim() === "") {
    missingFields.push("identity.id");
  }

  if (profile.identity.displayName.trim() === "") {
    missingFields.push("identity.displayName");
  }

  if (profile.networkContext.proxy === null) {
    missingFields.push("networkContext.proxy");
  }

  if (profile.hardwareFingerprint === null) {
    missingFields.push("hardwareFingerprint");
  }

  if (profile.temporalRoutine.timezone.trim() === "") {
    missingFields.push("temporalRoutine.timezone");
  }

  if (profile.temporalRoutine.activeWindows.length === 0) {
    missingFields.push("temporalRoutine.activeWindows");
  }

  if (profile.safetyThresholds.maxSessionsPerDay <= 0) {
    missingFields.push("safetyThresholds.maxSessionsPerDay");
  }

  if (profile.safetyThresholds.maxSessionDurationMinutes <= 0) {
    missingFields.push("safetyThresholds.maxSessionDurationMinutes");
  }

  if (profile.safetyThresholds.maxMacroActionsPerDay <= 0) {
    missingFields.push("safetyThresholds.maxMacroActionsPerDay");
  }

  if (profile.contentAffinities.primaryTopics.length === 0) {
    missingFields.push("contentAffinities.primaryTopics");
  }

  return missingFields;
}

export function assertRequiredProfileConfiguration(
  profile: CollectorProfile,
): void {
  const missingFields = getMissingRequiredProfileConfiguration(profile);

  if (missingFields.length > 0) {
    throw new MissingRequiredProfileConfigurationError(missingFields);
  }
}

export function assertValidProvisioningTokenState(
  state: ProvisioningTokenState,
  profileId?: string,
): void {
  const result = ProvisioningTokenStateSchema.safeParse(state);

  if (result.success) {
    return;
  }

  throw new InvalidProvisioningTokenStateError(
    result.error.issues[0]?.message ?? "expected valid provisioning token state",
    profileId,
  );
}

function createUnconfiguredNetworkContext(): NetworkContext {
  return {
    proxy: null,
    killswitch: {
      enabled: true,
      failClosed: true,
    },
  };
}

function createEmptyAuthenticationState(): AuthenticationState {
  return {
    cookies: [],
    localStorage: [],
    sessionCapturedAt: null,
    sessionExpiresAt: null,
  };
}

function createEmptyDailySafetyUsage(): DailySafetyUsage {
  return {
    localDate: null,
    sessionsStarted: 0,
    activeDurationMinutes: 0,
    macroActions: 0,
  };
}

function createUnconfiguredBehavioralPersona(): BehavioralPersona {
  return {
    scrollStyle: "STEADY",
    microDelayMs: {
      min: 0,
      max: 0,
    },
    reverseScrollProbability: 0,
    dwellTimeMs: {
      min: 0,
      max: 0,
    },
  };
}

function createUnconfiguredTemporalRoutine(): TemporalRoutine {
  return {
    timezone: "",
    chronotype: "MORNING",
    activeWindows: [],
    cooldownMinutes: 0,
  };
}

function createUnconfiguredSafetyThresholds(): SafetyThresholds {
  return {
    maxSessionsPerDay: 0,
    maxSessionDurationMinutes: 0,
    maxMacroActionsPerDay: 0,
    minCooldownMinutes: 0,
  };
}

function createUnconfiguredContentAffinities(): ContentAffinities {
  return {
    primaryTopics: [],
    secondaryTopics: [],
    interactionWeights: {
      view: 0,
      like: 0,
      save: 0,
      comment: 0,
      share: 0,
    },
  };
}

function createNotIssuedProvisioningTokenState(): ProvisioningTokenState {
  return {
    status: "NOT_ISSUED",
    tokenHash: null,
    issuedAt: null,
    expiresAt: null,
    consumedAt: null,
  };
}
