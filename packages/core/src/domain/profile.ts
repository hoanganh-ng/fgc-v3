import {
  ConfigurationIncompleteError,
  CooldownViolationError,
  FingerprintMutationError,
  InvalidProvisioningTokenError,
  InvalidStateTransitionError,
  LeaseConflictError,
  SafetyLimitViolationError
} from "./errors.js";
import {
  getLocalTimeSnapshot,
  isWithinActiveWindow,
  resetMetricsIfNewLocalDay
} from "./temporal.js";
import type {
  AuthenticationState,
  CheckoutLease,
  DailySafetyMetrics,
  ProfileAggregate,
  ProfileConfigurationInput,
  ProfilePillars,
  ProfileStatus
} from "./types.js";

const allowedTransitions: Record<ProfileStatus, readonly ProfileStatus[]> = {
  PENDING_CONFIG: ["PENDING_LOGIN"],
  PENDING_LOGIN: ["READY"],
  READY: ["BUSY"],
  BUSY: ["READY"]
};

export interface CreateProfileInput {
  id: string;
  displayName: string;
  externalRef?: string | undefined;
  now: Date;
}

export function createProfile(input: CreateProfileInput): ProfileAggregate {
  const identityMetadata = input.externalRef === undefined
    ? { displayName: input.displayName, tags: [] }
    : { displayName: input.displayName, externalRef: input.externalRef, tags: [] };

  return {
    id: input.id,
    status: "PENDING_CONFIG",
    version: 1,
    pillars: createEmptyPillars(identityMetadata),
    provisioningTokenHash: null,
    provisioningTokenExpiresAt: null,
    nextAvailableWindowAt: null,
    dailySafetyMetrics: {
      date: "uninitialized",
      sessionCount: 0,
      macroActionCount: 0,
      totalDurationMinutes: 0
    },
    activeLease: null,
    createdAt: input.now,
    updatedAt: input.now
  };
}

export function configureProfile(
  profile: ProfileAggregate,
  configuration: ProfileConfigurationInput,
  now: Date
): ProfileAggregate {
  if (profile.status === "BUSY") {
    throw new InvalidStateTransitionError("A BUSY profile cannot be reconfigured");
  }

  if (profile.status === "PENDING_LOGIN") {
    throw new InvalidStateTransitionError("A profile awaiting login cannot be reconfigured");
  }

  if (
    profile.pillars.hardwareFingerprint !== null &&
    !sameFingerprint(profile.pillars.hardwareFingerprint, configuration.hardwareFingerprint)
  ) {
    throw new FingerprintMutationError();
  }

  const nextStatus = profile.status === "PENDING_CONFIG" ? "PENDING_LOGIN" : profile.status;

  if (nextStatus !== profile.status) {
    assertTransition(profile.status, nextStatus);
  }

  const pillars: ProfilePillars = {
    identityMetadata: configuration.identityMetadata ?? profile.pillars.identityMetadata,
    networkContext: configuration.networkContext,
    hardwareFingerprint: configuration.hardwareFingerprint,
    authenticationState: profile.pillars.authenticationState,
    behavioralPersona: configuration.behavioralPersona,
    temporalRoutine: configuration.temporalRoutine,
    safetyThresholds: configuration.safetyThresholds,
    contentAffinities: configuration.contentAffinities
  };

  return touch({
    ...profile,
    status: nextStatus,
    pillars
  }, now);
}

export function attachProvisioningToken(
  profile: ProfileAggregate,
  tokenHash: string,
  expiresAt: Date,
  now: Date
): ProfileAggregate {
  if (profile.status !== "PENDING_LOGIN") {
    throw new InvalidStateTransitionError("Provisioning tokens can only be issued during PENDING_LOGIN");
  }

  assertConfigurationComplete(profile);

  return touch({
    ...profile,
    provisioningTokenHash: tokenHash,
    provisioningTokenExpiresAt: expiresAt
  }, now);
}

export function getProvisioningConfiguration(profile: ProfileAggregate, tokenHash: string, now: Date) {
  assertValidProvisioningToken(profile, tokenHash, now);
  assertConfigurationComplete(profile);

  return {
    profileId: profile.id,
    hardwareFingerprint: profile.pillars.hardwareFingerprint,
    networkContext: profile.pillars.networkContext,
    expiresAt: profile.provisioningTokenExpiresAt
  };
}

export function ingestAuthenticationState(
  profile: ProfileAggregate,
  tokenHash: string,
  authenticationState: AuthenticationState,
  now: Date
): ProfileAggregate {
  assertValidProvisioningToken(profile, tokenHash, now);
  assertTransition(profile.status, "READY");

  return touch({
    ...profile,
    status: "READY",
    provisioningTokenHash: null,
    provisioningTokenExpiresAt: null,
    pillars: {
      ...profile.pillars,
      authenticationState
    }
  }, now);
}

export interface CheckoutProfileInput {
  leaseId: string;
  requestedBy?: string | undefined;
  leaseTtlMinutes: number;
  now: Date;
}

