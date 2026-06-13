import { transitionCollectorProfileStatus } from "./profile";
import type { CollectorProfile } from "./profile";
import type { ProfileLease, ProfileLeasePurpose } from "./profile-lease";
import type {
  ActiveTimeWindow,
  DailySafetyUsage,
  DayOfWeek,
  IsoDateTime,
  LocalDate,
} from "./profile-properties";

export type CheckoutIneligibilityReasonCode =
  | "PROFILE_NOT_READY"
  | "ACCOUNT_STAGE_NOT_COLLECTION_READY"
  | "ACCOUNT_STAGE_NOT_EXERCISE_ELIGIBLE"
  | "AUTHENTICATION_MISSING"
  | "AUTHENTICATION_EXPIRED"
  | "NETWORK_CONTEXT_MISSING"
  | "HARDWARE_FINGERPRINT_MISSING"
  | "INVALID_TEMPORAL_ROUTINE"
  | "OUTSIDE_ACTIVE_WINDOW"
  | "COOLDOWN_ACTIVE"
  | "INVALID_SAFETY_THRESHOLDS"
  | "DAILY_SESSION_LIMIT_REACHED"
  | "DAILY_ACTIVE_DURATION_LIMIT_REACHED"
  | "DAILY_MACRO_ACTION_LIMIT_REACHED"
  | "SOURCE_ACCESS_UNSUCCESSFUL";

export interface CheckoutIneligibilityReason {
  readonly code: CheckoutIneligibilityReasonCode;
  readonly message: string;
  readonly availableAt?: IsoDateTime;
}

export type CheckoutEligibilityResult =
  | {
      readonly eligible: true;
      readonly localDate: LocalDate;
    }
  | {
      readonly eligible: false;
      readonly reasons: readonly CheckoutIneligibilityReason[];
      readonly localDate?: LocalDate;
    };

export interface CheckoutEligibilityOptions {
  readonly purpose?: ProfileLeasePurpose;
}

interface LocalTemporalContext {
  readonly localDate: LocalDate;
  readonly dayOfWeek: DayOfWeek;
  readonly minuteOfDay: number;
}

export function evaluateCheckoutEligibility(
  profile: CollectorProfile,
  now: Date,
  options: CheckoutEligibilityOptions = {},
): CheckoutEligibilityResult {
  const reasons: CheckoutIneligibilityReason[] = [];
  const purpose = options.purpose ?? "COLLECTION";

  if (profile.identity.status !== "READY") {
    reasons.push({
      code: "PROFILE_NOT_READY",
      message: "Profile must be READY before checkout.",
    });
  }

  if (
    purpose === "COLLECTION" &&
    profile.identity.accountStage !== "COLLECTION_READY"
  ) {
    reasons.push({
      code: "ACCOUNT_STAGE_NOT_COLLECTION_READY",
      message:
        "Profile account stage must be COLLECTION_READY before checkout.",
    });
  }

  if (
    purpose === "AMBIENT_EXERCISE" &&
    !isAccountStageEligibleForAmbientExercise(profile.identity.accountStage)
  ) {
    reasons.push({
      code: "ACCOUNT_STAGE_NOT_EXERCISE_ELIGIBLE",
      message:
        "Profile account stage must allow ambient exercise before exercise checkout.",
    });
  }

  if (
    profile.authenticationState.sessionCapturedAt === null ||
    profile.authenticationState.cookies.length === 0
  ) {
    reasons.push({
      code: "AUTHENTICATION_MISSING",
      message: "Profile requires a captured authentication session.",
    });
  } else if (
    profile.authenticationState.sessionExpiresAt !== null &&
    Date.parse(profile.authenticationState.sessionExpiresAt) <= now.getTime()
  ) {
    reasons.push({
      code: "AUTHENTICATION_EXPIRED",
      message: "Profile authentication session is expired.",
    });
  }

  if (profile.networkContext.proxy === null) {
    reasons.push({
      code: "NETWORK_CONTEXT_MISSING",
      message: "Profile requires a configured network context.",
    });
  }

  if (profile.hardwareFingerprint === null) {
    reasons.push({
      code: "HARDWARE_FINGERPRINT_MISSING",
      message: "Profile requires an assigned hardware fingerprint.",
    });
  }

  const localContext = getLocalTemporalContext(
    profile.temporalRoutine.timezone,
    now,
  );

  if (
    profile.temporalRoutine.timezone.trim() === "" ||
    profile.temporalRoutine.activeWindows.length === 0 ||
    localContext === null
  ) {
    reasons.push({
      code: "INVALID_TEMPORAL_ROUTINE",
      message: "Profile requires a valid timezone and active window.",
    });
  } else if (!isInsideAnyActiveWindow(localContext, profile.temporalRoutine.activeWindows)) {
    reasons.push({
      code: "OUTSIDE_ACTIVE_WINDOW",
      message: "Current localized time is outside the profile active windows.",
    });
  }

  const cooldownAvailableAt = getCooldownAvailableAt(profile, now);

  if (
    cooldownAvailableAt !== null &&
    cooldownAvailableAt.getTime() > now.getTime()
  ) {
    reasons.push({
      code: "COOLDOWN_ACTIVE",
      message: "Profile cooldown has not elapsed.",
      availableAt: toIsoDateTime(cooldownAvailableAt),
    });
  }

  if (hasInvalidSafetyThresholds(profile)) {
    reasons.push({
      code: "INVALID_SAFETY_THRESHOLDS",
      message: "Profile safety thresholds must be positive before checkout.",
    });
  } else if (localContext !== null) {
    const usage = getDailySafetyUsageForDate(
      profile.identity.dailyUsage,
      localContext.localDate,
    );

    if (usage.sessionsStarted >= profile.safetyThresholds.maxSessionsPerDay) {
      reasons.push({
        code: "DAILY_SESSION_LIMIT_REACHED",
        message: "Profile daily session limit has been reached.",
      });
    }

    if (
      usage.activeDurationMinutes >=
      profile.safetyThresholds.maxSessionDurationMinutes
    ) {
      reasons.push({
        code: "DAILY_ACTIVE_DURATION_LIMIT_REACHED",
        message: "Profile daily active duration limit has been reached.",
      });
    }

    if (usage.macroActions >= profile.safetyThresholds.maxMacroActionsPerDay) {
      reasons.push({
        code: "DAILY_MACRO_ACTION_LIMIT_REACHED",
        message: "Profile daily macro action limit has been reached.",
      });
    }
  }

  if (reasons.length > 0) {
    if (localContext === null) {
      return {
        eligible: false,
        reasons,
      };
    }

    return {
      eligible: false,
      reasons,
      localDate: localContext.localDate,
    };
  }

  if (localContext === null) {
    return {
      eligible: false,
      reasons: [
        {
          code: "INVALID_TEMPORAL_ROUTINE",
          message: "Profile requires a valid timezone and active window.",
        },
      ],
    };
  }

  return {
    eligible: true,
    localDate: localContext.localDate,
  };
}

