import type { infer as zInfer } from "zod";
import {
  ImmutableFingerprintViolationError,
  InvalidProvisioningTokenStateError,
  MissingRequiredProfileConfigurationError,
} from "./profile-errors";
import { ProvisioningTokenStateSchema } from "./profile.schemas";
import type { CollectorProfileSchema } from "./profile.schemas";
import type { ProfileStatus } from "./profile-status";
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