export function checkoutProfile(profile: ProfileAggregate, input: CheckoutProfileInput): CheckoutLease {
  if (profile.status !== "READY") {
    throw new InvalidStateTransitionError("Only READY profiles can be checked out");
  }

  if (profile.nextAvailableWindowAt !== null && profile.nextAvailableWindowAt > input.now) {
    throw new CooldownViolationError("Profile cooldown interval has not elapsed");
  }

  const routine = profile.pillars.temporalRoutine;
  const safety = profile.pillars.safetyThresholds;

  if (routine === null || safety === null) {
    throw new ConfigurationIncompleteError("Temporal routine and safety thresholds are required for checkout");
  }

  if (!isWithinActiveWindow(input.now, routine)) {
    throw new CooldownViolationError("Current localized time is outside the authorized active windows");
  }

  const metrics = resetMetricsIfNewLocalDay(profile.dailySafetyMetrics, input.now, routine.timezone);

  if (metrics.sessionCount >= safety.maxSessionsPerDay) {
    throw new SafetyLimitViolationError("Daily session limit has been reached");
  }

  if (metrics.macroActionCount >= safety.maxMacroActionsPerDay) {
    throw new SafetyLimitViolationError("Daily macro-action limit has been reached");
  }

  assertTransition(profile.status, "BUSY");

  const expiresAt = addMinutes(input.now, input.leaseTtlMinutes);
  const activeLease = input.requestedBy === undefined
    ? { id: input.leaseId, expiresAt }
    : { id: input.leaseId, holder: input.requestedBy, expiresAt };
  const updated = touch({
    ...profile,
    status: "BUSY",
    activeLease,
    dailySafetyMetrics: {
      ...metrics,
      sessionCount: metrics.sessionCount + 1
    }
  }, input.now);

  return {
    leaseId: input.leaseId,
    profile: updated,
    expiresAt
  };
}

export function releaseProfileLease(
  profile: ProfileAggregate,
  leaseId: string,
  sessionDurationMinutes: number,
  macroActionsPerformed: number,
  now: Date
): ProfileAggregate {
  if (profile.status !== "BUSY" || profile.activeLease === null) {
    throw new LeaseConflictError("Profile does not have an active lease");
  }

  if (profile.activeLease.id !== leaseId) {
    throw new LeaseConflictError("Lease identifier does not match the active profile lease");
  }

  const routine = profile.pillars.temporalRoutine;
  const safety = profile.pillars.safetyThresholds;

  if (routine === null || safety === null) {
    throw new ConfigurationIncompleteError("Temporal routine and safety thresholds are required for lease release");
  }

  if (sessionDurationMinutes > safety.maxSessionDurationMinutes) {
    throw new SafetyLimitViolationError("Session duration exceeded the configured maximum");
  }

  const metrics = resetMetricsIfNewLocalDay(profile.dailySafetyMetrics, now, routine.timezone);
  const updatedMetrics: DailySafetyMetrics = {
    ...metrics,
    macroActionCount: metrics.macroActionCount + macroActionsPerformed,
    totalDurationMinutes: metrics.totalDurationMinutes + sessionDurationMinutes
  };

  if (updatedMetrics.macroActionCount > safety.maxMacroActionsPerDay) {
    throw new SafetyLimitViolationError("Macro actions exceeded the configured daily maximum");
  }

  assertTransition(profile.status, "READY");

  return touch({
    ...profile,
    status: "READY",
    activeLease: null,
    dailySafetyMetrics: updatedMetrics,
    nextAvailableWindowAt: addMinutes(now, routine.cooldownMinutes)
  }, now);
}

export function assertTransition(from: ProfileStatus, to: ProfileStatus): void {
  if (!allowedTransitions[from].includes(to)) {
    throw new InvalidStateTransitionError(`Cannot transition profile from ${from} to ${to}`);
  }
}

export function currentLocalDateKey(profile: ProfileAggregate, now: Date): string {
  const routine = profile.pillars.temporalRoutine;
  return routine === null ? "uninitialized" : getLocalTimeSnapshot(now, routine.timezone).dateKey;
}

function createEmptyPillars(identityMetadata: ProfilePillars["identityMetadata"]): ProfilePillars {
  return {
    identityMetadata,
    networkContext: null,
    hardwareFingerprint: null,
    authenticationState: null,
    behavioralPersona: null,
    temporalRoutine: null,
    safetyThresholds: null,
    contentAffinities: null
  };
}

function assertConfigurationComplete(profile: ProfileAggregate): asserts profile is ProfileAggregate & {
  pillars: ProfilePillars & {
    networkContext: NonNullable<ProfilePillars["networkContext"]>;
    hardwareFingerprint: NonNullable<ProfilePillars["hardwareFingerprint"]>;
  };
} {
  if (profile.pillars.networkContext === null || profile.pillars.hardwareFingerprint === null) {
    throw new ConfigurationIncompleteError("Network context and hardware fingerprint are required");
  }
}

function assertValidProvisioningToken(
  profile: ProfileAggregate,
  tokenHash: string,
  now: Date
): asserts profile is ProfileAggregate & {
  provisioningTokenHash: string;
  provisioningTokenExpiresAt: Date;
} {
  if (
    profile.status !== "PENDING_LOGIN" ||
    profile.provisioningTokenHash === null ||
    profile.provisioningTokenExpiresAt === null ||
    profile.provisioningTokenHash !== tokenHash ||
    profile.provisioningTokenExpiresAt <= now
  ) {
    throw new InvalidProvisioningTokenError();
  }
}

function sameFingerprint(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function touch(profile: ProfileAggregate, now: Date): ProfileAggregate {
  return {
    ...profile,
    version: profile.version + 1,
    updatedAt: now
  };
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}