function isAccountStageEligibleForAmbientExercise(
  accountStage: CollectorProfile["identity"]["accountStage"],
): boolean {
  return (
    accountStage === "NEW_ACCOUNT" ||
    accountStage === "WARMING" ||
    accountStage === "LIMITED" ||
    accountStage === "COLLECTION_READY"
  );
}

export function markProfileCheckedOut(
  profile: CollectorProfile,
  checkedOutAt: Date,
  localDate: LocalDate,
): CollectorProfile {
  const checkedOutAtIso = toIsoDateTime(checkedOutAt);
  const dailyUsage = getDailySafetyUsageForDate(
    profile.identity.dailyUsage,
    localDate,
  );
  const busyProfile = transitionCollectorProfileStatus(
    profile,
    "BUSY",
    checkedOutAtIso,
  );

  return {
    ...busyProfile,
    identity: {
      ...busyProfile.identity,
      lastCheckoutAt: checkedOutAtIso,
      dailyUsage: {
        ...dailyUsage,
        sessionsStarted: dailyUsage.sessionsStarted + 1,
      },
    },
  };
}

export function markProfileReleasedFromLease(
  profile: CollectorProfile,
  lease: ProfileLease,
  releasedAt: Date,
  localDate: LocalDate,
  macroActionsPerformed: number,
): CollectorProfile {
  const releasedAtIso = toIsoDateTime(releasedAt);
  const readyProfile = transitionCollectorProfileStatus(
    profile,
    "READY",
    releasedAtIso,
  );
  const dailyUsage = getDailySafetyUsageForDate(
    readyProfile.identity.dailyUsage,
    localDate,
  );
  const activeDurationMinutes = calculateLeaseActiveDurationMinutes(
    lease,
    releasedAt,
  );
  const nextAvailableAt = calculateNextAvailableAt(profile, releasedAt);

  return {
    ...readyProfile,
    identity: {
      ...readyProfile.identity,
      lastReleasedAt: releasedAtIso,
      nextAvailableAt: toIsoDateTime(nextAvailableAt),
      dailyUsage: {
        ...dailyUsage,
        activeDurationMinutes:
          dailyUsage.activeDurationMinutes + activeDurationMinutes,
        macroActions: dailyUsage.macroActions + macroActionsPerformed,
      },
    },
  };
}

export function getDailySafetyUsageForDate(
  usage: DailySafetyUsage,
  localDate: LocalDate,
): DailySafetyUsage {
  if (usage.localDate === localDate) {
    return usage;
  }

  return {
    localDate,
    sessionsStarted: 0,
    activeDurationMinutes: 0,
    macroActions: 0,
  };
}

export function getProfileLocalDate(
  profile: CollectorProfile,
  now: Date,
): LocalDate | null {
  return getLocalTemporalContext(profile.temporalRoutine.timezone, now)
    ?.localDate ?? null;
}

export function toUtcDateString(date: Date): LocalDate {
  return date.toISOString().slice(0, 10);
}

