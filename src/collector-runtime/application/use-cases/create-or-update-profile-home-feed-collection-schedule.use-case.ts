import {
  ProfileHomeFeedCollectionScheduleValidationError,
  ProfileNotFoundError,
  ProfileReferenceLookupFailedError,
} from "../application-errors";
import {
  toProfileHomeFeedCollectionScheduleIsoDateTime,
  validateProfileHomeFeedCollectionScheduleForApplication,
  validateProfileHomeFeedCollectionScheduleParametersForApplication,
} from "../profile-home-feed-collection-schedule-validation";
import type { Clock } from "../ports/clock.port";
import type { ProfileHomeFeedCollectionScheduleRepository } from "../ports/profile-home-feed-collection-schedule-repository.port";
import type {
  ProfileReferencePort,
  ProfileReferenceResult,
} from "../ports/profile-reference.port";
import {
  ProfileHomeFeedCollectionScheduleIntervalMinutesSchema,
  ProfileHomeFeedCollectionScheduleIsoDateTimeSchema,
  ProfileHomeFeedCollectionScheduleProfileIdSchema,
} from "../../domain";
import type {
  ProfileHomeFeedCollectionRunParameters,
  ProfileHomeFeedCollectionSchedule,
  ProfileHomeFeedCollectionScheduleProfileId,
  ValidationIssue,
} from "../../domain";

export interface CreateOrUpdateProfileHomeFeedCollectionScheduleInput {
  readonly profileId: string;
  readonly enabled: boolean;
  readonly intervalMinutes: number;
  readonly nextRunAt: string;
  readonly maxScrolls?: number;
  readonly maxDurationMs?: number;
  readonly maxPosts?: number;
}

export class CreateOrUpdateProfileHomeFeedCollectionScheduleUseCase {
  public constructor(
    private readonly schedules: ProfileHomeFeedCollectionScheduleRepository,
    private readonly profiles: ProfileReferencePort,
    private readonly clock: Clock,
  ) {}

  public async execute(
    input: CreateOrUpdateProfileHomeFeedCollectionScheduleInput,
  ): Promise<ProfileHomeFeedCollectionSchedule> {
    const profileId = validateProfileId(input.profileId);
    const enabled = validateEnabled(input.enabled);
    const intervalMinutes = validateIntervalMinutes(input.intervalMinutes);
    const nextRunAt = validateNextRunAt(input.nextRunAt);
    const parameters =
      validateProfileHomeFeedCollectionScheduleParametersForApplication(
        toParameters(input),
      );

    await this.validateProfileExists(profileId);

    const now = toProfileHomeFeedCollectionScheduleIsoDateTime(
      this.clock.now(),
    );
    const existing = await this.schedules.findByProfileId(profileId);
    const schedule = validateProfileHomeFeedCollectionScheduleForApplication({
      profileId,
      enabled,
      intervalMinutes,
      nextRunAt,
      parameters,
      ...(existing?.lastAttemptedAt !== undefined
        ? { lastAttemptedAt: existing.lastAttemptedAt }
        : {}),
      ...(existing?.lastDispatchStatus !== undefined
        ? { lastDispatchStatus: existing.lastDispatchStatus }
        : {}),
      ...(existing?.lastFailureReason !== undefined
        ? { lastFailureReason: existing.lastFailureReason }
        : {}),
      consecutiveFailures: existing?.consecutiveFailures ?? 0,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });

    await this.schedules.save(schedule);

    return schedule;
  }

  private async validateProfileExists(
    profileId: ProfileHomeFeedCollectionScheduleProfileId,
  ): Promise<void> {
    let result: ProfileReferenceResult;
    try {
      result = await this.profiles.getProfileAccountStage(profileId);
    } catch {
      throw new ProfileReferenceLookupFailedError(
        profileId,
        "Could not safely look up profile.",
      );
    }

    if (!result.ok) {
      if (
        result.errorCode === "PROFILE_NOT_FOUND" ||
        result.statusCode === 404
      ) {
        throw new ProfileNotFoundError(profileId);
      }

      throw new ProfileReferenceLookupFailedError(
        profileId,
        "Profile Manager returned an error.",
        {
          causeCode: result.errorCode,
          ...(result.statusCode !== undefined
            ? { statusCode: result.statusCode }
            : {}),
        },
      );
    }

    if (result.profileId !== profileId) {
      throw new ProfileReferenceLookupFailedError(
        profileId,
        "Profile Manager returned a mismatched profile ID.",
      );
    }
  }
}

function toParameters(
  input: CreateOrUpdateProfileHomeFeedCollectionScheduleInput,
): ProfileHomeFeedCollectionRunParameters {
  return {
    ...(input.maxScrolls !== undefined ? { maxScrolls: input.maxScrolls } : {}),
    ...(input.maxDurationMs !== undefined
      ? { maxDurationMs: input.maxDurationMs }
      : {}),
    ...(input.maxPosts !== undefined ? { maxPosts: input.maxPosts } : {}),
  };
}

function validateProfileId(
  profileId: unknown,
): ProfileHomeFeedCollectionScheduleProfileId {
  const result =
    ProfileHomeFeedCollectionScheduleProfileIdSchema.safeParse(profileId);

  if (!result.success) {
    throw new ProfileHomeFeedCollectionScheduleValidationError(
      formatIssues("profileId", "profileId must be a non-empty string."),
    );
  }

  return result.data;
}

function validateEnabled(enabled: unknown): boolean {
  if (typeof enabled !== "boolean") {
    throw new ProfileHomeFeedCollectionScheduleValidationError(
      formatIssues("enabled", "enabled must be a boolean."),
    );
  }

  return enabled;
}

function validateIntervalMinutes(intervalMinutes: unknown): number {
  const result =
    ProfileHomeFeedCollectionScheduleIntervalMinutesSchema.safeParse(
      intervalMinutes,
    );

  if (!result.success) {
    throw new ProfileHomeFeedCollectionScheduleValidationError(
      formatIssues(
        "intervalMinutes",
        "intervalMinutes must be an integer between 1 and 10080.",
      ),
    );
  }

  return result.data;
}

function validateNextRunAt(
  nextRunAt: unknown,
): ProfileHomeFeedCollectionSchedule["nextRunAt"] {
  const result =
    ProfileHomeFeedCollectionScheduleIsoDateTimeSchema.safeParse(nextRunAt);

  if (!result.success) {
    throw new ProfileHomeFeedCollectionScheduleValidationError(
      formatIssues(
        "nextRunAt",
        "nextRunAt must be a valid ISO-8601 datetime with offset.",
      ),
    );
  }

  return result.data;
}

function formatIssues(
  path: string,
  message: string,
): readonly ValidationIssue[] {
  return [{ path, message }];
}