export function calculateLeaseExpiresAt(
  profile: CollectorProfile,
  leasedAt: Date,
): Date {
  return new Date(
    leasedAt.getTime() +
      profile.safetyThresholds.maxSessionDurationMinutes * 60 * 1000,
  );
}

function getLocalTemporalContext(
  timezone: string,
  now: Date,
): LocalTemporalContext | null {
  if (timezone.trim() === "") {
    return null;
  }

  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const year = Number(getDateTimePart(parts, "year"));
    const month = Number(getDateTimePart(parts, "month"));
    const day = Number(getDateTimePart(parts, "day"));
    const hour = Number(getDateTimePart(parts, "hour"));
    const minute = Number(getDateTimePart(parts, "minute"));

    if (
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      !Number.isInteger(day) ||
      !Number.isInteger(hour) ||
      !Number.isInteger(minute)
    ) {
      return null;
    }

    const localDate = `${year}-${pad2(month)}-${pad2(day)}`;
    const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

    return {
      localDate,
      dayOfWeek: dayOfWeek as DayOfWeek,
      minuteOfDay: normalizeHour(hour) * 60 + minute,
    };
  } catch (error) {
    if (error instanceof RangeError) {
      return null;
    }

    throw error;
  }
}

function isInsideAnyActiveWindow(
  context: LocalTemporalContext,
  activeWindows: readonly ActiveTimeWindow[],
): boolean {
  return activeWindows.some((window) => isInsideActiveWindow(context, window));
}

function isInsideActiveWindow(
  context: LocalTemporalContext,
  activeWindow: ActiveTimeWindow,
): boolean {
  const startsAt = localTimeToMinuteOfDay(activeWindow.startsAt);
  const endsAt = localTimeToMinuteOfDay(activeWindow.endsAt);

  if (startsAt === endsAt) {
    return includesDay(activeWindow.days, context.dayOfWeek);
  }

  if (startsAt < endsAt) {
    return (
      includesDay(activeWindow.days, context.dayOfWeek) &&
      context.minuteOfDay >= startsAt &&
      context.minuteOfDay < endsAt
    );
  }

  return (
    (includesDay(activeWindow.days, context.dayOfWeek) &&
      context.minuteOfDay >= startsAt) ||
    (includesDay(activeWindow.days, previousDay(context.dayOfWeek)) &&
      context.minuteOfDay < endsAt)
  );
}

function getCooldownAvailableAt(
  profile: CollectorProfile,
  now: Date,
): Date | null {
  const candidates: number[] = [];

  if (profile.identity.nextAvailableAt !== null) {
    candidates.push(Date.parse(profile.identity.nextAvailableAt));
  }

  if (profile.identity.lastReleasedAt !== null) {
    candidates.push(
      Date.parse(profile.identity.lastReleasedAt) +
        calculateRequiredCooldownMinutes(profile) * 60 * 1000,
    );
  }

  const validCandidates = candidates.filter((candidate) =>
    Number.isFinite(candidate),
  );

  if (validCandidates.length === 0) {
    return null;
  }

  const availableAtMs = Math.max(...validCandidates);

  if (availableAtMs <= now.getTime()) {
    return null;
  }

  return new Date(availableAtMs);
}

function calculateNextAvailableAt(
  profile: CollectorProfile,
  releasedAt: Date,
): Date {
  return new Date(
    releasedAt.getTime() + calculateRequiredCooldownMinutes(profile) * 60 * 1000,
  );
}

function calculateRequiredCooldownMinutes(profile: CollectorProfile): number {
  return Math.max(
    profile.temporalRoutine.cooldownMinutes,
    profile.safetyThresholds.minCooldownMinutes,
  );
}

function calculateLeaseActiveDurationMinutes(
  lease: ProfileLease,
  releasedAt: Date,
): number {
  const leasedAtMs = Date.parse(lease.leasedAt);
  const durationMs = Math.max(0, releasedAt.getTime() - leasedAtMs);

  return Math.ceil(durationMs / 60_000);
}

function hasInvalidSafetyThresholds(profile: CollectorProfile): boolean {
  return (
    profile.safetyThresholds.maxSessionsPerDay <= 0 ||
    profile.safetyThresholds.maxSessionDurationMinutes <= 0 ||
    profile.safetyThresholds.maxMacroActionsPerDay <= 0
  );
}

function localTimeToMinuteOfDay(localTime: string): number {
  return Number(localTime.slice(0, 2)) * 60 + Number(localTime.slice(3, 5));
}

function includesDay(days: readonly DayOfWeek[], day: DayOfWeek): boolean {
  return days.some((candidate) => candidate === day);
}

function previousDay(day: DayOfWeek): DayOfWeek {
  return (((day + 6) % 7) as DayOfWeek);
}

function normalizeHour(hour: number): number {
  return hour === 24 ? 0 : hour;
}

function getDateTimePart(
  parts: readonly { readonly type: string; readonly value: string }[],
  type: string,
): string | null {
  return parts.find((part) => part.type === type)?.value ?? null;
}

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

function toIsoDateTime(date: Date): IsoDateTime {
  return date.toISOString();
}
